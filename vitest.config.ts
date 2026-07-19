import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "virtual:pwa-register": new URL(
        "./apps/web/src/testing/pwa-register.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    coverage: {
      reporter: ["text", "html"],
    },
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
  },
});
