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

      // Handle API and public routes with proper middleware order
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/') || req.url?.startsWith('/public/')) {
          app(req, res, next);
        } else {
          next();
        }
      });
    },
  };
}
