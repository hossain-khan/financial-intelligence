import {
  Money,
  createClassificationRule,
  createTransaction,
  parseAccountId,
  parseCategoryId,
  parseDateOnly,
  parseImportId,
  parseMerchantId,
  parseRuleId,
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
    expect(selectEligibleTransactions([transaction({ status: "void" })], context())).toHaveLength(
      0,
    );
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

  it("excludes a transaction resolved by a rule (persisted rule classification)", () => {
    // Rule resolution is persisted on the record at import time as a category assigned with
    // method "rule". The reused precedence oracle (`deriveReviewQueueItem`) returns undefined for
    // such a resolved, unlocked, unreviewed record, so it is not an AI candidate.
    const ruleResolved = transaction({
      categoryId: parseCategoryId("018f6b80-0d62-7d2c-9a5c-7f5f59cda401"),
      classifications: {
        category: {
          method: "rule",
          classifierId: "rule:coffee",
          classifierVersion: "1.0.0",
          confidence: 1,
          evidence: ["matched-rule:coffee"],
          locked: false,
          decidedAt: NOW,
        },
      },
    });
    expect(selectEligibleTransactions([ruleResolved], context())).toHaveLength(0);
  });

  it("excludes a transaction resolved via a merchant mapping (persisted classification)", () => {
    // Merchant-mapping resolution is persisted at import time (merchant with method
    // "merchantMapping" plus its category). A fully-resolved, unlocked record is excluded.
    const mappingResolved = transaction({
      merchantId: parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda501"),
      categoryId: parseCategoryId("018f6b80-0d62-7d2c-9a5c-7f5f59cda401"),
      classifications: {
        merchant: {
          method: "merchantMapping",
          classifierId: "merchant-alias:rogers",
          classifierVersion: "1.0.0",
          confidence: 1,
          evidence: ["matched-alias:rogers"],
          locked: false,
          decidedAt: NOW,
        },
        category: {
          method: "rule",
          classifierId: "rule:utilities",
          classifierVersion: "1.0.0",
          confidence: 1,
          evidence: ["matched-rule:utilities"],
          locked: false,
          decidedAt: NOW,
        },
      },
    });
    expect(selectEligibleTransactions([mappingResolved], context())).toHaveLength(0);
  });

  it("keeps a rule-conflict transaction eligible (rules param is reused, not reimplemented)", () => {
    // Two equal-priority rules propose different categories: precedence surfaces a review item,
    // so the transaction stays eligible. This proves eligibility consults the same rule engine.
    const tx = transaction({ description: "TIM HORTONS OSHAWA ON" });
    const foodRule = createClassificationRule({
      id: parseRuleId("018f6b80-0d62-7d2c-9a5c-7f5f59cda601"),
      name: "Food",
      priority: 10,
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setCategory", value: "018f6b80-0d62-7d2c-9a5c-7f5f59cda401" }],
      now: NOW,
    });
    const coffeeRule = createClassificationRule({
      id: parseRuleId("018f6b80-0d62-7d2c-9a5c-7f5f59cda602"),
      name: "Coffee",
      priority: 10,
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setCategory", value: "018f6b80-0d62-7d2c-9a5c-7f5f59cda701" }],
      now: NOW,
    });
    expect(
      selectEligibleTransactions([tx], context({ rules: [foodRule, coffeeRule] })),
    ).toHaveLength(1);
  });

  it("respects the max-candidate cap", () => {
    const many = [transaction(), transaction(), transaction()];
    expect(selectEligibleTransactions(many, context({ maxCandidates: 2 }))).toHaveLength(2);
  });
});
