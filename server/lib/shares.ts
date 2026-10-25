/**
 * Project shares: the single pipeline that takes a job's photos + caption and
 * delivers them to every destination the business has turned on.
 *
 * Both apps create a share through POST /api/shares. Delivery happens here —
 * either immediately (run: "now") or from the worker tick (run: "queue").
 * Every destination records its own result, so the apps can show
 * queued / live / failed-with-reason instead of guessing.
 *
 * Destinations:
 *   gbp       — Google Business Profile local post with up to one photo
 *               (Google's post API accepts a single public image URL).
 *   website   — the business's website workflow (project page / gallery);
 *               the workflow id comes from businesses.share_settings.
 *   facebook  — Facebook Page post. Adapter present, delivery requires a Page
 *               token under share_settings.facebook (OAuth lands later); until
 *               then the result is "not_configured" with a human reason.
 *   instagram — same shape as facebook (Instagram Graph via a linked Page).
 */
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "./logger";
import { createLocalPost, GbpNotConnectedError } from "./gbp";
import { runWorkflowById } from "../routes/workflows";

const log = logger.child({ module: "shares" });

export type Destination = "gbp" | "facebook" | "instagram" | "website";
export const DESTINATIONS: Destination[] = ["gbp", "facebook", "instagram", "website"];

export type ShareStatus = "draft" | "queued" | "processing" | "done" | "partial" | "failed";
export type DeliveryStatus = "pending" | "live" | "failed" | "not_configured" | "skipped";

export interface DeliveryResult {
  status: DeliveryStatus;
  /** Plain-English, shown to the user. */
  detail: string;
  external_id?: string;
  url?: string;
  at: string;
}

export interface ShareCaption {
  title?: string;
  gbp?: string;
  facebook?: string;
  instagram?: string;
  website?: string;
  hashtags?: string[];
}

export interface ShareRow {
  id: string;
  business_id: string;
  job_id: string;
  created_by: string | null;
  media_ids: string[];
  destinations: Destination[];
  caption: ShareCaption;
  options: Record<string, any>;
  status: ShareStatus;
  scheduled_for: string | null;
  started_at: string | null;
  finished_at: string | null;
  results: Partial<Record<Destination, DeliveryResult>>;
  attempts: number;
  created_at: string;
  updated_at: string;
}

const BUCKET = "media";
const SIGNED_URL_TTL_SECONDS = 60 * 60; // Google and Meta fetch the image at post time.
const MAX_ATTEMPTS = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function result(status: DeliveryStatus, detail: string, extra: Partial<DeliveryResult> = {}): DeliveryResult {
  return { status, detail, at: now(), ...extra };
}

/** Short-lived public URLs for the selected photos, in the order requested. */
async function signedPhotoUrls(jobId: string, mediaIds: string[]): Promise<Array<{ id: string; url: string }>> {
  if (!mediaIds.length) return [];
  const db = getSupabaseClient();
  const { data, error } = await db
    .from("job_media")
    .select("id, file_path, media_type")
    .eq("job_id", jobId)
    .in("id", mediaIds);
  if (error) throw new Error(`Could not read the project's photos: ${error.message}`);
  const byId = new Map((data ?? []).map((row: any) => [String(row.id), row]));
  const out: Array<{ id: string; url: string }> = [];
  for (const id of mediaIds) {
    const row = byId.get(id);
    if (!row || row.media_type === "video") continue; // posts take photos only
    const { data: signed, error: signErr } = await db.storage
      .from(BUCKET)
      .createSignedUrl(String(row.file_path), SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed?.signedUrl) {
      log.warn({ err: signErr, mediaId: id }, "could not sign photo for share");
      continue;
    }
    out.push({ id, url: signed.signedUrl });
  }
  return out;
}

async function loadShareSettings(businessId: string): Promise<Record<string, any>> {
  const db = getSupabaseClient();
  const { data } = await db.from("businesses").select("share_settings").eq("id", businessId).maybeSingle();
  return (data?.share_settings && typeof data.share_settings === "object" ? data.share_settings : {}) as Record<string, any>;
}

function captionFor(share: ShareRow, dest: Destination): string {
  const c = share.caption || {};
  const base = c[dest] || c.gbp || c.website || c.facebook || c.instagram || "";
  const tags = Array.isArray(c.hashtags) && c.hashtags.length && (dest === "facebook" || dest === "instagram")
    ? "\n\n" + c.hashtags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")
    : "";
  return `${base}${tags}`.trim();
}

// ── Adapters ──────────────────────────────────────────────────────────────────

