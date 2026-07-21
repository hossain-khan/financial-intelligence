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
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
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
