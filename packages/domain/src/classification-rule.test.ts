import { describe, expect, it } from "vitest";

import {
  calculateRuleSpecificity,
  createClassificationRule,
  createRuleAction,
  createRuleCondition,
  evaluateClassificationRules,
  evaluateCondition,
  type TransactionRuleEvaluationContext,
} from "./classification-rule";
import {
  parseAccountId,
  parseCategoryId,
  parseMerchantId,
  parseRuleId,
  parseTransactionId,
} from "./identifiers";
import { Money } from "./money";
import { parseUtcTimestamp } from "./temporal";

const RULE_ID_1 = parseRuleId("018f6b80-0d62-7d2c-9a5c-7f5f59cda201");
const RULE_ID_2 = parseRuleId("018f6b80-0d62-7d2c-9a5c-7f5f59cda202");
const RULE_ID_3 = parseRuleId("018f6b80-0d62-7d2c-9a5c-7f5f59cda203");

const TRANSACTION_ID = parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda210");
const ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda220");
const CATEGORY_ID_GROCERIES = parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b03");
const CATEGORY_ID_RESTAURANTS = parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b04");
const MERCHANT_ID_TIMS = parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda230");

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");

const BASE_CONTEXT: TransactionRuleEvaluationContext = {
  transactionId: TRANSACTION_ID,
  rawDescription: "TIM HORTONS #145 OSHAWA ON",
  normalizedDescription: "tim hortons oshawa on",
  accountId: ACCOUNT_ID,
  accountType: "checking",
  amount: Money.from("-14.50", "CAD"),
};

describe("RuleCondition & RuleAction factories", () => {
  it("validates condition values and operators", () => {
    const stringCond = createRuleCondition({
      field: "normalizedDescription",
      operator: "startsWith",
      value: "TIM HORTONS",
    });
    expect(stringCond.value).toBe("tim hortons");

    const rangeCond = createRuleCondition({
      field: "amount",
      operator: "inRange",
      value: { minimum: "10.00", maximum: "50.00" },
    });
    expect(rangeCond.value).toEqual({ minimum: "10.00", maximum: "50.00" });

    expect(() =>
      createRuleCondition({
        field: "amount",
        operator: "inRange",
        value: { minimum: "50.00", maximum: "10.00" },
      }),
    ).toThrow(RangeError);
  });

  it("validates action values and types", () => {
    const action = createRuleAction({
      type: "setCategory",
      value: CATEGORY_ID_GROCERIES,
    });
    expect(action.value).toBe(CATEGORY_ID_GROCERIES);

    expect(() =>
      createRuleAction({
        type: "setCategory",
        value: "",
      }),
    ).toThrow(RangeError);
  });
});

describe("ClassificationRule validation & specificity", () => {
  it("validates rule creation bounds", () => {
    const rule = createClassificationRule({
      id: RULE_ID_1,
      name: "Tim Hortons Restaurants Rule",
      priority: 10,
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setCategory", value: CATEGORY_ID_RESTAURANTS }],
      now: NOW,
    });

    expect(rule.name).toBe("Tim Hortons Restaurants Rule");
    expect(rule.priority).toBe(10);
    expect(rule.enabled).toBe(true);
  });

  it("calculates specificity correctly based on operator weights", () => {
    const exactRule = createClassificationRule({
      id: RULE_ID_1,
      name: "Exact",
      conditions: [{ field: "normalizedDescription", operator: "equals", value: "tim hortons" }],
      actions: [{ type: "setCategory", value: CATEGORY_ID_RESTAURANTS }],
      now: NOW,
    });

    const prefixRule = createClassificationRule({
      id: RULE_ID_2,
      name: "Prefix",
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setCategory", value: CATEGORY_ID_RESTAURANTS }],
      now: NOW,
    });

    const containsRule = createClassificationRule({
      id: RULE_ID_3,
      name: "Contains",
      conditions: [{ field: "normalizedDescription", operator: "contains", value: "hortons" }],
      actions: [{ type: "setCategory", value: CATEGORY_ID_RESTAURANTS }],
      now: NOW,
    });

    expect(calculateRuleSpecificity(exactRule)).toBe(10);
    expect(calculateRuleSpecificity(prefixRule)).toBe(5);
    expect(calculateRuleSpecificity(containsRule)).toBe(2);
  });
});

describe("evaluateCondition", () => {
  it("evaluates normalizedDescription, amount inRange, and direction conditions", () => {
    const condDescription = createRuleCondition({
      field: "normalizedDescription",
      operator: "startsWith",
      value: "tim hortons",
    });
    expect(evaluateCondition(condDescription, BASE_CONTEXT)).toBe(true);

    const condAmount = createRuleCondition({
      field: "amount",
      operator: "inRange",
      value: { minimum: "10.00", maximum: "20.00" },
    });
    expect(evaluateCondition(condAmount, BASE_CONTEXT)).toBe(true);

    const condDirection = createRuleCondition({
      field: "direction",
      operator: "equals",
      value: "outflow",
    });
    expect(evaluateCondition(condDirection, BASE_CONTEXT)).toBe(true);
  });
});

