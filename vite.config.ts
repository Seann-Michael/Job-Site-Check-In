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
    },
    optimizeDeps: {
      entries: ["index.html"],
      exclude: ["test-google-maps.html", "public/offline.html"],
      include: ["recharts"],
    },
  };
});

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

          // Handle API endpoints in dev (supports both /api/ and legacy /.netlify/functions/)
          if (url.startsWith("/api/") || url.startsWith("/.netlify/functions/")) {
            // Extract function name and remaining path
            const cleanPath = url.startsWith("/api/") ? url.replace("/api/", "") : url.replace("/.netlify/functions/", "");
            const parts = cleanPath.split("/");
            const funcName = parts.shift();
            const remainingPath = parts.length ? `/${parts.join("/")}` : "";

            if (!funcName) return next();

            // Resolve module path in dev (support .ts files) - try api/ first, then netlify/functions/
            const modulePathTsApi = path.resolve(process.cwd(), `api/${funcName}.ts`);
            const modulePathJsApi = path.resolve(process.cwd(), `api/${funcName}.js`);
            const modulePathTs = path.resolve(process.cwd(), `netlify/functions/${funcName}.ts`);
            const modulePathJs = path.resolve(process.cwd(), `netlify/functions/${funcName}.js`);

            let mod: any = null;
            try {
              // Try to load from api/ directory first
              mod = await server.ssrLoadModule(modulePathTsApi);
            } catch (e) {
              try {
                mod = await server.ssrLoadModule(modulePathJsApi);
              } catch (e2) {
                try {
                  // Fall back to netlify/functions/ for legacy support
                  mod = await server.ssrLoadModule(modulePathTs);
                } catch (e3) {
                  try {
                    mod = await server.ssrLoadModule(modulePathJs);
                  } catch (err) {
                    console.error(`Failed to load API function module for ${funcName}:`, err);
                    res.statusCode = 500;
                    return res.end(`Function ${funcName} not found`);
                  }
                }
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
            const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
            const queryParams: Record<string, string> = {};
            for (const [k, v] of parsedUrl.searchParams.entries()) {
              queryParams[k] = v as string;
            }

            const event = {
              httpMethod: req.method,
              path: url.startsWith("/api/") ? `/api/${funcName}${remainingPath}` : `/.netlify/functions/${funcName}${remainingPath}`,
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
