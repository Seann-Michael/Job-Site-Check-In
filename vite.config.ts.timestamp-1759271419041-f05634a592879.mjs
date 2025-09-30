// vite.config.ts
import { defineConfig } from "file:///app/code/node_modules/vite/dist/node/index.js";
import react from "file:///app/code/node_modules/@vitejs/plugin-react/dist/index.js";
import path2 from "path";

// server/index.ts
import express from "file:///app/code/node_modules/express/index.js";
import cors from "file:///app/code/node_modules/cors/lib/index.js";

// server/routes/demo.ts
var handleDemo = (req, res) => {
  const response = {
    message: "Hello from Express server"
  };
  res.status(200).json(response);
};

// server/routes/media.ts
import path from "path";
import fs from "fs";
import crypto from "crypto";
var mediaFiles = /* @__PURE__ */ new Map();
var publicUrlMappings = /* @__PURE__ */ new Map();
var handleSecureMedia = async (req, res) => {
  try {
    const { mediaId, filename } = req.params;
    if (!mediaId || !filename) {
      return res.status(400).json({ error: "Missing media ID or filename" });
    }
    const mediaFile = mediaFiles.get(mediaId);
    if (!mediaFile) {
      return res.status(404).json({ error: "Media file not found" });
    }
    const userAccountId = req.headers["x-account-id"] || "default";
    if (mediaFile.accountId !== userAccountId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const filePath = path.join(process.cwd(), "uploads", mediaFile.storedPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Physical file not found" });
    }
    res.setHeader("Content-Type", mediaFile.mimeType);
    res.setHeader("Content-Length", mediaFile.size);
    if (req.query.download === "true") {
      const downloadFilename = req.query.filename || mediaFile.originalName;
      res.setHeader("Content-Disposition", `attachment; filename="${downloadFilename}"`);
    } else {
      res.setHeader("Content-Disposition", "inline");
    }
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("ETag", `"${mediaFile.id}"`);
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error serving secure media:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
var handlePublicMedia = async (req, res) => {
  try {
    const { publicId, filename } = req.params;
    if (!publicId || !filename) {
      return res.status(400).json({ error: "Missing public ID or filename" });
    }
    const mediaId = publicUrlMappings.get(`${publicId}/${filename}`);
    if (!mediaId) {
      return res.status(404).json({ error: "Media file not found" });
    }
    const mediaFile = mediaFiles.get(mediaId);
    if (!mediaFile || !mediaFile.isPublic) {
      return res.status(404).json({ error: "Media file not found or not public" });
    }
    const expiration = req.query.exp;
    if (expiration) {
      const expirationTime = parseInt(expiration);
      if (Date.now() > expirationTime) {
        return res.status(410).json({ error: "URL has expired" });
      }
    }
    const filePath = path.join(process.cwd(), "uploads", mediaFile.storedPath);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Physical file not found" });
    }
    res.setHeader("Content-Type", mediaFile.mimeType);
    res.setHeader("Content-Length", mediaFile.size);
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("ETag", `"${mediaFile.id}"`);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET");
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error("Error serving public media:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
var handleThumbnails = async (req, res) => {
  try {
    const { size, mediaId, filename } = req.params;
    const isPublic = req.path.includes("/public/");
    if (!size || !mediaId || !filename) {
      return res.status(400).json({ error: "Missing parameters" });
    }
    const validSizes = ["150x150", "300x300", "600x600"];
    if (!validSizes.includes(size)) {
      return res.status(400).json({ error: "Invalid thumbnail size" });
    }
    let mediaFile;
    if (isPublic) {
      const realMediaId = publicUrlMappings.get(`${mediaId}/${filename}`);
      if (realMediaId) {
        mediaFile = mediaFiles.get(realMediaId);
      }
    } else {
      mediaFile = mediaFiles.get(mediaId);
    }
    if (!mediaFile) {
      return res.status(404).json({ error: "Media file not found" });
    }
    if (!isPublic) {
      const userAccountId = req.headers["x-account-id"] || "default";
      if (mediaFile.accountId !== userAccountId) {
        return res.status(403).json({ error: "Access denied" });
      }
    }
    const sizeKey = size.replace("x", "_");
    const thumbnailPath = mediaFile.thumbnails?.[sizeKey];
    if (!thumbnailPath) {
      return res.status(404).json({ error: "Thumbnail not available" });
    }
    const fullThumbnailPath = path.join(process.cwd(), "uploads", "thumbnails", thumbnailPath);
    if (!fs.existsSync(fullThumbnailPath)) {
      return res.status(404).json({ error: "Thumbnail file not found" });
    }
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", isPublic ? "public, max-age=86400" : "private, max-age=3600");
    if (isPublic) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    const thumbnailStream = fs.createReadStream(fullThumbnailPath);
    thumbnailStream.pipe(res);
  } catch (error) {
    console.error("Error serving thumbnail:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
var handleMediaUpload = async (req, res) => {
  try {
    const { accountId, projectId, mediaType, isPublic } = req.body;
    if (!accountId || !mediaType) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const timestamp = Date.now();
    const randomToken = crypto.randomBytes(16).toString("hex");
    const projectPart = projectId ? `_p${projectId}` : "";
    const mediaId = `acc${accountId}${projectPart}_${mediaType}_${timestamp}_${randomToken}`;
    const mockFile = {
      originalname: "example.jpg",
      mimetype: "image/jpeg",
      size: 1024e3,
      buffer: Buffer.from("mock file content")
    };
    const fileExtension = path.extname(mockFile.originalname);
    const storedFilename = `${mediaId}${fileExtension}`;
    const storedPath = path.join("media", storedFilename);
    let publicUrlId = "";
    if (isPublic) {
      const accountHash = hashString(accountId);
      const projectHash = projectId ? hashString(projectId) : "";
      const randomId = crypto.randomBytes(12).toString("hex");
      const timestampBase36 = timestamp.toString(36);
      publicUrlId = `${accountHash}_${projectHash}_${timestampBase36}_${randomId}`.replace(/__/g, "_");
      publicUrlMappings.set(`${publicUrlId}/${mockFile.originalname}`, mediaId);
    }
    const mediaFile = {
      id: mediaId,
      originalName: mockFile.originalname,
      storedPath,
      mimeType: mockFile.mimetype,
      size: mockFile.size,
      accountId,
      projectId,
      mediaType,
      isPublic: Boolean(isPublic),
      uploadedAt: /* @__PURE__ */ new Date(),
      uploadedBy: req.headers["x-user-name"] || "Unknown",
      thumbnails: {
        small: `${mediaId}_150x150.jpg`,
        medium: `${mediaId}_300x300.jpg`,
        large: `${mediaId}_600x600.jpg`
      }
    };
    mediaFiles.set(mediaId, mediaFile);
    const secureUrl = `/api/media/${mediaId}/${encodeURIComponent(mockFile.originalname)}`;
    const publicUrl = isPublic ? `/public/media/${publicUrlId}/${mockFile.originalname}` : "";
    const thumbnailUrl = `/api/media/thumbs/300x300/${mediaId}/${encodeURIComponent(mockFile.originalname)}`;
    res.json({
      success: true,
      mediaFile: {
        id: mediaId,
        originalName: mockFile.originalname,
        mimeType: mockFile.mimetype,
        size: mockFile.size,
        secureUrl,
        publicUrl,
        thumbnailUrl,
        uploadedAt: mediaFile.uploadedAt,
        uploadedBy: mediaFile.uploadedBy
      }
    });
  } catch (error) {
    console.error("Error uploading media:", error);
    res.status(500).json({ error: "Upload failed" });
  }
};
var handleMediaMetadata = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const mediaFile = mediaFiles.get(mediaId);
    if (!mediaFile) {
      return res.status(404).json({ error: "Media file not found" });
    }
    const userAccountId = req.headers["x-account-id"] || "default";
    if (mediaFile.accountId !== userAccountId) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json({
      id: mediaFile.id,
      originalName: mediaFile.originalName,
      mimeType: mediaFile.mimeType,
      size: mediaFile.size,
      mediaType: mediaFile.mediaType,
      isPublic: mediaFile.isPublic,
      uploadedAt: mediaFile.uploadedAt,
      uploadedBy: mediaFile.uploadedBy,
      projectId: mediaFile.projectId
    });
  } catch (error) {
    console.error("Error getting media metadata:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// server/routes/dataforseo.ts
var DATAFORSEO_BASE_URL = "https://api.dataforseo.com/v3";
var getDataForSEOCredentials = () => {
  const username = process.env.DATAFORSEO_USERNAME;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (username && password) {
    return { username, password };
  }
  return null;
};
var handleDataForSEOProxy = async (req, res) => {
  try {
    const credentials = getDataForSEOCredentials();
    if (!credentials) {
      return res.status(500).json({
        success: false,
        error: "DataForSEO credentials not configured"
      });
    }
    const { endpoint, method = "GET", body } = req.body;
    if (!endpoint) {
      return res.status(400).json({
        success: false,
        error: "Endpoint is required"
      });
    }
    const authString = Buffer.from(
      `${credentials.username}:${credentials.password}`
    ).toString("base64");
    const response = await fetch(`${DATAFORSEO_BASE_URL}${endpoint}`, {
      method,
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/json"
      },
      ...body && { body: JSON.stringify(body) }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`DataForSEO API error: ${response.status}`);
    }
    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error("DataForSEO proxy error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
var handleDataForSEOStatus = async (_req, res) => {
  const credentials = getDataForSEOCredentials();
  res.json({
    success: true,
    configured: !!credentials
  });
};

// server/routes/twilio.ts
var getTwilioConfig = () => {
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
var handleSendSMS = async (req, res) => {
  try {
    const config = getTwilioConfig();
    if (!config) {
      return res.status(500).json({
        success: false,
        error: "Twilio credentials not configured"
      });
    }
    const { to, message, campaignId, businessId } = req.body;
    if (!to || !message) {
      return res.status(400).json({
        success: false,
        error: "Phone number and message are required"
      });
    }
    const authString = Buffer.from(
      `${config.accountSid}:${config.authToken}`
    ).toString("base64");
    const params = new URLSearchParams({
      From: config.phoneNumber,
      To: to,
      Body: message,
      ...config.webhookUrl && { StatusCallback: config.webhookUrl }
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authString}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Twilio API error: ${data.message || response.status}`);
    }
    console.log("SMS sent successfully:", {
      messageId: data.sid,
      to,
      campaignId,
      businessId
    });
    res.json({
      success: true,
      messageId: data.sid,
      status: data.status
    });
  } catch (error) {
    console.error("Twilio SMS error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
};
var handleTwilioWebhook = async (req, res) => {
  try {
    const { MessageSid, MessageStatus, ErrorCode, ErrorMessage } = req.body;
    console.log("Twilio webhook received:", {
      messageId: MessageSid,
      status: MessageStatus,
      errorCode: ErrorCode,
      errorMessage: ErrorMessage
    });
    res.status(200).send("OK");
  } catch (error) {
    console.error("Twilio webhook error:", error);
    res.status(500).send("Error processing webhook");
  }
};
var handleTwilioTest = async (_req, res) => {
  try {
    const config = getTwilioConfig();
    if (!config) {
      return res.status(500).json({
        success: false,
        error: "Twilio credentials not configured"
      });
    }
    const authString = Buffer.from(
      `${config.accountSid}:${config.authToken}`
    ).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}.json`,
      {
        headers: {
          "Authorization": `Basic ${authString}`
        }
      }
    );
    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Twilio API error: ${data.message || response.status}`);
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
    console.error("Twilio test error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Connection test failed"
    });
  }
};
var handleTwilioStatus = async (_req, res) => {
  const config = getTwilioConfig();
  res.json({
    success: true,
    configured: !!config,
    hasPhoneNumber: !!config?.phoneNumber
  });
};
var handleSendReviewRequest = async (req, res) => {
  try {
    const {
      to,
      businessName,
      customerName,
      reviewLink,
      businessId
    } = req.body;
    if (!to || !businessName || !reviewLink) {
      return res.status(400).json({
        success: false,
        error: "Phone number, business name, and review link are required"
      });
    }
    const message = `Hi ${customerName || "there"}! Thank you for choosing ${businessName}. We'd love to hear about your experience. Please leave us a review: ${reviewLink}`;
    req.body = {
      to,
      message,
      businessId,
      campaignId: "review_request"
    };
    return handleSendSMS(req, res);
  } catch (error) {
    console.error("Review request SMS error:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to send review request"
    });
  }
};

// server/index.ts
function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.get("/api/ping", (_req, res) => {
    res.json({ message: "Hello from Express server v2!" });
  });
  app.get("/api/demo", handleDemo);
  app.get("/api/media/:mediaId/:filename", handleSecureMedia);
  app.get("/api/media/thumbs/:size/:mediaId/:filename", handleThumbnails);
  app.post("/api/media/upload", handleMediaUpload);
  app.get("/api/media/metadata/:mediaId", handleMediaMetadata);
  app.get("/public/media/:publicId/:filename", handlePublicMedia);
  app.get("/public/media/thumbs/:size/:publicId/:filename", handleThumbnails);
  app.post("/api/dataforseo/proxy", handleDataForSEOProxy);
  app.get("/api/dataforseo/status", handleDataForSEOStatus);
  app.post("/api/twilio/sms/send", handleSendSMS);
  app.post("/api/twilio/review-request", handleSendReviewRequest);
  app.post("/api/webhooks/twilio", handleTwilioWebhook);
  app.get("/api/twilio/test", handleTwilioTest);
  app.get("/api/twilio/status", handleTwilioStatus);
  return app;
}

// vite.config.ts
var __vite_injected_original_dirname = "/app/code";
var vite_config_default = defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    strictPort: false
  },
  build: {
    outDir: "dist"
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path2.resolve(__vite_injected_original_dirname, "./client"),
      "@shared": path2.resolve(__vite_injected_original_dirname, "./shared")
    }
  },
  optimizeDeps: {
    entries: ["index.html"],
    exclude: ["test-google-maps.html", "public/offline.html"]
  }
}));
function expressPlugin() {
  return {
    name: "express-plugin",
    apply: "serve",
    // Only apply during development (serve mode)
    configureServer(server) {
      const app = createServer();
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/api/") || req.url?.startsWith("/public/")) {
          app(req, res, next);
        } else {
          next();
        }
      });
    }
  };
}
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAic2VydmVyL2luZGV4LnRzIiwgInNlcnZlci9yb3V0ZXMvZGVtby50cyIsICJzZXJ2ZXIvcm91dGVzL21lZGlhLnRzIiwgInNlcnZlci9yb3V0ZXMvZGF0YWZvcnNlby50cyIsICJzZXJ2ZXIvcm91dGVzL3R3aWxpby50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZVwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZywgUGx1Z2luIH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcbmltcG9ydCBwYXRoIGZyb20gXCJwYXRoXCI7XG5pbXBvcnQgeyBjcmVhdGVTZXJ2ZXIgfSBmcm9tIFwiLi9zZXJ2ZXJcIjtcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZygoeyBtb2RlIH0pID0+ICh7XG4gIHNlcnZlcjoge1xuICAgIGhvc3Q6IFwiOjpcIixcbiAgICBwb3J0OiA1MTczLFxuICAgIHN0cmljdFBvcnQ6IGZhbHNlLFxuICB9LFxuICBidWlsZDoge1xuICAgIG91dERpcjogXCJkaXN0XCIsXG4gIH0sXG4gIHBsdWdpbnM6IFtyZWFjdCgpLCBleHByZXNzUGx1Z2luKCldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vY2xpZW50XCIpLFxuICAgICAgXCJAc2hhcmVkXCI6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi9zaGFyZWRcIiksXG4gICAgfSxcbiAgfSxcbiAgb3B0aW1pemVEZXBzOiB7XG4gICAgZW50cmllczogW1wiaW5kZXguaHRtbFwiXSxcbiAgICBleGNsdWRlOiBbXCJ0ZXN0LWdvb2dsZS1tYXBzLmh0bWxcIiwgXCJwdWJsaWMvb2ZmbGluZS5odG1sXCJdLFxuICB9LFxufSkpO1xuXG5mdW5jdGlvbiBleHByZXNzUGx1Z2luKCk6IFBsdWdpbiB7XG4gIHJldHVybiB7XG4gICAgbmFtZTogXCJleHByZXNzLXBsdWdpblwiLFxuICAgIGFwcGx5OiBcInNlcnZlXCIsIC8vIE9ubHkgYXBwbHkgZHVyaW5nIGRldmVsb3BtZW50IChzZXJ2ZSBtb2RlKVxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIGNvbnN0IGFwcCA9IGNyZWF0ZVNlcnZlcigpO1xuXG4gICAgICAvLyBIYW5kbGUgQVBJIGFuZCBwdWJsaWMgcm91dGVzIHdpdGggcHJvcGVyIG1pZGRsZXdhcmUgb3JkZXJcbiAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XG4gICAgICAgIGlmIChyZXEudXJsPy5zdGFydHNXaXRoKFwiL2FwaS9cIikgfHwgcmVxLnVybD8uc3RhcnRzV2l0aChcIi9wdWJsaWMvXCIpKSB7XG4gICAgICAgICAgYXBwKHJlcSBhcyBhbnksIHJlcyBhcyBhbnksIG5leHQgYXMgYW55KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXh0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0sXG4gIH07XG59XG4iLCAiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvaW5kZXgudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9pbmRleC50c1wiO2ltcG9ydCBleHByZXNzIGZyb20gXCJleHByZXNzXCI7XG5pbXBvcnQgY29ycyBmcm9tIFwiY29yc1wiO1xuaW1wb3J0IHsgaGFuZGxlRGVtbyB9IGZyb20gXCIuL3JvdXRlcy9kZW1vXCI7XG5pbXBvcnQge1xuICBoYW5kbGVTZWN1cmVNZWRpYSxcbiAgaGFuZGxlUHVibGljTWVkaWEsXG4gIGhhbmRsZVRodW1ibmFpbHMsXG4gIGhhbmRsZU1lZGlhVXBsb2FkLFxuICBoYW5kbGVNZWRpYU1ldGFkYXRhXG59IGZyb20gXCIuL3JvdXRlcy9tZWRpYVwiO1xuaW1wb3J0IHtcbiAgaGFuZGxlRGF0YUZvclNFT1Byb3h5LFxuICBoYW5kbGVEYXRhRm9yU0VPU3RhdHVzXG59IGZyb20gXCIuL3JvdXRlcy9kYXRhZm9yc2VvXCI7XG5pbXBvcnQge1xuICBoYW5kbGVTZW5kU01TLFxuICBoYW5kbGVUd2lsaW9XZWJob29rLFxuICBoYW5kbGVUd2lsaW9UZXN0LFxuICBoYW5kbGVUd2lsaW9TdGF0dXMsXG4gIGhhbmRsZVNlbmRSZXZpZXdSZXF1ZXN0XG59IGZyb20gXCIuL3JvdXRlcy90d2lsaW9cIjtcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZVNlcnZlcigpIHtcbiAgY29uc3QgYXBwID0gZXhwcmVzcygpO1xuXG4gIC8vIE1pZGRsZXdhcmVcbiAgYXBwLnVzZShjb3JzKCkpO1xuICBhcHAudXNlKGV4cHJlc3MuanNvbigpKTtcbiAgYXBwLnVzZShleHByZXNzLnVybGVuY29kZWQoeyBleHRlbmRlZDogdHJ1ZSB9KSk7XG5cbiAgLy8gRXhhbXBsZSBBUEkgcm91dGVzXG4gIGFwcC5nZXQoXCIvYXBpL3BpbmdcIiwgKF9yZXEsIHJlcykgPT4ge1xuICAgIHJlcy5qc29uKHsgbWVzc2FnZTogXCJIZWxsbyBmcm9tIEV4cHJlc3Mgc2VydmVyIHYyIVwiIH0pO1xuICB9KTtcblxuICBhcHAuZ2V0KFwiL2FwaS9kZW1vXCIsIGhhbmRsZURlbW8pO1xuXG4gIC8vIFNlY3VyZSBNZWRpYSBSb3V0ZXNcbiAgYXBwLmdldChcIi9hcGkvbWVkaWEvOm1lZGlhSWQvOmZpbGVuYW1lXCIsIGhhbmRsZVNlY3VyZU1lZGlhKTtcbiAgYXBwLmdldChcIi9hcGkvbWVkaWEvdGh1bWJzLzpzaXplLzptZWRpYUlkLzpmaWxlbmFtZVwiLCBoYW5kbGVUaHVtYm5haWxzKTtcbiAgYXBwLnBvc3QoXCIvYXBpL21lZGlhL3VwbG9hZFwiLCBoYW5kbGVNZWRpYVVwbG9hZCk7XG4gIGFwcC5nZXQoXCIvYXBpL21lZGlhL21ldGFkYXRhLzptZWRpYUlkXCIsIGhhbmRsZU1lZGlhTWV0YWRhdGEpO1xuXG4gIC8vIFB1YmxpYyBNZWRpYSBSb3V0ZXNcbiAgYXBwLmdldChcIi9wdWJsaWMvbWVkaWEvOnB1YmxpY0lkLzpmaWxlbmFtZVwiLCBoYW5kbGVQdWJsaWNNZWRpYSk7XG4gIGFwcC5nZXQoXCIvcHVibGljL21lZGlhL3RodW1icy86c2l6ZS86cHVibGljSWQvOmZpbGVuYW1lXCIsIGhhbmRsZVRodW1ibmFpbHMpO1xuXG4gIC8vIERhdGFGb3JTRU8gUm91dGVzXG4gIGFwcC5wb3N0KFwiL2FwaS9kYXRhZm9yc2VvL3Byb3h5XCIsIGhhbmRsZURhdGFGb3JTRU9Qcm94eSk7XG4gIGFwcC5nZXQoXCIvYXBpL2RhdGFmb3JzZW8vc3RhdHVzXCIsIGhhbmRsZURhdGFGb3JTRU9TdGF0dXMpO1xuXG4gIC8vIFR3aWxpbyBSb3V0ZXNcbiAgYXBwLnBvc3QoXCIvYXBpL3R3aWxpby9zbXMvc2VuZFwiLCBoYW5kbGVTZW5kU01TKTtcbiAgYXBwLnBvc3QoXCIvYXBpL3R3aWxpby9yZXZpZXctcmVxdWVzdFwiLCBoYW5kbGVTZW5kUmV2aWV3UmVxdWVzdCk7XG4gIGFwcC5wb3N0KFwiL2FwaS93ZWJob29rcy90d2lsaW9cIiwgaGFuZGxlVHdpbGlvV2ViaG9vayk7XG4gIGFwcC5nZXQoXCIvYXBpL3R3aWxpby90ZXN0XCIsIGhhbmRsZVR3aWxpb1Rlc3QpO1xuICBhcHAuZ2V0KFwiL2FwaS90d2lsaW8vc3RhdHVzXCIsIGhhbmRsZVR3aWxpb1N0YXR1cyk7XG5cbiAgcmV0dXJuIGFwcDtcbn1cbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2RlbW8udHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZGVtby50c1wiO2ltcG9ydCB7IFJlcXVlc3RIYW5kbGVyIH0gZnJvbSBcImV4cHJlc3NcIjtcbmltcG9ydCB7IERlbW9SZXNwb25zZSB9IGZyb20gXCJAc2hhcmVkL2FwaVwiO1xuXG5leHBvcnQgY29uc3QgaGFuZGxlRGVtbzogUmVxdWVzdEhhbmRsZXIgPSAocmVxLCByZXMpID0+IHtcbiAgY29uc3QgcmVzcG9uc2U6IERlbW9SZXNwb25zZSA9IHtcbiAgICBtZXNzYWdlOiBcIkhlbGxvIGZyb20gRXhwcmVzcyBzZXJ2ZXJcIixcbiAgfTtcbiAgcmVzLnN0YXR1cygyMDApLmpzb24ocmVzcG9uc2UpO1xufTtcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL21lZGlhLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL21lZGlhLnRzXCI7aW1wb3J0IHsgUmVxdWVzdEhhbmRsZXIgfSBmcm9tIFwiZXhwcmVzc1wiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCBmcyBmcm9tIFwiZnNcIjtcbmltcG9ydCBjcnlwdG8gZnJvbSBcImNyeXB0b1wiO1xuXG4vKipcbiAqIEludGVyZmFjZSBmb3IgbWVkaWEgZmlsZSBtZXRhZGF0YSBzdG9yZWQgb24gc2VydmVyXG4gKi9cbmludGVyZmFjZSBTZXJ2ZXJNZWRpYUZpbGUge1xuICBpZDogc3RyaW5nO1xuICBvcmlnaW5hbE5hbWU6IHN0cmluZztcbiAgc3RvcmVkUGF0aDogc3RyaW5nO1xuICBtaW1lVHlwZTogc3RyaW5nO1xuICBzaXplOiBudW1iZXI7XG4gIGFjY291bnRJZDogc3RyaW5nO1xuICBwcm9qZWN0SWQ/OiBzdHJpbmc7XG4gIG1lZGlhVHlwZTogc3RyaW5nO1xuICBpc1B1YmxpYzogYm9vbGVhbjtcbiAgdXBsb2FkZWRBdDogRGF0ZTtcbiAgdXBsb2FkZWRCeTogc3RyaW5nO1xuICB0aHVtYm5haWxzPzoge1xuICAgIHNtYWxsOiBzdHJpbmc7XG4gICAgbWVkaXVtOiBzdHJpbmc7XG4gICAgbGFyZ2U6IHN0cmluZztcbiAgfTtcbn1cblxuLyoqXG4gKiBJbi1tZW1vcnkgc3RvcmFnZSBmb3IgZGVtbyBwdXJwb3Nlc1xuICogSW4gcHJvZHVjdGlvbiwgdGhpcyB3b3VsZCBiZSBhIGRhdGFiYXNlXG4gKi9cbmNvbnN0IG1lZGlhRmlsZXMgPSBuZXcgTWFwPHN0cmluZywgU2VydmVyTWVkaWFGaWxlPigpO1xuY29uc3QgcHVibGljVXJsTWFwcGluZ3MgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpOyAvLyBNYXBzIHB1YmxpYyBVUkxzIHRvIG1lZGlhIElEc1xuXG4vKipcbiAqIFNlcnZlIHNlY3VyZSBtZWRpYSBmaWxlcyAoYXV0aGVudGljYXRlZCBhY2Nlc3MpXG4gKi9cbmV4cG9ydCBjb25zdCBoYW5kbGVTZWN1cmVNZWRpYTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IG1lZGlhSWQsIGZpbGVuYW1lIH0gPSByZXEucGFyYW1zO1xuICAgIFxuICAgIGlmICghbWVkaWFJZCB8fCAhZmlsZW5hbWUpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcIk1pc3NpbmcgbWVkaWEgSUQgb3IgZmlsZW5hbWVcIiB9KTtcbiAgICB9XG5cbiAgICAvLyBHZXQgbWVkaWEgZmlsZSByZWNvcmRcbiAgICBjb25zdCBtZWRpYUZpbGUgPSBtZWRpYUZpbGVzLmdldChtZWRpYUlkKTtcbiAgICBpZiAoIW1lZGlhRmlsZSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiTWVkaWEgZmlsZSBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICAvLyBWYWxpZGF0ZSBhY2Nlc3MgcGVybWlzc2lvbnNcbiAgICAvLyBJbiBhIHJlYWwgYXBwLCB5b3UnZCBjaGVjayB1c2VyIGF1dGhlbnRpY2F0aW9uIGFuZCBwZXJtaXNzaW9ucyBoZXJlXG4gICAgY29uc3QgdXNlckFjY291bnRJZCA9IHJlcS5oZWFkZXJzWyd4LWFjY291bnQtaWQnXSBhcyBzdHJpbmcgfHwgJ2RlZmF1bHQnO1xuICAgIGlmIChtZWRpYUZpbGUuYWNjb3VudElkICE9PSB1c2VyQWNjb3VudElkKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDMpLmpzb24oeyBlcnJvcjogXCJBY2Nlc3MgZGVuaWVkXCIgfSk7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgaWYgZmlsZSBleGlzdHMgb24gZGlza1xuICAgIGNvbnN0IGZpbGVQYXRoID0gcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksICd1cGxvYWRzJywgbWVkaWFGaWxlLnN0b3JlZFBhdGgpO1xuICAgIGlmICghZnMuZXhpc3RzU3luYyhmaWxlUGF0aCkpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwNCkuanNvbih7IGVycm9yOiBcIlBoeXNpY2FsIGZpbGUgbm90IGZvdW5kXCIgfSk7XG4gICAgfVxuXG4gICAgLy8gU2V0IGFwcHJvcHJpYXRlIGhlYWRlcnNcbiAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCBtZWRpYUZpbGUubWltZVR5cGUpO1xuICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtTGVuZ3RoJywgbWVkaWFGaWxlLnNpemUpO1xuICAgIFxuICAgIC8vIEhhbmRsZSBkb3dubG9hZCByZXF1ZXN0c1xuICAgIGlmIChyZXEucXVlcnkuZG93bmxvYWQgPT09ICd0cnVlJykge1xuICAgICAgY29uc3QgZG93bmxvYWRGaWxlbmFtZSA9IHJlcS5xdWVyeS5maWxlbmFtZSBhcyBzdHJpbmcgfHwgbWVkaWFGaWxlLm9yaWdpbmFsTmFtZTtcbiAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtRGlzcG9zaXRpb24nLCBgYXR0YWNobWVudDsgZmlsZW5hbWU9XCIke2Rvd25sb2FkRmlsZW5hbWV9XCJgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1EaXNwb3NpdGlvbicsICdpbmxpbmUnKTtcbiAgICB9XG5cbiAgICAvLyBDYWNoZSBoZWFkZXJzIGZvciBwZXJmb3JtYW5jZVxuICAgIHJlcy5zZXRIZWFkZXIoJ0NhY2hlLUNvbnRyb2wnLCAncHJpdmF0ZSwgbWF4LWFnZT0zNjAwJyk7XG4gICAgcmVzLnNldEhlYWRlcignRVRhZycsIGBcIiR7bWVkaWFGaWxlLmlkfVwiYCk7XG5cbiAgICAvLyBTdHJlYW0gZmlsZVxuICAgIGNvbnN0IGZpbGVTdHJlYW0gPSBmcy5jcmVhdGVSZWFkU3RyZWFtKGZpbGVQYXRoKTtcbiAgICBmaWxlU3RyZWFtLnBpcGUocmVzKTtcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNlcnZpbmcgc2VjdXJlIG1lZGlhOicsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkludGVybmFsIHNlcnZlciBlcnJvclwiIH0pO1xuICB9XG59O1xuXG4vKipcbiAqIFNlcnZlIHB1YmxpYyBtZWRpYSBmaWxlcyAobm8gYXV0aGVudGljYXRpb24gcmVxdWlyZWQpXG4gKi9cbmV4cG9ydCBjb25zdCBoYW5kbGVQdWJsaWNNZWRpYTogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IHB1YmxpY0lkLCBmaWxlbmFtZSB9ID0gcmVxLnBhcmFtcztcbiAgICBcbiAgICBpZiAoIXB1YmxpY0lkIHx8ICFmaWxlbmFtZSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiTWlzc2luZyBwdWJsaWMgSUQgb3IgZmlsZW5hbWVcIiB9KTtcbiAgICB9XG5cbiAgICAvLyBHZXQgbWVkaWEgSUQgZnJvbSBwdWJsaWMgVVJMIG1hcHBpbmdcbiAgICBjb25zdCBtZWRpYUlkID0gcHVibGljVXJsTWFwcGluZ3MuZ2V0KGAke3B1YmxpY0lkfS8ke2ZpbGVuYW1lfWApO1xuICAgIGlmICghbWVkaWFJZCkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiTWVkaWEgZmlsZSBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICBjb25zdCBtZWRpYUZpbGUgPSBtZWRpYUZpbGVzLmdldChtZWRpYUlkKTtcbiAgICBpZiAoIW1lZGlhRmlsZSB8fCAhbWVkaWFGaWxlLmlzUHVibGljKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJNZWRpYSBmaWxlIG5vdCBmb3VuZCBvciBub3QgcHVibGljXCIgfSk7XG4gICAgfVxuXG4gICAgLy8gVmFsaWRhdGUgZXhwaXJhdGlvbiBpZiBwcmVzZW50XG4gICAgY29uc3QgZXhwaXJhdGlvbiA9IHJlcS5xdWVyeS5leHAgYXMgc3RyaW5nO1xuICAgIGlmIChleHBpcmF0aW9uKSB7XG4gICAgICBjb25zdCBleHBpcmF0aW9uVGltZSA9IHBhcnNlSW50KGV4cGlyYXRpb24pO1xuICAgICAgaWYgKERhdGUubm93KCkgPiBleHBpcmF0aW9uVGltZSkge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MTApLmpzb24oeyBlcnJvcjogXCJVUkwgaGFzIGV4cGlyZWRcIiB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBDaGVjayBpZiBmaWxlIGV4aXN0cyBvbiBkaXNrXG4gICAgY29uc3QgZmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvY2Vzcy5jd2QoKSwgJ3VwbG9hZHMnLCBtZWRpYUZpbGUuc3RvcmVkUGF0aCk7XG4gICAgaWYgKCFmcy5leGlzdHNTeW5jKGZpbGVQYXRoKSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiUGh5c2ljYWwgZmlsZSBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICAvLyBTZXQgYXBwcm9wcmlhdGUgaGVhZGVycyBmb3IgcHVibGljIGFjY2Vzc1xuICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsIG1lZGlhRmlsZS5taW1lVHlwZSk7XG4gICAgcmVzLnNldEhlYWRlcignQ29udGVudC1MZW5ndGgnLCBtZWRpYUZpbGUuc2l6ZSk7XG4gICAgcmVzLnNldEhlYWRlcignQ29udGVudC1EaXNwb3NpdGlvbicsICdpbmxpbmUnKTtcbiAgICBcbiAgICAvLyBNb3JlIGFnZ3Jlc3NpdmUgY2FjaGluZyBmb3IgcHVibGljIGZpbGVzXG4gICAgcmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsICdwdWJsaWMsIG1heC1hZ2U9ODY0MDAnKTtcbiAgICByZXMuc2V0SGVhZGVyKCdFVGFnJywgYFwiJHttZWRpYUZpbGUuaWR9XCJgKTtcblxuICAgIC8vIENPUlMgaGVhZGVycyBmb3IgUlNTL0FQSSBhY2Nlc3NcbiAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCAnKicpO1xuICAgIHJlcy5zZXRIZWFkZXIoJ0FjY2Vzcy1Db250cm9sLUFsbG93LU1ldGhvZHMnLCAnR0VUJyk7XG5cbiAgICAvLyBTdHJlYW0gZmlsZVxuICAgIGNvbnN0IGZpbGVTdHJlYW0gPSBmcy5jcmVhdGVSZWFkU3RyZWFtKGZpbGVQYXRoKTtcbiAgICBmaWxlU3RyZWFtLnBpcGUocmVzKTtcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHNlcnZpbmcgcHVibGljIG1lZGlhOicsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7IGVycm9yOiBcIkludGVybmFsIHNlcnZlciBlcnJvclwiIH0pO1xuICB9XG59O1xuXG4vKipcbiAqIFNlcnZlIHRodW1ibmFpbCBpbWFnZXNcbiAqL1xuZXhwb3J0IGNvbnN0IGhhbmRsZVRodW1ibmFpbHM6IFJlcXVlc3RIYW5kbGVyID0gYXN5bmMgKHJlcSwgcmVzKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBzaXplLCBtZWRpYUlkLCBmaWxlbmFtZSB9ID0gcmVxLnBhcmFtcztcbiAgICBjb25zdCBpc1B1YmxpYyA9IHJlcS5wYXRoLmluY2x1ZGVzKCcvcHVibGljLycpO1xuICAgIFxuICAgIGlmICghc2l6ZSB8fCAhbWVkaWFJZCB8fCAhZmlsZW5hbWUpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcIk1pc3NpbmcgcGFyYW1ldGVyc1wiIH0pO1xuICAgIH1cblxuICAgIC8vIFZhbGlkYXRlIHNpemUgcGFyYW1ldGVyXG4gICAgY29uc3QgdmFsaWRTaXplcyA9IFsnMTUweDE1MCcsICczMDB4MzAwJywgJzYwMHg2MDAnXTtcbiAgICBpZiAoIXZhbGlkU2l6ZXMuaW5jbHVkZXMoc2l6ZSkpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7IGVycm9yOiBcIkludmFsaWQgdGh1bWJuYWlsIHNpemVcIiB9KTtcbiAgICB9XG5cbiAgICBsZXQgbWVkaWFGaWxlOiBTZXJ2ZXJNZWRpYUZpbGUgfCB1bmRlZmluZWQ7XG5cbiAgICBpZiAoaXNQdWJsaWMpIHtcbiAgICAgIC8vIEZvciBwdWJsaWMgdGh1bWJuYWlscywgZ2V0IG1lZGlhIElEIGZyb20gbWFwcGluZ1xuICAgICAgY29uc3QgcmVhbE1lZGlhSWQgPSBwdWJsaWNVcmxNYXBwaW5ncy5nZXQoYCR7bWVkaWFJZH0vJHtmaWxlbmFtZX1gKTtcbiAgICAgIGlmIChyZWFsTWVkaWFJZCkge1xuICAgICAgICBtZWRpYUZpbGUgPSBtZWRpYUZpbGVzLmdldChyZWFsTWVkaWFJZCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIEZvciBzZWN1cmUgdGh1bWJuYWlscywgdXNlIG1lZGlhIElEIGRpcmVjdGx5XG4gICAgICBtZWRpYUZpbGUgPSBtZWRpYUZpbGVzLmdldChtZWRpYUlkKTtcbiAgICB9XG5cbiAgICBpZiAoIW1lZGlhRmlsZSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiTWVkaWEgZmlsZSBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBwZXJtaXNzaW9ucyBmb3Igc2VjdXJlIHRodW1ibmFpbHNcbiAgICBpZiAoIWlzUHVibGljKSB7XG4gICAgICBjb25zdCB1c2VyQWNjb3VudElkID0gcmVxLmhlYWRlcnNbJ3gtYWNjb3VudC1pZCddIGFzIHN0cmluZyB8fCAnZGVmYXVsdCc7XG4gICAgICBpZiAobWVkaWFGaWxlLmFjY291bnRJZCAhPT0gdXNlckFjY291bnRJZCkge1xuICAgICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDMpLmpzb24oeyBlcnJvcjogXCJBY2Nlc3MgZGVuaWVkXCIgfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gR2V0IHRodW1ibmFpbCBwYXRoXG4gICAgY29uc3Qgc2l6ZUtleSA9IHNpemUucmVwbGFjZSgneCcsICdfJykgYXMga2V5b2YgdHlwZW9mIG1lZGlhRmlsZS50aHVtYm5haWxzO1xuICAgIGNvbnN0IHRodW1ibmFpbFBhdGggPSBtZWRpYUZpbGUudGh1bWJuYWlscz8uW3NpemVLZXkgYXMgYW55XTtcbiAgICBcbiAgICBpZiAoIXRodW1ibmFpbFBhdGgpIHtcbiAgICAgIC8vIEdlbmVyYXRlIHRodW1ibmFpbCBvbi1kZW1hbmQgKHNpbXBsaWZpZWQgZm9yIGRlbW8pXG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJUaHVtYm5haWwgbm90IGF2YWlsYWJsZVwiIH0pO1xuICAgIH1cblxuICAgIGNvbnN0IGZ1bGxUaHVtYm5haWxQYXRoID0gcGF0aC5qb2luKHByb2Nlc3MuY3dkKCksICd1cGxvYWRzJywgJ3RodW1ibmFpbHMnLCB0aHVtYm5haWxQYXRoKTtcbiAgICBcbiAgICBpZiAoIWZzLmV4aXN0c1N5bmMoZnVsbFRodW1ibmFpbFBhdGgpKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDQpLmpzb24oeyBlcnJvcjogXCJUaHVtYm5haWwgZmlsZSBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICAvLyBTZXQgaGVhZGVyc1xuICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdpbWFnZS9qcGVnJyk7IC8vIFRodW1ibmFpbHMgYXJlIHR5cGljYWxseSBKUEVHXG4gICAgcmVzLnNldEhlYWRlcignQ2FjaGUtQ29udHJvbCcsIGlzUHVibGljID8gJ3B1YmxpYywgbWF4LWFnZT04NjQwMCcgOiAncHJpdmF0ZSwgbWF4LWFnZT0zNjAwJyk7XG4gICAgXG4gICAgaWYgKGlzUHVibGljKSB7XG4gICAgICByZXMuc2V0SGVhZGVyKCdBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW4nLCAnKicpO1xuICAgIH1cblxuICAgIC8vIFN0cmVhbSB0aHVtYm5haWxcbiAgICBjb25zdCB0aHVtYm5haWxTdHJlYW0gPSBmcy5jcmVhdGVSZWFkU3RyZWFtKGZ1bGxUaHVtYm5haWxQYXRoKTtcbiAgICB0aHVtYm5haWxTdHJlYW0ucGlwZShyZXMpO1xuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3Igc2VydmluZyB0aHVtYm5haWw6JywgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiSW50ZXJuYWwgc2VydmVyIGVycm9yXCIgfSk7XG4gIH1cbn07XG5cbi8qKlxuICogSGFuZGxlIG1lZGlhIGZpbGUgdXBsb2FkXG4gKi9cbmV4cG9ydCBjb25zdCBoYW5kbGVNZWRpYVVwbG9hZDogUmVxdWVzdEhhbmRsZXIgPSBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgdHJ5IHtcbiAgICAvLyBUaGlzIHdvdWxkIHR5cGljYWxseSB1c2UgbXVsdGVyIG9yIHNpbWlsYXIgZm9yIGZpbGUgdXBsb2FkIGhhbmRsaW5nXG4gICAgLy8gRm9yIG5vdywganVzdCByZXR1cm4gYSBtb2NrIHJlc3BvbnNlIHNob3dpbmcgdGhlIGV4cGVjdGVkIGJlaGF2aW9yXG4gICAgXG4gICAgY29uc3QgeyBhY2NvdW50SWQsIHByb2plY3RJZCwgbWVkaWFUeXBlLCBpc1B1YmxpYyB9ID0gcmVxLmJvZHk7XG4gICAgXG4gICAgaWYgKCFhY2NvdW50SWQgfHwgIW1lZGlhVHlwZSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAwKS5qc29uKHsgZXJyb3I6IFwiTWlzc2luZyByZXF1aXJlZCBmaWVsZHNcIiB9KTtcbiAgICB9XG5cbiAgICAvLyBHZW5lcmF0ZSB1bmlxdWUgbWVkaWEgSURcbiAgICBjb25zdCB0aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuICAgIGNvbnN0IHJhbmRvbVRva2VuID0gY3J5cHRvLnJhbmRvbUJ5dGVzKDE2KS50b1N0cmluZygnaGV4Jyk7XG4gICAgY29uc3QgcHJvamVjdFBhcnQgPSBwcm9qZWN0SWQgPyBgX3Ake3Byb2plY3RJZH1gIDogJyc7XG4gICAgY29uc3QgbWVkaWFJZCA9IGBhY2Mke2FjY291bnRJZH0ke3Byb2plY3RQYXJ0fV8ke21lZGlhVHlwZX1fJHt0aW1lc3RhbXB9XyR7cmFuZG9tVG9rZW59YDtcblxuICAgIC8vIE1vY2sgZmlsZSBkYXRhIChpbiByZWFsIGltcGxlbWVudGF0aW9uLCB0aGlzIGNvbWVzIGZyb20gbXVsdGVyKVxuICAgIGNvbnN0IG1vY2tGaWxlID0ge1xuICAgICAgb3JpZ2luYWxuYW1lOiAnZXhhbXBsZS5qcGcnLFxuICAgICAgbWltZXR5cGU6ICdpbWFnZS9qcGVnJyxcbiAgICAgIHNpemU6IDEwMjQwMDAsXG4gICAgICBidWZmZXI6IEJ1ZmZlci5mcm9tKCdtb2NrIGZpbGUgY29udGVudCcpXG4gICAgfTtcblxuICAgIC8vIENyZWF0ZSBzdG9yYWdlIHBhdGhzXG4gICAgY29uc3QgZmlsZUV4dGVuc2lvbiA9IHBhdGguZXh0bmFtZShtb2NrRmlsZS5vcmlnaW5hbG5hbWUpO1xuICAgIGNvbnN0IHN0b3JlZEZpbGVuYW1lID0gYCR7bWVkaWFJZH0ke2ZpbGVFeHRlbnNpb259YDtcbiAgICBjb25zdCBzdG9yZWRQYXRoID0gcGF0aC5qb2luKCdtZWRpYScsIHN0b3JlZEZpbGVuYW1lKTtcbiAgICBcbiAgICAvLyBHZW5lcmF0ZSBwdWJsaWMgVVJMIGlkZW50aWZpZXIgaWYgbmVlZGVkXG4gICAgbGV0IHB1YmxpY1VybElkID0gJyc7XG4gICAgaWYgKGlzUHVibGljKSB7XG4gICAgICBjb25zdCBhY2NvdW50SGFzaCA9IGhhc2hTdHJpbmcoYWNjb3VudElkKTtcbiAgICAgIGNvbnN0IHByb2plY3RIYXNoID0gcHJvamVjdElkID8gaGFzaFN0cmluZyhwcm9qZWN0SWQpIDogJyc7XG4gICAgICBjb25zdCByYW5kb21JZCA9IGNyeXB0by5yYW5kb21CeXRlcygxMikudG9TdHJpbmcoJ2hleCcpO1xuICAgICAgY29uc3QgdGltZXN0YW1wQmFzZTM2ID0gdGltZXN0YW1wLnRvU3RyaW5nKDM2KTtcbiAgICAgIFxuICAgICAgcHVibGljVXJsSWQgPSBgJHthY2NvdW50SGFzaH1fJHtwcm9qZWN0SGFzaH1fJHt0aW1lc3RhbXBCYXNlMzZ9XyR7cmFuZG9tSWR9YC5yZXBsYWNlKC9fXy9nLCAnXycpO1xuICAgICAgXG4gICAgICAvLyBTdG9yZSBtYXBwaW5nXG4gICAgICBwdWJsaWNVcmxNYXBwaW5ncy5zZXQoYCR7cHVibGljVXJsSWR9LyR7bW9ja0ZpbGUub3JpZ2luYWxuYW1lfWAsIG1lZGlhSWQpO1xuICAgIH1cblxuICAgIC8vIENyZWF0ZSBtZWRpYSBmaWxlIHJlY29yZFxuICAgIGNvbnN0IG1lZGlhRmlsZTogU2VydmVyTWVkaWFGaWxlID0ge1xuICAgICAgaWQ6IG1lZGlhSWQsXG4gICAgICBvcmlnaW5hbE5hbWU6IG1vY2tGaWxlLm9yaWdpbmFsbmFtZSxcbiAgICAgIHN0b3JlZFBhdGgsXG4gICAgICBtaW1lVHlwZTogbW9ja0ZpbGUubWltZXR5cGUsXG4gICAgICBzaXplOiBtb2NrRmlsZS5zaXplLFxuICAgICAgYWNjb3VudElkLFxuICAgICAgcHJvamVjdElkLFxuICAgICAgbWVkaWFUeXBlLFxuICAgICAgaXNQdWJsaWM6IEJvb2xlYW4oaXNQdWJsaWMpLFxuICAgICAgdXBsb2FkZWRBdDogbmV3IERhdGUoKSxcbiAgICAgIHVwbG9hZGVkQnk6IHJlcS5oZWFkZXJzWyd4LXVzZXItbmFtZSddIGFzIHN0cmluZyB8fCAnVW5rbm93bicsXG4gICAgICB0aHVtYm5haWxzOiB7XG4gICAgICAgIHNtYWxsOiBgJHttZWRpYUlkfV8xNTB4MTUwLmpwZ2AsXG4gICAgICAgIG1lZGl1bTogYCR7bWVkaWFJZH1fMzAweDMwMC5qcGdgLFxuICAgICAgICBsYXJnZTogYCR7bWVkaWFJZH1fNjAweDYwMC5qcGdgXG4gICAgICB9XG4gICAgfTtcblxuICAgIC8vIFN0b3JlIGluIG1lbW9yeSAoaW4gcHJvZHVjdGlvbiwgc2F2ZSB0byBkYXRhYmFzZSlcbiAgICBtZWRpYUZpbGVzLnNldChtZWRpYUlkLCBtZWRpYUZpbGUpO1xuXG4gICAgLy8gR2VuZXJhdGUgVVJMc1xuICAgIGNvbnN0IHNlY3VyZVVybCA9IGAvYXBpL21lZGlhLyR7bWVkaWFJZH0vJHtlbmNvZGVVUklDb21wb25lbnQobW9ja0ZpbGUub3JpZ2luYWxuYW1lKX1gO1xuICAgIGNvbnN0IHB1YmxpY1VybCA9IGlzUHVibGljID8gYC9wdWJsaWMvbWVkaWEvJHtwdWJsaWNVcmxJZH0vJHttb2NrRmlsZS5vcmlnaW5hbG5hbWV9YCA6ICcnO1xuICAgIGNvbnN0IHRodW1ibmFpbFVybCA9IGAvYXBpL21lZGlhL3RodW1icy8zMDB4MzAwLyR7bWVkaWFJZH0vJHtlbmNvZGVVUklDb21wb25lbnQobW9ja0ZpbGUub3JpZ2luYWxuYW1lKX1gO1xuXG4gICAgcmVzLmpzb24oe1xuICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgIG1lZGlhRmlsZToge1xuICAgICAgICBpZDogbWVkaWFJZCxcbiAgICAgICAgb3JpZ2luYWxOYW1lOiBtb2NrRmlsZS5vcmlnaW5hbG5hbWUsXG4gICAgICAgIG1pbWVUeXBlOiBtb2NrRmlsZS5taW1ldHlwZSxcbiAgICAgICAgc2l6ZTogbW9ja0ZpbGUuc2l6ZSxcbiAgICAgICAgc2VjdXJlVXJsLFxuICAgICAgICBwdWJsaWNVcmwsXG4gICAgICAgIHRodW1ibmFpbFVybCxcbiAgICAgICAgdXBsb2FkZWRBdDogbWVkaWFGaWxlLnVwbG9hZGVkQXQsXG4gICAgICAgIHVwbG9hZGVkQnk6IG1lZGlhRmlsZS51cGxvYWRlZEJ5XG4gICAgICB9XG4gICAgfSk7XG5cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciB1cGxvYWRpbmcgbWVkaWE6JywgZXJyb3IpO1xuICAgIHJlcy5zdGF0dXMoNTAwKS5qc29uKHsgZXJyb3I6IFwiVXBsb2FkIGZhaWxlZFwiIH0pO1xuICB9XG59O1xuXG4vKipcbiAqIEdldCBtZWRpYSBmaWxlIG1ldGFkYXRhXG4gKi9cbmV4cG9ydCBjb25zdCBoYW5kbGVNZWRpYU1ldGFkYXRhOiBSZXF1ZXN0SGFuZGxlciA9IGFzeW5jIChyZXEsIHJlcykgPT4ge1xuICB0cnkge1xuICAgIGNvbnN0IHsgbWVkaWFJZCB9ID0gcmVxLnBhcmFtcztcbiAgICBcbiAgICBjb25zdCBtZWRpYUZpbGUgPSBtZWRpYUZpbGVzLmdldChtZWRpYUlkKTtcbiAgICBpZiAoIW1lZGlhRmlsZSkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDA0KS5qc29uKHsgZXJyb3I6IFwiTWVkaWEgZmlsZSBub3QgZm91bmRcIiB9KTtcbiAgICB9XG5cbiAgICAvLyBDaGVjayBwZXJtaXNzaW9uc1xuICAgIGNvbnN0IHVzZXJBY2NvdW50SWQgPSByZXEuaGVhZGVyc1sneC1hY2NvdW50LWlkJ10gYXMgc3RyaW5nIHx8ICdkZWZhdWx0JztcbiAgICBpZiAobWVkaWFGaWxlLmFjY291bnRJZCAhPT0gdXNlckFjY291bnRJZCkge1xuICAgICAgcmV0dXJuIHJlcy5zdGF0dXMoNDAzKS5qc29uKHsgZXJyb3I6IFwiQWNjZXNzIGRlbmllZFwiIH0pO1xuICAgIH1cblxuICAgIHJlcy5qc29uKHtcbiAgICAgIGlkOiBtZWRpYUZpbGUuaWQsXG4gICAgICBvcmlnaW5hbE5hbWU6IG1lZGlhRmlsZS5vcmlnaW5hbE5hbWUsXG4gICAgICBtaW1lVHlwZTogbWVkaWFGaWxlLm1pbWVUeXBlLFxuICAgICAgc2l6ZTogbWVkaWFGaWxlLnNpemUsXG4gICAgICBtZWRpYVR5cGU6IG1lZGlhRmlsZS5tZWRpYVR5cGUsXG4gICAgICBpc1B1YmxpYzogbWVkaWFGaWxlLmlzUHVibGljLFxuICAgICAgdXBsb2FkZWRBdDogbWVkaWFGaWxlLnVwbG9hZGVkQXQsXG4gICAgICB1cGxvYWRlZEJ5OiBtZWRpYUZpbGUudXBsb2FkZWRCeSxcbiAgICAgIHByb2plY3RJZDogbWVkaWFGaWxlLnByb2plY3RJZFxuICAgIH0pO1xuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBtZWRpYSBtZXRhZGF0YTonLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oeyBlcnJvcjogXCJJbnRlcm5hbCBzZXJ2ZXIgZXJyb3JcIiB9KTtcbiAgfVxufTtcblxuLyoqXG4gKiBIZWxwZXIgZnVuY3Rpb24gdG8gaGFzaCBzdHJpbmdzXG4gKi9cbmZ1bmN0aW9uIGhhc2hTdHJpbmcoc3RyOiBzdHJpbmcpOiBzdHJpbmcge1xuICBsZXQgaGFzaCA9IDA7XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3RyLmxlbmd0aDsgaSsrKSB7XG4gICAgY29uc3QgY2hhciA9IHN0ci5jaGFyQ29kZUF0KGkpO1xuICAgIGhhc2ggPSAoKGhhc2ggPDwgNSkgLSBoYXNoKSArIGNoYXI7XG4gICAgaGFzaCA9IGhhc2ggJiBoYXNoO1xuICB9XG4gIHJldHVybiBNYXRoLmFicyhoYXNoKS50b1N0cmluZygzNik7XG59XG5cbi8vIEZ1bmN0aW9ucyBhcmUgYWxyZWFkeSBleHBvcnRlZCBpbmRpdmlkdWFsbHkgYWJvdmVcbiIsICJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL2RhdGFmb3JzZW8udHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvZGF0YWZvcnNlby50c1wiO2ltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuLy8gRGF0YUZvclNFTyBBUEkgQ29uZmlndXJhdGlvblxuY29uc3QgREFUQUZPUlNFT19CQVNFX1VSTCA9IFwiaHR0cHM6Ly9hcGkuZGF0YWZvcnNlby5jb20vdjNcIjtcblxuaW50ZXJmYWNlIERhdGFGb3JTRU9DcmVkZW50aWFscyB7XG4gIHVzZXJuYW1lOiBzdHJpbmc7XG4gIHBhc3N3b3JkOiBzdHJpbmc7XG59XG5cbi8vIEdldCBjcmVkZW50aWFscyBmcm9tIGVudmlyb25tZW50IHZhcmlhYmxlc1xuY29uc3QgZ2V0RGF0YUZvclNFT0NyZWRlbnRpYWxzID0gKCk6IERhdGFGb3JTRU9DcmVkZW50aWFscyB8IG51bGwgPT4ge1xuICBjb25zdCB1c2VybmFtZSA9IHByb2Nlc3MuZW52LkRBVEFGT1JTRU9fVVNFUk5BTUU7XG4gIGNvbnN0IHBhc3N3b3JkID0gcHJvY2Vzcy5lbnYuREFUQUZPUlNFT19QQVNTV09SRDtcbiAgXG4gIGlmICh1c2VybmFtZSAmJiBwYXNzd29yZCkge1xuICAgIHJldHVybiB7IHVzZXJuYW1lLCBwYXNzd29yZCB9O1xuICB9XG4gIFxuICByZXR1cm4gbnVsbDtcbn07XG5cbi8vIFByb3h5IGVuZHBvaW50IGZvciBEYXRhRm9yU0VPIEFQSSBjYWxsc1xuZXhwb3J0IGNvbnN0IGhhbmRsZURhdGFGb3JTRU9Qcm94eSA9IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCBjcmVkZW50aWFscyA9IGdldERhdGFGb3JTRU9DcmVkZW50aWFscygpO1xuICAgIFxuICAgIGlmICghY3JlZGVudGlhbHMpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcjogXCJEYXRhRm9yU0VPIGNyZWRlbnRpYWxzIG5vdCBjb25maWd1cmVkXCJcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICBjb25zdCB7IGVuZHBvaW50LCBtZXRob2QgPSBcIkdFVFwiLCBib2R5IH0gPSByZXEuYm9keTtcbiAgICBcbiAgICBpZiAoIWVuZHBvaW50KSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZXJyb3I6IFwiRW5kcG9pbnQgaXMgcmVxdWlyZWRcIlxuICAgICAgfSk7XG4gICAgfVxuICAgIFxuICAgIGNvbnN0IGF1dGhTdHJpbmcgPSBCdWZmZXIuZnJvbShcbiAgICAgIGAke2NyZWRlbnRpYWxzLnVzZXJuYW1lfToke2NyZWRlbnRpYWxzLnBhc3N3b3JkfWBcbiAgICApLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICBcbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGAke0RBVEFGT1JTRU9fQkFTRV9VUkx9JHtlbmRwb2ludH1gLCB7XG4gICAgICBtZXRob2QsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdBdXRob3JpemF0aW9uJzogYEJhc2ljICR7YXV0aFN0cmluZ31gLFxuICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nLFxuICAgICAgfSxcbiAgICAgIC4uLihib2R5ICYmIHsgYm9keTogSlNPTi5zdHJpbmdpZnkoYm9keSkgfSlcbiAgICB9KTtcbiAgICBcbiAgICBjb25zdCBkYXRhID0gYXdhaXQgcmVzcG9uc2UuanNvbigpO1xuICAgIFxuICAgIGlmICghcmVzcG9uc2Uub2spIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgRGF0YUZvclNFTyBBUEkgZXJyb3I6ICR7cmVzcG9uc2Uuc3RhdHVzfWApO1xuICAgIH1cbiAgICBcbiAgICByZXMuanNvbih7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgZGF0YVxuICAgIH0pO1xuICAgIFxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJEYXRhRm9yU0VPIHByb3h5IGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIlVua25vd24gZXJyb3JcIlxuICAgIH0pO1xuICB9XG59O1xuXG4vLyBDaGVjayBpZiBEYXRhRm9yU0VPIGlzIGNvbmZpZ3VyZWRcbmV4cG9ydCBjb25zdCBoYW5kbGVEYXRhRm9yU0VPU3RhdHVzID0gYXN5bmMgKF9yZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpID0+IHtcbiAgY29uc3QgY3JlZGVudGlhbHMgPSBnZXREYXRhRm9yU0VPQ3JlZGVudGlhbHMoKTtcbiAgXG4gIHJlcy5qc29uKHtcbiAgICBzdWNjZXNzOiB0cnVlLFxuICAgIGNvbmZpZ3VyZWQ6ICEhY3JlZGVudGlhbHNcbiAgfSk7XG59O1xuIiwgImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvYXBwL2NvZGUvc2VydmVyL3JvdXRlc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2FwcC9jb2RlL3NlcnZlci9yb3V0ZXMvdHdpbGlvLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9hcHAvY29kZS9zZXJ2ZXIvcm91dGVzL3R3aWxpby50c1wiO2ltcG9ydCB7IFJlcXVlc3QsIFJlc3BvbnNlIH0gZnJvbSBcImV4cHJlc3NcIjtcblxuLy8gVHdpbGlvIENvbmZpZ3VyYXRpb25cbmludGVyZmFjZSBUd2lsaW9Db25maWcge1xuICBhY2NvdW50U2lkOiBzdHJpbmc7XG4gIGF1dGhUb2tlbjogc3RyaW5nO1xuICBwaG9uZU51bWJlcjogc3RyaW5nO1xuICB3ZWJob29rVXJsPzogc3RyaW5nO1xufVxuXG5pbnRlcmZhY2UgU01TUmVxdWVzdCB7XG4gIHRvOiBzdHJpbmc7XG4gIG1lc3NhZ2U6IHN0cmluZztcbiAgY2FtcGFpZ25JZD86IHN0cmluZztcbiAgYnVzaW5lc3NJZD86IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIFNNU1Jlc3BvbnNlIHtcbiAgc3VjY2VzczogYm9vbGVhbjtcbiAgbWVzc2FnZUlkPzogc3RyaW5nO1xuICBlcnJvcj86IHN0cmluZztcbn1cblxuLy8gR2V0IFR3aWxpbyBjb25maWd1cmF0aW9uIGZyb20gZW52aXJvbm1lbnQgdmFyaWFibGVzXG5jb25zdCBnZXRUd2lsaW9Db25maWcgPSAoKTogVHdpbGlvQ29uZmlnIHwgbnVsbCA9PiB7XG4gIGNvbnN0IGFjY291bnRTaWQgPSBwcm9jZXNzLmVudi5UV0lMSU9fQUNDT1VOVF9TSUQ7XG4gIGNvbnN0IGF1dGhUb2tlbiA9IHByb2Nlc3MuZW52LlRXSUxJT19BVVRIX1RPS0VOO1xuICBjb25zdCBwaG9uZU51bWJlciA9IHByb2Nlc3MuZW52LlRXSUxJT19QSE9ORV9OVU1CRVI7XG4gIGNvbnN0IHdlYmhvb2tVcmwgPSBwcm9jZXNzLmVudi5UV0lMSU9fV0VCSE9PS19VUkw7XG5cbiAgaWYgKGFjY291bnRTaWQgJiYgYXV0aFRva2VuICYmIHBob25lTnVtYmVyKSB7XG4gICAgcmV0dXJuIHtcbiAgICAgIGFjY291bnRTaWQsXG4gICAgICBhdXRoVG9rZW4sXG4gICAgICBwaG9uZU51bWJlcixcbiAgICAgIHdlYmhvb2tVcmxcbiAgICB9O1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59O1xuXG4vLyBTZW5kIFNNUyB2aWEgVHdpbGlvIEFQSVxuZXhwb3J0IGNvbnN0IGhhbmRsZVNlbmRTTVMgPSBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgY29uZmlnID0gZ2V0VHdpbGlvQ29uZmlnKCk7XG4gICAgXG4gICAgaWYgKCFjb25maWcpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcjogXCJUd2lsaW8gY3JlZGVudGlhbHMgbm90IGNvbmZpZ3VyZWRcIlxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgeyB0bywgbWVzc2FnZSwgY2FtcGFpZ25JZCwgYnVzaW5lc3NJZCB9OiBTTVNSZXF1ZXN0ID0gcmVxLmJvZHk7XG5cbiAgICBpZiAoIXRvIHx8ICFtZXNzYWdlKSB7XG4gICAgICByZXR1cm4gcmVzLnN0YXR1cyg0MDApLmpzb24oe1xuICAgICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgICAgZXJyb3I6IFwiUGhvbmUgbnVtYmVyIGFuZCBtZXNzYWdlIGFyZSByZXF1aXJlZFwiXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBQcmVwYXJlIFR3aWxpbyBBUEkgcmVxdWVzdFxuICAgIGNvbnN0IGF1dGhTdHJpbmcgPSBCdWZmZXIuZnJvbShcbiAgICAgIGAke2NvbmZpZy5hY2NvdW50U2lkfToke2NvbmZpZy5hdXRoVG9rZW59YFxuICAgICkudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuXG4gICAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7XG4gICAgICBGcm9tOiBjb25maWcucGhvbmVOdW1iZXIsXG4gICAgICBUbzogdG8sXG4gICAgICBCb2R5OiBtZXNzYWdlLFxuICAgICAgLi4uKGNvbmZpZy53ZWJob29rVXJsICYmIHsgU3RhdHVzQ2FsbGJhY2s6IGNvbmZpZy53ZWJob29rVXJsIH0pXG4gICAgfSk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFxuICAgICAgYGh0dHBzOi8vYXBpLnR3aWxpby5jb20vMjAxMC0wNC0wMS9BY2NvdW50cy8ke2NvbmZpZy5hY2NvdW50U2lkfS9NZXNzYWdlcy5qc29uYCxcbiAgICAgIHtcbiAgICAgICAgbWV0aG9kOiAnUE9TVCcsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbic6IGBCYXNpYyAke2F1dGhTdHJpbmd9YCxcbiAgICAgICAgICAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCcsXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IHBhcmFtcy50b1N0cmluZygpXG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFR3aWxpbyBBUEkgZXJyb3I6ICR7ZGF0YS5tZXNzYWdlIHx8IHJlc3BvbnNlLnN0YXR1c31gKTtcbiAgICB9XG5cbiAgICAvLyBUT0RPOiBTdG9yZSBtZXNzYWdlIHJlY29yZCBpbiBkYXRhYmFzZVxuICAgIGNvbnNvbGUubG9nKCdTTVMgc2VudCBzdWNjZXNzZnVsbHk6Jywge1xuICAgICAgbWVzc2FnZUlkOiBkYXRhLnNpZCxcbiAgICAgIHRvLFxuICAgICAgY2FtcGFpZ25JZCxcbiAgICAgIGJ1c2luZXNzSWRcbiAgICB9KTtcblxuICAgIHJlcy5qc29uKHtcbiAgICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgICBtZXNzYWdlSWQ6IGRhdGEuc2lkLFxuICAgICAgc3RhdHVzOiBkYXRhLnN0YXR1c1xuICAgIH0pO1xuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlR3aWxpbyBTTVMgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiVW5rbm93biBlcnJvclwiXG4gICAgfSk7XG4gIH1cbn07XG5cbi8vIEhhbmRsZSBUd2lsaW8gd2ViaG9vayBmb3IgbWVzc2FnZSBzdGF0dXMgdXBkYXRlc1xuZXhwb3J0IGNvbnN0IGhhbmRsZVR3aWxpb1dlYmhvb2sgPSBhc3luYyAocmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgeyBNZXNzYWdlU2lkLCBNZXNzYWdlU3RhdHVzLCBFcnJvckNvZGUsIEVycm9yTWVzc2FnZSB9ID0gcmVxLmJvZHk7XG5cbiAgICBjb25zb2xlLmxvZygnVHdpbGlvIHdlYmhvb2sgcmVjZWl2ZWQ6Jywge1xuICAgICAgbWVzc2FnZUlkOiBNZXNzYWdlU2lkLFxuICAgICAgc3RhdHVzOiBNZXNzYWdlU3RhdHVzLFxuICAgICAgZXJyb3JDb2RlOiBFcnJvckNvZGUsXG4gICAgICBlcnJvck1lc3NhZ2U6IEVycm9yTWVzc2FnZVxuICAgIH0pO1xuXG4gICAgLy8gVE9ETzogVXBkYXRlIG1lc3NhZ2Ugc3RhdHVzIGluIGRhdGFiYXNlXG4gICAgLy8gY29uc3QgdXBkYXRlUmVzdWx0ID0gYXdhaXQgdXBkYXRlTWVzc2FnZVN0YXR1cyhNZXNzYWdlU2lkLCBNZXNzYWdlU3RhdHVzLCBFcnJvckNvZGUsIEVycm9yTWVzc2FnZSk7XG5cbiAgICAvLyBSZXNwb25kIHRvIFR3aWxpb1xuICAgIHJlcy5zdGF0dXMoMjAwKS5zZW5kKCdPSycpO1xuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlR3aWxpbyB3ZWJob29rIGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLnNlbmQoJ0Vycm9yIHByb2Nlc3Npbmcgd2ViaG9vaycpO1xuICB9XG59O1xuXG4vLyBUZXN0IFR3aWxpbyBjb25uZWN0aW9uXG5leHBvcnQgY29uc3QgaGFuZGxlVHdpbGlvVGVzdCA9IGFzeW5jIChfcmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3QgY29uZmlnID0gZ2V0VHdpbGlvQ29uZmlnKCk7XG4gICAgXG4gICAgaWYgKCFjb25maWcpIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcjogXCJUd2lsaW8gY3JlZGVudGlhbHMgbm90IGNvbmZpZ3VyZWRcIlxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gVGVzdCBieSBmZXRjaGluZyBhY2NvdW50IGluZm9ybWF0aW9uXG4gICAgY29uc3QgYXV0aFN0cmluZyA9IEJ1ZmZlci5mcm9tKFxuICAgICAgYCR7Y29uZmlnLmFjY291bnRTaWR9OiR7Y29uZmlnLmF1dGhUb2tlbn1gXG4gICAgKS50b1N0cmluZygnYmFzZTY0Jyk7XG5cbiAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKFxuICAgICAgYGh0dHBzOi8vYXBpLnR3aWxpby5jb20vMjAxMC0wNC0wMS9BY2NvdW50cy8ke2NvbmZpZy5hY2NvdW50U2lkfS5qc29uYCxcbiAgICAgIHtcbiAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICdBdXRob3JpemF0aW9uJzogYEJhc2ljICR7YXV0aFN0cmluZ31gLFxuICAgICAgICB9XG4gICAgICB9XG4gICAgKTtcblxuICAgIGNvbnN0IGRhdGEgPSBhd2FpdCByZXNwb25zZS5qc29uKCk7XG5cbiAgICBpZiAoIXJlc3BvbnNlLm9rKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYFR3aWxpbyBBUEkgZXJyb3I6ICR7ZGF0YS5tZXNzYWdlIHx8IHJlc3BvbnNlLnN0YXR1c31gKTtcbiAgICB9XG5cbiAgICByZXMuanNvbih7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgYWNjb3VudEluZm86IHtcbiAgICAgICAgZnJpZW5kbHlOYW1lOiBkYXRhLmZyaWVuZGx5X25hbWUsXG4gICAgICAgIHN0YXR1czogZGF0YS5zdGF0dXMsXG4gICAgICAgIHR5cGU6IGRhdGEudHlwZVxuICAgICAgfVxuICAgIH0pO1xuXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgY29uc29sZS5lcnJvcihcIlR3aWxpbyB0ZXN0IGVycm9yOlwiLCBlcnJvcik7XG4gICAgcmVzLnN0YXR1cyg1MDApLmpzb24oe1xuICAgICAgc3VjY2VzczogZmFsc2UsXG4gICAgICBlcnJvcjogZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiBcIkNvbm5lY3Rpb24gdGVzdCBmYWlsZWRcIlxuICAgIH0pO1xuICB9XG59O1xuXG4vLyBDaGVjayBpZiBUd2lsaW8gaXMgY29uZmlndXJlZFxuZXhwb3J0IGNvbnN0IGhhbmRsZVR3aWxpb1N0YXR1cyA9IGFzeW5jIChfcmVxOiBSZXF1ZXN0LCByZXM6IFJlc3BvbnNlKSA9PiB7XG4gIGNvbnN0IGNvbmZpZyA9IGdldFR3aWxpb0NvbmZpZygpO1xuICBcbiAgcmVzLmpzb24oe1xuICAgIHN1Y2Nlc3M6IHRydWUsXG4gICAgY29uZmlndXJlZDogISFjb25maWcsXG4gICAgaGFzUGhvbmVOdW1iZXI6ICEhKGNvbmZpZz8ucGhvbmVOdW1iZXIpXG4gIH0pO1xufTtcblxuLy8gU2VuZCByZXZpZXcgcmVxdWVzdCBTTVNcbmV4cG9ydCBjb25zdCBoYW5kbGVTZW5kUmV2aWV3UmVxdWVzdCA9IGFzeW5jIChyZXE6IFJlcXVlc3QsIHJlczogUmVzcG9uc2UpID0+IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB7IFxuICAgICAgdG8sIFxuICAgICAgYnVzaW5lc3NOYW1lLCBcbiAgICAgIGN1c3RvbWVyTmFtZSwgXG4gICAgICByZXZpZXdMaW5rLFxuICAgICAgYnVzaW5lc3NJZCBcbiAgICB9ID0gcmVxLmJvZHk7XG5cbiAgICBpZiAoIXRvIHx8ICFidXNpbmVzc05hbWUgfHwgIXJldmlld0xpbmspIHtcbiAgICAgIHJldHVybiByZXMuc3RhdHVzKDQwMCkuanNvbih7XG4gICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICBlcnJvcjogXCJQaG9uZSBudW1iZXIsIGJ1c2luZXNzIG5hbWUsIGFuZCByZXZpZXcgbGluayBhcmUgcmVxdWlyZWRcIlxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgY29uc3QgbWVzc2FnZSA9IGBIaSAke2N1c3RvbWVyTmFtZSB8fCAndGhlcmUnfSEgVGhhbmsgeW91IGZvciBjaG9vc2luZyAke2J1c2luZXNzTmFtZX0uIFdlJ2QgbG92ZSB0byBoZWFyIGFib3V0IHlvdXIgZXhwZXJpZW5jZS4gUGxlYXNlIGxlYXZlIHVzIGEgcmV2aWV3OiAke3Jldmlld0xpbmt9YDtcblxuICAgIC8vIFVzZSB0aGUgZXhpc3RpbmcgU01TIGhhbmRsZXJcbiAgICByZXEuYm9keSA9IHtcbiAgICAgIHRvLFxuICAgICAgbWVzc2FnZSxcbiAgICAgIGJ1c2luZXNzSWQsXG4gICAgICBjYW1wYWlnbklkOiAncmV2aWV3X3JlcXVlc3QnXG4gICAgfTtcblxuICAgIHJldHVybiBoYW5kbGVTZW5kU01TKHJlcSwgcmVzKTtcblxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoXCJSZXZpZXcgcmVxdWVzdCBTTVMgZXJyb3I6XCIsIGVycm9yKTtcbiAgICByZXMuc3RhdHVzKDUwMCkuanNvbih7XG4gICAgICBzdWNjZXNzOiBmYWxzZSxcbiAgICAgIGVycm9yOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IFwiRmFpbGVkIHRvIHNlbmQgcmV2aWV3IHJlcXVlc3RcIlxuICAgIH0pO1xuICB9XG59O1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE2TSxTQUFTLG9CQUE0QjtBQUNsUCxPQUFPLFdBQVc7QUFDbEIsT0FBT0EsV0FBVTs7O0FDRnFNLE9BQU8sYUFBYTtBQUMxTyxPQUFPLFVBQVU7OztBQ0VWLElBQU0sYUFBNkIsQ0FBQyxLQUFLLFFBQVE7QUFDdEQsUUFBTSxXQUF5QjtBQUFBLElBQzdCLFNBQVM7QUFBQSxFQUNYO0FBQ0EsTUFBSSxPQUFPLEdBQUcsRUFBRSxLQUFLLFFBQVE7QUFDL0I7OztBQ1BBLE9BQU8sVUFBVTtBQUNqQixPQUFPLFFBQVE7QUFDZixPQUFPLFlBQVk7QUE0Qm5CLElBQU0sYUFBYSxvQkFBSSxJQUE2QjtBQUNwRCxJQUFNLG9CQUFvQixvQkFBSSxJQUFvQjtBQUszQyxJQUFNLG9CQUFvQyxPQUFPLEtBQUssUUFBUTtBQUNuRSxNQUFJO0FBQ0YsVUFBTSxFQUFFLFNBQVMsU0FBUyxJQUFJLElBQUk7QUFFbEMsUUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVO0FBQ3pCLGFBQU8sSUFBSSxPQUFPLEdBQUcsRUFBRSxLQUFLLEVBQUUsT0FBTywrQkFBK0IsQ0FBQztBQUFBLElBQ3ZFO0FBR0EsVUFBTSxZQUFZLFdBQVcsSUFBSSxPQUFPO0FBQ3hDLFFBQUksQ0FBQyxXQUFXO0FBQ2QsYUFBTyxJQUFJLE9BQU8sR0FBRyxFQUFFLEtBQUssRUFBRSxPQUFPLHVCQUF1QixDQUFDO0FBQUEsSUFDL0Q7QUFJQSxVQUFNLGdCQUFnQixJQUFJLFFBQVEsY0FBYyxLQUFlO0FBQy9ELFFB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SUFBSSxpQ0FBaUMsaUJBQWlCO0FBQzFELE1BQUksSUFBSSw4Q0FBOEMsZ0JBQWdCO0FBQ3RFLE1BQUksS0FBSyxxQkFBcUIsaUJBQWlCO0FBQy9DLE1BQUksSUFBSSxnQ0FBZ0MsbUJBQW1CO0FBRzNELE1BQUksSUFBSSxxQ0FBcUMsaUJBQWlCO0FBQzlELE1BQUksSUFBSSxrREFBa0QsZ0JBQWdCO0FBRzFFLE1BQUksS0FBSyx5QkFBeUIscUJBQXFCO0FBQ3ZELE1BQUksSUFBSSwwQkFBMEIsc0JBQXNCO0FBR3hELE1BQUksS0FBSyx3QkFBd0IsYUFBYTtBQUM5QyxNQUFJLEtBQUssOEJBQThCLHVCQUF1QjtBQUM5RCxNQUFJLEtBQUssd0JBQXdCLG1CQUFtQjtBQUNwRCxNQUFJLElBQUksb0JBQW9CLGdCQUFnQjtBQUM1QyxNQUFJLElBQUksc0JBQXNCLGtCQUFrQjtBQUVoRCxTQUFPO0FBQ1Q7OztBRDNEQSxJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFlBQVk7QUFBQSxFQUNkO0FBQUEsRUFDQSxPQUFPO0FBQUEsSUFDTCxRQUFRO0FBQUEsRUFDVjtBQUFBLEVBQ0EsU0FBUyxDQUFDLE1BQU0sR0FBRyxjQUFjLENBQUM7QUFBQSxFQUNsQyxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLQyxNQUFLLFFBQVEsa0NBQVcsVUFBVTtBQUFBLE1BQ3ZDLFdBQVdBLE1BQUssUUFBUSxrQ0FBVyxVQUFVO0FBQUEsSUFDL0M7QUFBQSxFQUNGO0FBQUEsRUFDQSxjQUFjO0FBQUEsSUFDWixTQUFTLENBQUMsWUFBWTtBQUFBLElBQ3RCLFNBQVMsQ0FBQyx5QkFBeUIscUJBQXFCO0FBQUEsRUFDMUQ7QUFDRixFQUFFO0FBRUYsU0FBUyxnQkFBd0I7QUFDL0IsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBO0FBQUEsSUFDUCxnQkFBZ0IsUUFBUTtBQUN0QixZQUFNLE1BQU0sYUFBYTtBQUd6QixhQUFPLFlBQVksSUFBSSxDQUFDLEtBQUssS0FBSyxTQUFTO0FBQ3pDLFlBQUksSUFBSSxLQUFLLFdBQVcsT0FBTyxLQUFLLElBQUksS0FBSyxXQUFXLFVBQVUsR0FBRztBQUNuRSxjQUFJLEtBQVksS0FBWSxJQUFXO0FBQUEsUUFDekMsT0FBTztBQUNMLGVBQUs7QUFBQSxRQUNQO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Y7QUFDRjsiLAogICJuYW1lcyI6IFsicGF0aCIsICJwYXRoIl0KfQo=
