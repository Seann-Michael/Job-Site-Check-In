/**
 * Email API — /api/email/*. Super-admin only.
 *
 *   POST /api/email/providers/:id/test   send a real test email via THAT provider
 *   POST /api/email/campaigns/:id/send   send a campaign to its resolved segment
 *   POST /api/email/test                 send a quick test via the default provider
 *   GET  /api/email/status               { configured, provider }
 *
 * Sending happens server-side through server/lib/email.ts. Every send route is
 * rate-limited per user and writes an audit_logs row. When no provider is
 * active, campaign send returns 503 and does NOT mark the campaign sent.
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { getSupabaseClient } from "../supabaseClient";
import { getEnv } from "../lib/env";
import { logger } from "../lib/logger";
import { requireAuth, requireRole } from "../middleware/requireAuth";
import {
  getActiveProvider,
  getProviderById,
  sendEmailViaProvider,
  sendBulk,
  renderTemplate,
  EmailNotConfiguredError,
  type BulkRecipient,
} from "../lib/email";

const log = logger.child({ module: "email" });
const reqLog = (req: Request) => (req.log ?? log).child({ module: "email" });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NO_PROVIDER_MESSAGE = "No email provider configured — add one first";

function normalizeEmail(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const e = v.trim();
  if (!e || e.length > 254 || !EMAIL_RE.test(e)) return null;
  return e;
}

function appName(): string {
  const url = getEnv("APP_URL");
  if (url) {
    try {
      return new URL(url).hostname;
    } catch {
      /* fall through */
    }
  }
  return "Local SEO Ranker";
}

// ── Rate limits (per user) ───────────────────────────────────────────────────

const perUser = (limit: number, message: string) =>
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip || "anonymous",
    validate: { keyGeneratorIpFallback: false },
    message: { error: message },
  });

/** 30 test emails / hour / user (shared by both test endpoints). */
export const emailTestLimiter = perUser(30, "Too many test emails, please try again later");
/** 10 campaign sends / hour / user. */
export const campaignSendLimiter = perUser(10, "Too many campaign sends, please try again later");

// ── Audit ────────────────────────────────────────────────────────────────────

async function writeAudit(
  req: Request,
  entry: {
    action: "create" | "update" | "delete" | "permission_change";
    resourceType: string;
    resourceId?: string | null;
    details?: Record<string, unknown>;
  },
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
    if (error) reqLog(req).warn({ err: error }, "audit_logs insert failed");
  } catch (err) {
    reqLog(req).warn({ err }, "audit_logs insert threw");
  }
}

// ── Recipient resolution ─────────────────────────────────────────────────────

/** Columns that exist on `users` in the live schema (no `is_active` column). */
const USER_COLUMNS = "id, email, name, role, last_login, created_at, metadata";

const ROLE_KEYWORDS: Record<string, string> = {
  business_owners: "business_owner",
  "business-owners": "business_owner",
  business_owner: "business_owner",
  owners: "business_owner",
  agency_admins: "agency_admin",
  "agency-admins": "agency_admin",
  agency_admin: "agency_admin",
  staff: "staff",
  viewers: "viewer",
  viewer: "viewer",
  super_admins: "super_admin",
  "super-admins": "super_admin",
};

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  role: string | null;
  last_login: string | null;
  created_at: string | null;
  metadata: Record<string, any> | null;
  is_active?: boolean;
}

