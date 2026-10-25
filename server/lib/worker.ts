/**
 * In-process background worker.
 *
 * The API is deployed as a SINGLE instance on DigitalOcean, so one in-process
 * poller is safe — there is no distributed locking. We still CLAIM each row
 * before processing (a conditional UPDATE ... WHERE status = 'scheduled') so a
 * manual "run now" and the timed tick can never double-send the same item.
 *
 * Every 60s (and once shortly after boot) `tick()` runs five processors:
 *   a) scheduled broadcasts      -> fan out `notifications` rows
 *   b) scheduled email campaigns -> sendCampaignById() (same code as the route)
 *   c) automation event triggers -> detect new activity, run actions, log runs
 *   d) review requests           -> send the ones that are due, and nudge once
 *   e) review alerts             -> notify the business about a bad new review
 *
 * Each processor is wrapped in try/catch: one failure never kills the loop.
 * Disabled entirely under NODE_ENV=test or DISABLE_WORKER=true.
 */
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "./logger";
import { sendEmail, isEmailConfigured, renderTemplate } from "./email";
import { sendCampaignById } from "../routes/email";
import { safeFetch, SafeFetchError, readLimitedText } from "./safeFetch";
import { sendSms, reviewRequestMessage, normalisePhone } from "./sms";

const log = logger.child({ module: "worker" });

const TICK_INTERVAL_MS = 60_000;
/** Max rows processed per trigger per tick, to bound runtime. */
const MAX_ROWS_PER_TRIGGER = 50;
/** Max scheduled broadcasts / campaigns claimed per tick. */
const MAX_ITEMS_PER_TICK = 50;
/** Scheduled campaign send attempts before giving up (marks 'failed'). */
const MAX_CAMPAIGN_ATTEMPTS = 5;

let interval: NodeJS.Timeout | null = null;
let running = false;

// ── Lifecycle ────────────────────────────────────────────────────────────────

/**
 * Start the poller. No-op under tests or when DISABLE_WORKER=true, and no-op if
 * already started. The interval is unref'd so it never keeps the process alive.
 */
export function startWorker(): void {
  if (process.env.NODE_ENV === "test" || process.env.DISABLE_WORKER === "true") {
    log.info("background worker disabled (test or DISABLE_WORKER)");
    return;
  }
  if (interval) return;
  interval = setInterval(() => void tick(), TICK_INTERVAL_MS);
  interval.unref?.();
  // Kick once shortly after boot so scheduled work doesn't wait a full minute.
  const boot = setTimeout(() => void tick(), 3_000);
  boot.unref?.();
  log.info("background worker started");
}

/** Stop the poller (called from the SIGTERM handler). */
export function stopWorker(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
    log.info("background worker stopped");
  }
}

/** A single guarded tick. Overlapping ticks are skipped (single instance). */
async function tick(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await runTickOnce();
  } finally {
    running = false;
  }
}

export interface TickSummary {
  broadcasts: { processed: number; sent: number; failed: number };
  campaigns: { processed: number; sent: number; skipped: number; failed: number };
  triggers: { evaluated: number; fired: number; failed: number };
  reviewRequests: { processed: number; sent: number; skipped: number; failed: number };
  reviewAlerts: { reviews: number; notified: number };
}

/**
 * Run all three processors once and return a summary. Exported for tests, the
 * manual "run now" tick endpoint, and the boot kick. Each processor is isolated
 * so one failing does not prevent the others from running.
 */
export async function runTickOnce(): Promise<TickSummary> {
  const broadcasts = await guarded("scheduled_broadcasts", processScheduledBroadcasts, {
    processed: 0,
    sent: 0,
    failed: 0,
  });
  const campaigns = await guarded("scheduled_campaigns", processScheduledCampaigns, {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  });
  const triggers = await guarded("event_triggers", processEventTriggers, {
    evaluated: 0,
    fired: 0,
    failed: 0,
  });
  const reviewRequests = await guarded("review_requests", processReviewRequests, {
    processed: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
  });
  const reviewAlerts = await guarded("review_alerts", processReviewAlerts, { reviews: 0, notified: 0 });
  return { broadcasts, campaigns, triggers, reviewRequests, reviewAlerts };
}

async function guarded<T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    log.error({ err, task: name }, "worker task failed");
    return fallback;
  }
}

// ── (a) Scheduled broadcasts ───────────────────────────────────────────────────

/** Audience keyword -> user roles. Supports hyphen and underscore spellings. */
const AUDIENCE_ROLES: Record<string, string[]> = {
  business_owners: ["business_owner"],
  "business-owners": ["business_owner"],
  business_owner: ["business_owner"],
  agency_admins: ["agency_admin"],
  "agency-admins": ["agency_admin"],
  agency_admin: ["agency_admin"],
  staff: ["staff"],
};

const NOTIFICATION_TYPES = new Set(["info", "warning", "success", "error"]);

interface BroadcastRow {
  id: string;
  title: string;
  content: string;
  type: string;
  target_audience: string;
  custom_user_ids: string[] | null;
}

