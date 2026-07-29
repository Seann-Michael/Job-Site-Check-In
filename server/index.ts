import express from "express";
import cors from "cors";

// ── Startup-time environment validation ─────────────────────────────────────
function validateEnv() {
  const REQUIRED: string[] = [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const OPTIONAL_WITH_FEATURE: Array<[string, string]> = [
    ["STRIPE_SECRET_KEY",         "Payments (Stripe)"],
    ["PAYPAL_CLIENT_ID",          "Payments (PayPal)"],
    ["PAYPAL_CLIENT_SECRET",      "Payments (PayPal)"],
    ["TWILIO_ACCOUNT_SID",        "SMS / Review Requests"],
    ["TWILIO_AUTH_TOKEN",         "SMS / Review Requests"],
    ["TWILIO_PHONE_NUMBER",       "SMS / Review Requests"],
    ["OPENAI_API_KEY",            "AI Review Responses"],
    ["GOOGLE_MAPS_API_KEY",       "Google Maps / Place Lookup"],
    ["GOOGLE_OAUTH_CLIENT_ID",    "Google Business Profile OAuth"],
    ["GOOGLE_OAUTH_CLIENT_SECRET","Google Business Profile OAuth"],
    ["VITE_APP_URL",              "Payment redirect URLs"],
  ];

  const missing: string[] = [];
  for (const key of REQUIRED) {
    if (!process.env[key]) missing.push(key);
  }

  if (missing.length) {
    console.error("\n\x1b[31m[ENV] CRITICAL — Missing required environment variables:\x1b[0m");
    missing.forEach((k) => console.error(`  \x1b[31m✗ ${k}\x1b[0m`));
    console.error("Server will start but database features may be broken.\n");
  }

  const missingOptional: Array<[string, string]> = [];
  for (const [key, feature] of OPTIONAL_WITH_FEATURE) {
    if (!process.env[key]) missingOptional.push([key, feature]);
  }

  if (missingOptional.length) {
    console.warn("\n\x1b[33m[ENV] Optional variables not set (affected features listed):\x1b[0m");
    missingOptional.forEach(([k, f]) =>
      console.warn(`  \x1b[33m⚠ ${k.padEnd(32)} → ${f}\x1b[0m`),
    );
    console.warn("");
  }

  if (!missing.length && !missingOptional.length) {
    console.log("\x1b[32m[ENV] All environment variables configured ✓\x1b[0m");
  }
}

validateEnv();
import { handleDemo } from "./routes/demo";
import {
  handleSecureMedia,
  handlePublicMedia,
  handleThumbnails,
  handleMediaUpload,
  handleMediaMetadata
} from "./routes/media";
import {
  handleSendSMS,
  handleTwilioWebhook,
  handleTwilioTest,
  handleTwilioStatus,
  handleSendReviewRequest
} from "./routes/twilio";
import {
  handleRegisterWebhook,
  handleGenerateWebhookUrl,
  handleWorkflowWebhook,
  handleGetWebhookDeliveries,
} from "./routes/workflows";
import { handleResolveUrl } from "./routes/resolveUrl";
import { handleGooglePlaceLookup } from "./routes/googlePlaceLookup";
import { handleGoogleAuthorize, handleGoogleCallback } from "./routes/googleOAuth";
import { handleGetRssFeed, handleAddRssItem } from "./routes/rss";
import {
  handleStripeCheckout,
  handleStripeConfirm,
  handlePaypalCheckout,
  handlePaymentStatus,
} from "./routes/payments";
import {
  handleLogin,
  handleLogout,
  handleChangePassword,
  handleEnableMFA,
  handleVerifyMFA,
} from "./routes/authApi";
import { handleAIReviewResponse } from "./routes/aiReview";

export function createServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Example API routes
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });

  app.get("/api/demo", handleDemo);

  // Secure Media Routes
  app.get("/api/media/:mediaId/:filename", handleSecureMedia);
  app.get("/api/media/thumbs/:size/:mediaId/:filename", handleThumbnails);
  app.post("/api/media/upload", handleMediaUpload);
  app.get("/api/media/metadata/:mediaId", handleMediaMetadata);

  // Public Media Routes
  app.get("/public/media/:publicId/:filename", handlePublicMedia);
  app.get("/public/media/thumbs/:size/:publicId/:filename", handleThumbnails);

  // Twilio Routes
  app.post("/api/twilio/sms/send", handleSendSMS);
  app.post("/api/twilio/review-request", handleSendReviewRequest);
  app.post("/api/webhooks/twilio", handleTwilioWebhook);
  app.get("/api/twilio/test", handleTwilioTest);
  app.get("/api/twilio/status", handleTwilioStatus);

  // URL Resolver (for short Google Maps links)
  app.get("/api/resolve-url", handleResolveUrl);

  // Google Place Lookup from any Maps URL
  app.post("/api/google-place-lookup", handleGooglePlaceLookup);

  // Google OAuth (Business Profile connection)
  // Primary routes matching the registered Google Cloud Console redirect URI
  app.get("/api/oauth/google_my_business/authorize", handleGoogleAuthorize);
  app.get("/api/oauth/google_my_business/callback", handleGoogleCallback);
  // Legacy aliases kept for backwards compatibility
  app.get("/api/auth/google/authorize", handleGoogleAuthorize);
  app.get("/api/auth/google/callback", handleGoogleCallback);

  // RSS Feed Routes
  app.get("/api/rss/:workflowId", handleGetRssFeed);
  app.post("/api/rss/:workflowId/items", handleAddRssItem);

  // Payment Routes
  app.get("/api/payments/status", handlePaymentStatus);
  app.post("/api/create-checkout-stripe", handleStripeCheckout);
  app.post("/api/create-checkout-paypal", handlePaypalCheckout);
  // Success-redirect confirmation: records the purchased plan on the business
  app.post("/api/payments/confirm", handleStripeConfirm);

  // Auth API Routes
  app.post("/api/auth/login", handleLogin);
  app.post("/api/auth/logout", handleLogout);
  app.post("/api/auth/change-password", handleChangePassword);
  app.post("/api/auth/enable-mfa", handleEnableMFA);
  app.post("/api/auth/verify-mfa", handleVerifyMFA);

  // AI Review Response
  app.post("/api/ai-review-response", handleAIReviewResponse);

  // Workflow Routes
  app.post("/api/webhooks/register", handleRegisterWebhook);
  app.post("/api/workflows/webhook-url", handleGenerateWebhookUrl);
  app.post("/api/workflows/webhook/:workflowId", handleWorkflowWebhook);
  app.get("/api/workflows/deliveries/:executionId", handleGetWebhookDeliveries);

  return app;
}
