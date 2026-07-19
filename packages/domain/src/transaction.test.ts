import { describe, expect, it } from "vitest";

import { parseAccountId, parseImportId, parseTransactionId } from "./identifiers";
import { Money } from "./money";
import { parseDateOnly, parseUtcTimestamp } from "./temporal";
import { createTransaction, transactionFromCanonical, transactionToCanonical } from "./transaction";

describe("canonical transaction", () => {
  it("round-trips signed money, dates, lifecycle fields, and complete provenance", () => {
    const transaction = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f4"),
      accountId: parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2"),
      importId: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3"),
      postedDate: parseDateOnly("2026-07-19"),
      transactionDate: parseDateOnly("2026-07-18"),
      money: Money.from("-4.25", "CAD"),
      description: "  Coffee\nshop  ",
      sourceTransactionId: "source-1",
      provenance: {
        parserId: "financial-intelligence/csv",
        parserVersion: "1.0.0",
        sourceLocation: "line:2",
        original: { postedDate: "2026-07-19", amount: "-$4.25", description: "Coffee shop" },
        transformations: ["mapping:1.0.0", "description:whitespace-folded"],
      },
      now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
    });

    const document = transactionToCanonical(transaction);
    expect(document).toMatchObject({
      schemaVersion: "1.0.0",
      amount: "-4.25",
      currency: "CAD",
      description: "Coffee shop",
      status: "posted",
      reviewState: "unreviewed",
      tags: [],
      classifications: {},
    });
    expect(transactionToCanonical(transactionFromCanonical(document))).toEqual(document);
  });

  it("enforces canonical amount, field bounds, and provenance bounds", () => {
    const base = {
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f4"),
      accountId: parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2"),
      importId: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3"),
      postedDate: parseDateOnly("2026-07-19"),
      money: Money.from("1.00", "CAD"),
      description: "Coffee",
      provenance: {
        parserId: "csv",
        parserVersion: "1",
        sourceLocation: "line:2",
        original: {},
        transformations: [],
      },
      now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
    };
    expect(() => createTransaction({ ...base, description: "" })).toThrow(/description/i);
    expect(() => createTransaction({ ...base, sourceTransactionId: "x".repeat(241) })).toThrow(
      /ID/i,
    );
    expect(() => createTransaction({ ...base, tags: ["same", "same"] })).toThrow(/unique/i);
    expect(() =>
      createTransaction({
        ...base,
        provenance: { ...base.provenance, transformations: Array.from({ length: 31 }, () => "x") },
      }),
    ).toThrow(/transformations/i);
  });
});
