import {
  Money,
  createCommittedImport,
  createStarterCategories,
  createTransaction,
  importFromCanonical,
  importToCanonical,
  parseAccountId,
  parseCategoryId,
  parseDateOnly,
  parseImportId,
  parseTransactionId,
  parseUtcTimestamp,
  transactionFromCanonical,
  transactionToCanonical,
} from "@financial-intelligence/domain";
import { describe, expect, it } from "vitest";

import { validateCategory, validateImport, validateTransaction } from "./index";

describe("domain canonical schema round trips", () => {
  it("validates stable starter categories against the portable category schema", () => {
    for (const category of createStarterCategories(parseUtcTimestamp("2026-07-19T20:00:00.000Z"))) {
      expect(validateCategory(category)).toEqual({ valid: true, errors: [] });
    }
  });

  it("round-trips a domain transaction through its canonical schema", () => {
    const transaction = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f4"),
      accountId: parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2"),
      importId: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3"),
      postedDate: parseDateOnly("2026-07-19"),
      money: Money.from("-4.25", "CAD"),
      description: "Coffee",
      categoryId: parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b03"),
      notes: "Confirmed at home",
      tags: ["household"],
      classifications: {
        category: {
          method: "user",
          classifierId: "manual-ledger",
          classifierVersion: "1",
          evidence: ["user-confirmed"],
          locked: true,
          decidedAt: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
        },
      },
      provenance: {
        parserId: "financial-intelligence/csv",
        parserVersion: "1.0.0",
        sourceLocation: "line:2",
        original: { amount: "-$4.25", description: "Coffee" },
        transformations: ["mapping:1.0.0"],
      },
      now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
    });
    const document = transactionToCanonical(transaction);
    expect(validateTransaction(document)).toEqual({ valid: true, errors: [] });
    expect(transactionToCanonical(transactionFromCanonical(document))).toEqual(document);
  });

  it("round-trips a committed import through its canonical schema", () => {
    const statementImport = createCommittedImport({
      id: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3"),
      accountId: parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2"),
      source: {
        fileName: "statement.csv",
        mediaType: "text/csv",
        byteSize: 10,
        sha256: "a".repeat(64),
      },
      parser: { id: "financial-intelligence/csv", version: "1.0.0" },
      mapping: { dateFormat: "YYYY-MM-DD" },
      counts: {
        sourceRows: 1,
        valid: 1,
        errors: 0,
        warnings: 0,
        exactDuplicates: 0,
        likelyDuplicates: 0,
        committed: 1,
      },
      issues: [],
      committedRevision: 2,
      now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
    });
    const document = importToCanonical(statementImport);
    expect(validateImport(document)).toEqual({ valid: true, errors: [] });
    expect(importToCanonical(importFromCanonical(document))).toEqual(document);
  });
});
