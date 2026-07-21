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
      exclude: [
        "packages/schemas/src/generated/**",
        // Runtime-only: require WebGPU + real model weights, validated by the maintainer spike
        // rather than in CI. Their LocalEngine contract is covered via FakeLocalEngine.
        "packages/ai-local/src/worker.ts",
        "packages/ai-local/src/transformers-engine.ts",
      ],
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        branches: 68,
        functions: 73,
        lines: 76,
        statements: 75,
      },
    },
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"],
    passWithNoTests: false,
  },
});
