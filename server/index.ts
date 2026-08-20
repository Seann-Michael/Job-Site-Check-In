import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";
import * as Sentry from "@sentry/node";

import { logger } from "./lib/logger";
import { getEnv, validateEnv, EnvError } from "./lib/env";
import { requireAuth, requireRole, requireWrite } from "./middleware/requireAuth";

import { mediaRouter, publicMediaRouter } from "./routes/media";
import { aiRouter } from "./routes/ai";
import { dataForSEORouter } from "./routes/dataforseo";
import {
  handleSendSMS,
  handleTwilioWebhook,
  handleTwilioTest,
  handleTwilioStatus,
  handleSendReviewRequest,
  smsSendLimiter,
} from "./routes/twilio";
import {
  handleRegisterWebhook,
  handleGenerateWebhookUrl,
  handleWorkflowWebhook,
  handleGetWebhookDeliveries,
} from "./routes/workflows";
import { handleResolveUrl } from "./routes/resolveUrl";
import { handleGooglePlaceLookup } from "./routes/googlePlaceLookup";
import { handleGoogleAuthorize, handleGoogleCallback, handleGoogleStart } from "./routes/googleOAuth";
import { handleGetRssFeed, handleAddRssItem } from "./routes/rss";
import {
  handleStripeCheckout,
  handleStripeConfirm,
  handlePaypalCheckout,
  handlePaymentStatus,
} from "./routes/payments";
import { handleLogout, handleChangePassword } from "./routes/authApi";
import { handleImpersonate } from "./routes/admin";
import { handleAIReviewResponse } from "./routes/aiReview";

export const APP_VERSION = process.env.APP_VERSION || process.env.npm_package_version || "1.0.0";

export interface CreateServerOptions {
  /** Skip startup env validation (tests). Defaults to true under NODE_ENV=test. */
  skipEnvValidation?: boolean;
}

function stripQuery(url: string | undefined): string | undefined {
  if (!url) return url;
  const i = url.indexOf("?");
  return i === -1 ? url : url.slice(0, i);
}

function corsOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  const appUrl = getEnv("APP_URL");
  return appUrl ? [appUrl.replace(/\/+$/, "")] : [];
}

