import { Request, Response } from "express";
import rateLimit from "express-rate-limit";
import { getSupabaseClient } from "../supabaseClient";
import { logger } from "../lib/logger";
import { getEnv } from "../lib/env";
import { canWriteBusiness } from "../middleware/requireAuth";
import {
  twilioParamsFromBody,
  twilioParamsFromRawBody,
  verifyTwilioSignature,
} from "../lib/twilioSignature";
import {
  sendSms,
  reviewRequestMessage,
  classifyInbound,
  recordOptOut,
  clearOptOut,
  normalisePhone,
  getTwilioConfig,
  E164_RE as SMS_E164_RE,
  MAX_SMS_LENGTH as SMS_MAX_LENGTH,
  statusForSendFailure,
} from "../lib/sms";

const moduleLog = logger.child({ module: "twilio" });
const reqLog = (req: Request) => (req.log ?? moduleLog).child({ module: "twilio" });

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface SMSRequest {
  to: string;
  message: string;
  campaignId?: string;
  businessId?: string;
}

// Re-exported from lib/sms so there is exactly one definition of each.
export const E164_RE = SMS_E164_RE;
export const MAX_SMS_LENGTH = SMS_MAX_LENGTH;

/**
 * Per-user limit for outbound SMS endpoints (send + review-request share the
 * bucket): 30 sends per hour per authenticated user. Must be mounted after
 * requireAuth so req.user is populated.
 */
export const smsSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip || "anonymous",
  // Keyed by user id, so the IPv6-subnet keyGenerator validation does not apply.
  validate: { keyGeneratorIpFallback: false },
  message: { success: false, error: "Too many messages sent, please try again later" },
});

/**
 * Validate the shared SMS fields. Returns an error string or null.
 * `businessId`, when provided, must be one the caller can act on.
 */
function validateSmsInput(req: Request, to: unknown, message: unknown, businessId: unknown): { status: number; error: string } | null {
  if (typeof to !== "string" || typeof message !== "string" || !to || !message) {
    return { status: 400, error: "Phone number and message are required" };
  }
  if (!E164_RE.test(to)) {
    return { status: 400, error: "Phone number must be in E.164 format (e.g. +15551234567)" };
  }
  if (message.length > MAX_SMS_LENGTH) {
    return { status: 400, error: `Message must be at most ${MAX_SMS_LENGTH} characters` };
  }
  // businessId is REQUIRED. It used to be optional, which meant a caller could
  // simply omit it and send SMS to any number in the world on the platform's
  // Twilio account with no tenant scoping at all — requireWrite only checks the
  // global users.role, which defaults to business_owner for every signup.
  if (typeof businessId !== "string" || businessId === "") {
    return { status: 400, error: "businessId is required" };
  }
  if (!canWriteBusiness(req, businessId)) {
    return { status: 403, error: "You do not have access to this business" };
  }
  return null;
}