describe("evaluateClassificationRules — Precedence & Conflict Rules", () => {
  it("returns locked status if user has locked the field", () => {
    const lockedContext: TransactionRuleEvaluationContext = {
      ...BASE_CONTEXT,
      isLockedCategory: true,
    };

    const rule = createClassificationRule({
      id: RULE_ID_1,
      name: "Tim Hortons Rule",
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setCategory", value: CATEGORY_ID_RESTAURANTS }],
      now: NOW,
    });

    const evalResult = evaluateClassificationRules(lockedContext, [rule]);
    expect(evalResult.categoryResult.status).toBe("locked");
    expect(evalResult.categoryResult.reason).toContain("locked");
  });

  it("selects higher priority rule over lower priority rule", () => {
    const lowPriorityRule = createClassificationRule({
      id: RULE_ID_1,
      name: "Low Priority Rule",
      priority: 10,
      conditions: [{ field: "normalizedDescription", operator: "contains", value: "tim" }],
      actions: [{ type: "setCategory", value: CATEGORY_ID_GROCERIES }],
      now: NOW,
    });

    const highPriorityRule = createClassificationRule({
      id: RULE_ID_2,
      name: "High Priority Rule",
      priority: 50,
      conditions: [{ field: "normalizedDescription", operator: "contains", value: "tim" }],
      actions: [{ type: "setCategory", value: CATEGORY_ID_RESTAURANTS }],
      now: NOW,
    });

    const evalResult = evaluateClassificationRules(BASE_CONTEXT, [
      lowPriorityRule,
      highPriorityRule,
    ]);
    expect(evalResult.categoryResult.status).toBe("matched");
    expect(evalResult.categoryResult.winningRuleId).toBe(highPriorityRule.id);
    expect(evalResult.categoryResult.value).toBe(CATEGORY_ID_RESTAURANTS);
  });

  it("uses specificity as tie-breaker at equal priority", () => {
    const lowerSpecificity = createClassificationRule({
      id: RULE_ID_1,
      name: "Contains Rule",
      priority: 10,
      conditions: [{ field: "normalizedDescription", operator: "contains", value: "tim" }],
      actions: [{ type: "setCategory", value: CATEGORY_ID_GROCERIES }],
      now: NOW,
    });

    const higherSpecificity = createClassificationRule({
      id: RULE_ID_2,
      name: "StartsWith Rule",
      priority: 10,
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setCategory", value: CATEGORY_ID_RESTAURANTS }],
      now: NOW,
    });

    const evalResult = evaluateClassificationRules(BASE_CONTEXT, [
      lowerSpecificity,
      higherSpecificity,
    ]);
    expect(evalResult.categoryResult.status).toBe("matched");
    expect(evalResult.categoryResult.winningRuleId).toBe(higherSpecificity.id);
    expect(evalResult.categoryResult.value).toBe(CATEGORY_ID_RESTAURANTS);
  });

  it("abstains with conflict status when two equal-precedence rules propose different values", () => {
    const ruleA = createClassificationRule({
      id: RULE_ID_1,
      name: "Rule A",
      priority: 10,
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setCategory", value: CATEGORY_ID_GROCERIES }],
      now: NOW,
    });

    const ruleB = createClassificationRule({
      id: RULE_ID_2,
      name: "Rule B",
      priority: 10,
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setCategory", value: CATEGORY_ID_RESTAURANTS }],
      now: NOW,
    });

    const evalResult = evaluateClassificationRules(BASE_CONTEXT, [ruleA, ruleB]);
    expect(evalResult.categoryResult.status).toBe("conflict");
    expect(evalResult.categoryResult.value).toBeUndefined();
    expect(evalResult.categoryResult.matchedRuleIds).toHaveLength(2);
  });

  it("is strictly deterministic across multiple evaluation runs (property test)", () => {
    const rules = [
      createClassificationRule({
        id: RULE_ID_1,
        name: "Rule A",
        priority: 10,
        conditions: [
          { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
        ],
        actions: [
          { type: "setCategory", value: CATEGORY_ID_RESTAURANTS },
          { type: "setMerchant", value: MERCHANT_ID_TIMS },
        ],
        now: NOW,
      }),
      createClassificationRule({
        id: RULE_ID_2,
        name: "Rule B",
        priority: 5,
        conditions: [{ field: "normalizedDescription", operator: "contains", value: "tim" }],
        actions: [{ type: "setCategory", value: CATEGORY_ID_GROCERIES }],
        now: NOW,
      }),
    ];

    const run1 = evaluateClassificationRules(BASE_CONTEXT, rules);
    const run2 = evaluateClassificationRules(BASE_CONTEXT, rules);

    expect(run1).toEqual(run2);
  });

  it("evaluates startsWith, contains, setMerchant, and skips disabled rules", () => {
    const disabledRule = createClassificationRule({
      id: RULE_ID_1,
      name: "Disabled Rule",
      enabled: false,
      priority: 100,
      conditions: [
        { field: "normalizedDescription", operator: "equals", value: "tim hortons oshawa on" },
      ],
      actions: [{ type: "setCategory", value: CATEGORY_ID_GROCERIES }],
      now: NOW,
    });

    const activeRule = createClassificationRule({
      id: RULE_ID_2,
      name: "Active Merchant Rule",
      priority: 20,
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
        { field: "normalizedDescription", operator: "contains", value: "oshawa" },
      ],
      actions: [{ type: "setMerchant", value: MERCHANT_ID_TIMS }],
      now: NOW,
    });

    const evalResult = evaluateClassificationRules(BASE_CONTEXT, [disabledRule, activeRule]);
    expect(evalResult.merchantResult.status).toBe("matched");
    expect(evalResult.merchantResult.value).toBe(MERCHANT_ID_TIMS);
  });
});
