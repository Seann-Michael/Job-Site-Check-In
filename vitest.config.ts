import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
    },
  },
  test: {
    include: ["server/**/*.test.ts", "client/**/*.test.ts", "client/**/*.test.tsx"],
    // Client tests can opt into jsdom with a `// @vitest-environment jsdom` docblock.
    environment: "node",
    setupFiles: ["server/__tests__/setup.ts"],
    globals: false,
    restoreMocks: true,
  },
});
