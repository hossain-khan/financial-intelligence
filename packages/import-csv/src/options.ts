import { CsvImportError } from "./errors";

export const CSV_DELIMITERS = [",", ";", "\t", "|"] as const;
export const CSV_ENCODINGS = ["auto", "utf-8", "utf-16le", "utf-16be", "windows-1252"] as const;

export type CsvDelimiter = (typeof CSV_DELIMITERS)[number];
export type CsvEncoding = (typeof CSV_ENCODINGS)[number];

export interface CsvParseLimits {
  readonly maxFileBytes: number;
  readonly maxRows: number;
  readonly maxColumns: number;
  readonly maxCellCharacters: number;
  readonly maxRuntimeMs: number;
  readonly maxIssues: number;
  readonly maxOutputCharacters: number;
  readonly maxFooterRows: number;
  readonly chunkCharacters: number;
}

export interface CsvParseOptions {
  readonly delimiter?: CsvDelimiter;
  readonly encoding?: CsvEncoding;
  readonly quote?: '"' | "'" | null;
  readonly headerRow?: boolean | "auto";
  readonly footerRows?: number;
  readonly limits?: Partial<CsvParseLimits>;
}

export const DEFAULT_CSV_LIMITS: CsvParseLimits = Object.freeze({
  maxFileBytes: 16 * 1024 * 1024,
  maxRows: 100_000,
  maxColumns: 128,
  maxCellCharacters: 64 * 1024,
  maxRuntimeMs: 15_000,
  maxIssues: 1_000,
  maxOutputCharacters: 16 * 1024 * 1024,
  maxFooterRows: 20,
  chunkCharacters: 32 * 1024,
});

export interface NormalizedCsvOptions {
  readonly delimiter?: CsvDelimiter;
  readonly encoding: CsvEncoding;
  readonly quote: '"' | "'" | null;
  readonly headerRow: boolean | "auto";
  readonly footerRows: number;
  readonly limits: CsvParseLimits;
}

export function parseCsvOptions(value: unknown): NormalizedCsvOptions {
  if (value !== undefined && !isRecord(value)) {
    throw new CsvImportError("INVALID_OPTIONS", "CSV options must be an object");
  }
  const options = value ?? {};
  const delimiter = options.delimiter;
  const encoding = options.encoding ?? "auto";
  const quote = options.quote === undefined ? '"' : options.quote;
  const headerRow = options.headerRow ?? "auto";
  const footerRows = options.footerRows ?? 0;

  if (delimiter !== undefined && !CSV_DELIMITERS.includes(delimiter as CsvDelimiter)) {
    throw new CsvImportError("INVALID_OPTIONS", "Unsupported CSV delimiter");
  }
  if (!CSV_ENCODINGS.includes(encoding as CsvEncoding)) {
    throw new CsvImportError("INVALID_OPTIONS", "Unsupported CSV encoding");
  }
  if (quote !== '"' && quote !== "'" && quote !== null) {
    throw new CsvImportError("INVALID_OPTIONS", "Unsupported CSV quote character");
  }
  if (headerRow !== true && headerRow !== false && headerRow !== "auto") {
    throw new CsvImportError("INVALID_OPTIONS", "headerRow must be true, false, or auto");
  }
  if (typeof footerRows !== "number" || !Number.isInteger(footerRows) || footerRows < 0) {
    throw new CsvImportError("INVALID_OPTIONS", "footerRows must be a non-negative integer");
  }

  const rawLimits = options.limits;
  if (rawLimits !== undefined && !isRecord(rawLimits)) {
    throw new CsvImportError("INVALID_OPTIONS", "CSV limits must be an object");
  }
  const limits = { ...DEFAULT_CSV_LIMITS };
  for (const key of Object.keys(DEFAULT_CSV_LIMITS) as (keyof CsvParseLimits)[]) {
    const candidate = rawLimits?.[key];
    if (candidate !== undefined) {
      if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate <= 0) {
        throw new CsvImportError("INVALID_OPTIONS", `${key} must be a positive safe integer`);
      }
      limits[key] = candidate;
    }
  }
  if (footerRows > limits.maxFooterRows) {
    throw new CsvImportError("INVALID_OPTIONS", "footerRows exceeds the configured footer limit");
  }

  return {
    ...(delimiter === undefined ? {} : { delimiter: delimiter as CsvDelimiter }),
    encoding: encoding as CsvEncoding,
    quote,
    headerRow,
    footerRows,
    limits,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
