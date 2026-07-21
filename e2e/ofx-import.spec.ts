import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";

const OFX_SGML = [
  "OFXHEADER:100",
  "DATA:OFXSGML",
  "VERSION:102",
  "SECURITY:NONE",
  "ENCODING:USASCII",
  "CHARSET:1252",
  "",
  "<OFX>",
  "<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STATUS><CODE>0<SEVERITY>INFO</STATUS>",
  "<STMTRS><CURDEF>CAD",
  "<BANKACCTFROM><BANKID>111<ACCTID>0000000098761234<ACCTTYPE>CHECKING</BANKACCTFROM>",
  "<BANKTRANLIST><DTSTART>20260101<DTEND>20260430",
  "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260115<TRNAMT>-1000.00<FITID>OFX-0001<NAME>RENT PAYMENT</STMTTRN>",
  "<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260218<TRNAMT>-54.25<FITID>OFX-0002<NAME>GROCERY MARKET</STMTTRN>",
  "<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260430<TRNAMT>3000.00<FITID>OFX-0003<NAME>PAYROLL DEPOSIT</STMTTRN>",
  "</BANKTRANLIST>",
  "<LEDGERBAL><BALAMT>1945.75<DTASOF>20260430</LEDGERBAL>",
  "</STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>",
].join("\r\n");

test("atomically commits and reloads a bank-shaped OFX import without network access", async ({
  context,
  page,
}) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("OFX test household");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("textbox", { name: "Account name" }).fill("Everyday account");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText("Everyday account", { exact: true })).toBeVisible();

  await page.goto("/import");
  await page.getByLabel("Select CSV files, or a single OFX/QFX or PDF statement").setInputFiles({
    name: "synthetic-statement.ofx",
    mimeType: "application/x-ofx",
    buffer: Buffer.from(OFX_SGML),
  });

  await expect(page.getByText(/Parsed OFX statement/)).toBeVisible();
  // Detected metadata is shown, and only a masked account hint appears — never the full number.
  await expect(page.getByText("••••1234")).toBeVisible();
  await expect(page.getByText("98761234")).toHaveCount(0);

  await page
    .getByRole("combobox", { name: "Target account" })
    .selectOption({ label: "Everyday account · CAD" });

  await expect(page.getByRole("button", { name: "Commit accepted transactions" })).toBeEnabled();
  await expect(page.getByText("CAD -54.25", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Commit accepted transactions" }).click();
  await expect(
    page.getByText(/Committed 3 transactions atomically at local revision 2/),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("synthetic-statement.ofx", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Transactions" }).click();
  await expect(page.getByRole("cell", { name: "GROCERY MARKET", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  network.assertClean();
});

test("rejects an OFX extension whose content is not OFX", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("OFX reject household");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("textbox", { name: "Account name" }).fill("Everyday account");
  await page.getByRole("button", { name: "Add account" }).click();

  await page.goto("/import");
  await page.getByLabel("Select CSV files, or a single OFX/QFX or PDF statement").setInputFiles({
    name: "not-really.ofx",
    mimeType: "application/x-ofx",
    buffer: Buffer.from("date,amount\n2026-01-01,-1.00"),
  });
  await expect(page.getByRole("alert")).toContainText(/recognizable OFX/);
});
