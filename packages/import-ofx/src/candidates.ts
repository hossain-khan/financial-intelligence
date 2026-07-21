import type {
  CandidateDraft,
  CandidateMappingContext,
  CsvMappingResult,
  ParseStatementResult,
  SourceRow,
} from "@financial-intelligence/import-core";
import { buildCandidatesFromDrafts } from "@financial-intelligence/import-core";

import { OFX_FIELDS } from "./extract";

export interface OfxMappingContext {
  readonly accountId: string;
  readonly accountCurrency: string;
  readonly sourceFileSha256: string;
}

/**
 * Map an OFX parse result into canonical candidates. Unlike CSV, OFX rows are already normalized
 * (canonical dates, signed decimal amounts, built descriptions), so there is no column mapping —
 * only the account/currency context the user confirms plus the shared candidate validation.
 *
 * The statement currency (`CURDEF`) is compared against the target account currency by the shared
 * assembler; a mismatch surfaces as a per-row error rather than a silent conversion.
 */
export function mapOfxResult(
  result: ParseStatementResult,
  context: OfxMappingContext,
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
  const postedDate = fields[OFX_FIELDS.postedDate] ?? "";
  const transactionDate = fields[OFX_FIELDS.userDate];
  const description = fields[OFX_FIELDS.description] ?? "";
  const amount = fields[OFX_FIELDS.amount] ?? "";
  // OFX statements carry a single CURDEF per statement; when a row omits it we fall back to the
  // confirmed account currency so the shared validator can still enforce the match invariant.
  const currency = fields[OFX_FIELDS.currency] ?? accountCurrency;
  const sourceTransactionId = fields[OFX_FIELDS.sourceTransactionId];

  return {
    sourceLocation: row.sourceLocation,
    postedDate,
    ...(transactionDate === undefined ? {} : { transactionDate }),
    description,
    amount,
    currency,
    ...(sourceTransactionId === undefined ? {} : { sourceTransactionId }),
    original: {
      postedDate,
      ...(transactionDate === undefined ? {} : { transactionDate }),
      description,
      amount,
      ...(sourceTransactionId === undefined ? {} : { sourceTransactionId }),
    },
  };
}
