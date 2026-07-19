import type { ImportIssue, SourceFileMetadata, SourceRow } from "./index";

export const MAPPING_VERSION = "1.0.0";

export type DateFormat = "YYYY-MM-DD" | "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY/MM/DD";

export interface NumberFormat {
  readonly decimalSeparator: "." | ",";
  readonly groupSeparator: "," | "." | "space" | "none";
}

export type AmountMapping =
  | {
      readonly kind: "signed";
      readonly column: string;
      readonly positiveDirection: "inflow" | "outflow";
    }
  | {
      readonly kind: "debit-credit";
      readonly debitColumn: string;
      readonly creditColumn: string;
      readonly debitDirection: "outflow" | "inflow";
    };

export interface CsvMapping {
  readonly accountId: string;
  readonly accountCurrency: string;
  readonly postedDateColumn: string;
  readonly transactionDateColumn?: string;
  readonly descriptionColumn: string;
  readonly amount: AmountMapping;
  readonly currencyColumn?: string;
  readonly sourceTransactionIdColumn?: string;
  readonly statusColumn?: string;
  readonly ignoredColumns: readonly string[];
  readonly dateFormat: DateFormat;
  readonly numberFormat: NumberFormat;
}

export interface CsvMappingSource {
  readonly metadata: SourceFileMetadata;
  readonly parserId: string;
  readonly parserVersion: string;
  readonly rows: readonly SourceRow[];
  readonly issues: readonly ImportIssue[];
}

export interface CandidateProvenance {
  readonly sourceFileSha256: string;
  readonly sourceLocation: string;
  readonly parserId: string;
  readonly parserVersion: string;
  readonly mappingVersion: string;
  readonly original: {
    readonly postedDate: string;
    readonly transactionDate?: string;
    readonly description: string;
    readonly amount: string;
    readonly sourceTransactionId?: string;
    readonly status?: string;
  };
}

export interface CanonicalTransactionCandidate {
  readonly accountId: string;
  readonly postedDate: string;
  readonly transactionDate?: string;
  readonly description: string;
  readonly amount: string;
  readonly currency: string;
  readonly sourceTransactionId?: string;
  readonly status?: "pending" | "posted" | "void";
  readonly provenance: CandidateProvenance;
}

export interface CsvMappingIssue extends ImportIssue {
  readonly rejectedValueSummary?: string;
  readonly correction?: string;
}

export interface MappingPreviewRow {
  readonly sourceLocation: string;
  readonly status: "valid" | "invalid";
  readonly postedDate?: string;
  readonly description?: string;
  readonly amount?: string;
  readonly currency?: string;
  readonly issueCodes: readonly string[];
}

export interface CsvMappingResult {
  readonly candidates: readonly CanonicalTransactionCandidate[];
  readonly issues: readonly CsvMappingIssue[];
  readonly previewRows: readonly MappingPreviewRow[];
  readonly totals: {
    readonly currency: string;
    readonly inflow: string;
    readonly outflow: string;
    readonly validRows: number;
    readonly invalidRows: number;
  };
  readonly canContinue: boolean;
}

export interface MappingPreset {
  readonly schemaVersion: 1;
  readonly mappingVersion: string;
  readonly parserId: string;
  readonly parserVersion: string;
  readonly formatSignature: string;
  readonly mapping: Omit<CsvMapping, "accountId" | "accountCurrency">;
  readonly confirmedAt: string;
}

const MAX_PROVENANCE_VALUE = 512;
const MAX_ISSUES = 1_000;