/** Resolve a broadcast's audience to a list of user ids (mirrors the client). */
async function broadcastAudienceUserIds(b: BroadcastRow): Promise<string[]> {
  const db = getSupabaseClient();
  const audience = (b.target_audience || "all").toLowerCase();
  if (audience === "custom") {
    return Array.isArray(b.custom_user_ids) ? b.custom_user_ids.filter(Boolean) : [];
  }
  let q = db.from("users").select("id");
  const roles = AUDIENCE_ROLES[audience];
  if (roles) q = q.in("role", roles);
  const { data, error } = await q;
  if (error) throw new Error(`audience lookup failed: ${error.message}`);
  return ((data as any[]) || []).map((u) => u.id).filter(Boolean);
}

/**
 * Deliver a broadcast as one `notifications` row per targeted user, exactly
 * like the immediate path in client/pages/SuperAdminBroadcast.tsx. Returns the
 * recipient count.
 */
async function deliverBroadcast(b: BroadcastRow): Promise<number> {
  const db = getSupabaseClient();
  const userIds = await broadcastAudienceUserIds(b);
  if (userIds.length === 0) return 0;
  const type = NOTIFICATION_TYPES.has(b.type) ? b.type : "info";
  const rows = userIds.map((user_id) => ({
    user_id,
    type,
    title: b.title,
    message: b.content,
    read: false,
    source: "system",
    priority: type === "error" ? "high" : "normal",
    category: "system",
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("notifications").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`notifications insert failed: ${error.message}`);
  }
  return rows.length;
}

async function processScheduledBroadcasts(): Promise<TickSummary["broadcasts"]> {
  const db = getSupabaseClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from("broadcast_messages")
    .select("id, title, content, type, target_audience, custom_user_ids")
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
    .limit(MAX_ITEMS_PER_TICK);
  if (error) throw new Error(`broadcast scan failed: ${error.message}`);

  const rows = (data as BroadcastRow[]) || [];
  let sent = 0;
  let failed = 0;
  for (const b of rows) {
    // CLAIM: flip scheduled -> sending only if still scheduled. If the update
    // matched no row, another path already took it; skip to avoid double-send.
    const { data: claimed, error: claimErr } = await db
      .from("broadcast_messages")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", b.id)
      .eq("status", "scheduled")
      .select("id");
    if (claimErr) {
      log.error({ err: claimErr.message, id: b.id }, "broadcast claim failed");
      continue;
    }
    if (!claimed || claimed.length === 0) continue;

    try {
      const count = await deliverBroadcast(b);
      await db
        .from("broadcast_messages")
        .update({ status: "sent", sent_at: new Date().toISOString(), is_active: true, updated_at: new Date().toISOString() })
        .eq("id", b.id);
      sent++;
      log.info({ id: b.id, recipients: count }, "scheduled broadcast delivered");
    } catch (err: any) {
      // Hard failure: mark 'failed' (not back to 'scheduled') so a broken row
      // whose scheduled_for is in the past does not retry every tick forever.
      await db
        .from("broadcast_messages")
        .update({ status: "failed", is_active: false, updated_at: new Date().toISOString() })
        .eq("id", b.id);
      failed++;
      log.error({ err: err?.message, id: b.id }, "scheduled broadcast failed");
    }
  }
  return { processed: sent + failed, sent, failed };
}

// ── (b) Scheduled email campaigns ──────────────────────────────────────────────

interface CampaignRow {
  id: string;
  stats: Record<string, any> | null;
}

/**
 * Reset a claimed campaign after a non-fatal send failure. Keeps it 'scheduled'
 * so it retries once a provider is configured, but records an attempt counter
 * in stats and gives up (marks 'failed') after MAX_CAMPAIGN_ATTEMPTS to avoid
 * an infinite retry loop.
 */
async function revertClaimedCampaign(c: CampaignRow, reason: string): Promise<"retry" | "gaveup"> {
  const db = getSupabaseClient();
  const stats = { ...((c.stats as any) || {}) };
  const attempts = (Number(stats.worker_attempts) || 0) + 1;
  stats.worker_attempts = attempts;
  stats.worker_last_error = String(reason || "").slice(0, 300);
  const gaveUp = attempts >= MAX_CAMPAIGN_ATTEMPTS;
  await db
    .from("email_campaigns")
    .update({ status: gaveUp ? "failed" : "scheduled", stats, updated_at: new Date().toISOString() })
    .eq("id", c.id);
  return gaveUp ? "gaveup" : "retry";
}

async function processScheduledCampaigns(): Promise<TickSummary["campaigns"]> {
  const db = getSupabaseClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await db
    .from("email_campaigns")
    .select("id, stats")
    .eq("status", "scheduled")
    .lte("scheduled_at", nowIso)
    .limit(MAX_ITEMS_PER_TICK);
  if (error) throw new Error(`campaign scan failed: ${error.message}`);

  const rows = (data as CampaignRow[]) || [];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const c of rows) {
    // CLAIM: scheduled -> sending, only if still scheduled.
    const { data: claimed, error: claimErr } = await db
      .from("email_campaigns")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", c.id)
      .eq("status", "scheduled")
      .select("id");
    if (claimErr) {
      log.error({ err: claimErr.message, id: c.id }, "campaign claim failed");
      continue;
    }
    if (!claimed || claimed.length === 0) continue;

    // No provider: don't burn the campaign — leave it 'scheduled' (capped).
    if (!(await isEmailConfigured())) {
      await revertClaimedCampaign(c, "no email provider configured");
      skipped++;
      log.warn({ id: c.id }, "scheduled campaign skipped: no email provider");
      continue;
    }

    // sendCampaignById marks the row 'sent' on success; on failure the row is
    // still 'sending' (it never touches it), so we revert it here.
    const outcome = await sendCampaignById(c.id);
    if (outcome.ok) {
      sent++;
      log.info({ id: c.id, sent: outcome.sent, failed: outcome.failed }, "scheduled campaign sent");
    } else if (outcome.status === 503) {
      await revertClaimedCampaign(c, "no email provider configured");
      skipped++;
    } else {
      const disposition = await revertClaimedCampaign(c, outcome.error || `status ${outcome.status}`);
      failed++;
      log.warn({ id: c.id, status: outcome.status, disposition, err: outcome.error }, "scheduled campaign send failed");
    }
  }
  return { processed: rows.length, sent, skipped, failed };
}

