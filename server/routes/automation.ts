/**
 * Automation API — /api/automation/*.
 *
 *   GET  /api/automation/triggers         triggers the caller may see
 *   GET  /api/automation/triggers/:id/runs   recent trigger_runs for a trigger
 *   POST /api/automation/triggers/:id/run    run one trigger now (same path as tick)
 *   POST /api/automation/tick                full worker tick now (SUPER ADMIN)
 *
 * These drive the background worker (server/lib/worker.ts) on demand. Manual
 * runs are audit-logged. Claiming inside the worker means a manual run can
 * never double-send an item the timed tick is also handling.
 *
 * ACCESS. A trigger with a `business_id` belongs to that business and is
 * reachable by anyone who can write to it; a trigger with a NULL business_id is
 * platform-wide and stays super-admin-only. This router used to be
 * `requireRole("super_admin")` wholesale, which meant the one working
 * automation engine in the product was invisible to every paying tenant.
 *
 * `/tick` remains super-admin-only on purpose: it runs EVERY processor for
 * EVERY tenant, so it is an operator tool, not a tenant one.
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";
import { requireAuth, requireRole, canWriteBusiness, canAccessBusiness } from "../middleware/requireAuth";
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
  entry: {
    action: "create" | "update";
    resourceType: string;
    resourceId?: string | null;
    businessId?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    const db = getSupabaseClient();
    const { error } = await db.from("audit_logs").insert({
      user_id: req.user?.id ?? null,
      business_id: entry.businessId ?? null,
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

/**
 * Load a trigger and decide whether the caller may act on it.
 *
 * Returns the trigger, or null after having already sent the response — the
 * 404 for "no such trigger" and the 403 for "not yours" are deliberately
 * distinct, because an operator debugging a missing trigger needs to know
 * which it is, and a trigger id is not a secret.
 */
async function authorizeTrigger(
  req: Request,
  res: Response,
  id: string,
  write: boolean,
): Promise<{ id: string; business_id: string | null } | null> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from("event_triggers")
    .select("id, business_id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    reqLog(req).error({ err: error.message }, "trigger lookup failed");
    res.status(500).json({ error: "Failed to load the trigger" });
    return null;
  }
  const trigger = data as { id: string; business_id: string | null } | null;
  if (!trigger) {
    res.status(404).json({ error: "Trigger not found" });
    return null;
  }

  const isSuper = req.profile?.role === "super_admin";
  if (isSuper) return trigger;

  // A platform-wide trigger affects every tenant, so only an operator runs it.
  if (!trigger.business_id) {
    res.status(403).json({ error: "This automation is managed by the platform" });
    return null;
  }
  const allowed = write
    ? canWriteBusiness(req, trigger.business_id)
    : canAccessBusiness(req, trigger.business_id);
  if (!allowed) {
    res.status(403).json({ error: "You do not have access to this automation" });
    return null;
  }
  return trigger;
}

/** Triggers the caller may see: their businesses', plus all of them for an operator. */
async function handleListTriggers(req: Request, res: Response) {
  try {
    const db = getSupabaseClient();
    const isSuper = req.profile?.role === "super_admin";
    const wanted = typeof req.query.businessId === "string" ? req.query.businessId : "";

    let query = db
      .from("event_triggers")
      .select("id, name, description, event, conditions, actions, is_active, business_id, trigger_count, last_triggered, created_at")
      .order("created_at", { ascending: false })
      .limit(200);

    if (wanted) {
      if (!canAccessBusiness(req, wanted)) {
        return res.status(403).json({ error: "You do not have access to this business" });
      }
      query = query.eq("business_id", wanted);
    } else if (!isSuper) {
      const ids = (req.profile?.businessIds ?? []).filter(Boolean);
      if (ids.length === 0) return res.json({ triggers: [] });
      query = query.in("business_id", ids);
    }

    const { data, error } = await query;
    if (error) {
      reqLog(req).error({ err: error.message }, "trigger list failed");
      return res.status(500).json({ error: "Failed to load automations" });
    }
    res.json({ triggers: data || [] });
  } catch (err: any) {
    reqLog(req).error({ err: err?.message }, "handleListTriggers failed");
    res.status(500).json({ error: "Failed to load automations" });
  }
}

async function handleGetRuns(req: Request, res: Response) {
  const id = req.params.id;
  if (!UUID_RE.test(id || "")) return res.status(400).json({ error: "Invalid trigger id" });
  if (!(await authorizeTrigger(req, res, id, false))) return;
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
  const trigger = await authorizeTrigger(req, res, id, true);
  if (!trigger) return;
  try {
    const result = await runTriggerById(id, { manual: true });
    await writeAudit(req, {
      action: "update",
      resourceType: "event_trigger",
      resourceId: id,
      businessId: trigger.business_id,
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
automationRouter.use(requireAuth);
automationRouter.get("/triggers", handleListTriggers);
automationRouter.get("/triggers/:id/runs", handleGetRuns);
// Per-trigger authorization happens inside the handler, because whether a
// caller may touch a trigger depends on which business owns it.
automationRouter.post("/triggers/:id/run", runLimiter, handleRunTrigger);
// Operator-only: a full tick runs every processor for every tenant.
automationRouter.post("/tick", requireRole("super_admin"), tickLimiter, handleTick);
