import { defineConfig } from "vite";
import path from "path";
import { builtinModules } from "module";
import { readFileSync } from "fs";

const pkg = JSON.parse(readFileSync(path.resolve(import.meta.dirname, "package.json"), "utf-8"));

// Server build: bundle server/node-build.ts into dist/server/node-build.mjs.
// All node built-ins and every runtime dependency stay external (they are
// installed in node_modules on the host); only our own code is bundled.
export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: path.resolve(import.meta.dirname, "server/node-build.ts"),
      name: "server",
      fileName: "node-build",
      formats: ["es"],
    },
    outDir: "dist/server",
    emptyOutDir: true,
    target: "node20",
    ssr: true,
    rollupOptions: {
      external: [
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
        ...Object.keys(pkg.dependencies || {}),
      ],
      output: {
        format: "es",
        entryFileNames: "[name].mjs",
      },
    },
    minify: true,
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./client"),
    },
  },
  // NODE_ENV is deliberately not defined here; the runtime environment decides.
});