/** Dedupe by email, drop empty addresses. */
function toRecipients(rows: UserRow[]): BulkRecipient[] {
  const seen = new Set<string>();
  const out: BulkRecipient[] = [];
  for (const u of rows || []) {
    const email = (u?.email || "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ email, name: u.name || undefined });
  }
  return out;
}

/** True when the user is active. Absent `is_active` (live schema) => active. */
function userIsActive(u: UserRow): boolean {
  return u.is_active === undefined ? true : Boolean(u.is_active);
}

interface Criterion {
  field: string;
  op: string;
  value: any;
}

/** Normalize a segment's `criteria` jsonb into a flat list of rules. */
function parseCriteria(criteria: any): Criterion[] {
  const rules: Criterion[] = [];
  if (!criteria) return rules;
  const push = (field: any, op: any, value: any) => {
    if (typeof field !== "string" || !field) return;
    rules.push({ field: field.toLowerCase(), op: String(op || "eq").toLowerCase(), value });
  };
  if (Array.isArray(criteria)) {
    for (const c of criteria) {
      if (c && typeof c === "object") push(c.field ?? c.attribute ?? c.key, c.operator ?? c.op, c.value);
    }
  } else if (typeof criteria === "object") {
    for (const [k, v] of Object.entries(criteria)) {
      if (k === "match" || k === "logic") continue;
      push(k, "eq", v);
    }
  }
  return rules;
}

function evalCriterion(user: UserRow, c: Criterion, log2: ReturnType<typeof reqLog>): boolean {
  const op = c.op;
  switch (c.field) {
    case "role": {
      const role = (user.role || "").toLowerCase();
      const val = Array.isArray(c.value) ? c.value.map((x) => String(x).toLowerCase()) : String(c.value).toLowerCase();
      if (op === "neq" || op === "not_equals" || op === "ne") return role !== val;
      if (op === "in" || Array.isArray(c.value)) return (val as string[]).includes(role);
      return role === val;
    }
    case "is_active":
    case "active": {
      // Live `users` has no is_active column; only evaluate when present.
      if (user.is_active === undefined) return true; // best effort: exclude nobody extra
      const want = c.value === true || c.value === "true";
      return Boolean(user.is_active) === want;
    }
    case "created_at":
    case "signup_date": {
      const t = user.created_at ? Date.parse(user.created_at) : NaN;
      const v = Date.parse(String(c.value));
      if (Number.isNaN(t) || Number.isNaN(v)) return true;
      if (op === "before" || op === "lt" || op === "lte") return t <= v;
      if (op === "after" || op === "gt" || op === "gte") return t >= v;
      return true;
    }
    default:
      // Unsupported criterion: exclude nobody extra.
      log2.info({ field: c.field, op: c.op }, "Unsupported segment criterion, ignoring");
      return true;
  }
}

/**
 * Resolve a campaign's `target_segment` to a deduped recipient list.
 *  - 'all' / empty      → all active users with an email
 *  - 'active'           → users active in the last 30 days (fallback: all active)
 *  - a role keyword     → users with that role
 *  - a user_segments id or name → evaluate its `criteria` against users
 */
export async function resolveSegmentRecipients(targetSegment: string | null | undefined): Promise<BulkRecipient[]> {
  const db = getSupabaseClient();
  const seg = (targetSegment || "").trim();
  const key = seg.toLowerCase();
  const rlog = log;

  const loadAllUsers = async (): Promise<UserRow[]> => {
    const { data, error } = await db.from("users").select(USER_COLUMNS);
    if (error) {
      rlog.error({ err: error.message }, "Failed to load users for segment");
      return [];
    }
    return ((data as UserRow[]) || []).filter(userIsActive);
  };

  // all / empty
  if (!seg || key === "all" || key === "all_users" || key === "all-users") {
    return toRecipients(await loadAllUsers());
  }

  // active (last 30 days by last_login)
  if (key === "active" || key === "active_users") {
    const users = await loadAllUsers();
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = users.filter((u) => u.last_login && Date.parse(u.last_login) >= cutoff);
    return toRecipients(recent.length > 0 ? recent : users);
  }

  // role keyword
  if (ROLE_KEYWORDS[key]) {
    const role = ROLE_KEYWORDS[key];
    const { data, error } = await db.from("users").select(USER_COLUMNS).eq("role", role);
    if (error) {
      rlog.error({ err: error.message }, "Failed to load users by role");
      return [];
    }
    return toRecipients(((data as UserRow[]) || []).filter(userIsActive));
  }

  // user_segments id or name
  let segQuery = db.from("user_segments").select("id, name, criteria");
  segQuery = UUID_RE.test(seg) ? segQuery.eq("id", seg) : segQuery.eq("name", seg);
  const { data: segment, error: segErr } = await segQuery.maybeSingle();
  if (segErr) rlog.warn({ err: segErr.message }, "Segment lookup failed");
  if (!segment) {
    rlog.info({ segment: seg }, "Unknown target segment; no recipients");
    return [];
  }

  const rules = parseCriteria((segment as any).criteria);
  const users = await loadAllUsers();
  const matched = users.filter((u) => rules.every((c) => evalCriterion(u, c, rlog as any)));
  return toRecipients(matched);
}

// ── Handlers ─────────────────────────────────────────────────────────────────

async function handleStatus(_req: Request, res: Response) {
  try {
    const provider = await getActiveProvider();
    res.json({ configured: !!provider, provider: provider?.name ?? null });
  } catch (err) {
    log.error({ err }, "email status failed");
    res.status(500).json({ error: "Failed to read email status" });
  }
}

async function handleTest(req: Request, res: Response) {
  const to = normalizeEmail(req.body?.to);
  if (!to) return res.status(400).json({ error: "A valid recipient email is required" });
  const subject =
    typeof req.body?.subject === "string" && req.body.subject.trim()
      ? req.body.subject.trim().slice(0, 300)
      : `Test email from ${appName()}`;
  const html =
    typeof req.body?.html === "string" && req.body.html
      ? req.body.html
      : `<p>This is a test email from ${appName()}. If you received it, your email provider is working.</p>`;

  try {
    const provider = await getActiveProvider();
    if (!provider) return res.status(503).json({ error: NO_PROVIDER_MESSAGE });
    const result = await sendEmailViaProvider(provider, { to, subject, html, text: "This is a test email." });
    await writeAudit(req, {
      action: "create",
      resourceType: "email_test",
      resourceId: provider.id,
      details: { event: "test_send", to, provider: provider.name },
    });
    res.json({ success: true, id: result.id ?? null, provider: provider.name });
  } catch (err: any) {
    if (err instanceof EmailNotConfiguredError) return res.status(503).json({ error: NO_PROVIDER_MESSAGE });
    reqLog(req).error({ err: err?.message }, "test email failed");
    res.status(502).json({ success: false, error: err?.message || "Failed to send test email" });
  }
}

async function handleProviderTest(req: Request, res: Response) {
  const id = req.params.id;
  if (!UUID_RE.test(id || "")) return res.status(400).json({ error: "Invalid provider id" });
  const to = normalizeEmail(req.body?.to);
  if (!to) return res.status(400).json({ error: "A valid recipient email is required" });

  const provider = await getProviderById(id);
  if (!provider) return res.status(404).json({ error: "Provider not found" });

  try {
    const result = await sendEmailViaProvider(provider, {
      to,
      subject: `Test email from ${appName()}`,
      html: `<p>This is a test email sent via <strong>${provider.name}</strong>. Your configuration works.</p>`,
      text: `This is a test email sent via ${provider.name}. Your configuration works.`,
    });
    await writeAudit(req, {
      action: "create",
      resourceType: "email_provider_test",
      resourceId: provider.id,
      details: { event: "provider_test", to, provider: provider.name },
    });
    res.json({ success: true, id: result.id ?? null, provider: provider.name });
  } catch (err: any) {
    reqLog(req).error({ err: err?.message, providerId: id }, "provider test failed");
    res.status(502).json({ success: false, error: err?.message || "Failed to send test email" });
  }
}

/**
 * Outcome of {@link sendCampaignById}. `status` mirrors the HTTP status the
 * route would have returned so both the route and the background worker can
 * branch on the same code path.
 *   - ok: campaign was sent and the row marked `sent`.
 *   - status 503: no active email provider — the campaign row was NOT touched.
 *   - status 422: the target segment matched no recipients — row NOT touched.
 *   - status 404/500/502: lookup/send failure — row NOT marked sent.
 */
export interface CampaignSendOutcome {
  ok: boolean;
  status: number;
  error?: string;
  sent?: number;
  failed?: number;
  recipientCount?: number;
  errors?: { email: string; error: string }[];
  provider?: string;
}

/**
 * Send an email campaign by id and, on success, mark it `sent` with fresh
 * stats. This is the single source of truth for "send this campaign" — the
 * `POST /api/email/campaigns/:id/send` route and the background worker both
 * call it, so scheduled and manual sends run identical code (no self-HTTP).
 *
 * It never throws for the expected failure modes (missing provider, no
 * recipients, provider send error); those come back as an outcome the caller
 * maps to an HTTP status or a worker retry decision. It deliberately does NOT
 * write audit_logs (the route does that with request context).
 */
export async function sendCampaignById(id: string): Promise<CampaignSendOutcome> {
  if (!UUID_RE.test(id || "")) return { ok: false, status: 400, error: "Invalid campaign id" };

  const db = getSupabaseClient();
  const { data: campaign, error: campErr } = await db.from("email_campaigns").select("*").eq("id", id).maybeSingle();
  if (campErr) {
    log.error({ err: campErr.message }, "campaign lookup failed");
    return { ok: false, status: 500, error: "Failed to load campaign" };
  }
  if (!campaign) return { ok: false, status: 404, error: "Campaign not found" };

  // Must have a provider BEFORE we touch the campaign row.
  const provider = await getActiveProvider();
  if (!provider) return { ok: false, status: 503, error: NO_PROVIDER_MESSAGE };

  // Build subject + body (+ template).
  let subject: string = (campaign as any).subject || "";
  let html: string | undefined;
  let text: string | undefined;
  let templateId: string | null = (campaign as any).template_id || null;

  if (templateId) {
    const { data: tpl } = await db.from("email_templates").select("*").eq("id", templateId).maybeSingle();
    if (tpl) {
      subject = subject || (tpl as any).subject || "";
      html = (tpl as any).html_content || undefined;
      text = (tpl as any).text_content || undefined;
      if (!html && !text) html = (campaign as any).content || "";
    } else {
      templateId = null;
      html = (campaign as any).content || "";
    }
  } else {
    html = (campaign as any).content || "";
  }

  // Render global (non-per-recipient) variables once.
  const globals = { business: appName(), app: appName(), company: appName() };
  subject = renderTemplate(subject || `Update from ${appName()}`, globals);
  if (html) html = renderTemplate(html, globals);
  if (text) text = renderTemplate(text, globals);

  // Resolve recipients.
  let recipients: BulkRecipient[];
  try {
    recipients = await resolveSegmentRecipients((campaign as any).target_segment);
  } catch (err) {
    log.error({ err }, "recipient resolution failed");
    return { ok: false, status: 500, error: "Failed to resolve recipients" };
  }

  if (recipients.length === 0) {
    return { ok: false, status: 422, error: "No recipients matched this campaign's target segment" };
  }

  // Send, collecting per-recipient events for a single batch insert.
  const events: any[] = [];
  let summary;
  try {
    summary = await sendBulk(
      recipients,
      { subject, html, text },
      {
        provider,
        onResult: (r) => {
          events.push({
            campaign_id: id,
            provider_id: provider.id,
            to_email: r.email.slice(0, 320),
            status: r.ok ? "sent" : "failed",
            error: r.error ? r.error.slice(0, 500) : null,
          });
        },
      },
    );
  } catch (err: any) {
    if (err instanceof EmailNotConfiguredError) return { ok: false, status: 503, error: NO_PROVIDER_MESSAGE };
    log.error({ err: err?.message }, "campaign send failed");
    return { ok: false, status: 502, error: err?.message || "Failed to send campaign" };
  }

  // Persist email_events (best-effort).
  if (events.length > 0) {
    await db
      .from("email_events")
      .insert(events)
      .then(({ error }) => {
        if (error) log.warn({ err: error.message }, "email_events insert failed");
      });
  }

  // Update the campaign.
  const nowIso = new Date().toISOString();
  const newStats = { ...((campaign as any).stats || {}), sent: summary.sent, failed: summary.failed };
  const { error: updErr } = await db
    .from("email_campaigns")
    .update({
      status: "sent",
      sent_at: nowIso,
      recipient_count: recipients.length,
      stats: newStats,
      updated_at: nowIso,
    })
    .eq("id", id);
  if (updErr) log.warn({ err: updErr.message }, "campaign update failed");

  // Bump template usage best-effort.
  if (templateId) {
    const { data: tpl } = await db.from("email_templates").select("usage_count").eq("id", templateId).maybeSingle();
    await db
      .from("email_templates")
      .update({ usage_count: (Number((tpl as any)?.usage_count) || 0) + 1, last_used: nowIso })
      .eq("id", templateId)
      .then(({ error }) => {
        if (error) log.warn({ err: error.message }, "template usage update failed");
      });
  }

  return {
    ok: true,
    status: 200,
    sent: summary.sent,
    failed: summary.failed,
    recipientCount: recipients.length,
    provider: provider.name,
    errors: summary.errors.slice(0, 50),
  };
}

async function handleCampaignSend(req: Request, res: Response) {
  const id = req.params.id;
  if (!UUID_RE.test(id || "")) return res.status(400).json({ error: "Invalid campaign id" });

  const outcome = await sendCampaignById(id);

  if (!outcome.ok) {
    if (outcome.status >= 500) reqLog(req).error({ err: outcome.error, campaignId: id }, "campaign send failed");
    const message =
      outcome.status === 503 ? NO_PROVIDER_MESSAGE : outcome.error || "Failed to send campaign";
    return res.status(outcome.status).json({ error: message });
  }

  await writeAudit(req, {
    action: "update",
    resourceType: "email_campaign",
    resourceId: id,
    details: {
      event: "campaign_send",
      sent: outcome.sent,
      failed: outcome.failed,
      recipients: outcome.recipientCount,
      provider: outcome.provider,
    },
  });

  res.json({
    success: true,
    sent: outcome.sent,
    failed: outcome.failed,
    recipientCount: outcome.recipientCount,
    errors: (outcome.errors || []).slice(0, 50),
  });
}

// ── Router ───────────────────────────────────────────────────────────────────

/** Mount at /api/email */
export const emailRouter = Router();
emailRouter.use(requireAuth, requireRole("super_admin"));
emailRouter.get("/status", handleStatus);
emailRouter.post("/test", emailTestLimiter, handleTest);
emailRouter.post("/providers/:id/test", emailTestLimiter, handleProviderTest);
emailRouter.post("/campaigns/:id/send", campaignSendLimiter, handleCampaignSend);
