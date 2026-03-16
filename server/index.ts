import express from "express";
import cors from "cors";
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
  app.get("/api/auth/google/authorize", handleGoogleAuthorize);
  app.get("/api/auth/google/callback", handleGoogleCallback);

  // RSS Feed Routes
  app.get("/api/rss/:workflowId", handleGetRssFeed);
  app.post("/api/rss/:workflowId/items", handleAddRssItem);

  // Workflow Routes
  app.post("/api/webhooks/register", handleRegisterWebhook);
  app.post("/api/workflows/webhook-url", handleGenerateWebhookUrl);
  app.post("/api/workflows/webhook/:workflowId", handleWorkflowWebhook);
  app.get("/api/workflows/deliveries/:executionId", handleGetWebhookDeliveries);

  return app;
}
