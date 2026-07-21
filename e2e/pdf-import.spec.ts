import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { installLocalNetworkGuard } from "./network-guard";

const LOCAL_ORIGIN = "http://127.0.0.1:4173";

/**
 * Build a minimal single-page tabular statement PDF with real text-showing operators. Column x
 * positions are shared by the header and every body row so the generic tabular adapter can derive
 * column bands. All values are synthetic.
 */
function buildTabularStatementPdf(): Buffer {
  const cols = { date: 60, description: 150, amount: 460 };
  const lines: { text: string; x: number; y: number }[] = [
    { text: "Date", x: cols.date, y: 720 },
    { text: "Description", x: cols.description, y: 720 },
    { text: "Amount", x: cols.amount, y: 720 },
    { text: "2026-01-15", x: cols.date, y: 700 },
    { text: "RENT PAYMENT", x: cols.description, y: 700 },
    { text: "-1000.00", x: cols.amount, y: 700 },
    { text: "2026-01-18", x: cols.date, y: 680 },
    { text: "GROCERY MARKET", x: cols.description, y: 680 },
    { text: "-54.25", x: cols.amount, y: 680 },
    { text: "2026-01-31", x: cols.date, y: 660 },
    { text: "PAYROLL DEPOSIT", x: cols.description, y: 660 },
    { text: "3000.00", x: cols.amount, y: 660 },
  ];
  const stream = lines
    .map((line) => `BT /F1 10 Tf ${line.x} ${line.y} Td (${line.text}) Tj ET`)
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

async function createWorkspaceAndAccount(pageTitle: string, page: Page) {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Workspace name" }).fill(pageTitle);
  await page.getByRole("button", { name: "Create workspace" }).click();
  await page.getByRole("textbox", { name: "Account name" }).fill("Everyday account");
  await page.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText("Everyday account", { exact: true })).toBeVisible();
}

test("atomically commits a text-based PDF statement without network access", async ({
  context,
  page,
}) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await createWorkspaceAndAccount("PDF test household", page);

  await page.goto("/import");
  await page.getByLabel("Select CSV files, or a single OFX/QFX or PDF statement").setInputFiles({
    name: "synthetic-statement.pdf",
    mimeType: "application/pdf",
    buffer: buildTabularStatementPdf(),
  });

  await expect(page.getByText(/Parsed PDF statement/)).toBeVisible();
  await expect(page.getByText("generic-tabular").first()).toBeVisible();

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
  await expect(page.getByText("synthetic-statement.pdf", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Transactions" }).click();
  await expect(page.getByRole("cell", { name: "GROCERY MARKET", exact: true })).toBeVisible();

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag22aa"])
    .analyze();
  expect(results.violations).toEqual([]);
  network.assertClean();
});

test("explains an image-only PDF instead of importing it", async ({ context, page }) => {
  const network = await installLocalNetworkGuard(context, LOCAL_ORIGIN);
  await createWorkspaceAndAccount("PDF reject household", page);

  await page.goto("/import");
  // A valid PDF page with no text-showing operators extracts as image-only.
  const imageOnly = Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\ntrailer\n<< /Size 4 /Root 1 0 R >>\n%%EOF",
    "utf8",
  );
  await page
    .getByLabel("Select CSV files, or a single OFX/QFX or PDF statement")
    .setInputFiles({ name: "scan.pdf", mimeType: "application/pdf", buffer: imageOnly });

  await expect(page.getByRole("alert")).toContainText(/scanned or image-only|no selectable text/i);
  network.assertClean();
});
