import { describe, expect, it } from "vitest";

import {
  parseAndValidateFinancialBrain,
  planFinancialBrainMerge,
  serializeFinancialBrain,
  type FinancialBrainDocument,
} from "./financial-brain";
import { parseBrainId, parseCategoryId, parseMerchantId, parseRuleId } from "./identifiers";
import { parseUtcTimestamp } from "./temporal";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const BRAIN_ID = parseBrainId("018f6b80-0d62-7d2c-9a5c-7f5f59cda999");
const CAT_ID = parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b01");
const MERCH_ID = parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda230");
const RULE_ID = parseRuleId("018f6b80-0d62-7d2c-9a5c-7f5f59cda240");

const sampleBrainDoc: FinancialBrainDocument = {
  schemaVersion: "1.0.0",
  brainId: BRAIN_ID,
  createdAt: NOW,
  updatedAt: NOW,
  producer: {
    application: "Financial Intelligence",
    version: "0.1.0",
  },
  categories: [
    {
      id: CAT_ID,
      name: "Coffee",
      kind: "expense",
      order: 1,
      archived: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
  merchants: [
    {
      id: MERCH_ID,
      name: "Starbucks",
      aliases: [],
      archived: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
  rules: [
    {
      schemaVersion: "1.0.0",
      id: RULE_ID,
      name: "Coffee Rule",
      enabled: true,
      priority: 10,
      conditions: [{ field: "normalizedDescription", operator: "startsWith", value: "starbucks" }],
      actions: [{ type: "setCategory", value: CAT_ID }],
      createdBy: "user",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ],
  recurringDecisions: [],
  preferences: {
    locale: "en-US",
    firstDayOfWeek: "monday",
    reviewConfidenceThreshold: 0.8,
  },
};

describe("Financial Brain domain module", () => {
  it("produces deterministic, byte-for-byte stable serialization", () => {
    const json1 = serializeFinancialBrain(sampleBrainDoc);
    const json2 = serializeFinancialBrain({
      ...sampleBrainDoc,
      merchants: [...sampleBrainDoc.merchants],
      categories: [...sampleBrainDoc.categories],
    });

    expect(json1).toBe(json2);
    expect(json1.endsWith("\n")).toBe(true);
  });

  it("parses and validates a canonical Financial Brain document", () => {
    const json = serializeFinancialBrain(sampleBrainDoc);
    const parsed = parseAndValidateFinancialBrain(json);

    expect(parsed.brainId).toBe(BRAIN_ID);
    expect(parsed.categories).toHaveLength(1);
    expect(parsed.merchants).toHaveLength(1);
  });

  it("rejects Financial Brain payload with prohibited sensitive fields", () => {
    const badObj = {
      ...sampleBrainDoc,
      transactions: [{ id: "prohibited" }],
    };

    expect(() => parseAndValidateFinancialBrain(JSON.stringify(badObj))).toThrow(
      "Financial Brain export contains prohibited sensitive field 'transactions'",
    );
  });

  it("rejects payloads exceeding maximum size limit", () => {
    const hugeString = "a".repeat(11 * 1024 * 1024);
    expect(() => parseAndValidateFinancialBrain(hugeString)).toThrow(
      "Financial Brain payload exceeds maximum size limit",
    );
  });

  it("plans diffs and detects additions, unchanged items, and semantic duplicates", () => {
    const local = {
      categories: sampleBrainDoc.categories,
      merchants: sampleBrainDoc.merchants,
      rules: sampleBrainDoc.rules,
      recurringDecisions: [],
    };

    const newCatId = parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b02");
    const incoming = {
      categories: [
        ...sampleBrainDoc.categories,
        {
          id: newCatId,
          name: "Groceries",
          kind: "expense" as const,
          order: 2,
          archived: false,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      merchants: sampleBrainDoc.merchants,
      rules: sampleBrainDoc.rules,
      recurringDecisions: [],
    };

    const plan = planFinancialBrainMerge(local, incoming);
    expect(plan.unchangedCount).toBe(3); // 1 cat + 1 merch + 1 rule
    expect(plan.additions.categories).toHaveLength(1);
    expect(plan.additions.categories[0]?.name).toBe("Groceries");
    expect(plan.conflicts).toHaveLength(0);
  });
});