// ── (c) Automation event triggers ──────────────────────────────────────────────

interface TriggerRow {
  id: string;
  name: string;
  event: string;
  conditions: any;
  actions: any;
  is_active: boolean;
  trigger_count: number | null;
  last_triggered: string | null;
  created_at: string;
  /** Owning business, or null for a platform-wide (super-admin) trigger. */
  business_id?: string | null;
}

/** A source of new activity: one or more tables scanned by created_at. */
interface EventSource {
  /** Tables to scan for new rows. */
  tables: { table: string; select: string; filter?: (q: any) => any }[];
}

/**
 * Map an event name to the table(s) whose new rows fire it. Accepts both the
 * canonical names and the ids the automation UI (SuperAdminAutomation.tsx)
 * emits. Returns "scheduled" for time-based triggers and null for events we
 * don't have a real activity source for (they no-op).
 */
function resolveEventSource(event: string): EventSource | "scheduled" | null {
  const e = (event || "").toLowerCase().trim();
  switch (e) {
    case "review_received":
    case "new_review":
    case "review_submitted":
      return { tables: [{ table: "reviews", select: "id, business_id, rating, author, metadata, created_at" }] };
    case "review_completed":
      return {
        tables: [
          {
            table: "reviews",
            select: "id, business_id, rating, author, metadata, created_at",
            filter: (q) => q.filter("metadata->>source", "eq", "review_gate"),
          },
        ],
      };
    case "job_created":
    case "new_job":
    case "project_created":
      return { tables: [{ table: "jobs", select: "id, business_id, name, status, client_contact, metadata, created_at" }] };
    case "lead_created":
    case "new_lead":
      // Leads live in either table depending on flow; support both.
      return {
        tables: [
          { table: "clients", select: "id, business_id, name, email, created_at" },
          { table: "gmb_profiles", select: "id, business_id, business_name, created_at" },
        ],
      };
    case "scheduled":
    case "time":
    case "scheduled_time":
      return "scheduled";
    default:
      return null;
  }
}

const WORKER_STATE = "worker_state";

async function getCursor(key: string, fallbackIso: string): Promise<string> {
  const db = getSupabaseClient();
  const { data } = await db.from(WORKER_STATE).select("value").eq("key", key).maybeSingle();
  const v = (data as any)?.value;
  if (v && typeof v === "object" && typeof v.cursor === "string") return v.cursor;
  if (typeof v === "string") return v;
  return fallbackIso;
}

