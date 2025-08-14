import express from "express";
import cors from "cors";
import businessRoutes from "./routes/businesses";
import projectRoutes from "./routes/projects";
import authRoutes from "./routes/auth";
import seoRoutes from "./routes/seo";
import communicationRoutes from "./routes/communications";
import webhookRoutes from "./routes/webhooks";
import keywordRoutes from "./routes/keywords";

/**
 * Entry point for the Local SEO Ranker backend. This Express application
 * configures middleware for CORS and JSON parsing and mounts all REST
 * endpoints used by the front‑end. Additional routes can be added as the
 * application grows. In production this file would be bundled and
 * deployed as a Netlify function or run as a standalone server.
 */
const app = express();

// Allow cross‑origin requests from the front‑end domains. When deploying
// you should restrict the allowed origins to your actual front‑end URL.
app.use(
  cors({
    origin: [
      "https://app.mylocalseoranker.com",
      "http://localhost:8080",
      "http://localhost:3000",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  }),
);

// Parse JSON request bodies up to 10mb. Without this middleware Express
// will not automatically parse incoming JSON into req.body.
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Mount modular route handlers. Each module is responsible for one
// domain (businesses, projects, authentication, etc.). This keeps the
// application organized and makes it easy to add new features.
app.use("/auth", authRoutes);
app.use("/businesses", businessRoutes);
app.use("/projects", projectRoutes);
app.use("/seo", seoRoutes);
app.use("/communications", communicationRoutes);
app.use("/webhooks", webhookRoutes);
app.use("/keywords", keywordRoutes);

// Health check endpoint. Useful for uptime monitoring and ensuring
// the server is responding.
app.get("/health", (req, res) => {
  res.json({ success: true, message: "API is healthy" });
});

// Generic error handler. Catches errors thrown in async route
// handlers and returns a standardized JSON response. Do not expose
// sensitive information in production.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("API Error:", err);
  const statusCode = err.status || 500;
  res.status(statusCode).json({ success: false, error: err.message || "Internal Server Error" });
});

export default app;