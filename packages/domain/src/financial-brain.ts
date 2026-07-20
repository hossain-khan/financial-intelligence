import type { Category } from "./category";
import type { ClassificationRule } from "./classification-rule";
import type { BrainId, CategoryId, MerchantId } from "./identifiers";
import { parseBrainId, parseCategoryId, parseMerchantId } from "./identifiers";
import type { Merchant } from "./merchant";
import type { UtcTimestamp } from "./temporal";
import { parseUtcTimestamp } from "./temporal";

export const FINANCIAL_BRAIN_SCHEMA_VERSION = "1.0.0" as const;
export const MAX_BRAIN_FILE_BYTES = 10 * 1024 * 1024; // 10 MB limit

export interface FinancialBrainPreferences {
  readonly locale: string;
  readonly firstDayOfWeek: "monday" | "sunday" | "saturday";
  readonly reviewConfidenceThreshold: number;
  readonly categoryDisplayOrder?: readonly CategoryId[];
}

export interface RecurringDecisionRecord {
  readonly id: string;
  readonly signature: string;
  readonly merchantId?: MerchantId;
  readonly status: "confirmed" | "dismissed" | "muted";
  readonly cadence?: "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "irregular";
  readonly updatedAt: UtcTimestamp;
}

export interface FinancialBrainDocument {
  readonly schemaVersion: typeof FINANCIAL_BRAIN_SCHEMA_VERSION;
  readonly brainId: BrainId;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly producer: {
    readonly application: "Financial Intelligence";
    readonly version: string;
  };
  readonly categories: readonly Category[];
  readonly merchants: readonly Merchant[];
  readonly rules: readonly ClassificationRule[];
  readonly recurringDecisions: readonly RecurringDecisionRecord[];
  readonly preferences: FinancialBrainPreferences;
  readonly extensions?: Readonly<Record<string, unknown>>;
}

export interface BrainConflictItem<T> {
  readonly id: string;
  readonly kind: "category" | "merchant" | "rule" | "recurringDecision";
  readonly local: T;
  readonly incoming: T;
  readonly reason: string;
}

export interface SemanticDuplicateItem<T> {
  readonly localId: string;
  readonly incomingId: string;
  readonly kind: "category" | "merchant" | "rule";
  readonly local: T;
  readonly incoming: T;
  readonly reason: string;
}

export interface BrainImportPlan {
  readonly additions: {
    readonly categories: readonly Category[];
    readonly merchants: readonly Merchant[];
    readonly rules: readonly ClassificationRule[];
    readonly recurringDecisions: readonly RecurringDecisionRecord[];
  };
  readonly updates: {
    readonly categories: readonly Category[];
    readonly merchants: readonly Merchant[];
    readonly rules: readonly ClassificationRule[];
    readonly recurringDecisions: readonly RecurringDecisionRecord[];
  };
  readonly unchangedCount: number;
  readonly conflicts: readonly BrainConflictItem<unknown>[];
  readonly semanticDuplicates: readonly SemanticDuplicateItem<unknown>[];
}

/**
 * Serializes a FinancialBrainDocument into a canonical, byte-for-byte stable UTF-8 JSON string.
 * All object keys are sorted alphabetically, arrays are sorted by stable ID, and output ends with a single newline.
 */
export function serializeFinancialBrain(doc: FinancialBrainDocument): string {
  const sortedCategories = [...doc.categories].sort((a, b) => a.id.localeCompare(b.id));
  const sortedMerchants = [...doc.merchants].sort((a, b) => a.id.localeCompare(b.id));
  const sortedRules = [...doc.rules].sort((a, b) => a.id.localeCompare(b.id));
  const sortedRecurring = [...doc.recurringDecisions].sort((a, b) => a.id.localeCompare(b.id));

  const canonicalObj = {
    schemaVersion: doc.schemaVersion,
    brainId: doc.brainId,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    producer: {
      application: doc.producer.application,
      version: doc.producer.version,
    },
    categories: sortedCategories,
    merchants: sortedMerchants,
    rules: sortedRules,
    recurringDecisions: sortedRecurring,
    preferences: doc.preferences,
    ...(doc.extensions === undefined ? {} : { extensions: doc.extensions }),
  };

  return JSON.stringify(canonicalObj, null, 2) + "\n";
}

export interface FinancialBrainValidatorResult {
  readonly valid: boolean;
  readonly errors: readonly { readonly instancePath: string; readonly message: string }[];
}

export type FinancialBrainValidator = (value: unknown) => FinancialBrainValidatorResult;

