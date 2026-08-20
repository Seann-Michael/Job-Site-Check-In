/**
 * Provider-agnostic email sender.
 *
 * Reads provider configuration from the `email_providers` table (via the
 * service-role Supabase client) and dispatches through whichever provider is
 * active: SMTP (nodemailer) or one of the HTTP APIs (Resend, SendGrid,
 * Mailgun, Postmark). All outbound HTTP goes through `safeFetch` (SSRF-safe,
 * timed). Credentials are read from the provider's `config` jsonb first, with
 * an environment-variable fallback so deployments that keep secrets out of the
 * database still work.
 *
 * The `type` column is the provider kind: 'smtp' | 'resend' | 'sendgrid' |
 * 'mailgun' | 'postmark'. The legacy client also stored type 'api' with the
 * concrete kind in `provider_key`; that shape is handled too.
 */
import nodemailer from "nodemailer";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "./logger";
import { safeFetch, readLimitedText } from "./safeFetch";

const log = logger.child({ module: "email" });

const SEND_TIMEOUT_MS = 20_000;

// ── Errors ───────────────────────────────────────────────────────────────────

/** Thrown when no active email provider exists; callers map this to HTTP 503. */
export class EmailNotConfiguredError extends Error {
  constructor(message = "No email provider configured") {
    super(message);
    this.name = "EmailNotConfiguredError";
  }
}

/** Thrown when a provider rejects a send. `.message` is safe to surface (sanitized). */
export class EmailSendError extends Error {
  constructor(message: string, public readonly providerStatus?: number) {
    super(message);
    this.name = "EmailSendError";
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface EmailProviderRow {
  id: string;
  name: string;
  type: string;
  provider_key: string | null;
  config: Record<string, any>;
  is_active: boolean;
  is_default: boolean;
  stats: Record<string, any> | null;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  /** Overrides the provider's configured from address. */
  from?: string;
}

export interface SendResult {
  id?: string;
}

export interface BulkRecipient {
  email: string;
  name?: string;
}

export interface BulkContent {
  subject: string;
  html?: string;
  text?: string;
}

export interface BulkResult {
  email: string;
  ok: boolean;
  id?: string;
  error?: string;
}

export interface BulkOptions {
  /** Called once per (deduped) recipient with the delivery outcome. */
  onResult?: (result: BulkResult) => void | Promise<void>;
  /** Send via a specific provider instead of resolving the active one. */
  provider?: EmailProviderRow;
}

export interface BulkSummary {
  sent: number;
  failed: number;
  errors: { email: string; error: string }[];
}

// ── Provider resolution ──────────────────────────────────────────────────────

/**
 * The active provider: the default one that is active, else the first active
 * provider. Returns null when nothing is active.
 */
export async function getActiveProvider(): Promise<EmailProviderRow | null> {
  const db = getSupabaseClient();
  const { data, error } = await db
    .from("email_providers")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: true });
  if (error) {
    log.error({ err: error.message }, "Failed to load email providers");
    return null;
  }
  const rows = (data as EmailProviderRow[]) || [];
  if (rows.length === 0) return null;
  return rows.find((p) => p.is_default) ?? rows[0];
}

/** Load a single provider by id (regardless of is_active). Null when absent. */
export async function getProviderById(id: string): Promise<EmailProviderRow | null> {
  const db = getSupabaseClient();
  const { data, error } = await db.from("email_providers").select("*").eq("id", id).maybeSingle();
  if (error) {
    log.error({ err: error.message }, "Failed to load email provider by id");
    return null;
  }
  return (data as EmailProviderRow) ?? null;
}

/** True when at least one active provider exists. */
export async function isEmailConfigured(): Promise<boolean> {
  return (await getActiveProvider()) !== null;
}

// ── Config helpers ───────────────────────────────────────────────────────────

function cfgOf(provider: EmailProviderRow): Record<string, any> {
  return (provider.config && typeof provider.config === "object" ? provider.config : {}) as Record<string, any>;
}

