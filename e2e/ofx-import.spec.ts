import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";

const ofxStatement = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
  <SIGNONMSGSRSV1>
    <SONRS>
      <STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
      <DTSERVER>20260720000000</DTSERVER>
      <LANGUAGE>ENG</LANGUAGE>
    </SONRS>
  </SIGNONMSGSRSV1>
  <BANKMSGSRSV1>
    <STMTTRNRS>
      <TRNUID>1</TRNUID>
      <STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
      <STMTRS>
        <CURDEF>CAD</CURDEF>
        <BANKACCTFROM>
          <BANKID>001</BANKID>
          <ACCTID>1234567890</ACCTID>
          <ACCTTYPE>CHECKING</ACCTTYPE>
        </BANKACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20260701</DTSTART>
          <DTEND>20260719</DTEND>
          <STMTTRN>
            <TRNTYPE>DEBIT</TRNTYPE>
            <DTPOSTED>20260718000000</DTPOSTED>
            <TRNAMT>-4.25</TRNAMT>
            <FITID>2026-07-18-001</FITID>
            <NAME>COFFEE SHOP</NAME>
            <MEMO>Local cafe</MEMO>
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT</TRNTYPE>
            <DTPOSTED>20260719000000</DTPOSTED>
            <TRNAMT>100.00</TRNAMT>
            <FITID>2026-07-19-001</FITID>
            <NAME>EMPLOYER PAYROLL</NAME>
          </STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL>
          <BALAMT>1100.00</BALAMT>
          <DTASOF>20260719</DTASOF>
        </LEDGERBAL>
      </STMTRS>
    </STMTTRNRS>
  </BANKMSGSRSV1>
</OFX>
`;

test("commits an OFX statement without network access", async ({ context, page }) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await page.goto("/");
  await page.getByRole("textbox", { name: "Workspace name" }).fill("OFX import test");
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("textbox", { name: "Account name" }).fill("Everyday account");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText("Everyday account", { exact: true })).toBeVisible();

  await page.goto("/import");
  await expect(
    page.getByRole("heading", { name: "Map every transaction before it enters your ledger." }),
  ).toBeVisible();
  await page.getByLabel("Select one or more bounded statement files").setInputFiles({
    name: "synthetic-bank.ofx",
    mimeType: "application/ofx",
    buffer: Buffer.from(ofxStatement),
  });

  await expect(page.getByText("Parsed 1 source file containing 2 rows.")).toBeVisible();
  await expect(page.getByText("OFX parsed")).toBeVisible();
  await expect(page.getByText("checking")).toBeVisible();
  await expect(page.getByText("******7890")).toBeVisible();
  await page
    .getByRole("combobox", { name: "Target account" })
    .selectOption({ label: "Everyday account · CAD (matches currency)" });

  await expect(page.getByRole("button", { name: "Commit accepted transactions" })).toBeEnabled();
  await expect(page.getByRole("cell", { name: "CAD 100.00", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Commit accepted transactions" }).click();
  await expect(
    page.getByText(/Committed 2 transactions atomically at local revision 2/),
  ).toBeVisible();

  await page.getByRole("link", { name: "Transactions" }).click();
  await expect(page.getByRole("heading", { name: "Ledger", exact: true })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "COFFEE SHOP — Local cafe", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "EMPLOYER PAYROLL", exact: true })).toBeVisible();

  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations, JSON.stringify(axe.violations, null, 2)).toEqual([]);
  network.assertClean();
});
