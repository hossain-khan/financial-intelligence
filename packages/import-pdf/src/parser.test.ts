import { describe, expect, it } from "vitest";

import { buildImageOnlyPdf, buildSyntheticPdf, type SyntheticPage } from "./fixtures";
import { parseWithRealPdfjs } from "./testing";

/**
 * Lay out a date / description / amount table as positioned text. Column x-positions are shared by
 * the header and every body row so the adapter can derive column bands.
 */
function tabularStatement(
  rows: readonly { date: string; description: string; amount: string }[],
): SyntheticPage {
  const COLS = { date: 60, description: 150, amount: 460 };
  const runs = [
    { text: "Date", x: COLS.date, y: 720 },
    { text: "Description", x: COLS.description, y: 720 },
    { text: "Amount", x: COLS.amount, y: 720 },
  ];
  rows.forEach((row, index) => {
    const y = 700 - index * 20;
    runs.push({ text: row.date, x: COLS.date, y });
    runs.push({ text: row.description, x: COLS.description, y });
    runs.push({ text: row.amount, x: COLS.amount, y });
  });
  return { runs };
}

describe("PdfStatementParser", () => {
  it("extracts canonical rows from a generic tabular statement", async () => {
    const bytes = buildSyntheticPdf({
      pages: [
        tabularStatement([
          { date: "2026-01-15", description: "RENT PAYMENT", amount: "-1000.00" },
          { date: "2026-01-18", description: "GROCERY MARKET", amount: "-54.25" },
          { date: "2026-01-31", description: "PAYROLL DEPOSIT", amount: "3000.00" },
        ]),
      ],
    });

    const result = await parseWithRealPdfjs(bytes);
    expect(result.parserId).toBe("pdf");
    expect(result.parserVersion).toBe("1.0.0");
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]?.fields).toMatchObject({
      postedDate: "2026-01-15",
      description: "RENT PAYMENT",
      amount: "-1000.00",
    });
    expect(result.rows[2]?.fields.amount).toBe("3000.00");
    expect(result.rows[0]?.sourceLocation).toMatch(/^page:1\/items:\d+-\d+$/u);
    expect(result.detectedMetadata?.adapterId).toBe("generic-tabular");
  });

  it("rejects an image-only PDF with a guiding error", async () => {
    await expect(parseWithRealPdfjs(buildImageOnlyPdf())).rejects.toMatchObject({
      code: "IMAGE_ONLY_DOCUMENT",
    });
  });

  it("rejects a file that is not a PDF", async () => {
    const bytes = new TextEncoder().encode("date,amount\n2026-01-01,-1.00");
    await expect(parseWithRealPdfjs(bytes)).rejects.toMatchObject({ code: "MALFORMED_DOCUMENT" });
  });

  it("reports an unsupported layout when no statement table is present", async () => {
    const bytes = buildSyntheticPdf({
      pages: [
        {
          runs: [
            { text: "Thank you for banking with us.", x: 72, y: 700 },
            { text: "This page has no transaction table.", x: 72, y: 680 },
          ],
        },
      ],
    });
    await expect(parseWithRealPdfjs(bytes)).rejects.toMatchObject({ code: "UNSUPPORTED_LAYOUT" });
  });
});
