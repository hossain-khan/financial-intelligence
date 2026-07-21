import { describe, expect, it } from "vitest";

import { looksLikeAmount, looksLikeDate, parseAmount, parseDate } from "./normalize";

describe("parseDate", () => {
  it("parses ISO dates", () => {
    expect(parseDate("2026-01-15", false)).toBe("2026-01-15");
  });

  it("parses slash dates with an explicit day-first decision", () => {
    expect(parseDate("01/15/2026", false)).toBe("2026-01-15");
    expect(parseDate("15/01/2026", true)).toBe("2026-01-15");
  });

  it("normalizes two-digit years", () => {
    expect(parseDate("01/15/26", false)).toBe("2026-01-15");
    expect(parseDate("01/15/85", false)).toBe("1985-01-15");
  });

  it("parses textual month dates in both orders", () => {
    expect(parseDate("15 Jan 2026", false)).toBe("2026-01-15");
    expect(parseDate("Jan 15, 2026", false)).toBe("2026-01-15");
    expect(parseDate("15 January 2026", false)).toBe("2026-01-15");
  });

  it("rejects impossible calendar dates rather than guessing", () => {
    expect(parseDate("2026-02-30", false)).toBeUndefined();
    expect(parseDate("2026-13-01", false)).toBeUndefined();
    expect(parseDate("not a date", false)).toBeUndefined();
  });

  it("validates leap days", () => {
    expect(parseDate("2024-02-29", false)).toBe("2024-02-29");
    expect(parseDate("2026-02-29", false)).toBeUndefined();
  });
});

describe("parseAmount", () => {
  it("parses signed decimals with separators and currency marks", () => {
    expect(parseAmount("1,234.56")).toBe("1234.56");
    expect(parseAmount("$54.25")).toBe("54.25");
    expect(parseAmount("-1000.00")).toBe("-1000.00");
  });

  it("treats parentheses and trailing minus as negative", () => {
    expect(parseAmount("(54.25)")).toBe("-54.25");
    expect(parseAmount("54.25-")).toBe("-54.25");
  });

  it("forces a debit-column value negative", () => {
    expect(parseAmount("54.25", { debit: true })).toBe("-54.25");
  });

  it("keeps zero unsigned", () => {
    expect(parseAmount("0.00", { debit: true })).toBe("0.00");
  });

  it("rejects values without exactly two decimals rather than rounding", () => {
    expect(parseAmount("54")).toBeUndefined();
    expect(parseAmount("54.2")).toBeUndefined();
    expect(parseAmount("54.257")).toBeUndefined();
    expect(parseAmount("")).toBeUndefined();
    expect(parseAmount("abc")).toBeUndefined();
  });
});

describe("token classifiers", () => {
  it("detects date-shaped tokens", () => {
    expect(looksLikeDate("2026-01-15")).toBe(true);
    expect(looksLikeDate("RENT")).toBe(false);
  });

  it("detects amount-shaped tokens", () => {
    expect(looksLikeAmount("(1,234.56)")).toBe(true);
    expect(looksLikeAmount("RENT")).toBe(false);
  });
});
