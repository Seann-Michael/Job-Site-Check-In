import path from "path";
import { fileURLToPath } from "url";
import express, { Request, Response, NextFunction } from "express";
import * as Sentry from "@sentry/node";
import { createServer, APP_VERSION } from "./index";
import { logger } from "./lib/logger";

// Optional error reporting: only active when SENTRY_DSN is set. Must run
// before createServer() so the error handler's captureException has a client.
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "production",
    release: process.env.APP_VERSION || process.env.npm_package_version || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0,
    sendDefaultPii: false,
  });
  logger.info("Sentry error reporting enabled");
}

const port = Number(process.env.PORT) || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Built SPA lives in dist/ (this file is bundled to dist/server/).
const distPath = path.join(__dirname, "..");
const indexHtml = path.join(distPath, "index.html");

const app = createServer();

// Hashed build assets: cache forever.
app.use(
  "/assets",
  express.static(path.join(distPath, "assets"), {
    immutable: true,
    maxAge: "1y",
    index: false,
    fallthrough: true,
  }),
);

// Everything else in dist/ (favicon, manifest, offline.html...): short cache,
// never serve index.html from here so it gets the no-cache headers below.
app.use(
  express.static(distPath, {
    index: false,
    maxAge: "1h",
    setHeaders(res, filePath) {
      if (filePath.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
    },
  }),
);

// SPA fallback for client-side routes. Unknown /api/* already got a JSON 404
// inside createServer().
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path.startsWith("/api/") || req.path.startsWith("/public/media/")) {
    return res.status(404).json({ error: "Not found" });
  }
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.sendFile(indexHtml, (err) => {
    if (err) next(err);
  });
});

// Final safety net for errors raised by the static layer.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, "Unhandled error in static layer");
  if (res.headersSent) return;
  res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(port, () => {
  logger.info({ port, version: APP_VERSION, env: process.env.NODE_ENV || "development" }, "Server listening");
});

// Keep-alive tuned for load balancers (DigitalOcean App Platform idles at 60s).
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

// ── Graceful shutdown ────────────────────────────────────────────────────────
let shuttingDown = false;
function shutdown(signal: string, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, "Shutting down");
  const force = setTimeout(() => {
    logger.error("Forced shutdown after timeout");
    process.exit(1);
  }, 10_000);
  force.unref();
  server.close((err) => {
    if (err) {
      logger.error({ err }, "Error closing server");
      process.exit(1);
    }
    logger.info("Server closed");
    process.exit(code);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function flushSentry() {
  if (!process.env.SENTRY_DSN) return;
  try {
    await Sentry.flush(2000);
  } catch {
    /* ignore */
  }
}

process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection");
  Sentry.captureException(reason);
  void flushSentry().finally(() => shutdown("unhandledRejection", 1));
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  Sentry.captureException(err);
  void flushSentry().finally(() => shutdown("uncaughtException", 1));
});
