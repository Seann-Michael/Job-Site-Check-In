import { Router, Request, Response, RequestHandler } from "express";
import multer from "multer";
import crypto from "crypto";
import path from "path";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";
import { requireAuth, requireWrite } from "../middleware/requireAuth";

/**
 * Media: real multipart uploads into the Supabase Storage bucket `media`
 * under `<account_id>/<uuid>.<ext>`, metadata in `server_media_metadata`.
 *
 * Account scoping comes from the authenticated profile
 * (users.sub_account_id, falling back to the user id), never from headers.
 * Upload and delete require a write role (viewer -> 403).
 *
 * The bucket is PRIVATE: every URL returned here is a short-lived signed URL
 * (see docs/MEDIA_STORAGE.md). Thumbnail endpoints were removed: nothing
 * generated thumbnails, so they always 404'd.
 */

const BUCKET = "media";
const MAX_BYTES = 25 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
/** Mounted under /api so it survives the DO /api/* routing rule. */
const PUBLIC_MEDIA_BASE = "/api/public/media";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "video/mp4",
  "video/quicktime",
  "video/webm",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

const log = logger.child({ module: "media" });
/** Request-scoped logger (carries req.id) when available. */
const reqLog = (req: Request) => (req.log ?? log).child({ module: "media" });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error("UNSUPPORTED_MEDIA_TYPE"));
  },
});

interface MediaRow {
  id: string;
  original_name: string;
  stored_path: string;
  mime_type: string;
  size: number;
  account_id: string;
  job_id: string | null;
  media_type: string;
  is_public: boolean;
  public_url_id: string | null;
  uploaded_at: string;
  uploaded_by: string;
}

function accountIdOf(req: Request): string {
  return req.profile?.accountId || req.profile?.id || "";
}

function canAccess(req: Request, row: MediaRow): boolean {
  if (row.account_id === accountIdOf(req)) return true;
  return (req.profile?.role || "").toLowerCase().replace(/[^a-z]/g, "") === "superadmin";
}

function sanitizeFilename(name: string): string {
  const base = path.basename(name || "upload").replace(/[^\w.\- ]+/g, "_").slice(0, 180);
  return base || "upload";
}

async function getRow(mediaId: string): Promise<MediaRow | null> {
  const db = getSupabaseClient();
  const { data } = await db.from("server_media_metadata").select("*").eq("id", mediaId).maybeSingle();
  return (data as MediaRow | null) ?? null;
}

async function signedUrlFor(storedPath: string): Promise<string | null> {
  const { data, error } = await getSupabaseClient()
    .storage.from(BUCKET)
    .createSignedUrl(storedPath, SIGNED_URL_TTL_SECONDS);
  if (error) {
    log.error({ err: error }, "createSignedUrl failed");
    return null;
  }
  return data.signedUrl;
}

/**
 * Wire shape. `url` is a short-lived signed URL (the bucket is private, so
 * there is no public object URL to hand out); callers that need something
 * stable use `secureUrl` (auth) or `publicUrl` (is_public rows only), both of
 * which 302 to a fresh signed URL.
 */
async function serialize(row: MediaRow) {
  const encodedName = encodeURIComponent(row.original_name);
  return {
    id: row.id,
    originalName: row.original_name,
    mimeType: row.mime_type,
    size: row.size,
    mediaType: row.media_type,
    isPublic: row.is_public,
    jobId: row.job_id,
    projectId: row.job_id,
    storagePath: row.stored_path,
    uploadedAt: row.uploaded_at,
    uploadedBy: row.uploaded_by,
    secureUrl: `/api/media/${row.id}/${encodedName}`,
    publicUrl: row.is_public && row.public_url_id ? `${PUBLIC_MEDIA_BASE}/${row.public_url_id}/${encodedName}` : "",
    url: (await signedUrlFor(row.stored_path)) || "",
  };
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * POST /api/media/upload  (auth, multipart/form-data)
 * field `file` (required); text fields: mediaType?, jobId?|projectId?, isPublic?
 */
export const handleMediaUpload: RequestHandler = async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file uploaded (expected multipart field 'file')" });

  const accountId = accountIdOf(req);
  if (!accountId) return res.status(403).json({ error: "No account associated with this user" });

  const mediaType = typeof req.body?.mediaType === "string" && req.body.mediaType
    ? req.body.mediaType.slice(0, 40)
    : file.mimetype.startsWith("video/") ? "video" : "image";
  const jobId = typeof req.body?.jobId === "string" && req.body.jobId
    ? req.body.jobId
    : typeof req.body?.projectId === "string" && req.body.projectId ? req.body.projectId : null;
  const isPublic = req.body?.isPublic === "true" || req.body?.isPublic === true || req.body?.isPublic === "1";

  const id = crypto.randomUUID();
  const ext = EXT_BY_MIME[file.mimetype] || path.extname(file.originalname).replace(".", "").toLowerCase() || "bin";
  const storedPath = `${accountId}/${id}.${ext}`;
  const originalName = sanitizeFilename(file.originalname);

  const db = getSupabaseClient();
  const { error: uploadError } = await db.storage.from(BUCKET).upload(storedPath, file.buffer, {
    contentType: file.mimetype,
    cacheControl: "31536000",
    upsert: false,
  });
  if (uploadError) {
    reqLog(req).error({ err: uploadError }, "Storage upload failed");
    return res.status(502).json({ error: "Upload to storage failed" });
  }

  const row: MediaRow = {
    id,
    original_name: originalName,
    stored_path: storedPath,
    mime_type: file.mimetype,
    size: file.size,
    account_id: accountId,
    job_id: jobId,
    media_type: mediaType,
    is_public: isPublic,
    public_url_id: isPublic ? crypto.randomBytes(12).toString("hex") : null,
    uploaded_at: new Date().toISOString(),
    uploaded_by: req.profile?.email || req.user?.email || req.user?.id || "unknown",
  };

  const { error: dbError } = await db.from("server_media_metadata").insert(row);
  if (dbError) {
    reqLog(req).error({ err: dbError }, "server_media_metadata insert failed");
    await db.storage.from(BUCKET).remove([storedPath]).catch(() => undefined);
    return res.status(500).json({ error: "Failed to record upload" });
  }

  res.status(201).json({ success: true, mediaFile: await serialize(row) });
};

