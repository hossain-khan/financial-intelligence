/*
 * This file is generated from the canonical JSON Schema in /schemas.
 * Do not edit it directly. Run: pnpm schema:generate
 */

/**
 * This interface was referenced by `Merchant`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * This interface was referenced by `Merchant`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;

export interface Merchant {
  id: Uuid;
  name: string;
  /**
   * @maxItems 500
   */
  aliases: Alias[];
  websiteDomain?: string;
  redirectToId?: Uuid;
  archived: boolean;
  createdAt: DateTime;
  updatedAt: DateTime;
}
/**
 * This interface was referenced by `Merchant`'s JSON-Schema
 * via the `definition` "alias".
 */
export interface Alias {
  id: Uuid;
  pattern: string;
  matchMode: "exact" | "tokenPrefix" | "contains";
  normalizerVersion: string;
  createdAt: DateTime;
}
