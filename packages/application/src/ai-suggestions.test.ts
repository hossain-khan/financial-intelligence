import {
  Money,
  createTransaction,
  parseAccountId,
  parseCategoryId,
  parseDateOnly,
  parseImportId,
  parseTransactionId,
  parseUtcTimestamp,
  type Transaction,
} from "@financial-intelligence/domain";
import { describe, expect, it } from "vitest";

import {
  rejectionKey,
  selectEligibleTransactions,
  type EligibilityContext,
} from "./ai-suggestions";

const NOW = parseUtcTimestamp("2026-07-20T00:00:00.000Z");
const ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda202");
const IMPORT_ID = parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda203");
let counter = 0;

function transaction(over: Partial<Parameters<typeof createTransaction>[0]> = {}): Transaction {
  counter += 1;
  return createTransaction({
    id: parseTransactionId(`018f6b80-0d62-7d2c-9a5c-7f5f59cda${(300 + counter).toString()}`),
    accountId: ACCOUNT_ID,
    importId: IMPORT_ID,
    postedDate: parseDateOnly("2026-07-20"),
    money: Money.from("-12.50", "CAD"),
    description: "UNKNOWN COFFEE SHOP",
    provenance: {
      parserId: "csv",
      parserVersion: "1.0.0",
      sourceLocation: "line:1",
      original: {},
      transformations: [],
    },
    now: NOW,
    ...over,
  });
}

function context(over: Partial<EligibilityContext> = {}): EligibilityContext {
  return {
    rules: [],
    merchants: [],
    rejectedKeys: new Set(),
    classifierVersion: "1.0.0",
    ...over,
  };
}

describe("selectEligibleTransactions", () => {
  it("includes an active, unresolved, unlocked transaction", () => {
    expect(selectEligibleTransactions([transaction()], context())).toHaveLength(1);
  });

  it("excludes a locked transaction", () => {
    const locked = transaction({
      categoryId: parseCategoryId("018f6b80-0d62-7d2c-9a5c-7f5f59cda401"),
      classifications: {
        category: {
          method: "user",
          classifierId: "user",
          classifierVersion: "1.0.0",
          evidence: [],
          locked: true,
          decidedAt: NOW,
        },
      },
    });
    expect(selectEligibleTransactions([locked], context())).toHaveLength(0);
  });

  it("excludes a void transaction", () => {
    expect(selectEligibleTransactions([transaction({ status: "void" })], context())).toHaveLength(0);
  });

  it("excludes a description already rejected for this classifier version", () => {
    const key = rejectionKey("unknown coffee shop", "1.0.0");
    expect(
      selectEligibleTransactions([transaction()], context({ rejectedKeys: new Set([key]) })),
    ).toHaveLength(0);
  });

  it("still includes it when only a different classifier version was rejected", () => {
    const key = rejectionKey("unknown coffee shop", "0.9.0");
    expect(
      selectEligibleTransactions([transaction()], context({ rejectedKeys: new Set([key]) })),
    ).toHaveLength(1);
  });

  it("respects the max-candidate cap", () => {
    const many = [transaction(), transaction(), transaction()];
    expect(selectEligibleTransactions(many, context({ maxCandidates: 2 }))).toHaveLength(2);
  });
});