async function deliverGbp(share: ShareRow, photos: Array<{ id: string; url: string }>): Promise<DeliveryResult> {
  const summary = captionFor(share, "gbp");
  if (!summary) return result("failed", "The post has no text for Google.");
  if (summary.length > 1500) return result("failed", "Google posts are limited to 1,500 characters.");
  try {
    const cta = share.options?.cta && typeof share.options.cta === "object" ? share.options.cta : undefined;
    const post = await createLocalPost(share.business_id, {
      summary,
      ...(cta ? { callToAction: { actionType: String(cta.actionType || "LEARN_MORE"), url: cta.url ? String(cta.url) : undefined } } : {}),
      ...(photos.length ? { media: [{ mediaFormat: "PHOTO", sourceUrl: photos[0].url }] } : {}),
    });
    const name = (post as any)?.name ? String((post as any).name) : undefined;
    const url = (post as any)?.searchUrl ? String((post as any).searchUrl) : undefined;
    return result("live", photos.length ? "Posted to Google with 1 photo." : "Posted to Google.", {
      external_id: name,
      url,
    });
  } catch (err: any) {
    if (err instanceof GbpNotConnectedError) {
      return result("not_configured", "Google Business Profile isn't connected. Connect it under Sharing & destinations.");
    }
    const msg = String(err?.message || "");
    if (/image|media|photo/i.test(msg) && /size|small|large|dimension|invalid/i.test(msg)) {
      return result("failed", "Google rejected the photo (it must be at least 250×250 and under 10 MB). Remove it or pick another.");
    }
    log.error({ err, shareId: share.id }, "gbp delivery failed");
    return result("failed", "Google didn't accept the post. Try again in a few minutes.");
  }
}

async function deliverWebsite(share: ShareRow, photos: Array<{ id: string; url: string }>, settings: Record<string, any>): Promise<DeliveryResult> {
  const workflowId: string | undefined = share.options?.website_workflow_id || settings.website_workflow_id;
  if (!workflowId) {
    return result("not_configured", "No website destination is set up. Choose a workflow under Sharing & destinations.");
  }
  const db = getSupabaseClient();
  const { data: job } = await db.from("jobs").select("id, name, description, client_contact, metadata, business_id").eq("id", share.job_id).maybeSingle();
  const meta = (job?.metadata && typeof job.metadata === "object" ? job.metadata : {}) as Record<string, any>;
  const payload = {
    event: "project.shared",
    share_id: share.id,
    job_id: share.job_id,
    business_id: share.business_id,
    title: share.caption?.title || job?.name || "Project",
    caption: captionFor(share, "website"),
    city: meta.city ?? null,
    state: meta.state ?? null,
    service_type: meta.service_type ?? null,
    keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
    photos: photos.map((p) => ({ id: p.id, url: p.url })),
    destinations: ["website"],
  };
  try {
    const run = await runWorkflowById(workflowId, share.business_id, payload);
    if (!run.ok) return result("failed", run.detail);
    return result("live", run.detail, { external_id: run.executionId });
  } catch (err) {
    log.error({ err, shareId: share.id }, "website delivery failed");
    return result("failed", "Your website didn't accept the project. Try again in a few minutes.");
  }
}

async function deliverMeta(dest: "facebook" | "instagram", share: ShareRow, photos: Array<{ id: string; url: string }>, settings: Record<string, any>): Promise<DeliveryResult> {
  const conn = settings?.[dest];
  const pageToken: string | undefined = conn?.page_access_token;
  const pageId: string | undefined = conn?.page_id;
  const igUserId: string | undefined = conn?.ig_user_id;
  const label = dest === "facebook" ? "Facebook Page" : "Instagram";
  if (!pageToken || !pageId || (dest === "instagram" && !igUserId)) {
    return result("not_configured", `${label} isn't connected. Connect it under Sharing & destinations.`);
  }
  const message = captionFor(share, dest);
  try {
    if (dest === "facebook") {
      // Photo post when there is a photo, text post otherwise.
      const endpoint = photos.length
        ? `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/photos`
        : `https://graph.facebook.com/v21.0/${encodeURIComponent(pageId)}/feed`;
      const body = new URLSearchParams(photos.length ? { url: photos[0].url, message } : { message });
      body.set("access_token", pageToken);
      const res = await fetch(endpoint, { method: "POST", body });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      const id = String(data.post_id || data.id || "");
      return result("live", photos.length ? "Posted to your Facebook Page with 1 photo." : "Posted to your Facebook Page.", {
        external_id: id,
        url: id ? `https://www.facebook.com/${id}` : undefined,
      });
    }
    // Instagram: needs at least one photo; single image (carousel comes later).
    if (!photos.length) return result("skipped", "Instagram needs at least one photo.");
    const create = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(igUserId!)}/media`, {
      method: "POST",
      body: new URLSearchParams({ image_url: photos[0].url, caption: message, access_token: pageToken }),
    });
    const created: any = await create.json().catch(() => ({}));
    if (!create.ok || created?.error) throw new Error(created?.error?.message || `HTTP ${create.status}`);
    const publish = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(igUserId!)}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: String(created.id), access_token: pageToken }),
    });
    const published: any = await publish.json().catch(() => ({}));
    if (!publish.ok || published?.error) throw new Error(published?.error?.message || `HTTP ${publish.status}`);
    return result("live", "Posted to Instagram.", { external_id: String(published.id || "") });
  } catch (err: any) {
    log.error({ err, shareId: share.id, dest }, "meta delivery failed");
    const msg = String(err?.message || "");
    if (/token|expired|session/i.test(msg)) return result("not_configured", `${label} connection expired. Reconnect it under Sharing & destinations.`);
    return result("failed", `${label} didn't accept the post. Try again in a few minutes.`);
  }
}

