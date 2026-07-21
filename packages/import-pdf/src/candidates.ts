import type {
  CandidateDraft,
  CandidateMappingContext,
  CsvMappingResult,
  ParseStatementResult,
  SourceRow,
} from "@financial-intelligence/import-core";
import { buildCandidatesFromDrafts } from "@financial-intelligence/import-core";

import { PDF_FIELDS } from "./layout";

export interface PdfMappingContext {
  readonly accountId: string;
  readonly accountCurrency: string;
  readonly sourceFileSha256: string;
}

/**
 * Map a PDF parse result into canonical candidates. Like OFX, PDF rows are already normalized
 * (canonical dates, signed decimal amounts, extracted descriptions), so there is no column mapping
 * — only the account/currency context the user confirms plus the shared candidate validation. A
 * row without a detected currency falls back to the confirmed account currency, matching the OFX
 * adapter, so the shared validator still enforces the currency-match invariant.
 */
export function mapPdfResult(
  result: ParseStatementResult,
  context: PdfMappingContext,
): CsvMappingResult {
  const drafts = result.rows.map((row) => toDraft(row, context.accountCurrency));
  const mappingContext: CandidateMappingContext = {
    accountId: context.accountId,
    accountCurrency: context.accountCurrency,
    parserId: result.parserId,
    parserVersion: result.parserVersion,
    sourceFileSha256: context.sourceFileSha256,
  };
  return buildCandidatesFromDrafts(drafts, mappingContext, result.issues);
}

function toDraft(row: SourceRow, accountCurrency: string): CandidateDraft {
  const fields = row.fields;
  const postedDate = fields[PDF_FIELDS.postedDate] ?? "";
  const description = fields[PDF_FIELDS.description] ?? "";
  const amount = fields[PDF_FIELDS.amount] ?? "";
  const currency = fields[PDF_FIELDS.currency] ?? accountCurrency;

  return {
    sourceLocation: row.sourceLocation,
    postedDate,
    description,
    amount,
    currency,
    original: {
      postedDate,
      description,
      amount,
    },
  };
}
