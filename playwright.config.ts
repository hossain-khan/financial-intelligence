import { env } from "node:process";

import { defineConfig, devices } from "@playwright/test";

const webServerEnvironment = Object.fromEntries(
  Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined),
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(env.CI),
  retries: env.CI ? 1 : 0,
  ...(env.CI ? { workers: 2 } : {}),
  reporter: env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
  },
  projects: [
    // The functional browser gates run every spec except the performance smoke suite, which is a
    // separate project so its timing runs are not mixed into cross-engine correctness checks.
    {
      name: "chromium",
      testIgnore: /perf\//u,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      testIgnore: /perf\//u,
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      testIgnore: /perf\//u,
      use: { ...devices["Desktop Safari"] },
    },
    // Performance smoke: Chromium only, its own directory, run explicitly (`--project=perf`).
    {
      name: "perf",
      testMatch: /perf\/.*\.spec\.ts$/u,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command:
      "pnpm build && pnpm exec wrangler dev --ip 127.0.0.1 --port 4173 --show-interactive-dev-session=false --log-level warn",
    env: { ...webServerEnvironment, WRANGLER_LOG_PATH: ".wrangler/logs" },
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !env.CI,
    timeout: 120_000,
  },
});
