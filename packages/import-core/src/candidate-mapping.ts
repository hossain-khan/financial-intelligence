import type { ImportIssue } from "./index";
import {
  MAPPING_VERSION,
  type CanonicalTransactionCandidate,
  type CsvMappingIssue,
  type CsvMappingResult,
  type MappingPreviewRow,
} from "./mapping";

/**
 * A format-neutral, already-normalized transaction ready for canonical validation. Format
 * adapters (OFX today, potentially others) are responsible for parsing their own dialect into
 * this shape: `postedDate`/`transactionDate` as `YYYY-MM-DD`, `amount` as a signed decimal
 * string in the account perspective, and `original` capturing raw source values for provenance.
 * The shared assembler below then applies the invariants that are identical across formats.
 *
 * This deliberately does not cover CSV column mapping or locale-specific date/number parsing,
 * which remain in `mapping.ts`; only the post-parse validation and result assembly are shared.
 */
export interface CandidateDraft {
  readonly sourceLocation: string;
  readonly postedDate: string;
  readonly transactionDate?: string;
  readonly description: string;
  readonly amount: string;
  readonly currency: string;
  readonly sourceTransactionId?: string;
  readonly status?: "pending" | "posted" | "void";
  readonly original: {
    readonly postedDate: string;
    readonly transactionDate?: string;
    readonly description: string;
    readonly amount: string;
    readonly sourceTransactionId?: string;
    readonly status?: string;
  };
}

export interface CandidateMappingContext {
  readonly accountId: string;
  readonly accountCurrency: string;
  readonly parserId: string;
  readonly parserVersion: string;
  readonly sourceFileSha256: string;
}

const MAX_PROVENANCE_VALUE = 512;
const MAX_ISSUES = 1_000;
const MAX_DESCRIPTION = 1_000;
const MAX_SOURCE_ID = 240;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const AMOUNT_PATTERN = /^-?\d+\.\d{2}$/u;

/**
 * Validate normalized drafts and assemble the same `CsvMappingResult` shape the commit and
 * preview UI already consume. Errors mark a draft invalid (no candidate) without aborting the
 * batch; a file-level configuration error (missing account/currency) short-circuits.
 */
