import type { ParseStatementResult } from "@financial-intelligence/import-core";
import { describe, expect, it } from "vitest";

import { mapPdfResult } from "./candidates";

function result(rows: ParseStatementResult["rows"]): ParseStatementResult {
  return { parserId: "pdf", parserVersion: "1.0.0", rows, issues: [] };
}

const context = {
  accountId: "acct-1",
  accountCurrency: "USD",
  sourceFileSha256: "b".repeat(64),
};

describe("mapPdfResult", () => {
  it("maps parsed rows into canonical candidates with provenance", () => {
    const mapped = mapPdfResult(
      result([
        {
          sourceLocation: "page:1/items:3-5",
          fields: { postedDate: "2026-01-15", description: "RENT", amount: "-1000.00" },
        },
      ]),
      context,
    );
    expect(mapped.candidates).toHaveLength(1);
    const candidate = mapped.candidates[0];
    expect(candidate?.provenance).toMatchObject({
      parserId: "pdf",
      parserVersion: "1.0.0",
      sourceLocation: "page:1/items:3-5",
    });
    expect(candidate?.amount).toBe("-1000.00");
    expect(mapped.canContinue).toBe(true);
  });

  it("falls back to the account currency when a row omits one", () => {
    const mapped = mapPdfResult(
      result([
        {
          sourceLocation: "page:1/items:1-3",
          fields: { postedDate: "2026-01-15", description: "RENT", amount: "-1000.00" },
        },
      ]),
      context,
    );
    expect(mapped.candidates[0]?.currency).toBe("USD");
  });

  it("flags a row whose detected currency does not match the account", () => {
    const mapped = mapPdfResult(
      result([
        {
          sourceLocation: "page:1/items:1-3",
          fields: {
            postedDate: "2026-01-15",
            description: "RENT",
            amount: "-1000.00",
            currency: "EUR",
          },
        },
      ]),
      context,
    );
    expect(mapped.canContinue).toBe(false);
    expect(mapped.issues.some((issue) => issue.field === "currency")).toBe(true);
  });
});
