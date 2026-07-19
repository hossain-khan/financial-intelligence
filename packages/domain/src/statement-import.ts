import type { AccountId, ImportId } from "./identifiers";
import { parseAccountId, parseImportId } from "./identifiers";
import type { UtcTimestamp } from "./temporal";
import { parseUtcTimestamp } from "./temporal";

export interface ImportSource {
  readonly fileName: string;
  readonly mediaType: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly retained: false;
}

export interface ImportCounts {
  readonly sourceRows: number;
  readonly valid: number;
  readonly errors: number;
  readonly warnings: number;
  readonly exactDuplicates: number;
  readonly likelyDuplicates: number;
  readonly committed: number;
}

export interface ImportIssue {
  readonly code: string;
  readonly severity: "error" | "warning" | "information";
  readonly sourceLocation?: string;
  readonly field?: string;
  readonly message: string;
}

export interface StatementImport {
  readonly id: ImportId;
  readonly accountId: AccountId;
  readonly source: ImportSource;
  readonly parser: { readonly id: string; readonly version: string };
  readonly status: "committed" | "deleted";
  readonly mapping: Readonly<Record<string, string | number | boolean | null>>;
  readonly counts: ImportCounts;
  readonly issues: readonly ImportIssue[];
  readonly committedRevision: number;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
  readonly committedAt: UtcTimestamp;
}

export interface CreateCommittedImportInput {
  readonly id: ImportId;
  readonly accountId: AccountId;
  readonly source: Omit<ImportSource, "retained">;
  readonly parser: { readonly id: string; readonly version: string };
  readonly mapping: Readonly<Record<string, string | number | boolean | null>>;
  readonly counts: ImportCounts;
  readonly issues: readonly ImportIssue[];
  readonly committedRevision: number;
  readonly now: UtcTimestamp;
}

export interface StatementImportDocument {
  readonly schemaVersion: "1.0.0";
  readonly id: string;
  readonly accountId: string;
  readonly source: ImportSource;
  readonly parser: { readonly id: string; readonly version: string };
  readonly status: "committed" | "deleted";
  readonly mapping: Readonly<Record<string, string | number | boolean | null>>;
  readonly counts: ImportCounts;
  readonly issues: readonly ImportIssue[];
  readonly committedRevision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly committedAt: string;
}

export function createCommittedImport(input: CreateCommittedImportInput): StatementImport {
  const source: ImportSource = {
    fileName: requiredText(input.source.fileName, 255, "Source file name"),
    mediaType: requiredText(input.source.mediaType, 120, "Source media type"),
    byteSize: nonNegativeInteger(input.source.byteSize, "Source byte size"),
    sha256: parseSha256(input.source.sha256),
    retained: false,
  };
  const parser = {
    id: requiredText(input.parser.id, 100, "Parser ID"),
    version: requiredText(input.parser.version, 40, "Parser version"),
  };
  if (Object.keys(input.mapping).length > 60) {
    throw new RangeError("Import mapping exceeds 60 properties");
  }
  for (const [key, value] of Object.entries(input.mapping)) {
    if (key.length === 0 || key.length > 120) throw new RangeError("Import mapping key is invalid");
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new RangeError("Import mapping numbers must be finite");
    }
  }
  const counts = validateCounts(input.counts);
  if (counts.errors !== 0 || counts.valid !== counts.committed) {
    throw new RangeError("Committed imports require zero errors and all valid rows committed");
  }
  if (input.issues.length > 10_000) throw new RangeError("Import issues exceed 10,000 entries");
  const issues = input.issues.map(validateIssue);
  if (issues.some((issue) => issue.severity === "error")) {
    throw new RangeError("Committed imports cannot contain error-level issues");
  }
  if (!Number.isSafeInteger(input.committedRevision) || input.committedRevision < 1) {
    throw new RangeError("Committed revision must be a positive safe integer");
  }
  return {
    id: input.id,
    accountId: input.accountId,
    source,
    parser,
    status: "committed",
    mapping: { ...input.mapping },
    counts,
    issues,
    committedRevision: input.committedRevision,
    createdAt: input.now,
    updatedAt: input.now,
    committedAt: input.now,
  };
}