async function setCursor(key: string, iso: string): Promise<void> {
  const db = getSupabaseClient();
  const { error } = await db
    .from(WORKER_STATE)
    .upsert({ key, value: { cursor: iso }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) log.warn({ err: error.message, key }, "worker_state upsert failed");
}

/** conditions may be a UI array [{field,operator,value,type}] or an object map. */
interface Condition {
  field: string;
  op: string;
  value: any;
}

function parseConditions(conditions: any): Condition[] {
  const out: Condition[] = [];
  if (!conditions) return out;
  const push = (field: any, op: any, value: any) => {
    if (typeof field !== "string" || !field) return;
    out.push({ field, op: String(op || "equals").toLowerCase(), value });
  };
  if (Array.isArray(conditions)) {
    for (const c of conditions) if (c && typeof c === "object") push(c.field, c.operator ?? c.op, c.value);
  } else if (typeof conditions === "object") {
    for (const [k, v] of Object.entries(conditions)) {
      if (k === "interval_minutes" || k === "cron" || k === "time" || k === "interval") continue;
      push(k, "equals", v);
    }
  }
  return out;
}

/** Read a possibly-dotted field path from a row (e.g. metadata.source). */
function readField(row: Record<string, any>, field: string): any {
  if (field in row) return row[field];
  let cur: any = row;
  for (const part of field.split(".")) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

/**
 * Best-effort condition evaluation against a row. Unsupported operators/fields
 * are treated as PASS and noted, so a trigger is never silently blocked by a
 * condition shape we don't understand.
 */
function evalConditions(conditions: Condition[], row: Record<string, any>, notes: string[]): boolean {
  for (const c of conditions) {
    const actual = readField(row, c.field);
    const op = c.op;
    const val = c.value;
    let pass = true;
    switch (op) {
      case "equals":
      case "eq":
      case "is":
        pass = String(actual ?? "") === String(val ?? "");
        break;
      case "not_equals":
      case "neq":
      case "ne":
        pass = String(actual ?? "") !== String(val ?? "");
        break;
      case "contains":
        pass = String(actual ?? "").toLowerCase().includes(String(val ?? "").toLowerCase());
        break;
      case "starts_with":
        pass = String(actual ?? "").toLowerCase().startsWith(String(val ?? "").toLowerCase());
        break;
      case "ends_with":
        pass = String(actual ?? "").toLowerCase().endsWith(String(val ?? "").toLowerCase());
        break;
      case "greater_than":
      case "gt":
        pass = Number(actual) > Number(val);
        break;
      case "less_than":
      case "lt":
        pass = Number(actual) < Number(val);
        break;
      case "is_true":
        pass = actual === true || actual === "true";
        break;
      case "is_false":
        pass = actual === false || actual === "false";
        break;
      default:
        notes.push(`unsupported condition op "${op}" on "${c.field}" — treated as pass`);
        pass = true;
    }
    if (!pass) return false;
  }
  return true;
}

interface ActionResult {
  type: string;
  ok: boolean;
  detail: string;
}

/**
 * Normalize + run a single action against an (optional) affected row.
 *
 * `businessId` is the owning business of the trigger, or null for a
 * platform-wide one. It scopes the notification audience: a tenant's own
 * automation must not be able to address "all users" or the super admins.
 */
async function runAction(
  action: any,
  row: Record<string, any> | null,
  businessId: string | null = null,
): Promise<ActionResult> {
  const rawType = String(action?.type || "").toLowerCase();
  const cfg = (action && typeof action.config === "object" && action.config) || {};
  const get = (...keys: string[]) => {
    for (const k of keys) {
      if (action?.[k] !== undefined && action[k] !== null && action[k] !== "") return action[k];
      if (cfg[k] !== undefined && cfg[k] !== null && cfg[k] !== "") return cfg[k];
    }
    return undefined;
  };

  try {
    switch (rawType) {
      case "send_notification":
      case "send_message": {
        const title = String(get("title", "messageTitle") || "Notification");
        const message = String(get("message", "messageContent", "body") || "");
        const mtype = String(get("type", "messageType") || "info");

        // A business-owned trigger notifies that business's own people and
        // nobody else — the configured target is ignored rather than trusted,
        // because "all" or "super_admins" would otherwise let a tenant's
        // automation message the whole platform.
        if (businessId) {
          const recipients = await businessRecipients(businessId);
          if (recipients.length === 0) {
            return { type: rawType, ok: false, detail: "no recipients for this business — skipped" };
          }
          const count = await deliverNotificationToUsers(recipients, {
            title,
            message,
            type: mtype,
            businessId,
          });
          return { type: rawType, ok: true, detail: `notified ${count} user(s) in this business` };
        }

        const target = String(get("target", "targetAudience") || "super_admins");
        const count = await deliverNotification({ title, message, target, type: mtype });
        return { type: rawType, ok: true, detail: `notified ${count} user(s) (target=${target})` };
      }
      case "send_email": {
        if (!(await isEmailConfigured())) {
          return { type: rawType, ok: false, detail: "email not configured — skipped" };
        }
        const to = String(get("to", "email") || relatedEmail(row) || "").trim();
        if (!to) return { type: rawType, ok: false, detail: "no recipient address — skipped" };
        const subject = String(get("subject", "emailSubject") || "Notification");
        const body = String(get("body", "html", "emailBody") || "");
        const vars = row ? flattenForTemplate(row) : {};
        await sendEmail({ to, subject: renderTemplate(subject, vars), html: renderTemplate(body, vars) });
        return { type: rawType, ok: true, detail: `email sent to ${to}` };
      }
      case "webhook":
      case "send_webhook": {
        const url = String(get("url", "target_url", "targetUrl") || "").trim();
        if (!url) return { type: rawType, ok: false, detail: "no webhook url — skipped" };
        const method = String(get("method") || "POST").toUpperCase();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        const rawHeaders = get("headers");
        if (rawHeaders && typeof rawHeaders === "object") {
          for (const [k, v] of Object.entries(rawHeaders)) headers[k] = String(v);
        }
        const bodyVal = get("body");
        const payload =
          method === "GET" || method === "HEAD"
            ? undefined
            : typeof bodyVal === "string"
              ? bodyVal
              : JSON.stringify(bodyVal ?? { event: true, row });
        const res = await safeFetch(url, { method, headers, body: payload, timeoutMs: 10_000 });
        await readLimitedText(res).catch(() => "");
        return { type: rawType, ok: res.ok, detail: `webhook ${method} ${url} -> HTTP ${res.status}` };
      }
      default:
        return { type: rawType || "unknown", ok: false, detail: `unsupported action type "${rawType}"` };
    }
  } catch (err: any) {
    const reason = err instanceof SafeFetchError ? err.message : err?.message || "action failed";
    return { type: rawType || "unknown", ok: false, detail: reason };
  }
}

/** Best-effort related email for a row (reviews / jobs / clients / gmb). */
function relatedEmail(row: Record<string, any> | null): string {
  if (!row) return "";
  return (
    row.email ||
    row.author?.email ||
    row.client_contact?.email ||
    ""
  );
}

/** Flatten a row into flat {{token}} variables for templating. */
function flattenForTemplate(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v == null || typeof v === "object") continue;
    out[k] = v;
  }
  return out;
}

