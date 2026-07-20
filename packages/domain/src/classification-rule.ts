import type { AccountType } from "./account";
import type { AccountId, CategoryId, MerchantId, RuleId, TransactionId } from "./identifiers";
import { normalizeMerchantDescription } from "./merchant";
import { Money } from "./money";
import type { UtcTimestamp } from "./temporal";

export type ConditionField =
  | "normalizedDescription"
  | "merchantId"
  | "accountType"
  | "direction"
  | "amount"
  | "categoryId"
  | "tag";

export type ConditionOperator = "equals" | "contains" | "startsWith" | "inRange";

export interface AmountRange {
  readonly minimum: string;
  readonly maximum: string;
}

export interface RuleCondition {
  readonly field: ConditionField;
  readonly operator: ConditionOperator;
  readonly value: string | AmountRange;
}

export type ActionType =
  "setMerchant" | "setCategory" | "addTag" | "removeTag" | "markReviewed" | "markIgnored";

export interface RuleAction {
  readonly type: ActionType;
  readonly value: string | boolean;
}

export type RuleSource = "user" | "suggestedHeuristic" | "suggestedAi" | "importedBrain";

export interface ClassificationRule {
  readonly id: RuleId;
  readonly schemaVersion: "1.0.0";
  readonly name: string;
  readonly enabled: boolean;
  readonly priority: number;
  readonly conditions: readonly RuleCondition[];
  readonly actions: readonly RuleAction[];
  readonly createdBy: RuleSource;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
}

export interface TransactionRuleEvaluationContext {
  readonly transactionId: TransactionId;
  readonly rawDescription: string;
  readonly normalizedDescription?: string;
  readonly merchantId?: MerchantId;
  readonly accountId: AccountId;
  readonly accountType: AccountType;
  readonly amount: Money;
  readonly categoryId?: CategoryId;
  readonly tags?: readonly string[];
  readonly isLockedCategory?: boolean;
  readonly isLockedMerchant?: boolean;
}

export interface RuleFieldResult {
  readonly field: "merchantId" | "categoryId";
  readonly value?: string;
  readonly status: "matched" | "no-match" | "locked" | "conflict";
  readonly matchedRuleIds: readonly RuleId[];
  readonly winningRuleId?: RuleId;
  readonly reason: string;
}

export interface TransactionRuleEvaluation {
  readonly transactionId: TransactionId;
  readonly merchantResult: RuleFieldResult;
  readonly categoryResult: RuleFieldResult;
}

export interface CreateClassificationRuleInput {
  readonly id: RuleId;
  readonly name: string;
  readonly enabled?: boolean;
  readonly priority?: number;
  readonly conditions: readonly RuleCondition[];
  readonly actions: readonly RuleAction[];
  readonly createdBy?: RuleSource;
  readonly now: UtcTimestamp;
}

/**
 * Validates and creates a RuleCondition instance.
 */
export function createRuleCondition(condition: RuleCondition): RuleCondition {
  if (condition.operator === "inRange") {
    if (typeof condition.value !== "object" || condition.value === null) {
      throw new TypeError("inRange operator requires an AmountRange object value");
    }
    const range = condition.value as AmountRange;
    const minMoney = Money.from(range.minimum, "USD");
    const maxMoney = Money.from(range.maximum, "USD");
    if (minMoney.isGreaterThan(maxMoney)) {
      throw new RangeError("AmountRange minimum cannot be greater than maximum");
    }
    return {
      field: condition.field,
      operator: "inRange",
      value: { minimum: range.minimum.trim(), maximum: range.maximum.trim() },
    };
  }

  if (typeof condition.value !== "string") {
    throw new TypeError("Condition operator requires a string value");
  }

  const trimmed = condition.value.trim();
  if (trimmed.length === 0 || trimmed.length > 240) {
    throw new RangeError("Condition value must be between 1 and 240 characters");
  }

  const normalizedVal =
    condition.field === "normalizedDescription" ? normalizeMerchantDescription(trimmed) : trimmed;

  return {
    field: condition.field,
    operator: condition.operator,
    value: normalizedVal,
  };
}

/**
 * Validates and creates a RuleAction instance.
 */
export function createRuleAction(action: RuleAction): RuleAction {
  if (action.type === "markReviewed" || action.type === "markIgnored") {
    if (typeof action.value !== "boolean") {
      throw new TypeError(`${action.type} action requires a boolean value`);
    }
    return action;
  }

  if (typeof action.value !== "string") {
    throw new TypeError(`${action.type} action requires a string value`);
  }

  const trimmed = action.value.trim();
  if (trimmed.length === 0 || trimmed.length > 240) {
    throw new RangeError("Action value string must be between 1 and 240 characters");
  }

  return {
    type: action.type,
    value: trimmed,
  };
}

