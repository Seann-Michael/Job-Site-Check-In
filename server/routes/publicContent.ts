import { Router, RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";
import { handlePublicMedia } from "./media";

/**
 * Unauthenticated read endpoints for public share pages (mount at /api/public).
 *
 * The `media` storage bucket is private and anon cannot sign URLs, so the
 * server (service role) calls the same SECURITY DEFINER RPCs the pages used to
 * call directly and attaches short-lived signed URLs for the object keys those
 * RPCs return. Nothing is signed that the RPC did not hand back, so the RPCs
 * remain the single source of truth for what is public.
 */

const MEDIA_BUCKET = "media";
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const PUBLIC_MARKER = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const log = logger.child({ module: "publicContent" });

export const publicContentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

/** Object key inside `media` for a stored value (bare key or legacy public URL); null otherwise. */
export function mediaObjectKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) {
    const idx = v.indexOf(PUBLIC_MARKER);
    if (idx === -1) return null;
    const key = v.slice(idx + PUBLIC_MARKER.length).split("?")[0];
    try {
      return decodeURIComponent(key) || null;
    } catch {
      return key || null;
    }
  }
  if (/^(blob|data):/i.test(v)) return null;
  return v.replace(/^\/+/, "").replace(/^media\//, "") || null;
}

/**
 * Sign every `media` key in `values`; values that are not `media` objects
 * (e.g. `public-assets` URLs) pass through unchanged. Order is preserved and
 * entries that fail to sign are dropped.
 */
export async function signMediaValues(values: unknown[]): Promise<string[]> {
  const out: (string | null)[] = values.map((v) => (typeof v === "string" && v ? v : null));
  const keys: { index: number; key: string }[] = [];
  out.forEach((v, index) => {
    const key = mediaObjectKey(v);
    if (key) keys.push({ index, key });
  });
  if (keys.length > 0) {
    const { data, error } = await getSupabaseClient()
      .storage.from(MEDIA_BUCKET)
      .createSignedUrls(
        keys.map((k) => k.key),
        SIGNED_URL_TTL_SECONDS,
      );
    if (error || !data) {
      log.error({ err: error }, "createSignedUrls failed");
      for (const k of keys) out[k.index] = null;
    } else {
      keys.forEach((k, i) => {
        const item = data[i];
        out[k.index] = item && !item.error && item.signedUrl ? item.signedUrl : null;
      });
    }
  }
  return out.filter((v): v is string => typeof v === "string" && v.length > 0);
}

/** GET /api/public/job/:id -> public_job row + signed photo URLs */
export const handlePublicJob: RequestHandler = async (req, res) => {
  const id = req.params.id;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: "Not found" });

  const { data, error } = await getSupabaseClient().rpc("public_job", { p_id: id });
  if (error) {
    log.error({ err: error }, "public_job rpc failed");
    return res.status(502).json({ error: "Could not load project" });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return res.status(404).json({ error: "Not found" });

  const photoPaths: unknown[] = Array.isArray(row.photo_paths) ? row.photo_paths : [];
  const photos = await signMediaValues(photoPaths);

  const { photo_paths: _omit, ...rest } = row;
  res.setHeader("Cache-Control", "public, max-age=300");
  res.json({ ...rest, photos });
};

/** GET /api/public/review-request/:id -> review_request_public passthrough */
export const handlePublicReviewRequest: RequestHandler = async (req, res) => {
  const id = req.params.id;
  if (!UUID_RE.test(id)) return res.status(404).json({ error: "Not found" });

  const { data, error } = await getSupabaseClient().rpc("review_request_public", { p_id: id });
  if (error) {
    log.error({ err: error }, "review_request_public rpc failed");
    return res.status(502).json({ error: "Could not load review request" });
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return res.status(404).json({ error: "Not found" });

  // Video / logo normally live in the public `public-assets` bucket. A legacy
  // value still pointing at the private `media` bucket gets signed instead.
  const settings = { ...(row.settings || {}) } as Record<string, unknown>;
  for (const key of ["reviewGateVideoUrl", "logoUrl", "reviewGateLogoUrl", "businessLogo"]) {
    if (mediaObjectKey(settings[key])) {
      const [signed] = await signMediaValues([settings[key]]);
      if (signed) settings[key] = signed;
      else delete settings[key];
    }
  }

  res.setHeader("Cache-Control", "no-store");
  res.json({ ...row, settings });
};

/** Public router, mount at /api/public */
export const publicContentRouter = Router();
publicContentRouter.use(publicContentLimiter);
publicContentRouter.get("/job/:id", wrap(handlePublicJob));
publicContentRouter.get("/review-request/:id", wrap(handlePublicReviewRequest));
// Server-uploaded media flagged public (server_media_metadata.is_public).
publicContentRouter.get("/media/:publicId/:filename", wrap(handlePublicMedia));

function wrap(h: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(h(req, res, next)).catch(next);
}
