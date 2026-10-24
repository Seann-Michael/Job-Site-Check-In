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

const moduleLog = logger.child({ module: "twilio" });
const reqLog = (req: Request) => (req.log ?? moduleLog).child({ module: "twilio" });

// Twilio Configuration
interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  webhookUrl?: string;
}

interface SMSRequest {
  to: string;
  message: string;
  campaignId?: string;
  businessId?: string;
}

export const E164_RE = /^\+[1-9]\d{6,14}$/;
export const MAX_SMS_LENGTH = 1600;

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

// Get Twilio configuration from environment variables
const getTwilioConfig = (): TwilioConfig | null => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL;

  if (accountSid && authToken && phoneNumber) {
    return {
      accountSid,
      authToken,
      phoneNumber,
      webhookUrl
    };
  }

  return null;
};

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
    const config = getTwilioConfig();

    if (!config) {
      return res.status(503).json({
        success: false,
        error: "Twilio credentials not configured"
      });
    }

    const { to, message, campaignId, businessId }: SMSRequest = req.body ?? {};

    const invalid = validateSmsInput(req, to, message, businessId);
    if (invalid) {
      return res.status(invalid.status).json({ success: false, error: invalid.error });
    }

    // Prepare Twilio API request
    const authString = Buffer.from(
      `${config.accountSid}:${config.authToken}`
    ).toString('base64');

    const params = new URLSearchParams({
      From: config.phoneNumber,
      To: to,
      Body: message,
      ...(config.webhookUrl && { StatusCallback: config.webhookUrl })
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
        signal: AbortSignal.timeout(15_000),
      }
    );

    const data = (await response.json().catch(() => ({}))) as any;

    if (!response.ok) {
      // Never echo Twilio's error text to the client.
      log.error({ status: response.status, code: data?.code, message: data?.message }, "Twilio API error");
      return res.status(502).json({ success: false, error: "SMS provider request failed" });
    }

    // Persist SMS log to Supabase
    const db = getSupabaseClient();
    if (db) {
      await db.from("sms_logs").insert({
        twilio_sid: data.sid,
        direction: "outbound",
        to_number: to,
        from_number: config.phoneNumber,
        message,
        status: data.status ?? "sent",
        campaign_id: campaignId ?? null,
        business_id: businessId || null,
      }).then(({ error }) => {
        if (error) log.error({ err: error.message }, "Failed to log SMS");
      });
    }

    log.info({ userId: req.user?.id, businessId: businessId || null, campaignId: campaignId ?? null }, "SMS sent");

    res.json({
      success: true,
      messageId: data.sid,
      status: data.status
    });

  } catch (error) {
    log.error({ err: error }, "Twilio SMS error");
    res.status(502).json({
      success: false,
      error: "SMS provider request failed"
    });
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
export const handleSendReviewRequest = async (req: Request, res: Response) => {
  const log = reqLog(req);
  try {
    const {
      to,
      businessName,
      customerName,
      reviewLink,
      businessId
    } = req.body ?? {};

    if (!to || !businessName || !reviewLink) {
      return res.status(400).json({
        success: false,
        error: "Phone number, business name, and review link are required"
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
        error: "reviewLink must be an https URL on this application's domain"
      });
    }

    const message = `Hi ${customerName || 'there'}! Thank you for choosing ${businessName}. We'd love to hear about your experience. Please leave us a review: ${reviewLink}`;

    // Use the existing SMS handler (it re-validates `to`, length and businessId).
    req.body = {
      to,
      message,
      businessId,
      campaignId: 'review_request'
    };

    return handleSendSMS(req, res);

  } catch (error) {
    log.error({ err: error }, "Review request SMS error");
    res.status(500).json({
      success: false,
      error: "Failed to send review request"
    });
  }
};
