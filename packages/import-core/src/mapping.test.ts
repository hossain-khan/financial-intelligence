import { describe, expect, it } from "vitest";

import {
  createCsvErrorReport,
  createFormatSignature,
  mapCsvSources,
  sanitizeSpreadsheetCell,
  type CsvMapping,
  type CsvMappingSource,
} from "./mapping";

const metadata = {
  fileName: "statement.csv",
  mediaType: "text/csv",
  byteSize: 100,
  sha256: "a".repeat(64),
};

describe("mapCsvSources", () => {
  it.each([
    ["YYYY-MM-DD", "2026-07-08", "2026-07-08"],
    ["MM/DD/YYYY", "07/08/2026", "2026-07-08"],
    ["DD/MM/YYYY", "08/07/2026", "2026-07-08"],
    ["YYYY/MM/DD", "2026/07/08", "2026-07-08"],
  ] as const)("maps the %s date locale explicitly", (dateFormat, sourceDate, expected) => {
    const result = mapCsvSources(
      [source({ Date: sourceDate, Description: " Café  Store ", Amount: "-$1,234.50" })],
      mapping({ dateFormat }),
    );

    expect(result.canContinue).toBe(true);
    expect(result.candidates[0]).toMatchObject({
      postedDate: expected,
      description: "Café Store",
      amount: "-1234.50",
      currency: "CAD",
    });
    expect(result.candidates[0]?.provenance.original).toMatchObject({
      postedDate: sourceDate,
      description: " Café  Store ",
      amount: "-$1,234.50",
    });
  });

  it("maps locale decimal separators without floating point arithmetic", () => {
    const result = mapCsvSources(
      [source({ Date: "2026-01-01", Description: "Market", Amount: "1.234,56" })],
      mapping({ numberFormat: { decimalSeparator: ",", groupSeparator: "." } }),
    );
    expect(result.candidates[0]?.amount).toBe("1234.56");
    expect(result.totals).toMatchObject({ inflow: "1234.56", outflow: "0.00", currency: "CAD" });
  });

  it("rejects malformed grouping instead of silently changing its magnitude", () => {
    const result = mapCsvSources(
      [source({ Date: "2026-01-01", Description: "Market", Amount: "1,23" })],
      mapping(),
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "amount" }));
  });

  it("rejects arbitrary letters embedded in an amount", () => {
    const result = mapCsvSources(
      [source({ Date: "2026-01-01", Description: "Market", Amount: "12oops" })],
      mapping(),
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.issues).toContainEqual(expect.objectContaining({ field: "amount" }));
  });

  it("allows a mapped optional transaction date to be blank", () => {
    const result = mapCsvSources(
      [source({ Date: "2026-01-01", TransactionDate: "", Description: "Market", Amount: "1.00" })],
      mapping({ transactionDateColumn: "TransactionDate" }),
    );
    expect(result.canContinue).toBe(true);
    expect(result.candidates[0]?.transactionDate).toBeUndefined();
  });

  it("requires the confirmed signed amount direction", () => {
    const inflow = mapCsvSources(
      [source({ Date: "2026-01-01", Description: "Refund", Amount: "25.00" })],
      mapping(),
    );
    const outflow = mapCsvSources(
      [source({ Date: "2026-01-01", Description: "Purchase", Amount: "25.00" })],
      mapping({ amount: { kind: "signed", column: "Amount", positiveDirection: "outflow" } }),
    );
    expect(inflow.candidates[0]?.amount).toBe("25.00");
    expect(outflow.candidates[0]?.amount).toBe("-25.00");
  });

  it("maps separate debit and credit columns and rejects rows containing both", () => {
    const debitCredit = mapping({
      amount: {
        kind: "debit-credit",
        debitColumn: "Debit",
        creditColumn: "Credit",
        debitDirection: "outflow",
      },
    });
    const result = mapCsvSources(
      [
        source(
          { Date: "2026-01-01", Description: "Coffee", Debit: "4.25", Credit: "" },
          { Date: "2026-01-02", Description: "Pay", Debit: "", Credit: "100.00" },
          { Date: "2026-01-03", Description: "Invalid", Debit: "1.00", Credit: "2.00" },
        ),
      ],
      debitCredit,
    );
    expect(result.candidates.map((candidate) => candidate.amount)).toEqual(["-4.25", "100.00"]);
    expect(result.totals).toMatchObject({ inflow: "100.00", outflow: "4.25", invalidRows: 1 });
    expect(result.issues).toContainEqual(
      expect.objectContaining({ field: "amount", sourceLocation: "line:4" }),
    );
  });

  it("blocks missing and duplicate required mappings", () => {
    const result = mapCsvSources(
      [source({ Date: "2026-01-01", Description: "Coffee", Amount: "4.00" })],
      mapping({ descriptionColumn: "Date", transactionDateColumn: "Missing" }),
    );
    expect(result.canContinue).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["DUPLICATE_MAPPING", "MISSING_COLUMN"]),
    );
    expect(result.candidates).toHaveLength(0);
  });

  it("reports invalid fields without echoing the rejected financial value", () => {
    const result = mapCsvSources(
      [source({ Date: "07/08/2026", Description: "", Amount: "private amount" })],
      mapping(),
    );
    expect(result.canContinue).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceLocation: "line:2",
          field: "postedDate",
          correction: expect.any(String),
        }),
        expect.objectContaining({ sourceLocation: "line:2", field: "description" }),
        expect.objectContaining({ sourceLocation: "line:2", field: "amount" }),
      ]),
    );
    expect(JSON.stringify(result.issues)).not.toContain("private amount");
  });

  it("validates canonical field bounds and status values", () => {
    const result = mapCsvSources(
      [
        source({
          Date: "2026-01-01",
          Description: "x".repeat(1_001),
          Amount: "1.00",
          Id: "i".repeat(241),
          Status: "complete",
        }),
      ],
      mapping({ sourceTransactionIdColumn: "Id", statusColumn: "Status" }),
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.issues.map((issue) => issue.field)).toEqual(
      expect.arrayContaining(["description", "sourceTransactionId", "status"]),
    );
  });
});

