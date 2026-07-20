import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";

test("atomically commits and reloads a bank-shaped CSV import without network access", async ({
  context,
  page,
}) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("Import test household");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("textbox", { name: "Account name" }).fill("Everyday account");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText("Everyday account", { exact: true })).toBeVisible();

  await page.goto("/import");
  await expect(
    page.getByRole("heading", { name: "Map every transaction before it enters your ledger." }),
  ).toBeVisible();
  await page.getByLabel("Select one or more bounded CSV files").setInputFiles({
    name: "synthetic-bank-details.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "Transfer date,Description,Amount,Balance",
        "2026-01-15,RENT PAYMENT,-$1000.00,$4000.00",
        "2026-02-18,GROCERY MARKET,-$54.25,$3945.75",
        "2026-03-20,UTILITY COMPANY,-$80.00,$3865.75",
        "2026-04-30,PAYROLL DEPOSIT,$3000.00,$6865.75",
      ].join("\n"),
    ),
  });

  await expect(page.getByText("Parsed 1 source file containing 4 rows.")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Target account" })
    .selectOption({ label: "Everyday account · CAD" });
  await page
    .getByRole("combobox", { name: "Date format (must be confirmed)" })
    .selectOption("YYYY-MM-DD");
  await page
    .getByRole("combobox", { name: "What does a positive amount mean?" })
    .selectOption("inflow");

  await expect(page.getByRole("button", { name: "Commit accepted transactions" })).toBeEnabled();
  await expect(page.getByText("CAD -54.25", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Commit accepted transactions" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/Committed 4 transactions atomically at local revision 2/),
  ).toBeVisible();
  await expect(page.getByText("4 transactions", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("synthetic-bank-details.csv", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Transactions" }).click();
  await expect(page.getByRole("heading", { name: "Ledger" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cash-flow summary" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "CAD cash flow" })).toBeVisible();
  await expect(page.getByText("Income exceeds spending by CAD 1865.75.")).toBeVisible();
  await expect(page.getByRole("region", { name: "CAD monthly cash-flow data" })).toBeVisible();
  await expect(page.getByRole("region", { name: "CAD account cash-flow data" })).toBeVisible();
  await expect(page.getByRole("region", { name: "CAD category spending data" })).toBeVisible();
  const monthlyDrilldown = page
    .getByRole("region", { name: "CAD monthly cash-flow data" })
    .locator("summary")
    .filter({ hasText: "View 1 transaction(s)" })
    .first();
  await monthlyDrilldown.focus();
  await page.keyboard.press("Enter");
  await expect(
    monthlyDrilldown
      .locator("..")
      .getByText("These are the exact canonical records contributing to the selected fact."),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export filtered CSV" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(
    /^financial-intelligence-transactions-\d{4}-\d{2}-\d{2}\.csv$/u,
  );
  await expect(page.getByRole("cell", { name: "GROCERY MARKET", exact: true })).toBeVisible();
  await page
    .getByRole("combobox", { name: "Category for GROCERY MARKET" })
    .selectOption({ label: "Groceries" });
  await expect(page.getByRole("status")).toContainText("Updated 1 transaction");
  await expect(page.getByText("Source details").first()).toBeVisible();

  await page.goto("/import");
  await expect(
    page.getByRole("heading", { name: "Map every transaction before it enters your ledger." }),
  ).toBeVisible();
  await page.getByLabel("Select one or more bounded CSV files").setInputFiles({
    name: "synthetic-overlap.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "Transfer date,Description,Amount,Balance",
        "2026-02-18,GROCERY MARKET,-$54.25,$3945.75",
        "2026-03-20,UTILITY COMPANY,-$80.00,$3865.75",
        "2026-04-30,PAYROLL DEPOSIT,$3000.00,$6865.75",
        "2026-05-05,COFFEE SHOP,-$4.25,$6861.50",
      ].join("\n"),
    ),
  });
  await page
    .getByRole("combobox", { name: "Target account" })
    .selectOption({ label: "Everyday account · CAD" });
  await expect(page.getByRole("button", { name: "Commit accepted transactions" })).toBeEnabled();
  await page.getByRole("button", { name: "Commit accepted transactions" }).click();
  await expect(
    page.getByText(/Committed 4 transactions atomically at local revision 3/),
  ).toBeVisible();

  await page.getByRole("link", { name: "Transactions" }).click();
  await expect(page.getByRole("heading", { name: "Duplicate review" })).toBeVisible();
  await expect(page.getByText("Same canonical transaction fingerprint")).toHaveCount(3);
  for (let duplicate = 0; duplicate < 3; duplicate += 1) {
    await page.getByRole("button", { name: "Keep existing" }).first().click();
    await expect(page.getByText("Decision: keep-existing")).toHaveCount(duplicate + 1);
  }
  await expect(page.getByText("void", { exact: true })).toHaveCount(3);
  await expect(page.getByText("posted", { exact: true })).toHaveCount(5);
  await page.reload();
  await expect(page.getByText("Decision: keep-existing")).toHaveCount(3);

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
  network.assertClean();
});