export function mapCsvSources(
  sources: readonly CsvMappingSource[],
  mapping: CsvMapping,
): CsvMappingResult {
  const configurationIssues = validateMapping(sources, mapping);
  const candidates: CanonicalTransactionCandidate[] = [];
  const issues: CsvMappingIssue[] = [
    ...sources.flatMap((source, sourceIndex) =>
      source.issues.map((issue) =>
        toMappingIssue(issue, sources.length === 1 ? undefined : sourceIndex + 1),
      ),
    ),
    ...configurationIssues,
  ];
  const previewRows: MappingPreviewRow[] = [];
  let inflowMinor = 0n;
  let outflowMinor = 0n;
  let invalidRows = 0;

  if (configurationIssues.some((issue) => issue.severity === "error")) {
    return result(candidates, issues, previewRows, mapping.accountCurrency, 0n, 0n, 0);
  }

  for (const [sourceIndex, source] of sources.entries()) {
    for (const row of source.rows) {
      const sourceLocation =
        sources.length === 1
          ? row.sourceLocation
          : `source:${sourceIndex + 1}/${row.sourceLocation}`;
      const rowIssues: CsvMappingIssue[] = [];
      const postedDate = parseMappedDate(
        row.fields[mapping.postedDateColumn],
        mapping.dateFormat,
        "postedDate",
        sourceLocation,
        rowIssues,
      );
      const transactionDate = mapping.transactionDateColumn
        ? parseMappedDate(
            row.fields[mapping.transactionDateColumn],
            mapping.dateFormat,
            "transactionDate",
            sourceLocation,
            rowIssues,
            true,
          )
        : undefined;
      const originalDescription = row.fields[mapping.descriptionColumn] ?? "";
      const description = normalizeDescription(originalDescription);
      if (description.length === 0) {
        rowIssues.push(
          fieldIssue(
            sourceLocation,
            "description",
            "A description is required",
            originalDescription,
            "Map a populated description column or correct the source row.",
          ),
        );
      } else if (description.length > 1_000) {
        rowIssues.push(
          fieldIssue(
            sourceLocation,
            "description",
            "Description exceeds the 1,000 character limit",
            originalDescription,
            "Shorten the description in the source row before importing.",
          ),
        );
      }
      const amountResult = parseMappedAmount(row, sourceLocation, mapping, rowIssues);
      const currency = normalizeCurrency(
        mapping.currencyColumn ? row.fields[mapping.currencyColumn] : mapping.accountCurrency,
      );
      if (!/^[A-Z]{3}$/u.test(currency)) {
        rowIssues.push(
          fieldIssue(
            sourceLocation,
            "currency",
            "Currency must be a three-letter uppercase code",
            currency,
            "Choose the account currency or map a valid ISO currency column.",
          ),
        );
      } else if (currency !== mapping.accountCurrency) {
        rowIssues.push(
          fieldIssue(
            sourceLocation,
            "currency",
            `Row currency does not match target account currency ${mapping.accountCurrency}`,
            currency,
            "Choose an account with the same currency or correct the mapped currency.",
          ),
        );
      }
      const sourceTransactionId = optionalValue(mapping.sourceTransactionIdColumn, row);
      if (sourceTransactionId !== undefined && sourceTransactionId.length > 240) {
        rowIssues.push(
          fieldIssue(
            sourceLocation,
            "sourceTransactionId",
            "Source transaction ID exceeds the 240 character limit",
            sourceTransactionId,
            "Choose the correct ID column or shorten the source identifier.",
          ),
        );
      }
      const originalStatus = optionalValue(mapping.statusColumn, row);
      const status = originalStatus?.toLowerCase();
      if (status !== undefined && !isTransactionStatus(status)) {
        rowIssues.push(
          fieldIssue(
            sourceLocation,
            "status",
            "Status must be pending, posted, or void",
            status,
            "Correct the status value or leave the status column unmapped.",
          ),
        );
      }

      const rowErrors = rowIssues.filter((issue) => issue.severity === "error");
      issues.push(...rowIssues);
      if (
        postedDate === undefined ||
        description.length === 0 ||
        amountResult === undefined ||
        rowErrors.length > 0
      ) {
        invalidRows += 1;
        previewRows.push({
          sourceLocation,
          status: "invalid",
          ...(postedDate === undefined ? {} : { postedDate }),
          ...(description.length === 0 ? {} : { description }),
          ...(amountResult === undefined
            ? {}
            : { amount: minorToDecimal(amountResult.signedMinor) }),
          ...(currency.length === 0 ? {} : { currency }),
          issueCodes: rowIssues.map((issue) => issue.code),
        });
        continue;
      }

      const amount = minorToDecimal(amountResult.signedMinor);
      const candidate: CanonicalTransactionCandidate = {
        accountId: mapping.accountId,
        postedDate,
        ...(transactionDate === undefined ? {} : { transactionDate }),
        description,
        amount,
        currency,
        ...(sourceTransactionId === undefined ? {} : { sourceTransactionId }),
        ...(status === undefined ? {} : { status: status as "pending" | "posted" | "void" }),
        provenance: {
          sourceFileSha256: source.metadata.sha256,
          sourceLocation,
          parserId: source.parserId,
          parserVersion: source.parserVersion,
          mappingVersion: MAPPING_VERSION,
          original: {
            postedDate: bounded(row.fields[mapping.postedDateColumn] ?? ""),
            ...(mapping.transactionDateColumn === undefined
              ? {}
              : { transactionDate: bounded(row.fields[mapping.transactionDateColumn] ?? "") }),
            description: bounded(originalDescription),
            amount: bounded(amountResult.original),
            ...(sourceTransactionId === undefined
              ? {}
              : { sourceTransactionId: bounded(sourceTransactionId) }),
            ...(originalStatus === undefined ? {} : { status: bounded(originalStatus) }),
          },
        },
      };
      candidates.push(candidate);
      if (amountResult.signedMinor > 0n) inflowMinor += amountResult.signedMinor;
      if (amountResult.signedMinor < 0n) outflowMinor += -amountResult.signedMinor;
      previewRows.push({
        sourceLocation,
        status: "valid",
        postedDate,
        description,
        amount,
        currency,
        issueCodes: rowIssues.map((issue) => issue.code),
      });
    }
  }

  return result(
    candidates,
    issues.slice(0, MAX_ISSUES),
    representativePreview(previewRows),
    mapping.accountCurrency,
    inflowMinor,
    outflowMinor,
    invalidRows,
  );
}

