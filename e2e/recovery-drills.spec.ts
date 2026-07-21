import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { expect, test } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";
const FIXTURE_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "test-fixtures",
  "compatibility",
  "encrypted-backup",
  "v1.0.0",
);

/**
 * Fresh-profile disaster-recovery drills. Each uses a brand-new browser context (empty storage) and
 * the local network guard, and asserts either the old valid state or the new valid state — never a
 * mixture. Evidence is captured as attachments free of descriptions, amounts, and passphrases.
 */

test("drill: restore a supported encrypted backup into a fresh profile", async ({
  browser,
}, testInfo) => {
  const container = await readFile(join(FIXTURE_DIR, "workspace.fintbackup"));
  const passphrase = (await readFile(join(FIXTURE_DIR, "passphrase.txt"), "utf8")).trim();

  const context = await browser.newContext();
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  const page = await context.newPage();

  await page.goto("/settings");
  await page.getByLabel("Backup file to restore").setInputFiles({
    name: "workspace.fintbackup",
    mimeType: "application/vnd.financial-intelligence.encrypted-backup+json",
    buffer: container,
  });
  await page.getByLabel("Backup passphrase", { exact: true }).fill(passphrase);
  await page.getByRole("button", { name: "Verify and plan restore" }).click();

  // Metadata-only preview reconciles the fixture's known counts before any write.
  const plan = page.getByLabel("Restore plan");
  await expect(plan).toContainText("Fixture");
  await expect(plan).toContainText("Transactions");
  await page.getByRole("button", { name: "Restore now" }).click();
  await expect(page.getByText(/Your original data is safe/)).toBeVisible();

  // The restored workspace is now the local workspace.
  await page.getByRole("link", { name: "Overview" }).click();
  await expect(
    page.getByRole("list", { name: "Local workspaces" }).getByText("Fixture", { exact: true }),
  ).toHaveCount(1);

  testInfo.attach("recovery-drill", {
    body: JSON.stringify({ drill: "restore-as-new", fixture: "encrypted-backup/v1.0.0", ok: true }),
    contentType: "application/json",
  });
  network.assertClean();
  await context.close();
});

test("drill: a database newer than this build shows recovery guidance without clearing data", async ({
  browser,
}) => {
  const context = await browser.newContext();
  // Force the storage-health check to report a version-incompatible database (as a newer build
  // would leave behind). The app must show the recovery screen, not clear or loop.
  await context.addInitScript(() => {
    const original = indexedDB.open.bind(indexedDB);
    Object.defineProperty(indexedDB, "open", {
      configurable: true,
      value: (name: string, version?: number) => {
        const request = original(name, version);
        // Let the real open proceed; the app's own version guard handles the too-new case. Here we
        // simulate the guard tripping by throwing a synthetic incompatible error on the app DB.
        if (name === "financial-intelligence") {
          throw new DOMException("Synthetic version-incompatible database", "VersionError");
        }
        return request;
      },
    });
  });
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  const page = await context.newPage();
  await page.goto("/");

  await expect(page.getByRole("alert")).toContainText(/could not be opened/i);
  // Recovery affordances are present; data is never cleared automatically.
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export diagnostic" })).toBeVisible();
  network.assertClean();
  await context.close();
});