/**
 * Parses and validates raw Financial Brain JSON input against JSON Schema and domain constraints.
 */
export function parseAndValidateFinancialBrain(
  rawJson: string,
  validator?: FinancialBrainValidator,
): FinancialBrainDocument {
  const encoder = new (
    globalThis as unknown as { TextEncoder: new () => { encode(s: string): Uint8Array } }
  ).TextEncoder();
  const byteLength = encoder.encode(rawJson).length;
  if (byteLength > MAX_BRAIN_FILE_BYTES) {
    throw new RangeError(
      `Financial Brain payload exceeds maximum size limit of ${MAX_BRAIN_FILE_BYTES} bytes`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new TypeError("Invalid JSON format in Financial Brain payload");
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new TypeError("Financial Brain payload must be a JSON object");
  }

  // Check prohibited fields
  const obj = parsed as Record<string, unknown>;
  const prohibitedKeys = [
    "transactions",
    "accounts",
    "imports",
    "statements",
    "secrets",
    "apiKeys",
    "balances",
  ];
  for (const prohibited of prohibitedKeys) {
    if (prohibited in obj) {
      throw new Error(`Financial Brain export contains prohibited sensitive field '${prohibited}'`);
    }
  }

  if (validator !== undefined) {
    const validation = validator(parsed);
    if (!validation.valid) {
      const errorDetails = validation.errors
        .map((e) => `${e.instancePath} ${e.message}`)
        .join("; ");
      throw new Error(`Financial Brain schema validation failed: ${errorDetails}`);
    }
  }

  // Map to FinancialBrainDocument domain representation
  const brainDoc = parsed as unknown as FinancialBrainDocument;

  // Verify unique IDs and domain cross-references
  const categoryIds = new Set(brainDoc.categories.map((c) => c.id));
  if (categoryIds.size !== brainDoc.categories.length) {
    throw new Error("Duplicate category ID found in Financial Brain payload");
  }

  for (const category of brainDoc.categories) {
    if (category.parentId !== undefined && !categoryIds.has(category.parentId)) {
      throw new Error(
        `Category '${category.name}' references non-existent parent category ID '${category.parentId}'`,
      );
    }
  }

  const merchantIds = new Set(brainDoc.merchants.map((m) => m.id));
  if (merchantIds.size !== brainDoc.merchants.length) {
    throw new Error("Duplicate merchant ID found in Financial Brain payload");
  }

  for (const merchant of brainDoc.merchants) {
    if (merchant.redirectToId !== undefined && !merchantIds.has(merchant.redirectToId)) {
      throw new Error(
        `Merchant '${merchant.name}' references non-existent redirect merchant ID '${merchant.redirectToId}'`,
      );
    }
  }

  const ruleIds = new Set(brainDoc.rules.map((r) => r.id));
  if (ruleIds.size !== brainDoc.rules.length) {
    throw new Error("Duplicate classification rule ID found in Financial Brain payload");
  }

  return {
    ...brainDoc,
    brainId: parseBrainId(brainDoc.brainId),
    createdAt: parseUtcTimestamp(brainDoc.createdAt),
    updatedAt: parseUtcTimestamp(brainDoc.updatedAt),
    categories: brainDoc.categories.map((c) => ({
      ...c,
      id: parseCategoryId(c.id),
      ...(c.parentId === undefined ? {} : { parentId: parseCategoryId(c.parentId) }),
      createdAt: parseUtcTimestamp(c.createdAt),
      updatedAt: parseUtcTimestamp(c.updatedAt),
    })),
    merchants: brainDoc.merchants.map((m) => ({
      ...m,
      id: parseMerchantId(m.id),
      ...(m.redirectToId === undefined ? {} : { redirectToId: parseMerchantId(m.redirectToId) }),
      createdAt: parseUtcTimestamp(m.createdAt),
      updatedAt: parseUtcTimestamp(m.updatedAt),
    })),
  };
}

/**
 * Pure diff and merge planner for merging incoming Financial Brain data into local workspace state.
 */
export function planFinancialBrainMerge(
  local: {
    categories: readonly Category[];
    merchants: readonly Merchant[];
    rules: readonly ClassificationRule[];
    recurringDecisions: readonly RecurringDecisionRecord[];
  },
  incoming: {
    categories: readonly Category[];
    merchants: readonly Merchant[];
    rules: readonly ClassificationRule[];
    recurringDecisions: readonly RecurringDecisionRecord[];
  },
): BrainImportPlan {
  const localCategoriesById = new Map(local.categories.map((c) => [c.id, c]));
  const localMerchantsById = new Map(local.merchants.map((m) => [m.id, m]));
  const localRulesById = new Map(local.rules.map((r) => [r.id, r]));
  const localRecurringById = new Map(local.recurringDecisions.map((rd) => [rd.id, rd]));

  const additionsCategories: Category[] = [];
  const updatesCategories: Category[] = [];
  const conflicts: BrainConflictItem<unknown>[] = [];
  const semanticDuplicates: SemanticDuplicateItem<unknown>[] = [];
  let unchangedCount = 0;

  // Categories
  for (const incCat of incoming.categories) {
    const locCat = localCategoriesById.get(incCat.id);
    if (locCat === undefined) {
      // Check semantic duplicate by name + kind
      const semDup = local.categories.find(
        (c) =>
          c.name.toLowerCase() === incCat.name.toLowerCase() &&
          c.kind === incCat.kind &&
          c.id !== incCat.id,
      );
      if (semDup !== undefined) {
        semanticDuplicates.push({
          localId: semDup.id,
          incomingId: incCat.id,
          kind: "category",
          local: semDup,
          incoming: incCat,
          reason: `Category '${incCat.name}' matches local category '${semDup.name}' with different ID`,
        });
      }
      additionsCategories.push(incCat);
    } else if (JSON.stringify(locCat) === JSON.stringify(incCat)) {
      unchangedCount++;
    } else if (locCat.kind !== incCat.kind || locCat.parentId !== incCat.parentId) {
      conflicts.push({
        id: incCat.id,
        kind: "category",
        local: locCat,
        incoming: incCat,
        reason: `Incompatible category change for '${incCat.name}': local kind ${locCat.kind} vs incoming kind ${incCat.kind}`,
      });
    } else {
      updatesCategories.push(incCat);
    }
  }

  // Merchants
  const additionsMerchants: Merchant[] = [];
  const updatesMerchants: Merchant[] = [];

  for (const incMerch of incoming.merchants) {
    const locMerch = localMerchantsById.get(incMerch.id);
    if (locMerch === undefined) {
      const semDup = local.merchants.find(
        (m) => m.name.toLowerCase() === incMerch.name.toLowerCase() && m.id !== incMerch.id,
      );
      if (semDup !== undefined) {
        semanticDuplicates.push({
          localId: semDup.id,
          incomingId: incMerch.id,
          kind: "merchant",
          local: semDup,
          incoming: incMerch,
          reason: `Merchant '${incMerch.name}' matches local merchant '${semDup.name}'`,
        });
      }
      additionsMerchants.push(incMerch);
    } else if (JSON.stringify(locMerch) === JSON.stringify(incMerch)) {
      unchangedCount++;
    } else if (locMerch.redirectToId !== incMerch.redirectToId) {
      conflicts.push({
        id: incMerch.id,
        kind: "merchant",
        local: locMerch,
        incoming: incMerch,
        reason: `Conflicting redirect for merchant '${incMerch.name}'`,
      });
    } else {
      updatesMerchants.push(incMerch);
    }
  }

  // Rules
  const additionsRules: ClassificationRule[] = [];
  const updatesRules: ClassificationRule[] = [];

  for (const incRule of incoming.rules) {
    const locRule = localRulesById.get(incRule.id);
    if (locRule === undefined) {
      additionsRules.push(incRule);
    } else if (JSON.stringify(locRule) === JSON.stringify(incRule)) {
      unchangedCount++;
    } else {
      updatesRules.push(incRule);
    }
  }

  // Recurring Decisions
  const additionsRecurring: RecurringDecisionRecord[] = [];
  const updatesRecurring: RecurringDecisionRecord[] = [];

  for (const incRec of incoming.recurringDecisions) {
    const locRec = localRecurringById.get(incRec.id);
    if (locRec === undefined) {
      additionsRecurring.push(incRec);
    } else if (JSON.stringify(locRec) === JSON.stringify(incRec)) {
      unchangedCount++;
    } else {
      updatesRecurring.push(incRec);
    }
  }

  return {
    additions: {
      categories: additionsCategories,
      merchants: additionsMerchants,
      rules: additionsRules,
      recurringDecisions: additionsRecurring,
    },
    updates: {
      categories: updatesCategories,
      merchants: updatesMerchants,
      rules: updatesRules,
      recurringDecisions: updatesRecurring,
    },
    unchangedCount,
    conflicts,
    semanticDuplicates,
  };
}