export function createFormatSignature(
  headers: readonly string[],
  parserId: string,
  parserVersion: string,
): string {
  const normalized = `${parserId}\u0000${parserVersion}\u0000${headers.map((header) => header.normalize("NFKC").trim().toLowerCase()).join("\u001f")}`;
  let hash = 0x811c9dc5;
  for (const character of normalized) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return `csv-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function mappingPresetKey(formatSignature: string, parserVersion: string): string {
  return `financial-intelligence:mapping-preset:${parserVersion}:${formatSignature}`;
}

export function createCsvErrorReport(issues: readonly CsvMappingIssue[]): string {
  const header = [
    "severity",
    "code",
    "source_location",
    "field",
    "rejected_value_summary",
    "message",
    "correction",
  ];
  const rows = issues.map((issue) => [
    issue.severity,
    issue.code,
    issue.sourceLocation ?? "",
    issue.field ?? "",
    issue.rejectedValueSummary ?? "",
    issue.message,
    issue.correction ?? "",
  ]);
  return [header, ...rows]
    .map((row) => row.map((cell) => csvCell(sanitizeSpreadsheetCell(cell))).join(","))
    .join("\r\n");
}

export function sanitizeSpreadsheetCell(value: string): string {
  const normalized = value.replaceAll("\u0000", "").slice(0, 1_024);
  return /^[\t\r\n ]*[=+\-@]/u.test(normalized) ? `'${normalized}` : normalized;
}

function validateMapping(
  sources: readonly CsvMappingSource[],
  mapping: CsvMapping,
): readonly CsvMappingIssue[] {
  const issues: CsvMappingIssue[] = [];
  if (sources.length === 0) {
    issues.push({
      code: "NO_SOURCE",
      severity: "error",
      message: "Choose at least one parsed CSV file.",
    });
    return issues;
  }
  if (mapping.accountId.trim().length === 0) {
    issues.push({
      code: "ACCOUNT_REQUIRED",
      severity: "error",
      field: "accountId",
      message: "Choose a target account.",
    });
  }
  if (!/^[A-Z]{3}$/u.test(mapping.accountCurrency)) {
    issues.push({
      code: "ACCOUNT_CURRENCY_INVALID",
      severity: "error",
      field: "accountCurrency",
      message: "The target account must have a valid currency.",
    });
  }
  const mappedColumns = allMappedColumns(mapping);
  const duplicate = mappedColumns.find((column, index) => mappedColumns.indexOf(column) !== index);
  if (duplicate !== undefined) {
    issues.push({
      code: "DUPLICATE_MAPPING",
      severity: "error",
      field: duplicate,
      message: `Column “${duplicate}” is mapped to more than one required field.`,
      correction: "Choose a different source column for each required field.",
    });
  }
  for (const source of sources) {
    const headers = new Set(source.rows.flatMap((row) => Object.keys(row.fields)));
    for (const column of allMappedColumns(mapping)) {
      if (!headers.has(column)) {
        issues.push({
          code: "MISSING_COLUMN",
          severity: "error",
          field: column,
          message: `Mapped column “${column}” is missing from a source file.`,
          correction: "Choose a column present in every selected file.",
        });
      }
    }
  }
  if (mapping.numberFormat.decimalSeparator === mapping.numberFormat.groupSeparator) {
    issues.push({
      code: "NUMBER_FORMAT_CONFLICT",
      severity: "error",
      field: "numberFormat",
      message: "Decimal and group separators must be different.",
    });
  }
  return issues;
}

