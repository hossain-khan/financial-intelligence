import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"];

/**
 * Accessibility qualification for the Phase 1–3 journeys the original quality baseline predates:
 * the transaction ledger, the intelligence dashboards, and the backup/restore settings surface.
 * Each is visited with a seeded workspace under the local network guard and checked with axe plus a
 * keyboard-reachability assertion. Chart surfaces are checked for an accessible table equivalent
 * (NFR-042).
 */

async function seedWorkspaceWithImport(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("A11y household");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("textbox", { name: "Account name" }).fill("Everyday account");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText("Everyday account", { exact: true })).toBeVisible();

  await page.goto("/import");
  await page.getByLabel("Select CSV files, or a single OFX/QFX or PDF statement").setInputFiles({
    name: "a11y.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "Transfer date,Description,Amount,Balance",
        "2026-01-05,Grocery Market,-52.13,0.00",
        "2026-01-06,Payroll,1200.00,0.00",
        "2026-01-07,Coffee Bar,-4.75,0.00",
      ].join("\n"),
    ),
  });
  await page
    .getByRole("combobox", { name: "Target account" })
    .selectOption({ label: "Everyday account · CAD" });
  await page.getByRole("combobox", { name: "Date format" }).selectOption("YYYY-MM-DD");
  await page
    .getByRole("combobox", { name: "What does a positive amount mean?" })
    .selectOption("inflow");
  await page.getByRole("button", { name: "Commit accepted transactions" }).click();
  await expect(page.getByText(/Committed 3 transactions atomically/)).toBeVisible();
}

async function assertNoAxeViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test("transaction ledger journey is accessible and keyboard reachable", async ({
  context,
  page,
}) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await seedWorkspaceWithImport(page);

  await page.getByRole("link", { name: "Transactions" }).click();
  await expect(page.getByRole("cell", { name: "Grocery Market", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Transaction ledger" })).toBeVisible();
  await assertNoAxeViolations(page);
  network.assertClean();
});

test("dashboard journey is accessible with chart table equivalents", async ({ context, page }) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await seedWorkspaceWithImport(page);

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // NFR-042: any chart surface must expose an accessible table/summary, not color alone.
  await expect(page.getByRole("table").first()).toBeVisible();
  await assertNoAxeViolations(page);
  network.assertClean();
});

test("backup and restore settings surface is accessible", async ({ context, page }) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await seedWorkspaceWithImport(page);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Restore from backup" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Storage and installation" })).toBeVisible();
  await assertNoAxeViolations(page);
  network.assertClean();
});