// ── Orchestration ─────────────────────────────────────────────────────────────

function overallStatus(share: ShareRow, results: Partial<Record<Destination, DeliveryResult>>): ShareStatus {
  const wanted = share.destinations;
  const live = wanted.filter((d) => results[d]?.status === "live").length;
  const hardFail = wanted.filter((d) => results[d]?.status === "failed").length;
  if (wanted.length === 0) return "failed";
  if (live === wanted.length) return "done";
  if (live > 0) return "partial";
  // Nothing live. If every miss is a retryable failure and attempts remain, go back to the queue.
  if (hardFail > 0 && share.attempts + 1 < MAX_ATTEMPTS) return "queued";
  return "failed";
}

/** Deliver one share to every requested destination and persist the outcome. */
export async function runShare(shareId: string): Promise<ShareRow> {
  const db = getSupabaseClient();
  const { data: claimed, error: claimErr } = await db
    .from("project_shares")
    .update({ status: "processing", started_at: now(), updated_at: now() })
    .eq("id", shareId)
    .in("status", ["queued", "draft", "failed", "partial"])
    .select("*")
    .maybeSingle();
  if (claimErr) throw new Error(claimErr.message);
  if (!claimed) {
    const { data: existing } = await db.from("project_shares").select("*").eq("id", shareId).maybeSingle();
    if (!existing) throw new Error("Share not found");
    return existing as ShareRow; // already processing or done
  }
  const share = claimed as ShareRow;
  const settings = await loadShareSettings(share.business_id);
  const photos = await signedPhotoUrls(share.job_id, share.media_ids || []);
  const results: Partial<Record<Destination, DeliveryResult>> = { ...(share.results || {}) };

  for (const dest of share.destinations) {
    // Don't re-send to a destination that is already live from a previous attempt.
    if (results[dest]?.status === "live") continue;
    if (dest === "gbp") results.gbp = await deliverGbp(share, photos);
    else if (dest === "website") results.website = await deliverWebsite(share, photos, settings);
    else if (dest === "facebook" || dest === "instagram") results[dest] = await deliverMeta(dest, share, photos, settings);
    else results[dest as Destination] = result("skipped", "Unknown destination.");
  }

  const status = overallStatus(share, results);
  const patch: Partial<ShareRow> & { updated_at: string } = {
    status,
    results,
    attempts: share.attempts + 1,
    updated_at: now(),
    finished_at: status === "queued" ? null : now(),
    // A retry goes back into the queue a little later rather than immediately.
    scheduled_for: status === "queued" ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : share.scheduled_for,
  };
  const { data: saved, error: saveErr } = await db.from("project_shares").update(patch).eq("id", shareId).select("*").single();
  if (saveErr) throw new Error(saveErr.message);

  // Mark the job complete when the share asked for it and anything went live.
  if (share.options?.mark_complete && (status === "done" || status === "partial")) {
    await db.from("jobs").update({ status: "completed", completed_at: now(), updated_at: now() }).eq("id", share.job_id);
  }
  return saved as ShareRow;
}

/** Worker hook: deliver everything that is due. */
export async function processQueuedShares(limit = 10): Promise<{ processed: number; live: number; failed: number }> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from("project_shares")
    .select("id")
    .eq("status", "queued")
    .or(`scheduled_for.is.null,scheduled_for.lte.${now()}`)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  let processed = 0, live = 0, failed = 0;
  for (const row of data ?? []) {
    processed += 1;
    try {
      const done = await runShare(String(row.id));
      if (done.status === "done" || done.status === "partial") live += 1;
      else if (done.status === "failed") failed += 1;
    } catch (err) {
      failed += 1;
      log.error({ err, shareId: row.id }, "share delivery crashed");
    }
  }
  return { processed, live, failed };
}
