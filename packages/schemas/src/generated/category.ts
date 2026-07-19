/*
 * This file is generated from the canonical JSON Schema in /schemas.
 * Do not edit it directly. Run: pnpm schema:generate
 */

/**
 * This interface was referenced by `Category`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * This interface was referenced by `Category`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;

export interface Category {
  id: Uuid;
  name: string;
  parentId?: Uuid;
  kind: "income" | "expense" | "transfer" | "other";
  icon?: string;
  color?: string;
  order: number;
  archived: boolean;
  createdAt: DateTime;
  updatedAt: DateTime;
}
