import type { ImportIssue } from "@financial-intelligence/import-core";

import type { PdfTextDocument } from "./model";

/**
 * Named fields a layout adapter emits per row. Kept as a stable constant (like the OFX field table)
 * so the parser and the candidate mapper agree on keys without magic strings.
 */
export const PDF_FIELDS = Object.freeze({
  postedDate: "postedDate",
  description: "description",
  amount: "amount",
  currency: "currency",
});

export interface LayoutDetection {
  readonly adapterId: string;
  /** Confidence in [0, 1]. Below the adapter's declared minimum the document is not claimed. */
  readonly score: number;
  readonly reason: string;
}

export interface PdfLayoutRow {
  /** Provenance such as `page:2/items:41-47`, joined with `;` when a row spans continuations. */
  readonly sourceLocation: string;
  /** Canonical `YYYY-MM-DD`. */
  readonly postedDate: string;
  readonly description: string;
  /** Signed decimal string in the account perspective, exactly two fraction digits. */
  readonly amount: string;
  readonly currency?: string;
  readonly original: {
    readonly postedDate: string;
    readonly description: string;
    readonly amount: string;
  };
}

export interface PdfLayoutResult {
  readonly rows: readonly PdfLayoutRow[];
  readonly issues: readonly ImportIssue[];
  readonly detectedMetadata: Readonly<Record<string, string | number | boolean>>;
}

/**
 * A pure adapter over an already-extracted text document. `detect` is cheap and side-effect free;
 * `extract` is only called for the unique winning adapter. Adapters never perform I/O, never render,
 * and never invent a missing date, amount, sign, or description.
 */
export interface PdfStatementLayoutAdapter {
  readonly id: string;
  readonly version: string;
  /** Minimum detection score for this adapter to be eligible to win. */
  readonly minimumScore: number;
  detect(document: PdfTextDocument): LayoutDetection;
  extract(document: PdfTextDocument, signal: AbortSignal): PdfLayoutResult;
}