function parseMappedDate(
  value: string | undefined,
  format: DateFormat,
  field: string,
  location: string,
  issues: CsvMappingIssue[],
  allowEmpty = false,
): string | undefined {
  const raw = value?.trim() ?? "";
  if (allowEmpty && raw.length === 0) return undefined;
  const patterns: Record<DateFormat, RegExp> = {
    "YYYY-MM-DD": /^(\d{4})-(\d{2})-(\d{2})$/u,
    "MM/DD/YYYY": /^(\d{2})\/(\d{2})\/(\d{4})$/u,
    "DD/MM/YYYY": /^(\d{2})\/(\d{2})\/(\d{4})$/u,
    "YYYY/MM/DD": /^(\d{4})\/(\d{2})\/(\d{2})$/u,
  };
  const match = patterns[format].exec(raw);
  if (match === null) {
    issues.push(
      fieldIssue(
        location,
        field,
        `Date does not match confirmed format ${format}`,
        raw,
        `Correct the value or choose its exact date format (${format}).`,
      ),
    );
    return undefined;
  }
  let year: number;
  let month: number;
  let day: number;
  if (format === "MM/DD/YYYY")
    [month, day, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else if (format === "DD/MM/YYYY")
    [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  else [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (!validCalendarDate(year, month, day)) {
    issues.push(
      fieldIssue(
        location,
        field,
        "Date is not a valid calendar date",
        raw,
        "Correct the day, month, or year in the source row.",
      ),
    );
    return undefined;
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseMappedAmount(
  row: SourceRow,
  sourceLocation: string,
  mapping: CsvMapping,
  issues: CsvMappingIssue[],
): { readonly signedMinor: bigint; readonly original: string } | undefined {
  if (mapping.amount.kind === "signed") {
    const original = row.fields[mapping.amount.column] ?? "";
    const parsed = parseAmount(original, mapping.numberFormat);
    if (parsed === undefined) {
      issues.push(
        fieldIssue(
          sourceLocation,
          "amount",
          "Amount is invalid for the confirmed separators",
          original,
          "Correct the amount or confirm the decimal and group separators.",
        ),
      );
      return undefined;
    }
    return {
      signedMinor: mapping.amount.positiveDirection === "inflow" ? parsed : -parsed,
      original,
    };
  }

  const debitRaw = row.fields[mapping.amount.debitColumn] ?? "";
  const creditRaw = row.fields[mapping.amount.creditColumn] ?? "";
  const debit =
    debitRaw.trim().length === 0 ? undefined : parseAmount(debitRaw, mapping.numberFormat);
  const credit =
    creditRaw.trim().length === 0 ? undefined : parseAmount(creditRaw, mapping.numberFormat);
  if (
    (debit === undefined && credit === undefined) ||
    (debit !== undefined && credit !== undefined)
  ) {
    issues.push(
      fieldIssue(
        sourceLocation,
        "amount",
        "Exactly one debit or credit value is required",
        `${debitRaw} | ${creditRaw}`,
        "Populate exactly one of the mapped debit and credit columns.",
      ),
    );
    return undefined;
  }
  const rawMinor = debit ?? credit ?? 0n;
  const debitSign = mapping.amount.debitDirection === "outflow" ? -1n : 1n;
  return {
    signedMinor: debit === undefined ? -debitSign * abs(rawMinor) : debitSign * abs(rawMinor),
    original: `${debitRaw} | ${creditRaw}`,
  };
}

function parseAmount(value: string, format: NumberFormat): bigint | undefined {
  let normalized = value.normalize("NFKC").trim();
  if (normalized.length === 0) return undefined;
  const parenthesized = normalized.startsWith("(") && normalized.endsWith(")");
  if (parenthesized) normalized = normalized.slice(1, -1).trim();
  normalized = normalized
    .replace(/\p{Sc}/gu, "")
    .replaceAll("\u00a0", " ")
    .trim();
  normalized = normalized
    .replace(/^[A-Z]{3}\s*/iu, "")
    .replace(/\s*[A-Z]{3}$/iu, "")
    .trim();
  if (/\p{L}/u.test(normalized)) return undefined;
  if (parenthesized && /^[+-]/u.test(normalized)) return undefined;
  const explicitNegative = normalized.startsWith("-");
  const unsigned = normalized.replace(/^[+-]/u, "");
  const parts = unsigned.split(format.decimalSeparator);
  if (parts.length > 2) return undefined;
  const [groupedWhole = "", fraction = ""] = parts;
  if (groupedWhole.length === 0 || (!/^\d{1,2}$/u.test(fraction) && fraction.length > 0))
    return undefined;
  const groupCharacter = format.groupSeparator === "space" ? " " : format.groupSeparator;
  let whole = groupedWhole;
  if (groupCharacter === "none") {
    if (!/^\d+$/u.test(whole)) return undefined;
  } else if (whole.includes(groupCharacter)) {
    const groups = whole.split(groupCharacter);
    if (
      !/^\d{1,3}$/u.test(groups[0] ?? "") ||
      groups.slice(1).some((group) => !/^\d{3}$/u.test(group))
    )
      return undefined;
    whole = groups.join("");
  } else if (!/^\d+$/u.test(whole)) {
    return undefined;
  }
  let minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (parenthesized || explicitNegative) minor = -minor;
  return minor;
}

function result(
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
  const add = (row: MappingPreviewRow | undefined) => {
    if (row !== undefined && !chosen.includes(row)) chosen.push(row);
  };
  add(rows.find((row) => row.status === "invalid"));
  add(rows.find((row) => row.status === "valid" && row.amount?.startsWith("-") === true));
  add(
    rows.find(
      (row) =>
        row.status === "valid" && row.amount?.startsWith("-") === false && row.amount !== "0.00",
    ),
  );
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

function normalizeDescription(value: string): string {
  return value.normalize("NFKC").replaceAll(/\s+/gu, " ").trim();
}

function normalizeCurrency(value: string | undefined): string {
  return (value ?? "").normalize("NFKC").trim().toUpperCase();
}

function bounded(value: string): string {
  return value.slice(0, MAX_PROVENANCE_VALUE);
}

function optionalValue(column: string | undefined, row: SourceRow): string | undefined {
  if (column === undefined) return undefined;
  const value = normalizeDescription(row.fields[column] ?? "");
  return value.length === 0 ? undefined : value;
}

function isTransactionStatus(value: string): value is "pending" | "posted" | "void" {
  return value === "pending" || value === "posted" || value === "void";
}

function amountColumns(amount: AmountMapping): readonly string[] {
  return amount.kind === "signed" ? [amount.column] : [amount.debitColumn, amount.creditColumn];
}

function allMappedColumns(mapping: CsvMapping): readonly string[] {
  return [
    mapping.postedDateColumn,
    mapping.descriptionColumn,
    ...amountColumns(mapping.amount),
    ...[
      mapping.transactionDateColumn,
      mapping.currencyColumn,
      mapping.sourceTransactionIdColumn,
      mapping.statusColumn,
    ].filter((value): value is string => value !== undefined),
  ];
}

function toMappingIssue(issue: ImportIssue, sourceNumber?: number): CsvMappingIssue {
  if (sourceNumber === undefined) return { ...issue };
  return {
    ...issue,
    sourceLocation:
      issue.sourceLocation === undefined
        ? `source:${sourceNumber}`
        : `source:${sourceNumber}/${issue.sourceLocation}`,
  };
}

function validCalendarDate(year: number, month: number, day: number): boolean {
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= (days[month - 1] ?? 0);
}

function abs(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function minorToDecimal(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const positive = abs(value);
  return `${sign}${positive / 100n}.${String(positive % 100n).padStart(2, "0")}`;
}

function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}