export function importToCanonical(statementImport: StatementImport): StatementImportDocument {
  return {
    schemaVersion: "1.0.0",
    id: statementImport.id,
    accountId: statementImport.accountId,
    source: { ...statementImport.source },
    parser: { ...statementImport.parser },
    status: statementImport.status,
    mapping: { ...statementImport.mapping },
    counts: { ...statementImport.counts },
    issues: statementImport.issues.map((issue) => ({ ...issue })),
    committedRevision: statementImport.committedRevision,
    createdAt: statementImport.createdAt,
    updatedAt: statementImport.updatedAt,
    committedAt: statementImport.committedAt,
  };
}

export function importFromCanonical(document: StatementImportDocument): StatementImport {
  if (document.schemaVersion !== "1.0.0") {
    throw new TypeError("Unsupported statement import schema version");
  }
  if (document.source.retained !== false) {
    throw new TypeError("Retained source files are not supported by this version");
  }
  const imported = createCommittedImport({
    id: parseImportId(document.id),
    accountId: parseAccountId(document.accountId),
    source: document.source,
    parser: document.parser,
    mapping: document.mapping,
    counts: document.counts,
    issues: document.issues,
    committedRevision: document.committedRevision,
    now: parseUtcTimestamp(document.createdAt),
  });
  return document.status === "deleted"
    ? {
        ...imported,
        status: "deleted",
        updatedAt: parseUtcTimestamp(document.updatedAt),
        committedAt: parseUtcTimestamp(document.committedAt),
      }
    : {
        ...imported,
        updatedAt: parseUtcTimestamp(document.updatedAt),
        committedAt: parseUtcTimestamp(document.committedAt),
      };
}

function validateCounts(counts: ImportCounts): ImportCounts {
  const validated: ImportCounts = {
    sourceRows: nonNegativeInteger(counts.sourceRows, "sourceRows"),
    valid: nonNegativeInteger(counts.valid, "valid"),
    errors: nonNegativeInteger(counts.errors, "errors"),
    warnings: nonNegativeInteger(counts.warnings, "warnings"),
    exactDuplicates: nonNegativeInteger(counts.exactDuplicates, "exactDuplicates"),
    likelyDuplicates: nonNegativeInteger(counts.likelyDuplicates, "likelyDuplicates"),
    committed: nonNegativeInteger(counts.committed, "committed"),
  };
  if (validated.valid + validated.errors > validated.sourceRows) {
    throw new RangeError("Import row counts exceed source rows");
  }
  return validated;
}

function validateIssue(issue: ImportIssue): ImportIssue {
  if (!/^[A-Z][A-Z0-9_]{2,63}$/u.test(issue.code))
    throw new RangeError("Import issue code is invalid");
  const message = requiredText(issue.message, 500, "Import issue message");
  const sourceLocation = optionalText(issue.sourceLocation, 160, "Import issue source location");
  const field = optionalText(issue.field, 80, "Import issue field");
  if (!(["error", "warning", "information"] as const).includes(issue.severity)) {
    throw new RangeError("Import issue severity is invalid");
  }
  return {
    code: issue.code,
    severity: issue.severity,
    ...(sourceLocation === undefined ? {} : { sourceLocation }),
    ...(field === undefined ? {} : { field }),
    message,
  };
}

function parseSha256(value: string): string {
  if (!/^[0-9a-f]{64}$/u.test(value))
    throw new TypeError("Source digest must be lowercase SHA-256");
  return value;
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RangeError(`${label} must be a non-negative safe integer`);
  return value;
}

function requiredText(value: string, maximum: number, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new RangeError(`${label} must contain between 1 and ${maximum} characters`);
  }
  return normalized;
}

function optionalText(
  value: string | undefined,
  maximum: number,
  label: string,
): string | undefined {
  return value === undefined ? undefined : requiredText(value, maximum, label);
}