describe("mapping presets and reports", () => {
  it("generates stable, parser-version-specific format signatures", () => {
    expect(createFormatSignature(["Date", "Amount"], "csv", "1")).toBe(
      createFormatSignature([" Date ", "AMOUNT"], "csv", "1"),
    );
    expect(createFormatSignature(["Date", "Amount"], "csv", "1")).not.toBe(
      createFormatSignature(["Date", "Amount"], "csv", "2"),
    );
  });

  it.each(["=SUM(A1:A2)", "+cmd", "-2+3", "@payload", "  =hidden", "\t=1", "\tcmd", "\r123"])(
    "neutralizes spreadsheet formula cell %j",
    (value) => expect(sanitizeSpreadsheetCell(value)).toBe(`'${value}`),
  );

  it("creates a sanitized error report", () => {
    const report = createCsvErrorReport([
      {
        code: "INVALID",
        severity: "error",
        sourceLocation: "line:2",
        field: "amount",
        rejectedValueSummary: "=FORMULA",
        message: "+unsafe",
        correction: "Choose a number",
      },
    ]);
    expect(report).toContain("'=FORMULA");
    expect(report).toContain("'+unsafe");
    expect(report).not.toContain('"=FORMULA"');
  });
});

function source(...fields: readonly Record<string, string>[]): CsvMappingSource {
  return {
    metadata,
    parserId: "financial-intelligence/csv",
    parserVersion: "1.0.0",
    rows: fields.map((value, index) => ({ sourceLocation: `line:${index + 2}`, fields: value })),
    issues: [],
  };
}

function mapping(overrides: Partial<CsvMapping> = {}): CsvMapping {
  return {
    accountId: "account-1",
    accountCurrency: "CAD",
    postedDateColumn: "Date",
    descriptionColumn: "Description",
    amount: { kind: "signed", column: "Amount", positiveDirection: "inflow" },
    ignoredColumns: [],
    dateFormat: "YYYY-MM-DD",
    numberFormat: { decimalSeparator: ".", groupSeparator: "," },
    ...overrides,
  };
}
