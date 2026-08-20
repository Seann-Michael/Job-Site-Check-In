/**
 * Automation API — /api/automation/*. Super-admin only.
 *
 *   GET  /api/automation/triggers/:id/runs   recent trigger_runs for a trigger
 *   POST /api/automation/triggers/:id/run    run one trigger now (same path as tick)
 *   POST /api/automation/tick                run a full worker tick now (rate-limited)
 *
 * These drive the background worker (server/lib/worker.ts) on demand. Manual
 * runs are audit-logged. Claiming inside the worker means a manual run can
 * never double-send an item the timed tick is also handling.
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import { runTriggerById, runTickOnce } from "../lib/worker";

const log = logger.child({ module: "automation" });
const reqLog = (req: Request) => (req.log ?? log).child({ module: "automation" });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 20 manual runs / hour / user; the full-tick endpoint is tighter. */
const runLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip || "anonymous",
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Too many automation runs, please try again later" },
});

const tickLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip || "anonymous",
  validate: { keyGeneratorIpFallback: false },
  message: { error: "Too many manual ticks, please try again later" },
});

async function writeAudit(
  req: Request,
  entry: { action: "create" | "update"; resourceType: string; resourceId?: string | null; details?: Record<string, unknown> },
): Promise<void> {
  try {
    const db = getSupabaseClient();
    const { error } = await db.from("audit_logs").insert({
      user_id: req.user?.id ?? null,
      business_id: null,
      action: entry.action,
      resource_type: entry.resourceType,
      resource_id: entry.resourceId ?? null,
      details: { actor_email: req.profile?.email ?? req.user?.email ?? null, ...(entry.details ?? {}) },
      ip_address: req.ip ?? null,
      user_agent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"].slice(0, 500) : null,
    });
    if (error) reqLog(req).warn({ err: error.message }, "audit_logs insert failed");
  } catch (err) {
    reqLog(req).warn({ err }, "audit_logs insert threw");
  }
}

async function handleGetRuns(req: Request, res: Response) {
  const id = req.params.id;
  if (!UUID_RE.test(id || "")) return res.status(400).json({ error: "Invalid trigger id" });
  try {
    const db = getSupabaseClient();
    const { data, error } = await db
      .from("trigger_runs")
      .select("id, trigger_id, event, status, detail, created_at")
      .eq("trigger_id", id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      reqLog(req).error({ err: error.message }, "trigger_runs query failed");
      return res.status(500).json({ error: "Failed to load runs" });
    }
    res.json({ runs: data || [] });
  } catch (err: any) {
    reqLog(req).error({ err: err?.message }, "handleGetRuns failed");
    res.status(500).json({ error: "Failed to load runs" });
  }
}

async function handleRunTrigger(req: Request, res: Response) {
  const id = req.params.id;
  if (!UUID_RE.test(id || "")) return res.status(400).json({ error: "Invalid trigger id" });
  try {
    const result = await runTriggerById(id, { manual: true });
    await writeAudit(req, {
      action: "update",
      resourceType: "event_trigger",
      resourceId: id,
      details: { event: "manual_run", status: result.status, matched: result.matched },
    });
    res.json({ success: true, result });
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (/not found/i.test(msg)) return res.status(404).json({ error: "Trigger not found" });
    reqLog(req).error({ err: msg, triggerId: id }, "manual trigger run failed");
    res.status(500).json({ error: "Failed to run trigger" });
  }
}

async function handleTick(req: Request, res: Response) {
  try {
    const summary = await runTickOnce();
    await writeAudit(req, {
      action: "update",
      resourceType: "worker_tick",
      resourceId: null,
      details: { event: "manual_tick", ...summary },
    });
    res.json({ success: true, summary });
  } catch (err: any) {
    reqLog(req).error({ err: err?.message }, "manual tick failed");
    res.status(500).json({ error: "Failed to run tick" });
  }
}

/** Mount at /api/automation */
export const automationRouter = Router();
automationRouter.use(requireAuth, requireRole("super_admin"));
automationRouter.get("/triggers/:id/runs", handleGetRuns);
automationRouter.post("/triggers/:id/run", runLimiter, handleRunTrigger);
automationRouter.post("/tick", tickLimiter, handleTick);
