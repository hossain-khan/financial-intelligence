import { describe, expect, it } from "vitest";

import type { PdfTextDocument, PdfTextItem, PdfTextPage } from "../model";
import { GenericTabularAdapter } from "./generic-tabular";

function item(text: string, x: number, y: number, width = text.length * 5): PdfTextItem {
  return { text, x, y, width, height: 10, rawX: x, rawY: y };
}

function page(pageNumber: number, items: readonly PdfTextItem[]): PdfTextPage {
  return { pageNumber, width: 612, height: 792, items };
}

function doc(pages: readonly PdfTextPage[]): PdfTextDocument {
  const textCharacterCount = pages.reduce(
    (total, p) => total + p.items.reduce((sum, i) => sum + i.text.length, 0),
    0,
  );
  return { pageCount: pages.length, pages, textCharacterCount };
}

const COLS = { date: 60, description: 150, amount: 460, debit: 400, credit: 500 };
const signal = new AbortController().signal;

function signedHeader(y: number): PdfTextItem[] {
  return [
    item("Date", COLS.date, y),
    item("Description", COLS.description, y),
    item("Amount", COLS.amount, y),
  ];
}

function signedRow(y: number, date: string, description: string, amount: string): PdfTextItem[] {
  return [
    item(date, COLS.date, y),
    item(description, COLS.description, y),
    item(amount, COLS.amount, y),
  ];
}

describe("GenericTabularAdapter", () => {
  const adapter = new GenericTabularAdapter();

  it("detects a signed-amount table and extracts rows", () => {
    const document = doc([
      page(1, [
        ...signedHeader(720),
        ...signedRow(700, "2026-01-15", "RENT", "-1000.00"),
        ...signedRow(680, "2026-01-18", "GROCERIES", "-54.25"),
      ]),
    ]);
    expect(adapter.detect(document).score).toBeGreaterThanOrEqual(adapter.minimumScore);
    const result = adapter.extract(document, signal);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ postedDate: "2026-01-15", amount: "-1000.00" });
    expect(result.detectedMetadata.columnMode).toBe("signed-amount");
  });

  it("folds a wrapped description continuation into the prior row", () => {
    const document = doc([
      page(1, [
        ...signedHeader(720),
        ...signedRow(700, "2026-01-15", "COFFEE SHOP", "-4.50"),
        // Continuation line: no date, no amount, only more description text.
        item("DOWNTOWN LOCATION", COLS.description, 688),
        ...signedRow(668, "2026-01-16", "PAYROLL", "3000.00"),
      ]),
    ]);
    const result = adapter.extract(document, signal);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.description).toBe("COFFEE SHOP DOWNTOWN LOCATION");
    expect(result.rows[0]?.sourceLocation).toContain(";");
  });

  it("maps separate debit and credit columns into signed amounts", () => {
    const header = [
      item("Date", COLS.date, 720),
      item("Description", COLS.description, 720),
      item("Debit", COLS.debit, 720),
      item("Credit", COLS.credit, 720),
    ];
    const document = doc([
      page(1, [
        ...header,
        item("2026-01-15", COLS.date, 700),
        item("RENT", COLS.description, 700),
        item("1000.00", COLS.debit, 700),
        item("2026-01-31", COLS.date, 680),
        item("PAYROLL", COLS.description, 680),
        item("3000.00", COLS.credit, 680),
      ]),
    ]);
    const result = adapter.extract(document, signal);
    expect(result.detectedMetadata.columnMode).toBe("debit-credit");
    expect(result.rows[0]?.amount).toBe("-1000.00");
    expect(result.rows[1]?.amount).toBe("3000.00");
  });

  it("skips summary rows and repeated headers", () => {
    const document = doc([
      page(1, [
        ...signedHeader(720),
        ...signedRow(700, "2026-01-15", "RENT", "-1000.00"),
        item("Closing balance", COLS.description, 680),
        item("2000.00", COLS.amount, 680),
      ]),
      page(2, [...signedHeader(720), ...signedRow(700, "2026-01-20", "UTILITIES", "-120.00")]),
    ]);
    const result = adapter.extract(document, signal);
    expect(result.rows).toHaveLength(2);
    expect(result.rows.map((row) => row.description)).toEqual(["RENT", "UTILITIES"]);
  });

  it("continues a wrapped description across a page boundary", () => {
    const document = doc([
      page(1, [...signedHeader(720), ...signedRow(80, "2026-01-15", "CONFERENCE", "-500.00")]),
      page(2, [item("REGISTRATION FEE", COLS.description, 700)]),
    ]);
    const result = adapter.extract(document, signal);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.description).toBe("CONFERENCE REGISTRATION FEE");
  });

  it("reports a row that carries both a debit and a credit as ambiguous", () => {
    const header = [
      item("Date", COLS.date, 720),
      item("Description", COLS.description, 720),
      item("Debit", COLS.debit, 720),
      item("Credit", COLS.credit, 720),
    ];
    const document = doc([
      page(1, [
        ...header,
        item("2026-01-15", COLS.date, 700),
        item("WEIRD", COLS.description, 700),
        item("10.00", COLS.debit, 700),
        item("20.00", COLS.credit, 700),
      ]),
    ]);
    const result = adapter.extract(document, signal);
    expect(result.rows).toHaveLength(0);
    expect(result.issues.map((i) => i.code)).toContain("AMBIGUOUS_AMOUNT");
  });

  it("does not invent an amount for a dated row that has none", () => {
    const document = doc([
      page(1, [
        ...signedHeader(720),
        item("2026-01-15", COLS.date, 700),
        item("MISSING AMOUNT ROW", COLS.description, 700),
      ]),
    ]);
    const result = adapter.extract(document, signal);
    expect(result.rows).toHaveLength(0);
    expect(result.issues.map((i) => i.code)).toContain("MISSING_AMOUNT");
  });

  it("scores zero when no header row is present", () => {
    const document = doc([page(1, [item("just some prose", 72, 700)])]);
    expect(adapter.detect(document).score).toBe(0);
  });
});
