import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { createServer } from "./server";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: "dist",
  },
  plugins: [react(), expressPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  optimizeDeps: {
    entries: ["index.html"],
    exclude: ["test-google-maps.html", "public/offline.html"],
  },
}));

function expressPlugin(): Plugin {
  return {
    name: "express-plugin",
    apply: "serve", // Only apply during development (serve mode)
    configureServer(server) {
      const app = createServer();

      // Handle API, public routes and Netlify function requests with proper middleware order
      server.middlewares.use(async (req: any, res: any, next: any) => {
        try {
          const url = req.url || "";

          // Route normal API and public routes to the local express app
          if (url.startsWith("/api/") || url.startsWith("/public/")) {
            return app(req, res, next);
          }

          // Handle Netlify Functions in dev: /.netlify/functions/<name>
          if (url.startsWith("/.netlify/functions/")) {
            // Extract function name and remaining path
            const parts = url.replace("/.netlify/functions/", "").split("/");
            const funcName = parts.shift();
            const remainingPath = parts.length ? `/${parts.join("/")}` : "";

            if (!funcName) return next();

            // Resolve module path in dev (support .ts files)
            const modulePathTs = path.resolve(process.cwd(), `netlify/functions/${funcName}.ts`);
            const modulePathJs = path.resolve(process.cwd(), `netlify/functions/${funcName}.js`);

            let mod: any = null;
            try {
              // Try to load TS module via Vite's SSR loader which transpiles on the fly
              mod = await server.ssrLoadModule(modulePathTs);
            } catch (e) {
              try {
                mod = await server.ssrLoadModule(modulePathJs);
              } catch (err) {
                console.error(`Failed to load Netlify function module for ${funcName}:`, err);
                res.statusCode = 500;
                return res.end(`Function ${funcName} not found`);
              }
            }

            if (!mod || typeof mod.handler !== "function") {
              res.statusCode = 500;
              return res.end(`Function ${funcName} handler not found`);
            }

            // Collect body
            let body = "";
            req.on("data", (chunk: any) => (body += chunk));
            await new Promise((resolve) => req.on("end", resolve));

            // Build Netlify-style event
            const { pathname, query } = new URL(req.url, `http://${req.headers.host}`);

            const queryParams: Record<string, string> = {};
            for (const [k, v] of new URLSearchParams(query)) {
              queryParams[k] = v as string;
            }

            const event = {
              httpMethod: req.method,
              path: `/.netlify/functions/${funcName}${remainingPath}`,
              headers: req.headers,
              queryStringParameters: queryParams,
              body: body || null,
              isBase64Encoded: false,
            };

            try {
              const result = await mod.handler(event, {});
              if (!result || typeof result !== "object") {
                res.statusCode = 500;
                return res.end(`Invalid function response for ${funcName}`);
              }

              const statusCode = result.statusCode || 200;
              const headersOut = result.headers || { "Content-Type": "application/json" };
              const bodyOut = typeof result.body === "string" ? result.body : JSON.stringify(result.body || {});

              res.writeHead(statusCode, headersOut);
              return res.end(bodyOut);
            } catch (fnErr) {
              console.error(`Error running Netlify function ${funcName}:`, fnErr);
              res.statusCode = 500;
              return res.end(`Function ${funcName} execution error`);
            }
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
