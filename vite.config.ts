import { defineConfig, loadEnv, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";

// A build id that changes on every build so the service worker cache is
// invalidated on deploy. Prefer the platform-provided commit SHA when present.
const BUILD_ID =
  process.env.BUILD_ID ||
  process.env.SOURCE_VERSION ||
  process.env.GITHUB_SHA ||
  Date.now().toString(36);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Make .env / .env.local values visible to the dev-only Express server,
  // which reads process.env (server/lib/env.ts).
  const env = loadEnv(mode, process.cwd(), "");
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  return {
    server: {
      host: "::",
      port: 5173,
      strictPort: false,
    },
    build: {
      outDir: "dist",
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return undefined;
            if (
              /[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|react-is)[\\/]/.test(
                id,
              )
            ) {
              return "vendor-react";
            }
            if (id.includes("/node_modules/@radix-ui/")) return "vendor-radix";
            if (id.includes("/node_modules/@supabase/"))
              return "vendor-supabase";
            if (id.includes("/node_modules/lucide-react/"))
              return "vendor-icons";
            if (
              /[\\/]node_modules[\\/](recharts|d3-[^/]+|date-fns|victory-vendor|@tanstack)[\\/]/.test(
                id,
              )
            ) {
              return "vendor-misc";
            }
            return undefined;
          },
        },
      },
    },
    plugins: [react(), buildIdPlugin(), expressPlugin()],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./client"),
        "@shared": path.resolve(import.meta.dirname, "./shared"),
      },
      // Force a single copy of React packages to prevent "Invalid hook call"
      // errors caused by mismatched React versions (e.g. react-is@19 vs react@18)
      dedupe: ["react", "react-dom", "react-is", "react-router-dom"],
    },
    optimizeDeps: {
      entries: ["index.html"],
      exclude: ["public/offline.html"],
      // Explicitly include React packages to ensure Vite pre-bundles them as a
      // single unified chunk, preventing the "Invalid hook call" error that
      // occurs when multiple React instances exist.
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react-is",
        "react-router-dom",
        "recharts",
        "@radix-ui/react-slider",
        "@radix-ui/react-separator",
        "@radix-ui/react-tooltip",
        "@radix-ui/react-dialog",
        "@radix-ui/react-select",
        "@radix-ui/react-tabs",
        "@radix-ui/react-dropdown-menu",
      ],
    },
  };
});

/**
 * Replaces the `__BUILD_ID__` placeholder in public/sw.js (and index.html)
 * with a per-build id so each deploy gets a fresh service worker cache.
 */
function buildIdPlugin(): Plugin {
  return {
    name: "build-id",
    transformIndexHtml(html) {
      return html.replace(/__BUILD_ID__/g, BUILD_ID);
    },
    closeBundle() {
      // Vite copies public/ into dist after the bundle is written, so patch
      // the copied file in place.
      const out = path.resolve(import.meta.dirname, "dist/sw.js");
      if (!fs.existsSync(out)) return;
      const sw = fs.readFileSync(out, "utf-8");
      fs.writeFileSync(out, sw.replace(/__BUILD_ID__/g, BUILD_ID));
    },
    configureServer(server) {
      // In dev, serve sw.js with the placeholder replaced too.
      server.middlewares.use((req, res, next) => {
        if (req.url === "/sw.js") {
          const swPath = path.resolve(import.meta.dirname, "public/sw.js");
          try {
            const sw = fs.readFileSync(swPath, "utf-8");
            res.setHeader("Content-Type", "application/javascript");
            res.end(sw.replace(/__BUILD_ID__/g, "dev"));
            return;
          } catch {
            // fall through to static handling
          }
        }
        next();
      });
    },
  };
}

/**
 * Dev-only: mounts the Express API on the Vite dev server so `/api/*` works
 * without a separate process. The server module is imported lazily because it
 * creates a Supabase client at load time; without credentials we skip it
 * rather than crash `vite build`.
 */
function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve",
    async configureServer(server) {
      const hasSupabase =
        process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
      if (!hasSupabase) {
        console.warn(
          "[vite] SUPABASE_URL not set - API proxying is disabled for this dev session.",
        );
        return;
      }
      const { createServer } = await import("./server");
      // Dev only: the production entry (server/node-build.ts) validates env strictly.
      if (!process.env.APP_URL) process.env.APP_URL = "http://localhost:8080";
      let app: any;
      try {
        app = createServer();
      } catch (err) {
        console.warn("[vite] API server not started:", (err as Error).message);
        return;
      }

      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        if (url.startsWith("/api/") || url.startsWith("/public/")) {
          return app(req as any, res as any, next);
        }
        return next();
      });
    },
  };
}
