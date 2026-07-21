import { describe, expect, it } from "vitest";

import { buildCandidatesFromDrafts, type CandidateDraft } from "./candidate-mapping";

const CONTEXT = {
  accountId: "acct-1",
  accountCurrency: "USD",
  parserId: "ofx",
  parserVersion: "1.0.0",
  sourceFileSha256: "a".repeat(64),
};

function draft(overrides: Partial<CandidateDraft> = {}): CandidateDraft {
  return {
    sourceLocation: "statement:1/transaction:1",
    postedDate: "2024-01-15",
    description: "Coffee",
    amount: "-4.25",
    currency: "USD",
    original: { postedDate: "20240115", description: "Coffee", amount: "-4.25" },
    ...overrides,
  };
}

describe("buildCandidatesFromDrafts", () => {
  it("accepts a valid draft and computes totals", () => {
    const result = buildCandidatesFromDrafts(
      [draft(), draft({ sourceLocation: "s:1/t:2", amount: "10.00", description: "Refund" })],
      CONTEXT,
    );
    expect(result.canContinue).toBe(true);
    expect(result.candidates).toHaveLength(2);
    expect(result.totals).toMatchObject({ inflow: "10.00", outflow: "4.25", validRows: 2 });
  });

  it("carries a transaction date and status into the candidate", () => {
    const result = buildCandidatesFromDrafts(
      [
        draft({
          transactionDate: "2024-01-14",
          status: "pending",
          original: {
            postedDate: "20240115",
            transactionDate: "20240114",
            description: "Coffee",
            amount: "-4.25",
            status: "PENDING",
          },
        }),
      ],
      CONTEXT,
    );
    expect(result.candidates[0]).toMatchObject({
      transactionDate: "2024-01-14",
      status: "pending",
    });
  });

  it("flags a missing account and short-circuits", () => {
    const result = buildCandidatesFromDrafts([draft()], { ...CONTEXT, accountId: "  " });
    expect(result.canContinue).toBe(false);
    expect(result.candidates).toHaveLength(0);
    expect(result.issues.some((issue) => issue.code === "ACCOUNT_REQUIRED")).toBe(true);
  });

  it("flags an invalid account currency", () => {
    const result = buildCandidatesFromDrafts([draft()], { ...CONTEXT, accountCurrency: "usd" });
    expect(result.issues.some((issue) => issue.code === "ACCOUNT_CURRENCY_INVALID")).toBe(true);
  });

  it.each([
    ["bad posted date", draft({ postedDate: "2024-13-40" }), "postedDate"],
    ["bad transaction date", draft({ transactionDate: "2024-99-99" }), "transactionDate"],
    ["empty description", draft({ description: "" }), "description"],
    ["overlong description", draft({ description: "x".repeat(1_001) }), "description"],
    ["invalid amount", draft({ amount: "12.5" }), "amount"],
    ["invalid currency code", draft({ currency: "US" }), "currency"],
    ["currency mismatch", draft({ currency: "CAD" }), "currency"],
  ])("marks %s invalid", (_label, badDraft, field) => {
    const result = buildCandidatesFromDrafts([badDraft], CONTEXT);
    expect(result.canContinue).toBe(false);
    expect(result.candidates).toHaveLength(0);
    expect(result.issues.some((issue) => issue.field === field)).toBe(true);
  });

  it("rejects an overlong source transaction id", () => {
    const result = buildCandidatesFromDrafts(
      [draft({ sourceTransactionId: "x".repeat(241) })],
      CONTEXT,
    );
    expect(result.issues.some((issue) => issue.field === "sourceTransactionId")).toBe(true);
  });

  it("allows an empty optional transaction date", () => {
    const result = buildCandidatesFromDrafts([draft({ transactionDate: "" })], CONTEXT);
    expect(result.canContinue).toBe(true);
  });

  it("trims the preview to a representative 20 rows for large batches", () => {
    const drafts = Array.from({ length: 40 }, (_unused, index) =>
      draft({
        sourceLocation: `statement:1/transaction:${index + 1}`,
        amount: index % 2 === 0 ? "-1.00" : "1.00",
      }),
    );
    const result = buildCandidatesFromDrafts(drafts, CONTEXT);
    expect(result.candidates).toHaveLength(40);
    expect(result.previewRows.length).toBeLessThanOrEqual(20);
  });

  it("preserves upstream parse issues", () => {
    const result = buildCandidatesFromDrafts([draft()], CONTEXT, [
      { code: "UNSUPPORTED_SECTION", severity: "warning", message: "ignored" },
    ]);
    expect(result.issues.some((issue) => issue.code === "UNSUPPORTED_SECTION")).toBe(true);
    expect(result.canContinue).toBe(true);
  });
});