/** A review link must be https and (when APP_URL is set) on the app's own host. */
function isValidReviewLink(reviewLink: unknown): boolean {
  if (typeof reviewLink !== "string" || reviewLink.length > 2048) return false;
  let url: URL;
  try {
    url = new URL(reviewLink);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const appUrl = getEnv("APP_URL");
  if (!appUrl) return false;
  try {
    return url.host.toLowerCase() === new URL(appUrl).host.toLowerCase();
  } catch {
    return false;
  }
}

// Send SMS via Twilio API
export const handleSendSMS = async (req: Request, res: Response) => {
  const log = reqLog(req);
  try {
    const { to, message, campaignId, businessId }: SMSRequest = req.body ?? {};

    const invalid = validateSmsInput(req, to, message, businessId);
    if (invalid) {
      return res.status(invalid.status).json({ success: false, error: invalid.error });
    }

    const result = await sendSms({
      to: to as string,
      message: message as string,
      businessId: businessId as string,
      campaignId: campaignId ?? null,
    });

    if (!result.ok) {
      // An opt-out is the caller's answer, not a server fault: 409 so a UI can
      // say "this customer unsubscribed" instead of "something went wrong".
      return res
        .status(statusForSendFailure(result.reason))
        .json({ success: false, error: result.error, reason: result.reason });
    }

    log.info(
      { userId: req.user?.id, businessId: businessId || null, campaignId: campaignId ?? null },
      "SMS sent",
    );
    res.json({ success: true, messageId: result.sid, status: result.status });
  } catch (error) {
    log.error({ err: error }, "Twilio SMS error");
    res.status(502).json({ success: false, error: "SMS provider request failed" });
  }
};

/** Twilio message SIDs are a two-letter prefix plus 32 hex characters. */
export const TWILIO_SID_RE = /^[A-Z]{2}[0-9a-fA-F]{32}$/;

/** Statuses Twilio sends on a message status callback. */
const TWILIO_STATUSES = new Set([
  "accepted",
  "scheduled",
  "queued",
  "sending",
  "sent",
  "receiving",
  "received",
  "delivered",
  "undelivered",
  "failed",
  "read",
  "canceled",
]);

/**
 * The URL Twilio signed. `TWILIO_WEBHOOK_URL` is authoritative when set;
 * otherwise it is derived from `APP_URL` plus the request path. The Host
 * header is never trusted — an attacker controls it and could otherwise pick
 * the URL that goes into the HMAC.
 */
function twilioWebhookUrl(req: Request): string | null {
  const configured = getEnv("TWILIO_WEBHOOK_URL");
  if (configured) return configured;
  const appUrl = getEnv("APP_URL");
  if (!appUrl) return null;
  return appUrl.replace(/\/+$/, "") + (req.originalUrl || req.url || "");
}

// Handle Twilio webhook for message status updates.
//
// This endpoint is unauthenticated in the session sense because Twilio calls
// it; authenticity comes from the X-Twilio-Signature HMAC. When
// TWILIO_AUTH_TOKEN is configured the request MUST carry a valid signature —
// an absent or wrong signature is a 403 (fail closed). When the token is not
// configured the endpoint behaves as before (dormant/unconfigured install) and
// logs a warning on every call.
export const handleTwilioWebhook = async (req: Request, res: Response) => {
  const log = reqLog(req);
  try {
    const authToken = getEnv("TWILIO_AUTH_TOKEN");
    if (authToken) {
      const url = twilioWebhookUrl(req);
      if (!url) {
        log.error("Twilio webhook cannot be verified: neither TWILIO_WEBHOOK_URL nor APP_URL is set");
        return res.status(403).send("Forbidden");
      }
      // Prefer the raw bytes so the signed params are exactly what Twilio
      // sent, independent of how the urlencoded parser expands the body.
      const params = req.rawBody
        ? twilioParamsFromRawBody(req.rawBody)
        : twilioParamsFromBody(req.body);
      if (!verifyTwilioSignature(authToken, url, params, req.headers["x-twilio-signature"])) {
        log.warn({ hasSignature: !!req.headers["x-twilio-signature"] }, "Twilio webhook signature rejected");
        return res.status(403).send("Forbidden");
      }
    } else {
      log.warn("TWILIO_AUTH_TOKEN is not set: inbound Twilio webhook accepted without signature verification");
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const rawSid = body.MessageSid;
    const MessageSid = typeof rawSid === "string" ? rawSid : "";

    // ── Inbound message (not a delivery receipt) ──────────────────────────
    // A status callback carries MessageStatus; an inbound SMS carries Body and
    // From. STOP has to be honoured here or the product keeps texting someone
    // who told it to stop, which is a TCPA violation, not a bug backlog item.
    const inboundBody = typeof body.Body === "string" ? body.Body : null;
    const fromNumber = normalisePhone(body.From);
    if (inboundBody !== null && fromNumber) {
      const intent = classifyInbound(inboundBody);
      const businessId = await businessForInboundNumber(fromNumber);

      if (intent === "stop") {
        // Recorded platform-wide when we cannot attribute the number to one
        // tenant: an unattributable STOP must still stop everything.
        await recordOptOut(fromNumber, businessId, "stop_reply", "inbound_sms");
      } else if (intent === "start") {
        await clearOptOut(fromNumber, businessId);
      }

      try {
        const db = getSupabaseClient();
        if (db) {
          await db.from("sms_logs").insert({
            twilio_sid: MessageSid || null,
            direction: "inbound",
            to_number: typeof body.To === "string" ? body.To : null,
            from_number: fromNumber,
            message: inboundBody.slice(0, 1600),
            status: "received",
            business_id: businessId,
          });
        }
      } catch (err) {
        reqLog(req).warn({ err }, "inbound SMS log failed");
      }

      reqLog(req).info({ intent, businessId }, "inbound SMS handled");
      // Twilio reads the body as TwiML; an empty 200 means "no auto-reply".
      return res.status(200).send("OK");
    }

    // Nothing to key the update on — acknowledge and no-op.
    if (!MessageSid) {
      log.info("Twilio webhook received without a MessageSid");
      return res.status(200).send("OK");
    }
    if (!TWILIO_SID_RE.test(MessageSid)) {
      log.warn("Twilio webhook received with a malformed MessageSid");
      return res.status(400).send("Invalid MessageSid");
    }

    const rawStatus = typeof body.MessageStatus === "string" ? body.MessageStatus.toLowerCase() : "";
    const status = TWILIO_STATUSES.has(rawStatus) ? rawStatus : "unknown";
    const rawErrorCode = typeof body.ErrorCode === "string" ? body.ErrorCode.trim() : "";
    const errorCode = /^\d{1,10}$/.test(rawErrorCode) ? rawErrorCode : null;
    const errorMessage =
      typeof body.ErrorMessage === "string" && body.ErrorMessage ? body.ErrorMessage.slice(0, 500) : null;

    log.info({ messageId: MessageSid, status, errorCode }, "Twilio webhook received");

    // Update message status in Supabase
    const db = getSupabaseClient();
    if (db) {
      await db
        .from("sms_logs")
        .update({
          status,
          error_code: errorCode,
          error_message: errorMessage,
          updated_at: new Date().toISOString(),
        })
        .eq("twilio_sid", MessageSid)
        .then(({ error }) => {
          if (error) log.error({ err: error.message }, "Failed to update SMS status");
        });
    }

    // Respond to Twilio
    res.status(200).send('OK');

  } catch (error) {
    log.error({ err: error }, "Twilio webhook error");
    res.status(500).send('Error processing webhook');
  }
};

// Test Twilio connection
export const handleTwilioTest = async (req: Request, res: Response) => {
  const log = reqLog(req);
  try {
    const config = getTwilioConfig();

    if (!config) {
      return res.status(503).json({
        success: false,
        error: "Twilio credentials not configured"
      });
    }

    // Test by fetching account information
    const authString = Buffer.from(
      `${config.accountSid}:${config.authToken}`
    ).toString('base64');

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`,
      {
        headers: {
          'Authorization': `Basic ${authString}`,
        },
        signal: AbortSignal.timeout(15_000),
      }
    );

    const data = (await response.json().catch(() => ({}))) as any;

    if (!response.ok) {
      log.error({ status: response.status, code: data?.code, message: data?.message }, "Twilio test failed");
      return res.status(502).json({ success: false, error: "Connection test failed" });
    }

    res.json({
      success: true,
      accountInfo: {
        friendlyName: data.friendly_name,
        status: data.status,
        type: data.type
      }
    });

  } catch (error) {
    log.error({ err: error }, "Twilio test error");
    res.status(502).json({
      success: false,
      error: "Connection test failed"
    });
  }
};

// Check if Twilio is configured
export const handleTwilioStatus = async (_req: Request, res: Response) => {
  const config = getTwilioConfig();

  res.json({
    success: true,
    configured: !!config,
    hasPhoneNumber: !!(config?.phoneNumber)
  });
};

// Send review request SMS
/**
 * Which business, if any, does this number belong to? Used to scope an inbound
 * STOP. Returns null when the number cannot be attributed, in which case the
 * opt-out is recorded platform-wide — the safer direction.
 */
async function businessForInboundNumber(fromNumber: string): Promise<string | null> {
  try {
    const db = getSupabaseClient();
    if (!db) return null;
    const { data } = await db
      .from("sms_logs")
      .select("business_id")
      .eq("direction", "outbound")
      .eq("to_number", fromNumber)
      .not("business_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = Array.isArray(data) ? data[0] : null;
    const id = (row as any)?.business_id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

export const handleSendReviewRequest = async (req: Request, res: Response) => {
  const log = reqLog(req);
  try {
    const { to, businessName, customerName, reviewLink, businessId, jobId, scheduledFor, requestId } =
      req.body ?? {};

    if (!to || !businessName || !reviewLink) {
      return res.status(400).json({
        success: false,
        error: "Phone number, business name, and review link are required",
      });
    }
    if (typeof businessName !== "string" || businessName.length > 120) {
      return res.status(400).json({ success: false, error: "Invalid business name" });
    }
    if (customerName !== undefined && (typeof customerName !== "string" || customerName.length > 80)) {
      return res.status(400).json({ success: false, error: "Invalid customer name" });
    }
    if (!isValidReviewLink(reviewLink)) {
      return res.status(400).json({
        success: false,
        error: "reviewLink must be an https URL on this application's domain",
      });
    }

    const message = reviewRequestMessage({ customerName, businessName, reviewLink });

    const invalid = validateSmsInput(req, to, message, businessId);
    if (invalid) {
      return res.status(invalid.status).json({ success: false, error: invalid.error });
    }

    const db = getSupabaseClient();
    const normalisedTo = normalisePhone(to);

    // The web UI creates the row first, because the review link embeds its id.
    // Update that row rather than inserting a duplicate beside it.
    const existingId = typeof requestId === "string" && UUID_LIKE.test(requestId) ? requestId : null;
    if (existingId) {
      const { data: owned } = await db
        .from("review_requests")
        .select("id")
        .eq("id", existingId)
        .eq("business_id", businessId)
        .maybeSingle();
      if (!owned) {
        return res.status(404).json({ success: false, error: "Review request not found for this business" });
      }
    }

    const recordOutcome = async (fields: Record<string, unknown>): Promise<string | null> => {
      const base = {
        business_id: businessId,
        customer_name: typeof customerName === "string" && customerName ? customerName : "Customer",
        customer_phone: normalisedTo,
        project_name: typeof req.body?.projectName === "string" ? req.body.projectName : "Project",
        job_id: typeof jobId === "string" && UUID_LIKE.test(jobId) ? jobId : null,
        review_link: reviewLink,
        channel: "sms",
        ...fields,
      };
      if (existingId) {
        const { error } = await db.from("review_requests").update(base).eq("id", existingId);
        if (error) log.warn({ err: error.message }, "review request update failed");
        return existingId;
      }
      const { data, error } = await db.from("review_requests").insert(base).select("id").single();
      if (error) log.warn({ err: error.message }, "review request insert failed");
      return (data as any)?.id ?? null;
    };

    // A scheduled request is a row for the worker to pick up later, not a send.
    const when = typeof scheduledFor === "string" ? Date.parse(scheduledFor) : NaN;
    if (Number.isFinite(when) && when > Date.now() + 60_000) {
      const id = await recordOutcome({
        status: "scheduled",
        scheduled_for: new Date(when).toISOString(),
      });
      if (!id) {
        return res.status(500).json({ success: false, error: "Could not schedule the review request" });
      }
      return res.json({ success: true, scheduled: true, requestId: id });
    }

    const result = await sendSms({
      to: normalisedTo,
      message,
      businessId: businessId as string,
      campaignId: "review_request",
    });

    // Recorded either way: a request that was refused because the customer
    // opted out is exactly the thing the operator needs to be able to see.
    const recordedId = await recordOutcome({
      status: result.ok ? "sent" : result.reason === "opted_out" ? "opted_out" : "failed",
      attempt_count: 1,
      twilio_sid: result.ok ? result.sid ?? null : null,
      last_error: result.ok ? null : result.error,
      sent_at: new Date().toISOString(),
      // One nudge three days later, only for a request that actually went out.
      follow_up_after: result.ok ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() : null,
    });

    if (!result.ok) {
      return res
        .status(statusForSendFailure(result.reason))
        .json({ success: false, error: result.error, reason: result.reason, requestId: recordedId });
    }

    return res.json({ success: true, messageId: result.sid, status: result.status, requestId: recordedId });
  } catch (error) {
    log.error({ err: error }, "Review request SMS error");
    res.status(500).json({ success: false, error: "Failed to send review request" });
  }
};