/** GET /api/media/metadata/:mediaId  (auth) */
export const handleMediaMetadata: RequestHandler = async (req, res) => {
  const row = await getRow(req.params.mediaId);
  if (!row || !canAccess(req, row)) return res.status(404).json({ error: "Media file not found" });
  res.json(await serialize(row));
};

/** GET /api/media/:mediaId/:filename  (auth) -> 302 to a short-lived signed URL */
export const handleSecureMedia: RequestHandler = async (req, res) => {
  const row = await getRow(req.params.mediaId);
  if (!row || !canAccess(req, row)) return res.status(404).json({ error: "Media file not found" });
  const url = await signedUrlFor(row.stored_path);
  if (!url) return res.status(502).json({ error: "Could not generate media URL" });
  res.setHeader("Cache-Control", "private, no-store");
  res.redirect(302, url);
};

/**
 * GET /api/public/media/:publicId/:filename  (public) -> 302 to a short-lived
 * signed URL, only for rows flagged is_public. Mounted by routes/publicContent.
 */
export const handlePublicMedia: RequestHandler = async (req, res) => {
  const db = getSupabaseClient();
  const { data } = await db
    .from("server_media_metadata")
    .select("*")
    .eq("public_url_id", req.params.publicId)
    .eq("is_public", true)
    .maybeSingle();
  const row = data as MediaRow | null;
  if (!row) return res.status(404).json({ error: "Media file not found" });
  const url = await signedUrlFor(row.stored_path);
  if (!url) return res.status(502).json({ error: "Could not generate media URL" });
  // The redirect target expires, so cache well under the signed TTL.
  res.setHeader("Cache-Control", `public, max-age=${Math.floor(SIGNED_URL_TTL_SECONDS / 2)}`);
  res.redirect(302, url);
};

/** DELETE /api/media/:mediaId  (auth) */
export const handleMediaDelete: RequestHandler = async (req, res) => {
  const row = await getRow(req.params.mediaId);
  if (!row || !canAccess(req, row)) return res.status(404).json({ error: "Media file not found" });
  const db = getSupabaseClient();
  const { error: rmError } = await db.storage.from(BUCKET).remove([row.stored_path]);
  if (rmError) reqLog(req).warn({ err: rmError }, "Storage remove failed (continuing)");
  const { error } = await db.from("server_media_metadata").delete().eq("id", row.id);
  if (error) {
    reqLog(req).error({ err: error }, "server_media_metadata delete failed");
    return res.status(500).json({ error: "Failed to delete media" });
  }
  res.json({ success: true });
};

/** GET /api/media  (auth) ?jobId=  -> list the caller's media */
export const handleMediaList: RequestHandler = async (req, res) => {
  const db = getSupabaseClient();
  let q = db
    .from("server_media_metadata")
    .select("*")
    .eq("account_id", accountIdOf(req))
    .order("uploaded_at", { ascending: false })
    .limit(200);
  if (typeof req.query.jobId === "string" && req.query.jobId) q = q.eq("job_id", req.query.jobId);
  const { data, error } = await q;
  if (error) {
    reqLog(req).error({ err: error }, "media list failed");
    return res.status(500).json({ error: "Failed to list media" });
  }
  res.json({ media: await Promise.all(((data as MediaRow[]) || []).map(serialize)) });
};

// ── Router ───────────────────────────────────────────────────────────────────

/** Authenticated media API, mount at /api/media */
export const mediaRouter = Router();
mediaRouter.use(requireAuth);
mediaRouter.get("/", handleMediaList);
mediaRouter.post(
  "/upload",
  requireWrite,
  (req, res, next) =>
    upload.single("file")(req, res, (err: any) => {
      if (!err) return next();
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: "File too large (max 25MB)" });
      }
      if (err?.message === "UNSUPPORTED_MEDIA_TYPE") {
        return res.status(415).json({ error: "Unsupported file type (images and videos only)" });
      }
      reqLog(req).warn({ err }, "multer rejected upload");
      return res.status(400).json({ error: "Invalid upload" });
    }),
  wrap(handleMediaUpload),
);
mediaRouter.get("/metadata/:mediaId", wrap(handleMediaMetadata));
mediaRouter.delete("/:mediaId", requireWrite, wrap(handleMediaDelete));
mediaRouter.get("/:mediaId/:filename", wrap(handleSecureMedia));

/**
 * Public media redirects. Canonical mount is /api/public/media (via
 * routes/publicContent); this router is kept for the legacy /public/media mount.
 */
export const publicMediaRouter = Router();
publicMediaRouter.get("/:publicId/:filename", wrap(handlePublicMedia));

function wrap(h: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(h(req, res, next)).catch(next);
}
