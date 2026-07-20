import { describe, expect, it } from "vitest";

import { createClassificationRule } from "./classification-rule";
import {
  parseAccountId,
  parseAliasId,
  parseCategoryId,
  parseImportId,
  parseMerchantId,
  parseRuleId,
  parseTransactionId,
} from "./identifiers";
import { createMerchant, createMerchantAlias } from "./merchant";
import { Money } from "./money";
import { deriveReviewQueueItem } from "./review-queue";
import { parseDateOnly, parseUtcTimestamp } from "./temporal";
import { createTransaction } from "./transaction";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda210");
const IMPORT_ID = parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda220");
const CATEGORY_ID_FOOD = parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b03");
const CATEGORY_ID_COFFEE = parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b04");

describe("deriveReviewQueueItem", () => {
  it("projects 'unclassified' when transaction has no category and is unlocked", () => {
    const transaction = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda201"),
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
    });

    const item = deriveReviewQueueItem(transaction);
    expect(item).toBeDefined();
    expect(item?.reason).toBe("unclassified");
  });

  it("projects 'rule-conflict' when classification rules conflict", () => {
    const transaction = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda202"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("-5.00", "CAD"),
      description: "TIM HORTONS OSHAWA ON",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "line:2",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const ruleA = createClassificationRule({
      id: parseRuleId("018f6b80-0d62-7d2c-9a5c-7f5f59cda203"),
      name: "Rule Food",
      priority: 10,
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setCategory", value: CATEGORY_ID_FOOD }],
      now: NOW,
    });

    const ruleB = createClassificationRule({
      id: parseRuleId("018f6b80-0d62-7d2c-9a5c-7f5f59cda204"),
      name: "Rule Coffee",
      priority: 10,
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setCategory", value: CATEGORY_ID_COFFEE }],
      now: NOW,
    });

    const item = deriveReviewQueueItem(transaction, [ruleA, ruleB]);
    expect(item).toBeDefined();
    expect(item?.reason).toBe("rule-conflict");
  });

  it("projects 'merchant-collision' when multiple merchant aliases match description", () => {
    const transaction = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda205"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("-15.00", "CAD"),
      description: "CORNER STORE CAFE",
      categoryId: CATEGORY_ID_FOOD,
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "line:3",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const aliasA = createMerchantAlias({
      id: parseAliasId("018f6b80-0d62-7d2c-9a5c-7f5f59cda211"),
      pattern: "corner store",
      matchMode: "tokenPrefix",
      now: NOW,
    });

    const aliasB = createMerchantAlias({
      id: parseAliasId("018f6b80-0d62-7d2c-9a5c-7f5f59cda212"),
      pattern: "cafe",
      matchMode: "contains",
      now: NOW,
    });

    const merchantA = createMerchant({
      id: parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda206"),
      name: "Corner Store",
      aliases: [aliasA],
      now: NOW,
    });

    const merchantB = createMerchant({
      id: parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda207"),
      name: "Corner Cafe",
      aliases: [aliasB],
      now: NOW,
    });

    const item = deriveReviewQueueItem(transaction, [], [merchantA, merchantB]);
    expect(item).toBeDefined();
    expect(item?.reason).toBe("merchant-collision");
  });

  it("returns undefined for locked category user edits", () => {
    const transaction = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda208"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("-12.50", "CAD"),
      description: "MANUALLY LOCKED",
      categoryId: CATEGORY_ID_FOOD,
      classifications: {
        category: {
          method: "user",
          classifierId: "user",
          classifierVersion: "1.0.0",
          confidence: 1.0,
          evidence: [],
          locked: true,
          decidedAt: NOW,
        },
      },
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "line:4",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const item = deriveReviewQueueItem(transaction);
    expect(item).toBeUndefined();
  });
});
