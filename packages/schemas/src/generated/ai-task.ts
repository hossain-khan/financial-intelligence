/*
 * This file is generated from the canonical JSON Schema in /schemas.
 * Do not edit it directly. Run: pnpm schema:generate
 */

export type AITask = {
  [k: string]: unknown;
} & {
  schemaVersion: "1.0.0";
  task: "merchant.resolve.v1" | "category.classify.v1" | "query.plan.v1" | "insight.word.v1";
  direction: "request" | "response";
  payload: {
    [k: string]: unknown;
  };
};
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "confidence".
 */
export type Confidence = number;
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "boundedText".
 */
export type BoundedText = string;
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "evidenceCode".
 */
export type EvidenceCode =
  | "matched_alias"
  | "similar_confirmed_merchant"
  | "model_category_candidate"
  | "insufficient_evidence";
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "categoryId".
 */
export type CategoryId = string;
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "descriptionToken".
 */
export type DescriptionToken = string;

/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "merchantResolveRequest".
 */
export interface MerchantResolveRequest {
  /**
   * @minItems 1
   * @maxItems 32
   */
  tokens: [DescriptionToken, ...DescriptionToken[]];
  countryHint?: string;
  categoryHint?: CategoryId;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "merchantResolveResponse".
 */
export interface MerchantResolveResponse {
  label: BoundedText;
  confidence: Confidence;
  /**
   * @minItems 1
   * @maxItems 8
   */
  evidence:
    | [EvidenceCode]
    | [EvidenceCode, EvidenceCode]
    | [EvidenceCode, EvidenceCode, EvidenceCode]
    | [EvidenceCode, EvidenceCode, EvidenceCode, EvidenceCode]
    | [EvidenceCode, EvidenceCode, EvidenceCode, EvidenceCode, EvidenceCode]
    | [EvidenceCode, EvidenceCode, EvidenceCode, EvidenceCode, EvidenceCode, EvidenceCode]
    | [
        EvidenceCode,
        EvidenceCode,
        EvidenceCode,
        EvidenceCode,
        EvidenceCode,
        EvidenceCode,
        EvidenceCode,
      ]
    | [
        EvidenceCode,
        EvidenceCode,
        EvidenceCode,
        EvidenceCode,
        EvidenceCode,
        EvidenceCode,
        EvidenceCode,
        EvidenceCode,
      ];
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "categoryClassifyRequest".
 */
export interface CategoryClassifyRequest {
  descriptor: BoundedText;
  direction: "inflow" | "outflow";
  /**
   * @minItems 1
   * @maxItems 200
   */
  allowedCategoryIds: [CategoryId, ...CategoryId[]];
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "categoryClassifyResponse".
 */
export interface CategoryClassifyResponse {
  categoryId: CategoryId;
  confidence: Confidence;
  rationale: BoundedText;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "queryPlanRequest".
 */
export interface QueryPlanRequest {
  question: string;
  /**
   * @minItems 1
   * @maxItems 32
   */
  metrics: [BoundedText, ...BoundedText[]];
  /**
   * @maxItems 32
   */
  dimensions: BoundedText[];
  dateRange?: {
    from: string;
    to: string;
  };
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "queryPlanResponse".
 */
export interface QueryPlanResponse {
  metric: BoundedText;
  /**
   * @maxItems 8
   */
  dimensions:
    | []
    | [BoundedText]
    | [BoundedText, BoundedText]
    | [BoundedText, BoundedText, BoundedText]
    | [BoundedText, BoundedText, BoundedText, BoundedText]
    | [BoundedText, BoundedText, BoundedText, BoundedText, BoundedText]
    | [BoundedText, BoundedText, BoundedText, BoundedText, BoundedText, BoundedText]
    | [BoundedText, BoundedText, BoundedText, BoundedText, BoundedText, BoundedText, BoundedText]
    | [
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
      ];
  /**
   * @maxItems 16
   */
  filters?:
    | []
    | [BoundedText]
    | [BoundedText, BoundedText]
    | [BoundedText, BoundedText, BoundedText]
    | [BoundedText, BoundedText, BoundedText, BoundedText]
    | [BoundedText, BoundedText, BoundedText, BoundedText, BoundedText]
    | [BoundedText, BoundedText, BoundedText, BoundedText, BoundedText, BoundedText]
    | [BoundedText, BoundedText, BoundedText, BoundedText, BoundedText, BoundedText, BoundedText]
    | [
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
      ]
    | [
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
      ]
    | [
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
      ]
    | [
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
      ]
    | [
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
      ]
    | [
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
      ]
    | [
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
      ]
    | [
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
      ]
    | [
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
        BoundedText,
      ];
  period?: BoundedText;
  comparison?: BoundedText;
  sort?: BoundedText;
  limit?: number;
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "insightWordRequest".
 */
export interface InsightWordRequest {
  /**
   * @minItems 1
   * @maxItems 32
   */
  facts: [
    {
      id: BoundedText;
      value: BoundedText;
    },
    ...{
      id: BoundedText;
      value: BoundedText;
    }[],
  ];
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "insightWordResponse".
 */
export interface InsightWordResponse {
  summary: string;
  /**
   * @minItems 1
   * @maxItems 32
   */
  factRefs: [BoundedText, ...BoundedText[]];
}
