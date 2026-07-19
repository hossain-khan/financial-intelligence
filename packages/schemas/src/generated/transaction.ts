/*
 * This file is generated from the canonical JSON Schema in /schemas.
 * Do not edit it directly. Run: pnpm schema:generate
 */

/**
 * This interface was referenced by `CanonicalTransaction`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * This interface was referenced by `CanonicalTransaction`'s JSON-Schema
 * via the `definition` "date".
 */
export type Date = string;
/**
 * This interface was referenced by `CanonicalTransaction`'s JSON-Schema
 * via the `definition` "decimal".
 */
export type Decimal = string;
/**
 * This interface was referenced by `CanonicalTransaction`'s JSON-Schema
 * via the `definition` "currency".
 */
export type Currency = string;
/**
 * This interface was referenced by `CanonicalTransaction`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;

export interface CanonicalTransaction {
  schemaVersion: "1.0.0";
  id: Uuid;
  accountId: Uuid;
  importId: Uuid;
  postedDate: Date;
  transactionDate?: Date;
  amount: Decimal;
  currency: Currency;
  description: string;
  sourceTransactionId?: string;
  merchantId?: Uuid;
  categoryId?: Uuid;
  /**
   * @maxItems 50
   */
  tags: string[];
  notes?: string;
  status: "pending" | "posted" | "void";
  reviewState: "unreviewed" | "needsReview" | "reviewed";
  transferLinkId?: Uuid;
  classifications: {
    merchant?: Classification;
    category?: Classification;
  };
  provenance: Provenance;
  createdAt: DateTime;
  updatedAt: DateTime;
}
/**
 * This interface was referenced by `CanonicalTransaction`'s JSON-Schema
 * via the `definition` "classification".
 */
export interface Classification {
  method: "user" | "imported" | "rule" | "merchantMapping" | "heuristic" | "localAi" | "remoteAi";
  classifierId: string;
  classifierVersion: string;
  confidence?: number;
  /**
   * @maxItems 20
   */
  evidence:
    | []
    | [string]
    | [string, string]
    | [string, string, string]
    | [string, string, string, string]
    | [string, string, string, string, string]
    | [string, string, string, string, string, string]
    | [string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string]
    | [string, string, string, string, string, string, string, string, string, string, string]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ]
    | [
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
        string,
      ];
  locked: boolean;
  decidedAt: DateTime;
}
/**
 * This interface was referenced by `CanonicalTransaction`'s JSON-Schema
 * via the `definition` "provenance".
 */
export interface Provenance {
  parserId: string;
  parserVersion: string;
  sourceLocation: string;
  original: {
    [k: string]: string | number | boolean | null;
  };
  /**
   * @maxItems 30
   */
  transformations?: string[];
}
