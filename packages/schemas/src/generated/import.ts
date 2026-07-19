/*
 * This file is generated from the canonical JSON Schema in /schemas.
 * Do not edit it directly. Run: pnpm schema:generate
 */

/**
 * This interface was referenced by `StatementImport`'s JSON-Schema
 * via the `definition` "uuid".
 */
export type Uuid = string;
/**
 * This interface was referenced by `StatementImport`'s JSON-Schema
 * via the `definition` "dateTime".
 */
export type DateTime = string;

export interface StatementImport {
  schemaVersion: "1.0.0";
  id: Uuid;
  accountId: Uuid;
  source: Source;
  parser: Parser;
  status: "staged" | "ready" | "committing" | "committed" | "failed" | "cancelled" | "deleted";
  mapping: {
    [k: string]: string | number | boolean | null;
  };
  counts: Counts;
  /**
   * @maxItems 10000
   */
  issues: Issue[];
  committedRevision?: number;
  createdAt: DateTime;
  updatedAt: DateTime;
  committedAt?: DateTime;
}
/**
 * This interface was referenced by `StatementImport`'s JSON-Schema
 * via the `definition` "source".
 */
export interface Source {
  fileName: string;
  mediaType: string;
  byteSize: number;
  sha256: string;
  retained: boolean;
}
/**
 * This interface was referenced by `StatementImport`'s JSON-Schema
 * via the `definition` "parser".
 */
export interface Parser {
  id: string;
  version: string;
}
/**
 * This interface was referenced by `StatementImport`'s JSON-Schema
 * via the `definition` "counts".
 */
export interface Counts {
  sourceRows: number;
  valid: number;
  errors: number;
  warnings: number;
  exactDuplicates: number;
  likelyDuplicates: number;
  committed: number;
}
/**
 * This interface was referenced by `StatementImport`'s JSON-Schema
 * via the `definition` "issue".
 */
export interface Issue {
  code: string;
  severity: "error" | "warning" | "information";
  sourceLocation?: string;
  field?: string;
  message: string;
}