/** First non-empty value among the given config keys. */
function pick(cfg: Record<string, any>, ...keys: string[]): any {
  for (const k of keys) {
    const v = cfg[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/** Resolve the provider kind, tolerating the legacy `type: 'api'` shape. */
function providerKind(provider: EmailProviderRow): string {
  const type = (provider.type || "").toLowerCase().trim();
  if (type && type !== "api" && type !== "smtp") return type;
  if (type === "smtp") return "smtp";
  // type is generic 'api' (or empty): fall back to provider_key.
  const key = (provider.provider_key || "").toLowerCase().trim();
  if (["resend", "sendgrid", "mailgun", "postmark"].includes(key)) return key;
  if (key === "gmail") return "smtp";
  return type || key;
}

/**
 * Resolve the `from` address. Honours an explicit override, then the config's
 * from/from_email/fromEmail. When a from name is present and the address is a
 * bare email, produces `"Name" <email>`. Throws when no address is available.
 */
function resolveFrom(provider: EmailProviderRow, override?: string): string {
  const cfg = cfgOf(provider);
  const raw = (override && override.trim()) || pick(cfg, "from", "from_email", "fromEmail");
  if (!raw || typeof raw !== "string") {
    throw new EmailSendError(`Email provider "${provider.name}" has no from address configured`);
  }
  if (raw.includes("<")) return raw; // already "Name <email>"
  const name = pick(cfg, "fromName", "from_name");
  return name ? `${name} <${raw}>` : raw;
}

/** API key for an HTTP provider: config first, then the given env var. */
function apiKeyFor(provider: EmailProviderRow, envName: string): string {
  const cfg = cfgOf(provider);
  const key = pick(cfg, "api_key", "apiKey", "token", "server_token", "serverToken") || process.env[envName];
  if (!key) {
    throw new EmailSendError(`Email provider "${provider.name}" is missing its API key`);
  }
  return String(key);
}

/** Parse `"Name <email>"` (or a bare email) into parts. */
function parseAddress(addr: string): { email: string; name?: string } {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(addr);
  if (m) return { name: m[1] ? m[1].replace(/^"|"$/g, "") : undefined, email: m[2].trim() };
  return { email: addr.trim() };
}

// ── Provider error extraction ────────────────────────────────────────────────

/** Pull a concise, safe message out of a provider error body. */
function extractProviderError(kind: string, status: number, body: string): string {
  let msg = "";
  try {
    const data = JSON.parse(body);
    msg =
      data?.message ||
      data?.Message ||
      data?.error?.message ||
      (Array.isArray(data?.errors) ? data.errors.map((e: any) => e?.message).filter(Boolean).join("; ") : "") ||
      data?.error ||
      "";
  } catch {
    msg = body.slice(0, 200);
  }
  msg = (msg || "").toString().replace(/\s+/g, " ").trim().slice(0, 300);
  return msg ? `${kind} error (${status}): ${msg}` : `${kind} error (${status})`;
}

// ── Dispatch ─────────────────────────────────────────────────────────────────

async function deliver(provider: EmailProviderRow, input: SendEmailInput, from: string): Promise<SendResult> {
  const kind = providerKind(provider);
  switch (kind) {
    case "smtp":
      return sendSmtp(provider, input, from);
    case "resend":
      return sendResend(provider, input, from);
    case "sendgrid":
      return sendSendgrid(provider, input, from);
    case "mailgun":
      return sendMailgun(provider, input, from);
    case "postmark":
      return sendPostmark(provider, input, from);
    default:
      throw new EmailSendError(`Unsupported email provider type: ${provider.type || provider.provider_key || "unknown"}`);
  }
}

async function sendSmtp(provider: EmailProviderRow, input: SendEmailInput, from: string): Promise<SendResult> {
  const cfg = cfgOf(provider);
  const host = pick(cfg, "host");
  if (!host) throw new EmailSendError("SMTP host is not configured");
  const port = Number(pick(cfg, "port")) || 587;
  const secureCfg = pick(cfg, "secure");
  const secure = secureCfg === undefined ? port === 465 : Boolean(secureCfg);
  const user = pick(cfg, "user", "username") || process.env.SMTP_USER;
  const pass = pick(cfg, "pass", "password") || process.env.SMTP_PASSWORD;

  const transport = nodemailer.createTransport({
    host: String(host),
    port,
    secure,
    auth: user && pass ? { user: String(user), pass: String(pass) } : undefined,
    connectionTimeout: SEND_TIMEOUT_MS,
    greetingTimeout: SEND_TIMEOUT_MS,
    socketTimeout: SEND_TIMEOUT_MS,
  });

  try {
    const info = await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });
    return { id: info?.messageId };
  } catch (err: any) {
    throw new EmailSendError(`SMTP send failed: ${String(err?.message || "unknown error").slice(0, 200)}`);
  } finally {
    transport.close();
  }
}

async function sendResend(provider: EmailProviderRow, input: SendEmailInput, from: string): Promise<SendResult> {
  const apiKey = apiKeyFor(provider, "RESEND_API_KEY");
  const res = await safeFetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: input.subject,
      ...(input.html ? { html: input.html } : {}),
      ...(input.text ? { text: input.text } : {}),
    }),
    timeoutMs: SEND_TIMEOUT_MS,
  });
  const body = await readLimitedText(res);
  if (!res.ok) throw new EmailSendError(extractProviderError("Resend", res.status, body), res.status);
  const data = safeParse(body);
  return { id: data?.id };
}

