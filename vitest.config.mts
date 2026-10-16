import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure and server-side logic (npm test). Integration of the whole API is
 * scripts/api-smoke.mjs; the screens are covered by scripts/e2e.mjs.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // `server-only` throws outside React's server build; in tests every module is "server".
      "server-only": path.resolve(import.meta.dirname, "tests/support/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
  },
});
