/**
 * /api/shares — the one way a project leaves the app.
 *
 *   POST   /api/shares                 create (run: "now" | "queue" | "draft")
 *   GET    /api/shares?businessId=&status=&jobId=
 *   GET    /api/shares/:id
 *   POST   /api/shares/:id/run         deliver now (also retries a failed one)
 *   DELETE /api/shares/:id             only while draft/queued/failed
 *   GET    /api/shares/settings/:businessId
 *   PATCH  /api/shares/settings/:businessId   (owner)
 */
import { Router, Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";
import { requireAuth, requireWrite, canAccessBusiness, canWriteBusiness, isBusinessOwner } from "../middleware/requireAuth";
import { DESTINATIONS, runShare, type Destination, type ShareCaption } from "../lib/shares";

const log = logger.child({ module: "shares-route" });
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => (req as any).user?.id || req.ip || "anonymous",
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Too many share actions, please try again later" },
});

export const sharesRouter = Router();
sharesRouter.use(requireAuth);

function cleanCaption(raw: any): ShareCaption {
  const c = raw && typeof raw === "object" ? raw : {};
  const str = (v: any, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : undefined);
  const hashtags = Array.isArray(c.hashtags) ? c.hashtags.filter((t: any) => typeof t === "string").map((t: string) => t.replace(/[^\w#]/g, "")).filter(Boolean).slice(0, 15) : undefined;
  return {
    title: str(c.title, 120),
    gbp: str(c.gbp, 1500),
    facebook: str(c.facebook, 5000),
    instagram: str(c.instagram, 2200),
    website: str(c.website, 5000),
    ...(hashtags ? { hashtags } : {}),
  };
}

// POST /api/shares
sharesRouter.post("/", requireWrite, writeLimiter, async (req: Request, res: Response) => {
  const db = getSupabaseClient();
  const body = req.body ?? {};
  const jobId = String(body.jobId || "");
  if (!UUID_RE.test(jobId)) return res.status(400).json({ error: "jobId is required" });
  const { data: job, error: jobErr } = await db.from("jobs").select("id, business_id").eq("id", jobId).maybeSingle();
  if (jobErr || !job) return res.status(404).json({ error: "Project not found" });
  const businessId = String(job.business_id || "");
  if (!canWriteBusiness(req, businessId)) return res.status(403).json({ error: "Forbidden" });

  const destinations = (Array.isArray(body.destinations) ? body.destinations : [])
    .filter((d: any): d is Destination => DESTINATIONS.includes(d));
  if (!destinations.length) return res.status(400).json({ error: "Pick at least one destination" });
  const mediaIds = (Array.isArray(body.mediaIds) ? body.mediaIds : []).filter((m: any) => typeof m === "string" && UUID_RE.test(m)).slice(0, 10);
  const caption = cleanCaption(body.caption);
  if (!caption.gbp && !caption.facebook && !caption.instagram && !caption.website) {
    return res.status(400).json({ error: "The post needs some text" });
  }
  let run: "now" | "queue" | "draft" = body.run === "queue" ? "queue" : body.run === "draft" ? "draft" : "now";
  // The owner's after-capture rule is enforced here, not on the phone: with
  // "queue", nobody but the owner can send immediately, so a crew member's
  // "Share now" lands in the queue for the owner to release.
  if (run === "now" && !isBusinessOwner(req, businessId)) {
    const { data: biz } = await db.from("businesses").select("share_settings").eq("id", businessId).maybeSingle();
    if (biz?.share_settings?.after_capture === "queue") run = "queue";
  }
  const options: Record<string, any> = {};
  if (body.markComplete === true) options.mark_complete = true;
  if (body.cta && typeof body.cta === "object") options.cta = { actionType: String(body.cta.actionType || "LEARN_MORE"), url: body.cta.url ? String(body.cta.url) : undefined };
  if (typeof body.websiteWorkflowId === "string" && UUID_RE.test(body.websiteWorkflowId)) options.website_workflow_id = body.websiteWorkflowId;

  const { data: created, error } = await db
    .from("project_shares")
    .insert({
      business_id: businessId,
      job_id: jobId,
      created_by: (req as any).user?.id ?? null,
      media_ids: mediaIds,
      destinations,
      caption,
      options,
      status: run === "draft" ? "draft" : "queued",
      scheduled_for: typeof body.scheduledFor === "string" && !Number.isNaN(Date.parse(body.scheduledFor)) ? body.scheduledFor : null,
    })
    .select("*")
    .single();
  if (error || !created) {
    log.error({ err: error }, "share insert failed");
    return res.status(500).json({ error: "Could not save the share" });
  }
  if (run !== "now") return res.status(201).json({ share: created });
  try {
    const done = await runShare(String(created.id));
    return res.status(201).json({ share: done });
  } catch (err) {
    log.error({ err, shareId: created.id }, "share run failed");
    return res.status(201).json({ share: created, warning: "Saved, but delivery hit an error. It will retry from the queue." });
  }
});

// GET /api/shares?businessId=&status=&jobId=
sharesRouter.get("/", async (req: Request, res: Response) => {
  const businessId = String(req.query.businessId || "");
  if (!UUID_RE.test(businessId) || !canAccessBusiness(req, businessId)) return res.status(403).json({ error: "Forbidden" });
  const db = getSupabaseClient();
  let q = db.from("project_shares").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(200);
  const status = String(req.query.status || "");
  if (status === "waiting") q = q.in("status", ["draft", "queued", "processing", "failed", "partial"]);
  else if (status === "shared") q = q.in("status", ["done", "partial"]);
  else if (status) q = q.eq("status", status);
  const jobId = String(req.query.jobId || "");
  if (UUID_RE.test(jobId)) q = q.eq("job_id", jobId);
  const { data, error } = await q;
  if (error) return res.status(500).json({ error: "Could not load shares" });
  res.json({ shares: data ?? [] });
});

// Settings (must come before /:id)
sharesRouter.get("/settings/:businessId", async (req: Request, res: Response) => {
  const businessId = req.params.businessId;
  if (!UUID_RE.test(businessId) || !canAccessBusiness(req, businessId)) return res.status(403).json({ error: "Forbidden" });
  const { data } = await getSupabaseClient().from("businesses").select("share_settings").eq("id", businessId).maybeSingle();
  const s = (data?.share_settings && typeof data.share_settings === "object" ? data.share_settings : {}) as Record<string, any>;
  // Never hand tokens to a client.
  const safe = { ...s, facebook: s.facebook ? { connected: Boolean(s.facebook.page_access_token), page_name: s.facebook.page_name ?? null } : undefined, instagram: s.instagram ? { connected: Boolean(s.instagram.page_access_token), username: s.instagram.username ?? null } : undefined };
  res.json({ settings: safe });
});

sharesRouter.patch("/settings/:businessId", requireWrite, async (req: Request, res: Response) => {
  const businessId = req.params.businessId;
  if (!UUID_RE.test(businessId) || !isBusinessOwner(req, businessId)) return res.status(403).json({ error: "Only the owner can change sharing settings" });
  const db = getSupabaseClient();
  const { data: current } = await db.from("businesses").select("share_settings").eq("id", businessId).maybeSingle();
  const cur = (current?.share_settings && typeof current.share_settings === "object" ? current.share_settings : {}) as Record<string, any>;
  const b = req.body ?? {};
  const next: Record<string, any> = { ...cur };
  if (b.destinations && typeof b.destinations === "object") {
    next.destinations = Object.fromEntries(DESTINATIONS.map((d) => [d, Boolean(b.destinations[d] ?? cur.destinations?.[d] ?? (d === "gbp"))]));
  }
  if (["ask", "auto", "queue"].includes(b.after_capture)) next.after_capture = b.after_capture;
  if (b.website_workflow_id === null) delete next.website_workflow_id;
  else if (typeof b.website_workflow_id === "string" && UUID_RE.test(b.website_workflow_id)) next.website_workflow_id = b.website_workflow_id;
  if (Number.isInteger(b.max_photos) && b.max_photos >= 1 && b.max_photos <= 10) next.max_photos = b.max_photos;
  if (typeof b.hashtags === "boolean") next.hashtags = b.hashtags;
  if (b.caption && typeof b.caption === "object") {
    next.caption = {
      tone: ["plain", "friendly", "professional"].includes(b.caption.tone) ? b.caption.tone : cur.caption?.tone ?? "plain",
      always_mention: typeof b.caption.always_mention === "string" ? b.caption.always_mention.slice(0, 200) : cur.caption?.always_mention ?? "",
      never_say: Array.isArray(b.caption.never_say) ? b.caption.never_say.filter((s: any) => typeof s === "string").slice(0, 20) : cur.caption?.never_say ?? [],
    };
  }
  const { error } = await db.from("businesses").update({ share_settings: next }).eq("id", businessId);
  if (error) return res.status(500).json({ error: "Could not save settings" });
  res.json({ ok: true });
});

// GET /api/shares/:id
sharesRouter.get("/:id", async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" });
  const { data } = await getSupabaseClient().from("project_shares").select("*").eq("id", id).maybeSingle();
  if (!data || !canAccessBusiness(req, String(data.business_id))) return res.status(404).json({ error: "Not found" });
  res.json({ share: data });
});

// POST /api/shares/:id/run
sharesRouter.post("/:id/run", requireWrite, writeLimiter, async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" });
  const db = getSupabaseClient();
  const { data } = await db.from("project_shares").select("id, business_id, status").eq("id", id).maybeSingle();
  if (!data || !canWriteBusiness(req, String(data.business_id))) return res.status(404).json({ error: "Not found" });
  if (data.status === "processing") return res.status(409).json({ error: "Already sending" });
  if (data.status === "done") return res.status(409).json({ error: "Already shared" });
  try {
    const done = await runShare(id);
    res.json({ share: done });
  } catch (err) {
    log.error({ err, shareId: id }, "share run failed");
    res.status(502).json({ error: "Delivery hit an error. Try again." });
  }
});

// DELETE /api/shares/:id
sharesRouter.delete("/:id", requireWrite, async (req: Request, res: Response) => {
  const id = req.params.id;
  if (!UUID_RE.test(id)) return res.status(400).json({ error: "Invalid id" });
  const db = getSupabaseClient();
  const { data } = await db.from("project_shares").select("id, business_id, status").eq("id", id).maybeSingle();
  if (!data || !canWriteBusiness(req, String(data.business_id))) return res.status(404).json({ error: "Not found" });
  if (!["draft", "queued", "failed"].includes(String(data.status))) return res.status(409).json({ error: "Only unsent shares can be removed" });
  const { error } = await db.from("project_shares").delete().eq("id", id);
  if (error) return res.status(500).json({ error: "Could not remove" });
  res.json({ ok: true });
});
