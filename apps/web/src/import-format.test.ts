// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { detectBatchFormat, detectImportFormat } from "./import-format";

const OFX_CONTENT = "OFXHEADER:100\nDATA:OFXSGML\n\n<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>";
const CSV_CONTENT = "date,amount,description\n2024-01-01,-1.00,Coffee";

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
});
