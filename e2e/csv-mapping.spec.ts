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

  await page.getByRole("link", { name: "Import" }).click();
  await page.getByLabel("Select one or more bounded CSV files").setInputFiles({
    name: "synthetic-bank-details.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        "Transfer date,Description,Amount,Balance",
        "2026-07-18,COFFEE SHOP,-$4.25,$1000.00",
        "2026-07-19,PAYROLL DEPOSIT,$100.00,$1100.00",
      ].join("\n"),
    ),
  });

  await expect(page.getByText("Parsed 1 source file containing 2 rows.")).toBeVisible();
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
  await expect(page.getByText("CAD 4.25", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Commit accepted transactions" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByText(/Committed 2 transactions atomically at local revision 2/),
  ).toBeVisible();
  await expect(page.getByText("2 transactions", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("synthetic-bank-details.csv", { exact: true })).toBeVisible();

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
  network.assertClean();
});
