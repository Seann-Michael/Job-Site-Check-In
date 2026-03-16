import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { createServer } from "./index";

const app = createServer();
const port = process.env.PORT || 3000;

// ESM-compatible __dirname (works on Node 18+)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve the built SPA files from dist/ (server builds to dist/server/, so go up one level)
const distPath = path.join(__dirname, "..");

// Serve static files (frontend)
app.use(express.static(distPath));

// Catch-all: serve index.html for React Router (SPA fallback)
// Using app.use() avoids Express 5's named-wildcard requirement in path-to-regexp v8
app.use((req: express.Request, res: express.Response) => {
  // Return JSON 404 for unknown API or health routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/health")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(port, () => {
  console.log(`🚀 Local SEO Ranker server running on port ${port}`);
  console.log(`📱 Frontend: http://localhost:${port}`);
  console.log(`🔧 API: http://localhost:${port}/api`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🛑 Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("🛑 Received SIGINT, shutting down gracefully");
  process.exit(0);
});
