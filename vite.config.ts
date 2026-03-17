import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { createServer } from "./server";

/**
 * Reads a .env-style file and returns key/value pairs.
 * This is used to let .env.local values OVERRIDE process.env,
 * which is necessary when the platform injects incorrect env vars.
 */
function parseEnvFile(filePath: string): Record<string, string> {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const result: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIndex = trimmed.indexOf("=");
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim();
        const value = trimmed.slice(eqIndex + 1).trim();
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Read .env.local directly so its VITE_ values take precedence over
  // any incorrect values the platform may have set in process.env.
  const envLocalPath = path.resolve(__dirname, ".env.local");
  const envLocal = parseEnvFile(envLocalPath);

  // Build `define` overrides so import.meta.env.VITE_* uses the .env.local values
  const envDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(envLocal)) {
    if (key.startsWith("VITE_")) {
      envDefines[`import.meta.env.${key}`] = JSON.stringify(value);
    }
  }

  return {
    server: {
      host: "::",
      port: 5173,
      strictPort: false,
    },
    build: {
      outDir: "dist",
    },
    // These compile-time replacements override the process.env values that
    // Vite would otherwise inject, fixing any misconfigured platform env vars.
    define: envDefines,
    plugins: [react(), expressPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./client"),
        "@shared": path.resolve(__dirname, "./shared"),
      },
      // Force a single copy of React packages to prevent "Invalid hook call"
      // errors caused by mismatched React versions (e.g. react-is@19 vs react@18)
      dedupe: ["react", "react-dom", "react-is", "react-router-dom"],
    },
    optimizeDeps: {
      entries: ["index.html"],
      exclude: ["test-google-maps.html", "public/offline.html"],
      // Explicitly include React packages to ensure Vite pre-bundles them as a
      // single unified chunk, preventing the "Invalid hook call" error that
      // occurs when multiple React instances exist (e.g. from a stale cache or
      // a nested react-is version shipped by prop-types).
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react-is",
        "react-router-dom",
        "recharts",
      ],
    },
  };
});

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    configureServer(server) {
      const app = createServer();

      // Route API and public routes to the local express app
      server.middlewares.use(async (req: any, res: any, next: any) => {
        try {
          const url = req.url || "";
          if (url.startsWith("/api/") || url.startsWith("/public/")) {
            return app(req, res, next);
          }
          return next();
        } catch (err) {
          console.error("Vite dev middleware error:", err);
          return next();
        }
      });
    },
  };
}