export function buildCandidatesFromDrafts(
  drafts: readonly CandidateDraft[],
  context: CandidateMappingContext,
  parseIssues: readonly ImportIssue[] = [],
): CsvMappingResult {
  const issues: CsvMappingIssue[] = parseIssues.map((issue) => ({ ...issue }));
  const configurationIssues = validateContext(context);
  issues.push(...configurationIssues);

  const candidates: CanonicalTransactionCandidate[] = [];
  const previewRows: MappingPreviewRow[] = [];
  let inflowMinor = 0n;
  let outflowMinor = 0n;
  let invalidRows = 0;

  if (configurationIssues.some((issue) => issue.severity === "error")) {
    return assemble(candidates, issues, previewRows, context.accountCurrency, 0n, 0n, 0);
  }

  for (const draft of drafts) {
    const rowIssues: CsvMappingIssue[] = [];
    validateDate(draft.postedDate, "postedDate", draft.sourceLocation, rowIssues, false);
    if (draft.transactionDate !== undefined) {
      validateDate(draft.transactionDate, "transactionDate", draft.sourceLocation, rowIssues, true);
    }
    validateDescription(draft.description, draft.sourceLocation, rowIssues);
    const amountMinor = validateAmount(draft.amount, draft.sourceLocation, rowIssues);
    validateCurrency(draft.currency, context.accountCurrency, draft.sourceLocation, rowIssues);
    if (
      draft.sourceTransactionId !== undefined &&
      draft.sourceTransactionId.length > MAX_SOURCE_ID
    ) {
      rowIssues.push(
        fieldIssue(
          draft.sourceLocation,
          "sourceTransactionId",
          `Source transaction ID exceeds the ${MAX_SOURCE_ID} character limit`,
          draft.sourceTransactionId,
          "The statement's transaction identifier is unusually long; contact the institution.",
        ),
      );
    }

    issues.push(...rowIssues);
    const hasError = rowIssues.some((issue) => issue.severity === "error");
    if (hasError || amountMinor === undefined) {
      invalidRows += 1;
      previewRows.push({
        sourceLocation: draft.sourceLocation,
        status: "invalid",
        ...(DATE_PATTERN.test(draft.postedDate) ? { postedDate: draft.postedDate } : {}),
        ...(draft.description.length === 0 ? {} : { description: draft.description }),
        ...(amountMinor === undefined ? {} : { amount: draft.amount }),
        ...(draft.currency.length === 0 ? {} : { currency: draft.currency }),
        issueCodes: rowIssues.map((issue) => issue.code),
      });
      continue;
    }

    candidates.push({
      accountId: context.accountId,
      postedDate: draft.postedDate,
      ...(draft.transactionDate === undefined ? {} : { transactionDate: draft.transactionDate }),
      description: draft.description,
      amount: draft.amount,
      currency: draft.currency,
      ...(draft.sourceTransactionId === undefined
        ? {}
        : { sourceTransactionId: draft.sourceTransactionId }),
      ...(draft.status === undefined ? {} : { status: draft.status }),
      provenance: {
        sourceFileSha256: context.sourceFileSha256,
        sourceLocation: draft.sourceLocation,
        parserId: context.parserId,
        parserVersion: context.parserVersion,
        mappingVersion: MAPPING_VERSION,
        original: {
          postedDate: bounded(draft.original.postedDate),
          ...(draft.original.transactionDate === undefined
            ? {}
            : { transactionDate: bounded(draft.original.transactionDate) }),
          description: bounded(draft.original.description),
          amount: bounded(draft.original.amount),
          ...(draft.original.sourceTransactionId === undefined
            ? {}
            : { sourceTransactionId: bounded(draft.original.sourceTransactionId) }),
          ...(draft.original.status === undefined
            ? {}
            : { status: bounded(draft.original.status) }),
        },
      },
    });
    if (amountMinor > 0n) inflowMinor += amountMinor;
    if (amountMinor < 0n) outflowMinor += -amountMinor;
    previewRows.push({
      sourceLocation: draft.sourceLocation,
      status: "valid",
      postedDate: draft.postedDate,
      description: draft.description,
      amount: draft.amount,
      currency: draft.currency,
      issueCodes: rowIssues.map((issue) => issue.code),
    });
  }

  return assemble(
    candidates,
    issues.slice(0, MAX_ISSUES),
    representativePreview(previewRows),
    context.accountCurrency,
    inflowMinor,
    outflowMinor,
    invalidRows,
  );
}

function validateContext(context: CandidateMappingContext): readonly CsvMappingIssue[] {
  const issues: CsvMappingIssue[] = [];
  if (context.accountId.trim().length === 0) {
    issues.push({
      code: "ACCOUNT_REQUIRED",
      severity: "error",
      field: "accountId",
      message: "Choose a target account.",
    });
  }
  if (!/^[A-Z]{3}$/u.test(context.accountCurrency)) {
    issues.push({
      code: "ACCOUNT_CURRENCY_INVALID",
      severity: "error",
      field: "accountCurrency",
      message: "The target account must have a valid currency.",
    });
  }
  return issues;
}

function validateDate(
  value: string,
  field: string,
  location: string,
  issues: CsvMappingIssue[],
  allowEmpty: boolean,
): void {
  if (allowEmpty && value.length === 0) return;
  if (!DATE_PATTERN.test(value) || !isValidCalendarDate(value)) {
    issues.push(
      fieldIssue(
        location,
        field,
        "Date is not a valid calendar date",
        value,
        "Correct the source date.",
      ),
    );
  }
}

function validateDescription(value: string, location: string, issues: CsvMappingIssue[]): void {
  if (value.length === 0) {
    issues.push(
      fieldIssue(
        location,
        "description",
        "A description is required",
        value,
        "Provide a NAME or MEMO.",
      ),
    );
  } else if (value.length > MAX_DESCRIPTION) {
    issues.push(
      fieldIssue(
        location,
        "description",
        `Description exceeds the ${MAX_DESCRIPTION} character limit`,
        value,
        "Shorten the description in the source statement.",
      ),
    );
  }
}

