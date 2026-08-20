import supabaseClient from "@/lib/supabaseClient";

/**
 * Signed URL helpers for the PRIVATE `media` bucket.
 *
 * `job_media.file_path` / `job_documents.file_path` hold either a bare object
 * key (`project-media/<jobId>/x.jpg`) or the legacy "public URL" form
 * (`https://…/storage/v1/object/public/media/<key>`). Both apps (web + mobile)
 * parse that form back to a key, so it stays the persisted identifier — but it
 * is no longer fetchable now that the bucket is private. Render sites must go
 * through these helpers to obtain a short-lived signed URL.
 *
 * Anything that is not a `media` object (absolute URLs to other hosts, incl.
 * the public `public-assets` bucket, blob:/data: URLs) is returned unchanged.
 */

const MEDIA_BUCKET = "media";
const PUBLIC_MARKER = `/storage/v1/object/public/${MEDIA_BUCKET}/`;
const DEFAULT_TTL_SEC = 3600;
/** Refresh a cached URL when less than this fraction of its TTL remains. */
const REFRESH_AT = 0.2;

interface CacheEntry {
  url: string;
  expiresAt: number; // epoch ms
  ttlMs: number;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

/** Object key inside `media` for a stored value, or null if it isn't one. */
export function mediaObjectKey(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(blob|data):/i.test(trimmed)) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    const idx = trimmed.indexOf(PUBLIC_MARKER);
    if (idx === -1) return null; // some other host / bucket — leave as is
    const key = trimmed.slice(idx + PUBLIC_MARKER.length).split("?")[0];
    try {
      return decodeURIComponent(key) || null;
    } catch {
      return key || null;
    }
  }
  // Bare key. Strip a leading slash or a "media/" bucket prefix if present.
  return trimmed.replace(/^\/+/, "").replace(/^media\//, "") || null;
}

/** True when the value points at an object in the private bucket. */
export function isMediaPath(value: string | null | undefined): boolean {
  return mediaObjectKey(value) !== null;
}

function fresh(entry: CacheEntry | undefined): boolean {
  if (!entry) return false;
  return entry.expiresAt - Date.now() > entry.ttlMs * REFRESH_AT;
}

function remember(key: string, url: string, expiresSec: number) {
  const ttlMs = expiresSec * 1000;
  cache.set(key, { url, ttlMs, expiresAt: Date.now() + ttlMs });
}

/**
 * Signed URL for one stored value. Returns the input unchanged when it is not
 * a `media` object, and null when signing fails (no session / not owned).
 */
export async function getSignedMediaUrl(
  path: string | null | undefined,
  expiresSec: number = DEFAULT_TTL_SEC,
): Promise<string | null> {
  if (!path) return null;
  const key = mediaObjectKey(path);
  if (!key) return path;

  const hit = cache.get(key);
  if (hit && fresh(hit)) return hit.url;
  const stale = hit?.url ?? null;

  const pending = inflight.get(key);
  if (pending) return pending;

  const task = (async () => {
    try {
      const { data, error } = await supabaseClient.storage
        .from(MEDIA_BUCKET)
        .createSignedUrl(key, expiresSec);
      if (error || !data?.signedUrl) return stale;
      remember(key, data.signedUrl, expiresSec);
      return data.signedUrl;
    } catch {
      return stale;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, task);
  return task;
}

/**
 * Batch variant. Returns a map from the ORIGINAL input value to its display
 * URL (signed for `media` objects, passthrough otherwise). Inputs that could
 * not be signed are omitted.
 */
export async function getSignedMediaUrls(
  paths: ReadonlyArray<string | null | undefined>,
  expiresSec: number = DEFAULT_TTL_SEC,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const toSign = new Map<string, string[]>(); // key -> original inputs

  for (const p of paths) {
    if (!p) continue;
    const key = mediaObjectKey(p);
    if (!key) {
      out[p] = p;
      continue;
    }
    const hit = cache.get(key);
    if (hit && fresh(hit)) {
      out[p] = hit.url;
      continue;
    }
    const list = toSign.get(key) || [];
    list.push(p);
    toSign.set(key, list);
  }

  if (toSign.size > 0) {
    const keys = [...toSign.keys()];
    try {
      const { data, error } = await supabaseClient.storage
        .from(MEDIA_BUCKET)
        .createSignedUrls(keys, expiresSec);
      if (!error && data) {
        for (const item of data) {
          if (!item.signedUrl || item.error) continue;
          // storage-js echoes the key back as `path`.
          const key = item.path ?? "";
          const originals = toSign.get(key);
          if (!originals) continue;
          remember(key, item.signedUrl, expiresSec);
          for (const o of originals) out[o] = item.signedUrl;
        }
      }
    } catch {
      // fall through — unsigned entries are simply omitted
    }
    // Anything the batch couldn't sign: keep a stale cached URL if we have one.
    for (const [key, originals] of toSign) {
      const stale = cache.get(key);
      if (!stale) continue;
      for (const o of originals) if (!(o in out)) out[o] = stale.url;
    }
  }
  return out;
}

/** Drop every cached signed URL (call on sign-out). */
export function clearSignedMediaUrlCache() {
  cache.clear();
}
