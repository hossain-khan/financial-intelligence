/*
 * This file is generated from the canonical JSON Schema in /schemas.
 * Do not edit it directly. Run: pnpm schema:generate
 */

export type AIProviderProfile = {
  [k: string]: unknown;
} & {
  schemaVersion: "1.0.0";
  id: Uuid;
  name: string;
  kind: "none" | "browserLocal" | "selfHosted" | "remote";
  enabled: boolean;
  adapterId?: string;
  adapterVersion?: string;
  endpointOrigin?: string;
  model?: string;
  tasks: ("merchant.resolve.v1" | "category.classify.v1" | "query.plan.v1" | "insight.word.v1")[];
  secretRef?: string;
  consent?: Consent;
  localModel?: LocalModel;
  createdAt: DateTime;
  updatedAt: DateTime;
};
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;

/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "consent".
 */
export interface Consent {
  disclosureVersion: string;
  grantedAt: DateTime;
  dataClasses: (
    | "normalizedDescription"
    | "merchantLabel"
    | "amountDirection"
    | "amountBucket"
    | "categoryVocabulary"
    | "question"
    | "aggregateFacts"
  )[];
}
/**
 * This interface was referenced by `undefined`'s JSON-Schema
 * via the `definition` "localModel".
 */
export interface LocalModel {
  source: string;
  revision: string;
  sha256: string;
  byteSize: number;
  license: string;
}