function validateAmount(
  value: string,
  location: string,
  issues: CsvMappingIssue[],
): bigint | undefined {
  if (!AMOUNT_PATTERN.test(value)) {
    issues.push(
      fieldIssue(
        location,
        "amount",
        "Amount is not a valid decimal",
        value,
        "Correct the source amount.",
      ),
    );
    return undefined;
  }
  const negative = value.startsWith("-");
  const [whole = "0", fraction = "00"] = value.replace(/^-/u, "").split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction);
  return negative ? -minor : minor;
}

function validateCurrency(
  currency: string,
  accountCurrency: string,
  location: string,
  issues: CsvMappingIssue[],
): void {
  if (!/^[A-Z]{3}$/u.test(currency)) {
    issues.push(
      fieldIssue(
        location,
        "currency",
        "Currency must be a three-letter uppercase code",
        currency,
        "The statement currency is missing or invalid.",
      ),
    );
  } else if (currency !== accountCurrency) {
    issues.push(
      fieldIssue(
        location,
        "currency",
        `Row currency does not match target account currency ${accountCurrency}`,
        currency,
        "Choose an account with the same currency as the statement.",
      ),
    );
  }
}

function assemble(
  candidates: readonly CanonicalTransactionCandidate[],
  issues: readonly CsvMappingIssue[],
  previewRows: readonly MappingPreviewRow[],
  currency: string,
  inflowMinor: bigint,
  outflowMinor: bigint,
  invalidRows: number,
): CsvMappingResult {
  return {
    candidates,
    issues,
    previewRows,
    totals: {
      currency,
      inflow: minorToDecimal(inflowMinor),
      outflow: minorToDecimal(outflowMinor),
      validRows: candidates.length,
      invalidRows,
    },
    canContinue: invalidRows === 0 && !issues.some((issue) => issue.severity === "error"),
  };
}

function representativePreview(rows: readonly MappingPreviewRow[]): readonly MappingPreviewRow[] {
  if (rows.length <= 20) return rows;
  const chosen: MappingPreviewRow[] = [];
  const add = (row: MappingPreviewRow | undefined): void => {
    if (row !== undefined && !chosen.includes(row)) chosen.push(row);
  };
  add(rows.find((row) => row.status === "invalid"));
  add(rows.find((row) => row.status === "valid" && row.amount?.startsWith("-") === true));
  add(rows.find((row) => row.status === "valid" && row.amount?.startsWith("-") === false));
  for (const row of rows) {
    add(row);
    if (chosen.length === 20) break;
  }
  return chosen;
}

function fieldIssue(
  sourceLocation: string,
  field: string,
  message: string,
  rejected: string,
  correction: string,
): CsvMappingIssue {
  return {
    code: `INVALID_${field.replaceAll(/([a-z])([A-Z])/gu, "$1_$2").toUpperCase()}`,
    severity: "error",
    sourceLocation,
    field,
    message,
    rejectedValueSummary: summarizeRejected(rejected),
    correction,
  };
}

function summarizeRejected(value: string): string {
  const normalized = value.replaceAll(/[\r\n\t]/gu, " ").trim();
  if (normalized.length === 0) return "blank value";
  const visible = normalized.slice(0, 16).replaceAll(/[\p{L}\p{N}]/gu, "•");
  return `${visible}${normalized.length > 16 ? "…" : ""} (${normalized.length} characters)`;
}

function bounded(value: string): string {
  return value.slice(0, MAX_PROVENANCE_VALUE);
}

function isValidCalendarDate(value: string): boolean {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (daysInMonth[month - 1] ?? 0);
}

function minorToDecimal(value: bigint): string {
  const negative = value < 0n;
  const positive = negative ? -value : value;
  return `${negative ? "-" : ""}${positive / 100n}.${String(positive % 100n).padStart(2, "0")}`;
}