/**
 * Validates and constructs a ClassificationRule entity.
 */
export function createClassificationRule(input: CreateClassificationRuleInput): ClassificationRule {
  const name = input.name.trim();
  if (name.length === 0 || name.length > 160) {
    throw new RangeError("Rule name must be between 1 and 160 characters");
  }

  const priority = input.priority ?? 0;
  if (!Number.isInteger(priority) || priority < -100000 || priority > 100000) {
    throw new RangeError("Rule priority must be an integer between -100000 and 100000");
  }

  if (
    !Array.isArray(input.conditions) ||
    input.conditions.length === 0 ||
    input.conditions.length > 20
  ) {
    throw new RangeError("Rule must contain between 1 and 20 conditions");
  }

  if (!Array.isArray(input.actions) || input.actions.length === 0 || input.actions.length > 20) {
    throw new RangeError("Rule must contain between 1 and 20 actions");
  }

  const validatedConditions = input.conditions.map(createRuleCondition);
  const validatedActions = input.actions.map(createRuleAction);

  // Validate internal consistency of conditions
  validateConditionSetConsistency(validatedConditions);

  return {
    id: input.id,
    schemaVersion: "1.0.0",
    name,
    enabled: input.enabled ?? true,
    priority,
    conditions: validatedConditions,
    actions: validatedActions,
    createdBy: input.createdBy ?? "user",
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/**
 * Calculates a rule's specificity score based on its condition types & operators.
 * - Exact equality / ID match: +10
 * - Prefix / Range: +5
 * - Contains: +2
 */
export function calculateRuleSpecificity(rule: ClassificationRule): number {
  let score = 0;

  for (const cond of rule.conditions) {
    if (cond.operator === "equals") {
      score += 10;
    } else if (cond.operator === "startsWith" || cond.operator === "inRange") {
      score += 5;
    } else if (cond.operator === "contains") {
      score += 2;
    }
  }

  return score;
}

/**
 * Evaluates whether a single condition matches a transaction context.
 */
export function evaluateCondition(
  condition: RuleCondition,
  context: TransactionRuleEvaluationContext,
): boolean {
  if (condition.field === "normalizedDescription") {
    const normText =
      context.normalizedDescription ?? normalizeMerchantDescription(context.rawDescription);
    const pattern = condition.value as string;

    if (condition.operator === "equals") return normText === pattern;
    if (condition.operator === "startsWith") return normText.startsWith(pattern);
    if (condition.operator === "contains") return normText.includes(pattern);
    return false;
  }

  if (condition.field === "merchantId") {
    if (context.merchantId === undefined) return false;
    const val = condition.value as string;
    if (condition.operator === "equals") return context.merchantId === val;
    return false;
  }

  if (condition.field === "accountType") {
    const val = condition.value as string;
    if (condition.operator === "equals") return context.accountType === val;
    return false;
  }

  if (condition.field === "direction") {
    const direction = context.amount.isInflow() ? "inflow" : "outflow";
    const val = condition.value as string;
    if (condition.operator === "equals") return direction === val;
    return false;
  }

  if (condition.field === "amount") {
    if (condition.operator === "inRange") {
      const range = condition.value as AmountRange;
      const absAmount = context.amount.abs();
      const min = Money.from(range.minimum, context.amount.currency);
      const max = Money.from(range.maximum, context.amount.currency);
      return absAmount.isGreaterThanOrEqual(min) && absAmount.isLessThanOrEqual(max);
    }
    if (condition.operator === "equals") {
      const val = Money.from(condition.value as string, context.amount.currency);
      return context.amount.abs().equals(val);
    }
    return false;
  }

  if (condition.field === "categoryId") {
    if (context.categoryId === undefined) return false;
    const val = condition.value as string;
    if (condition.operator === "equals") return context.categoryId === val;
    return false;
  }

  if (condition.field === "tag") {
    if (context.tags === undefined || context.tags.length === 0) return false;
    const val = condition.value as string;
    if (condition.operator === "equals") return context.tags.includes(val);
    if (condition.operator === "contains") return context.tags.some((t) => t.includes(val));
    return false;
  }

  return false;
}

/**
 * Pure evaluator for rules against a transaction context.
 * Implements strict decision precedence:
 * 1. Locked fields win (returns reason: "locked")
 * 2. Filter enabled rules matching all AND conditions
 * 3. Priority (descending)
 * 4. Specificity (descending)
 * 5. Incompatible values at equal precedence -> conflict (returns status: "conflict")
 */
export function evaluateClassificationRules(
  context: TransactionRuleEvaluationContext,
  rules: readonly ClassificationRule[],
): TransactionRuleEvaluation {
  const merchantResult = evaluateFieldRules("setMerchant", context, rules);
  const categoryResult = evaluateFieldRules("setCategory", context, rules);

  return {
    transactionId: context.transactionId,
    merchantResult,
    categoryResult,
  };
}

function evaluateFieldRules(
  actionType: "setMerchant" | "setCategory",
  context: TransactionRuleEvaluationContext,
  rules: readonly ClassificationRule[],
): RuleFieldResult {
  const targetField = actionType === "setMerchant" ? "merchantId" : "categoryId";
  const isLocked =
    actionType === "setMerchant"
      ? (context.isLockedMerchant ?? false)
      : (context.isLockedCategory ?? false);

  if (isLocked) {
    return {
      field: targetField,
      status: "locked",
      matchedRuleIds: [],
      reason: "User has locked this field against automated evaluation",
    };
  }

  // Filter enabled rules that match all conditions and contain the target action
  const matchingRules = rules.filter(
    (rule) =>
      rule.enabled &&
      rule.actions.some((a) => a.type === actionType) &&
      rule.conditions.every((cond) => evaluateCondition(cond, context)),
  );

  if (matchingRules.length === 0) {
    return {
      field: targetField,
      status: "no-match",
      matchedRuleIds: [],
      reason: "No rules matched transaction conditions",
    };
  }

  // Sort by priority (desc), then specificity (desc), then lexical ID for tie-breaking
  const sorted = [...matchingRules].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const specA = calculateRuleSpecificity(a);
    const specB = calculateRuleSpecificity(b);
    if (specB !== specA) return specB - specA;
    return a.id.localeCompare(b.id);
  });

  const highest = sorted[0];
  if (highest === undefined) {
    return {
      field: targetField,
      status: "no-match",
      matchedRuleIds: [],
      reason: "No matching rules found",
    };
  }

  const topPriority = highest.priority;
  const topSpecificity = calculateRuleSpecificity(highest);

  // Find all rules sharing the exact top priority and specificity
  const topTier = sorted.filter(
    (r) => r.priority === topPriority && calculateRuleSpecificity(r) === topSpecificity,
  );

  // Extract proposed values for this target action
  const proposedValues = topTier
    .map((r) => r.actions.find((a) => a.type === actionType)?.value as string)
    .filter((v): v is string => typeof v === "string");

  const uniqueProposed = Array.from(new Set(proposedValues));

  if (uniqueProposed.length > 1) {
    return {
      field: targetField,
      status: "conflict",
      matchedRuleIds: topTier.map((r) => r.id),
      reason: `Conflicting rules (${topTier.map((r) => r.id).join(", ")}) proposed different values: ${uniqueProposed.join(", ")}`,
    };
  }

  const winningValue = uniqueProposed[0];

  return {
    field: targetField,
    ...(winningValue === undefined ? {} : { value: winningValue }),
    status: "matched",
    matchedRuleIds: matchingRules.map((r) => r.id),
    winningRuleId: highest.id,
    reason: `Matched rule '${highest.name}' (priority ${highest.priority}, specificity ${topSpecificity})`,
  };
}

function validateConditionSetConsistency(conditions: readonly RuleCondition[]): void {
  const directions = conditions.filter((c) => c.field === "direction");
  if (directions.length > 1) {
    const values = new Set(directions.map((c) => c.value));
    if (values.size > 1) {
      throw new RangeError("Contradictory direction conditions (inflow vs outflow)");
    }
  }
}

/**
 * Analyzes overlap/shadowing between two classification rules.
 */
export function analyzeRuleOverlap(
  ruleA: ClassificationRule,
  ruleB: ClassificationRule,
): "identical" | "shadowed" | "overlapping" | "distinct" {
  if (ruleA.id === ruleB.id) return "identical";

  // Check if conditions are identical
  const condsA = JSON.stringify(ruleA.conditions);
  const condsB = JSON.stringify(ruleB.conditions);

  if (condsA === condsB) {
    if (ruleA.priority > ruleB.priority) return "shadowed"; // B is shadowed by A
    return "overlapping";
  }

  return "distinct";
}
