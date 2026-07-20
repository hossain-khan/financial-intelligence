import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "virtual:pwa-register": new URL("./apps/web/src/testing/pwa-register.ts", import.meta.url)
        .pathname,
    },
  },
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        branches: 67,
        functions: 72,
        lines: 75,
        statements: 73,
      },
    },
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
  },
});