/** Insert `notifications` rows for a notification-action target. */
async function deliverNotification(n: {
  title: string;
  message: string;
  target: string;
  type: string;
}): Promise<number> {
  const db = getSupabaseClient();
  const type = NOTIFICATION_TYPES.has(n.type) ? n.type : "info";
  const target = (n.target || "super_admins").toLowerCase();

  let userIds: string[] = [];
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (UUID_RE.test(n.target)) {
    userIds = [n.target];
  } else if (target === "super_admins" || target === "super_admin" || target === "super-admins") {
    const { data } = await db.from("users").select("id").eq("role", "super_admin");
    userIds = ((data as any[]) || []).map((u) => u.id);
  } else if (target === "all") {
    const { data } = await db.from("users").select("id");
    userIds = ((data as any[]) || []).map((u) => u.id);
  } else if (target === "business_owner" || AUDIENCE_ROLES[target]) {
    const roles = AUDIENCE_ROLES[target] || ["business_owner"];
    const { data } = await db.from("users").select("id").in("role", roles);
    userIds = ((data as any[]) || []).map((u) => u.id);
  }
  userIds = userIds.filter(Boolean);
  if (userIds.length === 0) return 0;

  const rows = userIds.map((user_id) => ({
    user_id,
    type,
    title: n.title,
    message: n.message,
    read: false,
    source: "automation",
    priority: type === "error" ? "high" : "normal",
    category: "system",
  }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("notifications").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`notifications insert failed: ${error.message}`);
  }
  return rows.length;
}

/** Insert `notifications` rows for an explicit list of users. */
async function deliverNotificationToUsers(
  userIds: string[],
  n: { title: string; message: string; type: string; businessId: string | null },
): Promise<number> {
  const db = getSupabaseClient();
  const type = NOTIFICATION_TYPES.has(n.type) ? n.type : "info";
  const rows = userIds.filter(Boolean).map((user_id) => ({
    user_id,
    business_id: n.businessId,
    type,
    title: n.title,
    message: n.message,
    read: false,
    source: "automation",
    priority: type === "error" ? "high" : "normal",
    category: "system",
  }));
  if (rows.length === 0) return 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from("notifications").insert(rows.slice(i, i + 500));
    if (error) throw new Error(`notifications insert failed: ${error.message}`);
  }
  return rows.length;
}

async function insertTriggerRun(
  triggerId: string,
  event: string,
  status: "success" | "failed" | "skipped",
  detail: Record<string, any>,
): Promise<void> {
  const db = getSupabaseClient();
  const { error } = await db.from("trigger_runs").insert({ trigger_id: triggerId, event, status, detail });
  if (error) log.warn({ err: error.message, triggerId }, "trigger_runs insert failed");
}

export interface TriggerRunResult {
  triggerId: string;
  event: string;
  status: "success" | "failed" | "skipped";
  matched: number;
  actions: ActionResult[];
  notes: string[];
  detail: string;
}

/**
 * Process a single trigger. Shared by the tick loop and the manual "run now"
 * endpoint. When `manual` is true a run is always logged (so the UI gets
 * feedback) and scheduled triggers fire regardless of their interval; on the
 * timed path a no-op produces no log row.
 */
export async function runTriggerById(triggerId: string, opts: { manual?: boolean } = {}): Promise<TriggerRunResult> {
  const db = getSupabaseClient();
  const { data, error } = await db.from("event_triggers").select("*").eq("id", triggerId).maybeSingle();
  if (error) throw new Error(`trigger lookup failed: ${error.message}`);
  if (!data) throw new Error("trigger not found");
  return processTrigger(data as TriggerRow, { manual: opts.manual === true });
}

