import {
  Money,
  createTransaction,
  detectDuplicateCandidates,
  parseAccountId,
  parseDateOnly,
  parseImportId,
  parseTransactionId,
  parseUtcTimestamp,
  type Transaction,
} from "@financial-intelligence/domain";
import { describe, expect, it } from "vitest";

import { createFingerprintBasis } from "./imports";

const ACCOUNT_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2";
const NOW = parseUtcTimestamp("2026-07-19T20:00:00.000Z");

/**
 * A CSV import and an OFX import of the same real transaction rarely share a source identifier
 * (CSV often has none; OFX has a FITID). The canonical fingerprint — account, posted date, amount,
 * currency, and normalized description — is what lets the two formats deduplicate against each
 * other, so this test pins that shared basis and the resulting exact-duplicate detection.
 */
function transaction(overrides: {
  readonly id: string;
  readonly importId: string;
  readonly parserId: string;
  readonly sourceLocation: string;
  readonly sourceTransactionId?: string;
}): Transaction {
  return createTransaction({
    id: parseTransactionId(overrides.id),
    accountId: parseAccountId(ACCOUNT_ID),
    importId: parseImportId(overrides.importId),
    postedDate: parseDateOnly("2024-01-15"),
    money: Money.from("-42.50", "USD"),
    description: "Coffee Bar",
    ...(overrides.sourceTransactionId === undefined
      ? {}
      : { sourceTransactionId: overrides.sourceTransactionId }),
    provenance: {
      parserId: overrides.parserId,
      parserVersion: "1.0.0",
      sourceLocation: overrides.sourceLocation,
      original: {},
      transformations: ["mapping:1.0.0"],
    },
    now: NOW,
  });
}

describe("cross-format deduplication", () => {
  const csvTransaction = transaction({
    id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda201",
    importId: "018f6b80-0d62-7d2c-9a5c-7f5f59cda301",
    parserId: "financial-intelligence/csv",
    sourceLocation: "line:2",
  });
  const ofxTransaction = transaction({
    id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda202",
    importId: "018f6b80-0d62-7d2c-9a5c-7f5f59cda302",
    parserId: "ofx",
    sourceLocation: "statement:1/transaction:1",
    sourceTransactionId: "202401150001",
  });

  it("produces an identical fingerprint basis regardless of parser or source id", () => {
    expect(createFingerprintBasis(ofxTransaction)).toBe(createFingerprintBasis(csvTransaction));
  });

  it("flags the OFX import as an exact duplicate of the existing CSV transaction via fingerprint", () => {
    const fingerprintValue = "shared-fingerprint";
    const candidates = detectDuplicateCandidates({
      existing: [csvTransaction],
      incoming: [ofxTransaction],
      fingerprints: [
        { transactionId: csvTransaction.id, value: fingerprintValue },
        { transactionId: ofxTransaction.id, value: fingerprintValue },
      ],
    });
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ kind: "exact", score: 10_000 });
    expect(candidates[0]?.evidence.some((item) => item.code === "fingerprint")).toBe(true);
  });

  it("does not treat differing amounts as duplicates", () => {
    const different = transaction({
      id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda203",
      importId: "018f6b80-0d62-7d2c-9a5c-7f5f59cda303",
      parserId: "ofx",
      sourceLocation: "statement:1/transaction:9",
    });
    const differentAmount = { ...different, money: Money.from("-99.99", "USD") } as Transaction;
    const candidates = detectDuplicateCandidates({
      existing: [csvTransaction],
      incoming: [differentAmount],
    });
    expect(candidates).toHaveLength(0);
  });
});
