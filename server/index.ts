import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { pinoHttp } from "pino-http";

import { logger } from "./lib/logger";
import { getEnv, validateEnv, EnvError } from "./lib/env";
import { requireAuth, requireRole } from "./middleware/requireAuth";

import { mediaRouter, publicMediaRouter } from "./routes/media";
import { aiRouter } from "./routes/ai";
import { dataForSEORouter } from "./routes/dataforseo";
import {
  handleSendSMS,
  handleTwilioWebhook,
  handleTwilioTest,
  handleTwilioStatus,
  handleSendReviewRequest,
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
      allowedHeaders: ["Content-Type", "Authorization", "X-Webhook-Signature", "X-Requested-With"],
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
          return { id: req.id, method: req.method, url: req.url, remoteAddress: req.remoteAddress };
        },
        res(res) {
          return { statusCode: res.statusCode };
        },
      },
    }),
  );

  // ── Health ──────────────────────────────────────────────────────────────
  const health = (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ status: "ok", uptime: Math.round(process.uptime()), version: APP_VERSION });
  };
  app.get("/health", health);
  app.get("/api/health", health);

  // ── Body parsing ────────────────────────────────────────────────────────
  // Stripe webhooks need the raw body for signature verification. The raw
  // parser is mounted for that path BEFORE express.json so the JSON parser
  // never consumes it. Handler lands with the payments step.
  app.use("/api/webhooks/stripe", express.raw({ type: "application/json", limit: "1mb" }));

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

  // ── Rate limiting ───────────────────────────────────────────────────────
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

  // ── Routes ──────────────────────────────────────────────────────────────

  // Media (router applies requireAuth itself) + public redirects
  app.use("/api/media", mediaRouter);
  app.use("/public/media", publicMediaRouter);

  // AI
  app.use("/api/ai", requireAuth, aiRouter);
  app.post("/api/ai-review-response", requireAuth, handleAIReviewResponse);

  // DataForSEO proxy
  app.use("/api/dataforseo", requireAuth, dataForSEORouter);

  // Twilio — sending SMS requires a signed-in user. The `test` endpoint makes
  // an authenticated upstream call and leaks account info, so it's protected
  // too. `status` returns only booleans (safe to leave open). The inbound
  // webhook stays open because Twilio calls it (signature verification is
  // deferred to the Twilio step — see server/routes/README.md).
  app.post("/api/twilio/sms/send", requireAuth, handleSendSMS);
  app.post("/api/twilio/review-request", requireAuth, handleSendReviewRequest);
  app.post("/api/webhooks/twilio", handleTwilioWebhook);
  app.get("/api/twilio/test", requireAuth, handleTwilioTest);
  app.get("/api/twilio/status", handleTwilioStatus);

  // Google Maps helpers
  app.get("/api/resolve-url", requireAuth, handleResolveUrl);
  app.post("/api/google-place-lookup", requireAuth, handleGooglePlaceLookup);

  // Google OAuth (Business Profile connection)
  app.post("/api/oauth/google_my_business/start", requireAuth, handleGoogleStart);
  app.get("/api/oauth/google_my_business/authorize", requireAuth, handleGoogleAuthorize);
  app.get("/api/oauth/google_my_business/callback", handleGoogleCallback);
  // Legacy aliases
  app.get("/api/auth/google/authorize", requireAuth, handleGoogleAuthorize);
  app.get("/api/auth/google/callback", handleGoogleCallback);

  // RSS
  app.get("/api/rss/:workflowId", handleGetRssFeed);
  app.post("/api/rss/:workflowId/items", requireAuth, handleAddRssItem);

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
  app.post("/api/webhooks/register", requireAuth, handleRegisterWebhook);
  app.post("/api/workflows/webhook-url", requireAuth, handleGenerateWebhookUrl);
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
    res.status(status).json({ error: status >= 500 ? "Internal server error" : err?.message || "Request failed" });
  });

  return app;
}