async function processTrigger(t: TriggerRow, opts: { manual: boolean }): Promise<TriggerRunResult> {
  const db = getSupabaseClient();
  const source = resolveEventSource(t.event);
  const conditions = parseConditions(t.conditions);
  const actions = Array.isArray(t.actions) ? t.actions : [];
  const notes: string[] = [];
  const base = { triggerId: t.id, event: t.event };

  // Unsupported event: no activity source. No-op on the timed path; on manual
  // run, report skipped so the operator understands nothing happened.
  if (source === null) {
    const detail = `event "${t.event}" has no activity source — nothing to do`;
    if (opts.manual) await insertTriggerRun(t.id, t.event, "skipped", { reason: detail });
    return { ...base, status: "skipped", matched: 0, actions: [], notes, detail };
  }

  // ── Scheduled / time-based triggers ──
  if (source === "scheduled") {
    const intervalMinutes = scheduledIntervalMinutes(t.conditions);
    const due =
      opts.manual ||
      !t.last_triggered ||
      Date.now() - Date.parse(t.last_triggered) >= intervalMinutes * 60_000;
    if (!due) {
      return { ...base, status: "skipped", matched: 0, actions: [], notes, detail: "not due yet" };
    }
    const results: ActionResult[] = [];
    for (const a of actions) results.push(await runAction(a, null, t.business_id ?? null));
    const okAll = results.every((r) => r.ok);
    await bumpTrigger(t.id, t.trigger_count, 1);
    const status = results.length === 0 ? "skipped" : okAll ? "success" : "failed";
    const detail = `scheduled fire; ${results.filter((r) => r.ok).length}/${results.length} action(s) ok`;
    await insertTriggerRun(t.id, t.event, status, { matched: 1, actions: results, notes });
    return { ...base, status, matched: 1, actions: results, notes, detail };
  }

  // ── Row-based triggers ──
  const fallback = t.created_at || new Date().toISOString();
  const cursorKey = `trigger:${t.id}:cursor`;
  const cursor = await getCursor(cursorKey, fallback);

  // Gather new rows across all source tables, newest-bounded per table.
  const matchedRows: Record<string, any>[] = [];
  let newestCursor = cursor;
  let capped = false;
  for (const src of source.tables) {
    let q = db
      .from(src.table)
      .select(src.select)
      .gt("created_at", cursor)
      .order("created_at", { ascending: true })
      .limit(MAX_ROWS_PER_TRIGGER);
    // A business-owned trigger only ever sees its own rows. Without this a
    // tenant trigger would fire on every tenant's activity, which is why this
    // engine could not be opened up before.
    if (t.business_id) q = q.eq("business_id", t.business_id);
    if (src.filter) q = src.filter(q);
    const { data, error } = await q;
    if (error) {
      log.warn({ err: error.message, table: src.table, trigger: t.id }, "trigger source scan failed");
      continue;
    }
    const rows = (data as any[]) || [];
    if (rows.length >= MAX_ROWS_PER_TRIGGER) capped = true;
    for (const r of rows) {
      matchedRows.push(r);
      if (r.created_at && r.created_at > newestCursor) newestCursor = r.created_at;
    }
  }

  if (matchedRows.length === 0) {
    // Nothing new. Leave the cursor as-is so we keep scanning from the same
    // point. Only log on a manual run so the UI gets feedback.
    if (opts.manual) await insertTriggerRun(t.id, t.event, "skipped", { reason: "no new activity since cursor", cursor });
    return { ...base, status: "skipped", matched: 0, actions: [], notes, detail: "no new activity" };
  }

  // Evaluate conditions per row, run every action for each passing row.
  const allResults: ActionResult[] = [];
  let fired = 0;
  for (const row of matchedRows) {
    if (!evalConditions(conditions, row, notes)) continue;
    fired++;
    for (const a of actions) allResults.push(await runAction(a, row, t.business_id ?? null));
  }
  if (capped) notes.push(`row cap (${MAX_ROWS_PER_TRIGGER}) hit — more will process next tick`);

  // Advance the cursor to the newest row we saw so those rows never re-fire.
  await setCursor(cursorKey, newestCursor);
  await bumpTrigger(t.id, t.trigger_count, fired);

  const okAll = allResults.every((r) => r.ok);
  const status: TriggerRunResult["status"] =
    fired === 0 ? "skipped" : allResults.length > 0 && !okAll ? "failed" : "success";
  const detail = `${fired}/${matchedRows.length} row(s) fired; ${allResults.filter((r) => r.ok).length}/${allResults.length} action(s) ok`;
  await insertTriggerRun(t.id, t.event, status, { matched: matchedRows.length, fired, actions: allResults, notes });
  return { ...base, status, matched: matchedRows.length, actions: allResults, notes, detail };
}

/** interval minutes for a scheduled trigger; defaults to daily (1440). */
function scheduledIntervalMinutes(conditions: any): number {
  const fromObj = (o: any): number | null => {
    if (!o || typeof o !== "object") return null;
    const n = Number(o.interval_minutes ?? o.intervalMinutes ?? o.interval);
    if (Number.isFinite(n) && n > 0) return n;
    return null;
  };
  if (Array.isArray(conditions)) {
    for (const c of conditions) {
      if (c && typeof c === "object") {
        const direct = fromObj(c);
        if (direct) return direct;
        if (c.field === "interval_minutes" && Number(c.value) > 0) return Number(c.value);
      }
    }
  } else {
    const direct = fromObj(conditions);
    if (direct) return direct;
  }
  return 1440;
}

