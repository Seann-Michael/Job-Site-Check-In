/**
 * Outbound SMS, with the opt-out list enforced at the single point every sender
 * goes through.
 *
 * Why this exists as a lib rather than living in the route: the Express handler
 * was the only way to send a message, so the background worker could not send
 * one at all, and nothing checked whether the recipient had replied STOP.
 * Honouring an opt-out is a legal obligation under the TCPA and it has to hold
 * for every sender — a route, a worker tick, a workflow step — which means the
 * check belongs next to the send, not in each caller.
 *
 * `sendSms` is the only function that talks to Twilio. It refuses to send to a
 * suppressed number and says so, rather than throwing.
 */
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "./logger";
import { E164_RE as E164, normalisePhone } from "./phone";

const log = logger.child({ module: "sms" });

export { E164_RE, normalisePhone } from "./phone";
export const MAX_SMS_LENGTH = 1600;

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  webhookUrl?: string;
}

/** Twilio credentials from the environment, or null when not configured. */
export function getTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL;
  if (accountSid && authToken && phoneNumber) {
    return { accountSid, authToken, phoneNumber, webhookUrl };
  }
  return null;
}

/**
 * The words carriers and regulators treat as an opt-out, and the words that
 * reverse it. Matched on the whole message body, trimmed, case-insensitive —
 * "stop" opts out, "please stop texting me" does too, "non-stop service" does
 * not.
 */
const STOP_WORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "stop all", "optout", "opt out"]);
const START_WORDS = new Set(["start", "unstop", "yes", "subscribe", "optin", "opt in"]);

export type InboundIntent = "stop" | "start" | "help" | "other";

/** Classify an inbound SMS body. */
export function classifyInbound(body: unknown): InboundIntent {
  if (typeof body !== "string") return "other";
  const normalised = body.trim().toLowerCase().replace(/[.!?]+$/, "");
  if (STOP_WORDS.has(normalised)) return "stop";
  if (START_WORDS.has(normalised)) return "start";
  if (normalised === "help" || normalised === "info") return "help";
  // A longer sentence still counts when it is unmistakably an opt-out. The
  // word boundary has to exclude hyphens as well as word characters, or
  // "non-stop service was great" reads as an opt-out and silently suppresses a
  // happy customer. Exact keywords are already handled above (and by Twilio's
  // own opt-out handling), so this heuristic can afford to be the strict one.
  if (/(?<![\w-])(stop|unsubscribe)(?![\w-])/.test(normalised) && normalised.length <= 60) {
    return "stop";
  }
  return "other";
}

/**
 * Postgres/PostgREST codes that mean "this table isn't there", as opposed to
 * "the query failed". An absent suppression list cannot be hiding an opt-out,
 * so it is the one read error that is safe to treat as empty — which keeps a
 * deploy that lands ahead of its migration from silently blocking every
 * message instead of sending them.
 */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205", "PGRST204"]);

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code && MISSING_TABLE_CODES.has(error.code)) return true;
  return /relation .* does not exist|could not find the table/i.test(error.message || "");
}

/**
 * Is this number suppressed?
 *
 * Checks a business-scoped opt-out and a platform-wide one, because a STOP sent
 * to the shared sending number is not always attributable to one tenant. Two
 * plain queries rather than one `.or()`: a PostgREST `or` filter takes its
 * operands as a string, so building one by interpolating an id is a filter
 * injection waiting to happen, and two `.eq`s cost nothing here.
 *
 * Fails CLOSED on a real read error — messaging someone who asked us to stop is
 * worse than not messaging at all.
 */
export async function isOptedOut(phone: string, businessId?: string | null): Promise<boolean> {
  const normalised = normalisePhone(phone);
  if (!normalised) return false;

  const db = getSupabaseClient();

  const lookup = async (scoped: boolean): Promise<boolean | "error"> => {
    try {
      let query = db.from("sms_opt_outs").select("id").eq("phone", normalised).limit(1);
      query = scoped ? query.eq("business_id", businessId as string) : query.is("business_id", null);
      const { data, error } = await query;
      if (error) {
        if (isMissingTable(error)) {
          log.warn("sms_opt_outs is not present; treating the suppression list as empty");
          return false;
        }
        log.error({ err: error.message }, "opt-out lookup failed; refusing to send");
        return "error";
      }
      return Array.isArray(data) ? data.length > 0 : !!data;
    } catch (err) {
      log.error({ err }, "opt-out lookup threw; refusing to send");
      return "error";
    }
  };

  const global = await lookup(false);
  if (global === "error") return true;
  if (global) return true;

  if (!businessId) return false;
  const scoped = await lookup(true);
  if (scoped === "error") return true;
  return scoped;
}

/** Record an opt-out. Idempotent — a repeated STOP is not an error. */
export async function recordOptOut(
  phone: string,
  businessId: string | null,
  reason = "stop_reply",
  source = "inbound_sms",
): Promise<boolean> {
  const normalised = normalisePhone(phone);
  if (!normalised) return false;
  try {
    const db = getSupabaseClient();
    const { error } = await db
      .from("sms_opt_outs")
      .upsert(
        { phone: normalised, business_id: businessId, reason, source },
        { onConflict: businessId ? "business_id,phone" : "phone", ignoreDuplicates: true },
      );
    if (error) {
      log.error({ err: error.message }, "opt-out insert failed");
      return false;
    }
    log.info({ businessId, reason }, "SMS opt-out recorded");
    return true;
  } catch (err) {
    log.error({ err }, "opt-out insert threw");
    return false;
  }
}

