export const AI_TASK_IDS = [
  "merchant.resolve.v1",
  "category.classify.v1",
  "query.plan.v1",
  "insight.word.v1",
] as const;

export type AiTaskId = (typeof AI_TASK_IDS)[number];

export interface MerchantResolveRequest {
  readonly tokens: readonly string[];
  readonly countryHint?: string;
  readonly categoryHint?: string;
}
export interface MerchantResolveResponse {
  readonly label: string;
  readonly confidence: number;
  readonly evidence: readonly string[];
}
export interface CategoryClassifyRequest {
  readonly descriptor: string;
  readonly direction: "inflow" | "outflow";
  readonly allowedCategoryIds: readonly string[];
}
export interface CategoryClassifyResponse {
  readonly categoryId: string;
  readonly confidence: number;
  readonly rationale: string;
}

// The minimal disclosure surface each task may carry. Values match the `dataClasses`
// enum in schemas/ai-provider.schema.json so consent UI and payload construction cannot drift.
export const TASK_DATA_CLASSES: Readonly<Record<AiTaskId, readonly string[]>> = {
  "merchant.resolve.v1": ["normalizedDescription"],
  "category.classify.v1": [
    "normalizedDescription",
    "merchantLabel",
    "amountDirection",
    "categoryVocabulary",
  ],
  "query.plan.v1": ["question"],
  "insight.word.v1": ["aggregateFacts"],
};

const MAX_DESCRIPTOR = 200;
const MAX_ALLOWED_CATEGORIES = 200;

export function minimizeCategoryClassify(input: CategoryClassifyRequest): CategoryClassifyRequest {
  return {
    descriptor: input.descriptor.trim().slice(0, MAX_DESCRIPTOR),
    direction: input.direction,
    allowedCategoryIds: [...new Set(input.allowedCategoryIds)].slice(0, MAX_ALLOWED_CATEGORIES),
  };
}