async function bumpTrigger(id: string, currentCount: number | null, fired: number): Promise<void> {
  const db = getSupabaseClient();
  const { error } = await db
    .from("event_triggers")
    .update({
      trigger_count: (Number(currentCount) || 0) + Math.max(fired, 0),
      last_triggered: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) log.warn({ err: error.message, id }, "event_triggers bump failed");
}

async function processEventTriggers(): Promise<TickSummary["triggers"]> {
  const db = getSupabaseClient();
  const { data, error } = await db.from("event_triggers").select("*").eq("is_active", true).limit(500);
  if (error) throw new Error(`trigger scan failed: ${error.message}`);
  const triggers = (data as TriggerRow[]) || [];
  let fired = 0;
  let failed = 0;
  for (const t of triggers) {
    try {
      const result = await processTrigger(t, { manual: false });
      if (result.status === "success") fired++;
      else if (result.status === "failed") failed++;
    } catch (err: any) {
      failed++;
      log.error({ err: err?.message, trigger: t.id }, "trigger processing failed");
      await insertTriggerRun(t.id, t.event, "failed", { error: String(err?.message || "processing failed").slice(0, 300) });
    }
  }
  return { evaluated: triggers.length, fired, failed };
}


// ── (d) Review requests: scheduled sends and one follow-up ───────────────────

/** Nudge window: a request with no review after this long gets one follow-up. */
const FOLLOW_UP_AFTER_DAYS = 3;
/** A request is abandoned after this many failed attempts. */
const MAX_REVIEW_REQUEST_ATTEMPTS = 3;

interface ReviewRequestRow {
  id: string;
  business_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  project_name: string | null;
  review_link: string | null;
  channel: string | null;
  status: string;
  attempt_count: number | null;
  follow_up_of: string | null;
}

/** The business's display name, for the message body. */
async function businessName(businessId: string | null): Promise<string> {
  if (!businessId) return "";
  const db = getSupabaseClient();
  const { data } = await db.from("businesses").select("name").eq("id", businessId).maybeSingle();
  const name = (data as any)?.name;
  return typeof name === "string" ? name : "";
}

/**
 * Send one review request and record the outcome on its row.
 *
 * An opt-out is a terminal state, not a failure to retry: the customer said no,
 * so the row is marked `opted_out` and never picked up again.
 */
async function deliverReviewRequest(row: ReviewRequestRow, followUp: boolean): Promise<"sent" | "skipped" | "failed"> {
  const db = getSupabaseClient();
  const phone = normalisePhone(row.customer_phone);
  const name = await businessName(row.business_id);

  if (!phone || !row.business_id || !row.review_link || !name) {
    await db
      .from("review_requests")
      .update({
        status: "failed",
        last_error: "missing phone, business, review link or business name",
        follow_up_after: null,
      })
      .eq("id", row.id);
    return "failed";
  }

  const result = await sendSms({
    to: phone,
    message: reviewRequestMessage({
      customerName: row.customer_name,
      businessName: name,
      reviewLink: row.review_link,
      followUp,
    }),
    businessId: row.business_id,
    campaignId: followUp ? "review_request_follow_up" : "review_request",
  });

  const attempts = (Number(row.attempt_count) || 0) + 1;

  if (result.ok) {
    await db
      .from("review_requests")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        attempt_count: attempts,
        twilio_sid: result.sid ?? null,
        last_error: null,
        // A follow-up never earns another follow-up: one nudge, then stop.
        follow_up_after: followUp
          ? null
          : new Date(Date.now() + FOLLOW_UP_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", row.id);
    return "sent";
  }

  if (result.reason === "opted_out") {
    await db
      .from("review_requests")
      .update({ status: "opted_out", attempt_count: attempts, last_error: result.error, follow_up_after: null })
      .eq("id", row.id);
    return "skipped";
  }

  // `not_configured` is transient (someone has yet to add credentials), so the
  // row goes back to scheduled and retries — bounded by the attempt counter.
  const transient = result.reason === "not_configured" || result.reason === "provider_error";
  const giveUp = !transient || attempts >= MAX_REVIEW_REQUEST_ATTEMPTS;
  await db
    .from("review_requests")
    .update({
      status: giveUp ? "failed" : "scheduled",
      attempt_count: attempts,
      last_error: result.error,
      ...(giveUp ? { follow_up_after: null } : {}),
    })
    .eq("id", row.id);
  return giveUp ? "failed" : "skipped";
}

/**
 * Send review requests that are due, then nudge sent-but-unanswered ones once.
 *
 * `review_requests.scheduled_for` has existed on this table from the beginning
 * with nothing reading it, so scheduling a request silently did nothing. This
 * is the consumer.
 */
async function processReviewRequests(): Promise<TickSummary["reviewRequests"]> {
  const db = getSupabaseClient();
  const nowIso = new Date().toISOString();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  const tally = (outcome: "sent" | "skipped" | "failed") => {
    if (outcome === "sent") sent++;
    else if (outcome === "skipped") skipped++;
    else failed++;
  };

  // ── due scheduled requests ───────────────────────────────────────────────
  const { data: due, error: dueErr } = await db
    .from("review_requests")
    .select("id, business_id, customer_name, customer_phone, project_name, review_link, channel, status, attempt_count, follow_up_of")
    .eq("status", "scheduled")
    .lte("scheduled_for", nowIso)
    .limit(MAX_ITEMS_PER_TICK);
  if (dueErr) throw new Error(`review request scan failed: ${dueErr.message}`);

  for (const row of (due as ReviewRequestRow[]) || []) {
    // CLAIM, same conditional-update pattern as the other processors, so a
    // manual send and this tick can never double-text the same customer.
    const { data: claimed, error: claimErr } = await db
      .from("review_requests")
      .update({ status: "sending" })
      .eq("id", row.id)
      .eq("status", "scheduled")
      .select("id");
    if (claimErr) {
      log.error({ err: claimErr.message, id: row.id }, "review request claim failed");
      continue;
    }
    if (!claimed || claimed.length === 0) continue;
    tally(await deliverReviewRequest(row, false));
  }

  // ── follow-ups: sent, nudge window elapsed, still no review ─────────────
  const { data: nudges, error: nudgeErr } = await db
    .from("review_requests")
    .select("id, business_id, customer_name, customer_phone, project_name, review_link, channel, status, attempt_count, follow_up_of")
    .eq("status", "sent")
    .is("follow_up_of", null)
    .not("follow_up_after", "is", null)
    .lte("follow_up_after", nowIso)
    .limit(MAX_ITEMS_PER_TICK);
  if (nudgeErr) {
    log.warn({ err: nudgeErr.message }, "review request follow-up scan failed");
    return { processed: sent + skipped + failed, sent, skipped, failed };
  }

  for (const row of (nudges as ReviewRequestRow[]) || []) {
    // Clear the window first, whatever happens next: a row that cannot be
    // nudged must not be rescanned every minute forever.
    const { data: claimed } = await db
      .from("review_requests")
      .update({ follow_up_after: null })
      .eq("id", row.id)
      .not("follow_up_after", "is", null)
      .select("id");
    if (!claimed || claimed.length === 0) continue;

    // Did the customer already leave a review? If the business has any review
    // newer than the request, assume this one landed and do not chase it.
    if (row.business_id) {
      const { count } = await db
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("business_id", row.business_id)
        .gte("date", new Date(Date.now() - FOLLOW_UP_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString());
      if ((count || 0) > 0) {
        skipped++;
        continue;
      }
    }

    const { data: followUp, error: insErr } = await db
      .from("review_requests")
      .insert({
        business_id: row.business_id,
        customer_name: row.customer_name || "Customer",
        customer_phone: row.customer_phone || "N/A",
        project_name: row.project_name || "Project",
        review_link: row.review_link,
        channel: row.channel || "sms",
        status: "sending",
        follow_up_of: row.id,
      })
      .select("id")
      .single();
    if (insErr || !followUp) {
      log.warn({ err: insErr?.message, id: row.id }, "review request follow-up insert failed");
      failed++;
      continue;
    }
    tally(await deliverReviewRequest({ ...row, id: followUp.id, attempt_count: 0, follow_up_of: row.id }, true));
  }

  return { processed: sent + skipped + failed, sent, skipped, failed };
}

// ── (e) Review alerts: a bad new review should reach a human ─────────────────

/** At or below this rating, the business gets told. */
const ALERT_AT_OR_BELOW = 3;
/** Only look at reviews this recent, so enabling the watcher is not a flood. */
const ALERT_LOOKBACK_HOURS = 72;

/**
 * Notify a business's owner and staff about new low-rated reviews.
 *
 * Previously a one-star review landed in the database and told nobody, which is
 * the single worst silence in a reputation product: the window to reply well is
 * hours, and review responses are themselves a ranking input.
 *
 * Idempotent through `notifications.dedupe_key`, so the same review never
 * produces a second alert however often this runs.
 */
async function processReviewAlerts(): Promise<TickSummary["reviewAlerts"]> {
  const db = getSupabaseClient();
  const since = new Date(Date.now() - ALERT_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("reviews")
    .select("id, business_id, rating, text, author, date, response")
    .lte("rating", ALERT_AT_OR_BELOW)
    .gte("date", since)
    .is("response", null)
    .limit(MAX_ITEMS_PER_TICK);
  if (error) throw new Error(`review alert scan failed: ${error.message}`);

  const reviews = (data as any[]) || [];
  let notified = 0;

  for (const review of reviews) {
    const businessId = review?.business_id;
    if (!businessId || !review?.id) continue;

    const recipients = await businessRecipients(businessId);
    if (recipients.length === 0) continue;

    const rating = Number(review.rating) || 0;
    const authorName =
      review.author && typeof review.author === "object" && typeof review.author.name === "string"
        ? review.author.name
        : "A customer";
    const snippet = typeof review.text === "string" && review.text.trim() ? `: "${review.text.trim().slice(0, 140)}"` : "";

    const rows = recipients.map((user_id) => ({
      user_id,
      business_id: businessId,
      type: rating <= 2 ? "error" : "warning",
      title: `New ${rating}-star review`,
      message: `${authorName} left a ${rating}-star review${snippet}. Replying quickly is the single best thing you can do about it.`,
      read: false,
      source: "system",
      priority: rating <= 2 ? "urgent" : "high",
      category: "project",
      action_url: "/admin/reviews",
      action_label: "Reply to it",
      dedupe_key: `review_alert:${review.id}`,
    }));

    // ignoreDuplicates leans on the (user_id, dedupe_key) unique index: a review
    // already alerted on is a no-op rather than a conflict.
    const { error: insErr } = await db.from("notifications").upsert(rows, {
      onConflict: "user_id,dedupe_key",
      ignoreDuplicates: true,
    });
    if (insErr) {
      log.warn({ err: insErr.message, reviewId: review.id }, "review alert insert failed");
      continue;
    }
    notified += rows.length;
  }

  return { reviews: reviews.length, notified };
}

/** Owner + members of a business: who should hear about its reviews. */
async function businessRecipients(businessId: string): Promise<string[]> {
  const db = getSupabaseClient();
  const ids = new Set<string>();
  try {
    const { data: biz } = await db.from("businesses").select("owner_id").eq("id", businessId).maybeSingle();
    const ownerId = (biz as any)?.owner_id;
    if (typeof ownerId === "string" && ownerId) ids.add(ownerId);
  } catch (err) {
    log.warn({ err, businessId }, "review alert owner lookup failed");
  }
  try {
    const { data: members } = await db
      .from("business_members")
      .select("user_id, role")
      .eq("business_id", businessId)
      .in("role", ["owner", "staff"]);
    for (const m of (members as any[]) || []) {
      if (typeof m?.user_id === "string" && m.user_id) ids.add(m.user_id);
    }
  } catch (err) {
    log.warn({ err, businessId }, "review alert member lookup failed");
  }
  return [...ids];
}
