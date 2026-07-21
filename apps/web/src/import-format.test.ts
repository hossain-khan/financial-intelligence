// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { detectBatchFormat, detectImportFormat } from "./import-format";

const OFX_CONTENT = "OFXHEADER:100\nDATA:OFXSGML\n\n<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>";
const CSV_CONTENT = "date,amount,description\n2024-01-01,-1.00,Coffee";
const PDF_CONTENT = "%PDF-1.4\n1 0 obj<< /Type /Catalog >>endobj\n%%EOF";

function file(name: string, content: string, type = ""): File {
  return new File([content], name, { type });
}

describe("detectImportFormat", () => {
  it("detects OFX from content regardless of a generic extension", async () => {
    expect(await detectImportFormat(file("statement.ofx", OFX_CONTENT))).toBe("ofx");
    expect(await detectImportFormat(file("export.xml", OFX_CONTENT))).toBe("ofx");
  });

  it("detects CSV by default", async () => {
    expect(await detectImportFormat(file("statement.csv", CSV_CONTENT))).toBe("csv");
  });

  it("rejects OFX content wearing a CSV extension", async () => {
    await expect(detectImportFormat(file("statement.csv", OFX_CONTENT))).rejects.toThrow(
      /OFX content/u,
    );
  });

  it("rejects an OFX extension without OFX content", async () => {
    await expect(detectImportFormat(file("statement.ofx", CSV_CONTENT))).rejects.toThrow(
      /recognizable OFX/u,
    );
  });

  it("detects PDF from its content signature", async () => {
    expect(await detectImportFormat(file("statement.pdf", PDF_CONTENT))).toBe("pdf");
  });

  it("rejects PDF content wearing a CSV or OFX extension", async () => {
    await expect(detectImportFormat(file("statement.csv", PDF_CONTENT))).rejects.toThrow(
      /PDF content/u,
    );
    await expect(detectImportFormat(file("statement.ofx", PDF_CONTENT))).rejects.toThrow(
      /PDF content/u,
    );
  });

  it("rejects a PDF extension without PDF content", async () => {
    await expect(detectImportFormat(file("statement.pdf", CSV_CONTENT))).rejects.toThrow(
      /recognizable PDF/u,
    );
  });
});

describe("detectBatchFormat", () => {
  it("rejects mixed formats in one batch", async () => {
    await expect(
      detectBatchFormat([file("a.csv", CSV_CONTENT), file("b.ofx", OFX_CONTENT)]),
    ).rejects.toThrow(/separately/u);
  });

  it("rejects more than one OFX file at once", async () => {
    await expect(
      detectBatchFormat([file("a.ofx", OFX_CONTENT), file("b.ofx", OFX_CONTENT)]),
    ).rejects.toThrow(/one OFX/u);
  });

  it("accepts multiple CSV files", async () => {
    expect(await detectBatchFormat([file("a.csv", CSV_CONTENT), file("b.csv", CSV_CONTENT)])).toBe(
      "csv",
    );
  });

  it("rejects more than one PDF file at once", async () => {
    await expect(
      detectBatchFormat([file("a.pdf", PDF_CONTENT), file("b.pdf", PDF_CONTENT)]),
    ).rejects.toThrow(/one PDF/u);
  });
});