async function sendSendgrid(provider: EmailProviderRow, input: SendEmailInput, from: string): Promise<SendResult> {
  const apiKey = apiKeyFor(provider, "SENDGRID_API_KEY");
  const fromAddr = parseAddress(from);
  const content: { type: string; value: string }[] = [];
  if (input.text) content.push({ type: "text/plain", value: input.text });
  if (input.html) content.push({ type: "text/html", value: input.html });
  if (content.length === 0) content.push({ type: "text/plain", value: "" });

  const res = await safeFetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: input.to }] }],
      from: fromAddr.name ? { email: fromAddr.email, name: fromAddr.name } : { email: fromAddr.email },
      subject: input.subject,
      content,
    }),
    timeoutMs: SEND_TIMEOUT_MS,
  });
  const body = await readLimitedText(res);
  if (!res.ok) throw new EmailSendError(extractProviderError("SendGrid", res.status, body), res.status);
  return { id: res.headers.get("x-message-id") ?? undefined };
}

async function sendMailgun(provider: EmailProviderRow, input: SendEmailInput, from: string): Promise<SendResult> {
  const apiKey = apiKeyFor(provider, "MAILGUN_API_KEY");
  const cfg = cfgOf(provider);
  const domain = pick(cfg, "domain") || process.env.MAILGUN_DOMAIN;
  if (!domain) throw new EmailSendError(`Email provider "${provider.name}" is missing its Mailgun domain`);

  const form = new URLSearchParams();
  form.set("from", from);
  form.set("to", input.to);
  form.set("subject", input.subject);
  if (input.html) form.set("html", input.html);
  if (input.text) form.set("text", input.text);

  const auth = Buffer.from(`api:${apiKey}`).toString("base64");
  const res = await safeFetch(`https://api.mailgun.net/v3/${encodeURIComponent(String(domain))}/messages`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    timeoutMs: SEND_TIMEOUT_MS,
  });
  const body = await readLimitedText(res);
  if (!res.ok) throw new EmailSendError(extractProviderError("Mailgun", res.status, body), res.status);
  const data = safeParse(body);
  return { id: data?.id };
}

async function sendPostmark(provider: EmailProviderRow, input: SendEmailInput, from: string): Promise<SendResult> {
  const token = apiKeyFor(provider, "POSTMARK_SERVER_TOKEN");
  const cfg = cfgOf(provider);
  const res = await safeFetch("https://api.postmark.com/email", {
    method: "POST",
    headers: {
      "X-Postmark-Server-Token": token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      From: from,
      To: input.to,
      Subject: input.subject,
      ...(input.html ? { HtmlBody: input.html } : {}),
      ...(input.text ? { TextBody: input.text } : {}),
      MessageStream: pick(cfg, "messageStream", "message_stream") || "outbound",
    }),
    timeoutMs: SEND_TIMEOUT_MS,
  });
  const body = await readLimitedText(res);
  if (!res.ok) throw new EmailSendError(extractProviderError("Postmark", res.status, body), res.status);
  const data = safeParse(body);
  return { id: data?.MessageID };
}