export function createServer(options: CreateServerOptions = {}) {
  const skipEnv = options.skipEnvValidation ?? process.env.NODE_ENV === "test";
  if (!skipEnv) validateEnv();

  const app = express();
  app.disable("x-powered-by");
  // Behind DigitalOcean's load balancer / Vite proxy: trust one hop so
  // req.ip and rate limiting see the real client address.
  app.set("trust proxy", 1);

  // ── Security / platform middleware ──────────────────────────────────────
  app.use(
    helmet({
      // CSP is owned by index.html (the SPA loads Google Maps, Stripe, etc.).
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  const allowedOrigins = corsOrigins();
  app.use(
    cors({
      origin(origin, cb) {
        // Same-origin / server-to-server requests carry no Origin header.
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin.replace(/\/+$/, ""))) return cb(null, true);
        return cb(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Webhook-Signature", "X-Webhook-Timestamp", "X-Requested-With"],
      maxAge: 600,
    }),
  );

  app.use(compression());

  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === "/health" || req.url === "/api/health",
      },
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return "error";
        if (res.statusCode >= 400) return "warn";
        return "info";
      },
      serializers: {
        req(req) {
          // Strip the query string from logged URLs: OAuth callbacks carry
          // `?code=` / `?state=` which must never reach the logs.
          return { id: req.id, method: req.method, url: stripQuery(req.url), remoteAddress: req.remoteAddress };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );

  // Expose the pino-http request id so clients / support can correlate logs.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const id = (req as any).id;
    if (id !== undefined && id !== null) res.setHeader("X-Request-Id", String(id));
    next();
  });

  // ── Health ──────────────────────────────────────────────────────────────
  const health = (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok", uptime: Math.round(process.uptime()), version: APP_VERSION });
  };
  app.get("/health", health);
  app.get("/api/health", health);

  // ── Rate limiting ───────────────────────────────────────────────────────
  // Mounted BEFORE the body parsers so over-limit requests are rejected
  // without buffering their bodies.
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => req.path === "/health" || req.path === "/api/health",
    message: { error: "Too many requests, please try again later" },
  });
  const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  });
  app.use(globalLimiter);
  app.use("/api/ai", strictLimiter);
  app.use("/api/ai-review-response", strictLimiter);
  app.use("/api/auth", strictLimiter);

  // ── Body parsing ────────────────────────────────────────────────────────
  // Stripe webhooks need the raw body for signature verification. The raw
  // parser is mounted for that path BEFORE express.json so the JSON parser
  // never consumes it. Handler lands with the payments step.
  app.use("/api/webhooks/stripe", express.raw({ type: "application/json", limit: "1mb" }));

  // AI endpoints accept base64 images, so /api/ai gets an 8mb JSON limit.
  // Mounted before the global parser so the 1mb parser sees an already-parsed
  // body and skips; everything else keeps the global 1mb limit.
  app.use("/api/ai", express.json({ limit: "8mb" }));

  app.use(
    express.json({
      limit: "1mb",
      // Keep the raw bytes for HMAC verification of inbound workflow webhooks.
      verify: (req: Request, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // ── Routes ──────────────────────────────────────────────────────────────

  // Media (router applies requireAuth itself) + public redirects
  app.use("/api/media", mediaRouter);
  app.use("/public/media", publicMediaRouter);

  // AI
  app.use("/api/ai", requireAuth, aiRouter);
  app.post("/api/ai-review-response", requireAuth, handleAIReviewResponse);

  // DataForSEO proxy
  app.use("/api/dataforseo", requireAuth, dataForSEORouter);

  // Twilio — sending SMS requires a signed-in user with a write role and is
  // limited to 30 sends/hour/user. The `test` endpoint makes an authenticated
  // upstream call and leaks account info, so it's protected too. `status`
  // returns only booleans (safe to leave open). The inbound webhook stays
  // open because Twilio calls it (signature verification is deferred to the
  // Twilio step — see server/routes/README.md).
  app.post("/api/twilio/sms/send", requireAuth, requireWrite, smsSendLimiter, handleSendSMS);
  app.post("/api/twilio/review-request", requireAuth, requireWrite, smsSendLimiter, handleSendReviewRequest);
  app.post("/api/webhooks/twilio", handleTwilioWebhook);
  app.get("/api/twilio/test", requireAuth, handleTwilioTest);
  app.get("/api/twilio/status", handleTwilioStatus);

  // Google Maps helpers
  app.get("/api/resolve-url", requireAuth, handleResolveUrl);
  app.post("/api/google-place-lookup", requireAuth, handleGooglePlaceLookup);

  // Google OAuth (Business Profile connection)
  app.post("/api/oauth/google_my_business/start", requireAuth, requireWrite, handleGoogleStart);
  app.get("/api/oauth/google_my_business/authorize", requireAuth, requireWrite, handleGoogleAuthorize);
  app.get("/api/oauth/google_my_business/callback", handleGoogleCallback);
  // Legacy aliases
  app.get("/api/auth/google/authorize", requireAuth, requireWrite, handleGoogleAuthorize);
  app.get("/api/auth/google/callback", handleGoogleCallback);

  // RSS
  app.get("/api/rss/:workflowId", handleGetRssFeed);
  app.post("/api/rss/:workflowId/items", requireAuth, requireWrite, handleAddRssItem);

  // Payments (auth deferred to a later step)
  app.get("/api/payments/status", handlePaymentStatus);
  app.post("/api/create-checkout-stripe", handleStripeCheckout);
  app.post("/api/create-checkout-paypal", handlePaypalCheckout);
  app.post("/api/payments/confirm", handleStripeConfirm);

  // Auth API. Login + password reset happen client-side directly against
  // Supabase (signInWithPassword / resetPasswordForEmail). MFA is deferred.
  app.post("/api/auth/logout", handleLogout);
  app.post("/api/auth/change-password", requireAuth, handleChangePassword);

  // Admin
  app.post("/api/admin/impersonate", requireAuth, requireRole("super_admin"), handleImpersonate);

  // Workflows
  app.post("/api/webhooks/register", requireAuth, requireWrite, handleRegisterWebhook);
  app.post("/api/workflows/webhook-url", requireAuth, requireWrite, handleGenerateWebhookUrl);
  app.post("/api/workflows/webhook/:workflowId", handleWorkflowWebhook); // public, HMAC-verified
  app.get("/api/workflows/deliveries/:executionId", requireAuth, handleGetWebhookDeliveries);

  // ── 404 for unknown API routes ──────────────────────────────────────────
  app.use("/api", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // ── Error handler (JSON, no stack) ──────────────────────────────────────
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    if (err instanceof EnvError) {
      (req.log ?? logger).error({ err }, "Environment misconfiguration");
      Sentry.captureException(err);
      return res.status(500).json({ error: "Server misconfigured" });
    }
    if (err?.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
    if (err?.type === "entity.too.large") {
      return res.status(413).json({ error: "Request body too large" });
    }
    const status = Number(err?.status || err?.statusCode) || 500;
    (req.log ?? logger).error({ err, status }, "Unhandled request error");
    if (status >= 500) {
      // No-op unless Sentry.init() ran (node-build.ts, only with SENTRY_DSN).
      Sentry.captureException(err, { extra: { requestId: (req as any).id, method: req.method, path: req.path } });
    }
    res.status(status).json({ error: status >= 500 ? "Internal server error" : err?.message || "Request failed" });
  });

  return app;
}