/** Remove an opt-out after an explicit START/UNSTOP from the same number. */
export async function clearOptOut(phone: string, businessId: string | null): Promise<void> {
  const normalised = normalisePhone(phone);
  if (!normalised) return;
  try {
    const db = getSupabaseClient();
    let query = db.from("sms_opt_outs").delete().eq("phone", normalised);
    query = businessId ? query.eq("business_id", businessId) : query.is("business_id", null);
    const { error } = await query;
    if (error) log.error({ err: error.message }, "opt-out delete failed");
    else log.info({ businessId }, "SMS opt-out cleared after opt-in");
  } catch (err) {
    log.error({ err }, "opt-out delete threw");
  }
}

export interface SendSmsInput {
  to: string;
  message: string;
  businessId: string;
  campaignId?: string | null;
}

export type SendSmsFailure = "not_configured" | "opted_out" | "invalid" | "provider_error";

/**
 * Deliberately a flat shape rather than a discriminated union: this project
 * compiles with `strictNullChecks: false`, under which TypeScript does not
 * narrow a union on a boolean literal, so every `result.reason` after an
 * `if (!result.ok)` would be an error. One interface with optional fields is
 * honest about that instead of pretending to narrow.
 */
export interface SendSmsResult {
  ok: boolean;
  sid?: string;
  status?: string;
  reason?: SendSmsFailure;
  error?: string;
}

/**
 * Send one SMS. The ONLY path to Twilio in this codebase.
 *
 * Checks the suppression list first, sends, then writes an `sms_logs` row.
 * Returns a tagged result instead of throwing, so a caller in a loop (the
 * worker) can record a per-recipient outcome and carry on.
 */
export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const config = getTwilioConfig();
  if (!config) {
    return { ok: false, reason: "not_configured", error: "SMS is not configured" };
  }
  const to = normalisePhone(input.to);
  if (!E164.test(to)) {
    return { ok: false, reason: "invalid", error: "Phone number must be in E.164 format" };
  }
  if (!input.message || input.message.length > MAX_SMS_LENGTH) {
    return { ok: false, reason: "invalid", error: `Message must be 1-${MAX_SMS_LENGTH} characters` };
  }
  if (await isOptedOut(to, input.businessId)) {
    return { ok: false, reason: "opted_out", error: "This number has opted out of messages" };
  }

  const authString = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const params = new URLSearchParams({
    From: config.phoneNumber,
    To: to,
    Body: input.message,
    ...(config.webhookUrl ? { StatusCallback: config.webhookUrl } : {}),
  });

  let data: { sid?: string; status?: string; code?: number; message?: string } = {};
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authString}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        signal: AbortSignal.timeout(15_000),
      },
    );
    data = (await response.json().catch(() => ({}))) as typeof data;
    if (!response.ok) {
      // Twilio's own error text is logged, never returned to a tenant.
      log.error({ status: response.status, code: data?.code, message: data?.message }, "Twilio API error");
      return { ok: false, reason: "provider_error", error: "SMS provider request failed" };
    }
  } catch (err) {
    log.error({ err }, "Twilio request failed");
    return { ok: false, reason: "provider_error", error: "SMS provider request failed" };
  }

  try {
    const db = getSupabaseClient();
    const { error } = await db.from("sms_logs").insert({
      twilio_sid: data.sid,
      direction: "outbound",
      to_number: to,
      from_number: config.phoneNumber,
      message: input.message,
      status: data.status ?? "sent",
      campaign_id: input.campaignId ?? null,
      business_id: input.businessId,
    });
    if (error) log.error({ err: error.message }, "Failed to log SMS");
  } catch (err) {
    log.error({ err }, "Failed to log SMS");
  }

  return { ok: true, sid: String(data.sid || ""), status: String(data.status || "sent") };
}

/** True when the failure is the recipient's choice, not a system fault. */
export function isOptOutFailure(result: SendSmsResult): boolean {
  return !result.ok && result.reason === "opted_out";
}

/** HTTP status that matches a send failure. */
export function statusForSendFailure(reason: SendSmsFailure | undefined): number {
  switch (reason) {
    case "not_configured":
      return 503;
    case "opted_out":
      return 409;
    case "invalid":
      return 400;
    default:
      return 502;
  }
}

/**
 * Compose a review-request message.
 *
 * The opt-out sentence is appended by construction rather than left to the
 * caller: every message this product sends to a consumer must carry it.
 */
export function reviewRequestMessage(opts: {
  customerName?: string | null;
  businessName: string;
  reviewLink: string;
  followUp?: boolean;
}): string {
  const who = (opts.customerName || "").trim().split(/\s+/)[0] || "there";
  const lead = opts.followUp
    ? `Hi ${who}, just a quick follow-up from ${opts.businessName} — if you have a minute, we'd really value your review:`
    : `Hi ${who}! Thank you for choosing ${opts.businessName}. We'd love to hear about your experience. Please leave us a review:`;
  return `${lead} ${opts.reviewLink}\n\nReply STOP to opt out.`;
}