function safeParse(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ── Stats ────────────────────────────────────────────────────────────────────

/** Best-effort increment of a provider's sent/failed counters. */
async function bumpStats(providerId: string, sent: number, failed: number): Promise<void> {
  if (sent === 0 && failed === 0) return;
  try {
    const db = getSupabaseClient();
    const { data } = await db.from("email_providers").select("stats").eq("id", providerId).maybeSingle();
    const stats = { ...((data as any)?.stats || {}) };
    stats.sent = (Number(stats.sent) || 0) + sent;
    stats.failed = (Number(stats.failed) || 0) + failed;
    await db.from("email_providers").update({ stats, updated_at: new Date().toISOString() }).eq("id", providerId);
  } catch (err) {
    log.warn({ err }, "Failed to update provider stats");
  }
}

// ── Public send API ──────────────────────────────────────────────────────────

/**
 * Send a single email via a specific provider (used by the per-provider test
 * endpoint). Updates the provider's stats best-effort.
 */
export async function sendEmailViaProvider(provider: EmailProviderRow, input: SendEmailInput): Promise<SendResult> {
  if (!input.to || typeof input.to !== "string") throw new EmailSendError("A recipient (to) is required");
  const from = resolveFrom(provider, input.from);
  try {
    const result = await deliver(provider, input, from);
    await bumpStats(provider.id, 1, 0);
    return result;
  } catch (err) {
    await bumpStats(provider.id, 0, 1);
    throw err;
  }
}

/**
 * Send a single email via the active provider. Throws EmailNotConfiguredError
 * when no provider is active (caller maps to 503). This is the entry point a
 * later automation change imports.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendResult> {
  const provider = await getActiveProvider();
  if (!provider) throw new EmailNotConfiguredError();
  return sendEmailViaProvider(provider, input);
}

/**
 * Send to many recipients sequentially, catching per-recipient failures. Each
 * recipient's name/email personalize the subject/body via renderTemplate.
 * Dedupes by email and skips empty addresses. Updates provider stats once.
 */
export async function sendBulk(
  recipients: BulkRecipient[],
  content: BulkContent,
  options: BulkOptions = {},
): Promise<BulkSummary> {
  const provider = options.provider ?? (await getActiveProvider());
  if (!provider) throw new EmailNotConfiguredError();
  const from = resolveFrom(provider);

  let sent = 0;
  let failed = 0;
  const errors: { email: string; error: string }[] = [];
  const seen = new Set<string>();

  for (const r of recipients) {
    const email = (r?.email || "").trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const vars = { name: r.name || "", email };
    const input: SendEmailInput = {
      to: email,
      subject: renderTemplate(content.subject, vars),
      html: content.html ? renderTemplate(content.html, vars) : undefined,
      text: content.text ? renderTemplate(content.text, vars) : undefined,
      from,
    };

    try {
      const result = await deliver(provider, input, from);
      sent++;
      await options.onResult?.({ email, ok: true, id: result.id });
    } catch (err: any) {
      failed++;
      const message = err instanceof Error ? err.message : "Send failed";
      errors.push({ email, error: message });
      await options.onResult?.({ email, ok: false, error: message });
    }
  }

  await bumpStats(provider.id, sent, failed);
  return { sent, failed, errors };
}

// ── Templating ───────────────────────────────────────────────────────────────

/**
 * Replace `{{ token }}` placeholders from `vars`. A token whose key is present
 * in `vars` is replaced (an empty/null value becomes ""); tokens whose key is
 * absent are left intact, so multi-stage rendering can fill them later.
 */
export function renderTemplate(body: string, vars: Record<string, any> = {}): string {
  if (!body || typeof body !== "string") return body ?? "";
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in vars)) return match;
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}
