/*
 * This file is generated from the canonical JSON Schema in /schemas.
 * Do not edit it directly. Run: pnpm schema:generate
 */

/**
 * This interface was referenced by `FinancialBrain`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * This interface was referenced by `FinancialBrain`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;
/**
 * This interface was referenced by `FinancialBrain`'s JSON-Schema
 * via the `definition` "decimal".
 */
export type Decimal = string;

/**
 * Portable learned knowledge. Must not contain raw transactions, statements, account identifiers, or secrets.
 */
export interface FinancialBrain {
  schemaVersion: "1.0.0";
  brainId: Uuid;
  createdAt: DateTime;
  updatedAt: DateTime;
  producer: {
    application: "Financial Intelligence";
    version: string;
  };
  /**
   * @maxItems 2000
   */
  categories: Category[];
  /**
   * @maxItems 50000
   */
  merchants: Merchant[];
  /**
   * @maxItems 50000
   */
  rules: Rule[];
  /**
   * @maxItems 10000
   */
  recurringDecisions: RecurringDecision[];
  preferences: Preferences;
  extensions?: {
    [k: string]: unknown;
  };
}
export interface Category {
  /**
   * This interface was referenced by `Category`'s JSON-Schema
   * via the `definition` "uuid".
   */
  id: string;
  name: string;
  /**
   * This interface was referenced by `Category`'s JSON-Schema
   * via the `definition` "uuid".
   */
  parentId?: string;
  kind: "income" | "expense" | "transfer" | "other";
  icon?: string;
  color?: string;
  order: number;
  archived: boolean;
  /**
   * This interface was referenced by `Category`'s JSON-Schema
   * via the `definition` "dateTime".
   */
  createdAt: string;
  /**
   * This interface was referenced by `Category`'s JSON-Schema
   * via the `definition` "dateTime".
   */
  updatedAt: string;
}
export interface Merchant {
  /**
   * This interface was referenced by `Merchant`'s JSON-Schema
   * via the `definition` "uuid".
   */
  id: string;
  name: string;
  /**
   * @maxItems 500
   */
  aliases: Alias[];
  websiteDomain?: string;
  /**
   * This interface was referenced by `Merchant`'s JSON-Schema
   * via the `definition` "uuid".
   */
  redirectToId?: string;
  archived: boolean;
  /**
   * This interface was referenced by `Merchant`'s JSON-Schema
   * via the `definition` "dateTime".
   */
  createdAt: string;
  /**
   * This interface was referenced by `Merchant`'s JSON-Schema
   * via the `definition` "dateTime".
   */
  updatedAt: string;
}
/**
 * This interface was referenced by `Merchant`'s JSON-Schema
 * via the `definition` "alias".
 */
export interface Alias {
  /**
   * This interface was referenced by `Merchant`'s JSON-Schema
   * via the `definition` "uuid".
   */
  id: string;
  pattern: string;
  matchMode: "exact" | "tokenPrefix" | "contains";
  normalizerVersion: string;
  /**
   * This interface was referenced by `Merchant`'s JSON-Schema
   * via the `definition` "dateTime".
   */
  createdAt: string;
}
/**
 * This interface was referenced by `FinancialBrain`'s JSON-Schema
 * via the `definition` "rule".
 */
export interface Rule {
  id: Uuid;
  name: string;
  enabled: boolean;
  priority: number;
  /**
   * @minItems 1
   * @maxItems 20
   */
  conditions:
    | [Condition]
    | [Condition, Condition]
    | [Condition, Condition, Condition]
    | [Condition, Condition, Condition, Condition]
    | [Condition, Condition, Condition, Condition, Condition]
    | [Condition, Condition, Condition, Condition, Condition, Condition]
    | [Condition, Condition, Condition, Condition, Condition, Condition, Condition]
    | [Condition, Condition, Condition, Condition, Condition, Condition, Condition, Condition]
    | [
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
      ]
    | [
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
      ]
    | [
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
      ]
    | [
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
      ]
    | [
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
      ]
    | [
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
      ]
    | [
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
      ]
    | [
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
      ]
    | [
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
      ]
    | [
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
      ]
    | [
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
      ]
    | [
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
        Condition,
      ];
  /**
   * @minItems 1
   * @maxItems 20
   */
  actions:
    | [Action]
    | [Action, Action]
    | [Action, Action, Action]
    | [Action, Action, Action, Action]
    | [Action, Action, Action, Action, Action]
    | [Action, Action, Action, Action, Action, Action]
    | [Action, Action, Action, Action, Action, Action, Action]
    | [Action, Action, Action, Action, Action, Action, Action, Action]
    | [Action, Action, Action, Action, Action, Action, Action, Action, Action]
    | [Action, Action, Action, Action, Action, Action, Action, Action, Action, Action]
    | [Action, Action, Action, Action, Action, Action, Action, Action, Action, Action, Action]
    | [
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
      ]
    | [
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
      ]
    | [
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
      ]
    | [
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
      ]
    | [
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
      ]
    | [
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
      ]
    | [
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
      ]
    | [
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
      ]
    | [
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
        Action,
      ];
  createdBy: "user" | "suggestedHeuristic" | "suggestedAi" | "importedBrain";
  createdAt: DateTime;
  updatedAt: DateTime;
}
/**
 * This interface was referenced by `FinancialBrain`'s JSON-Schema
 * via the `definition` "condition".
 */
export interface Condition {
  field:
    | "normalizedDescription"
    | "merchantId"
    | "accountType"
    | "direction"
    | "amount"
    | "categoryId"
    | "tag";
  operator: "equals" | "contains" | "startsWith" | "inRange";
  value:
    | string
    | {
        minimum: Decimal;
        maximum: Decimal;
      };
}
/**
 * This interface was referenced by `FinancialBrain`'s JSON-Schema
 * via the `definition` "action".
 */
export interface Action {
  type: "setMerchant" | "setCategory" | "addTag" | "removeTag" | "markReviewed" | "markIgnored";
  value: string | boolean;
}
/**
 * This interface was referenced by `FinancialBrain`'s JSON-Schema
 * via the `definition` "recurringDecision".
 */
export interface RecurringDecision {
  id: Uuid;
  signature: string;
  merchantId?: Uuid;
  status: "confirmed" | "dismissed" | "muted";
  cadence?: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "irregular";
  updatedAt: DateTime;
}
/**
 * This interface was referenced by `FinancialBrain`'s JSON-Schema
 * via the `definition` "preferences".
 */
export interface Preferences {
  locale: string;
  firstDayOfWeek: "monday" | "sunday" | "saturday";
  reviewConfidenceThreshold: number;
  categoryDisplayOrder?: Uuid[];
}
