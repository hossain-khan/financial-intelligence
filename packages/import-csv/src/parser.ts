import type {
  ImportIssue,
  ParseProgressReporter,
  ParseStatementInput,
  ParseStatementResult,
  SourceRow,
  StatementParser,
} from "@financial-intelligence/import-core";
import { parse, type CsvError, type InfoRecord } from "csv-parse/browser/esm";

import { CsvImportError, throwIfCancelled } from "./errors";
import {
  CSV_DELIMITERS,
  parseCsvOptions,
  type CsvDelimiter,
  type CsvEncoding,
  type CsvParseLimits,
} from "./options";

interface ParsedRecord {
  readonly values: readonly string[];
  readonly startLine: number;
  readonly endLine: number;
}

interface ParserDependencies {
  readonly now: () => number;
  readonly yieldControl: () => Promise<void>;
}

const DEFAULT_DEPENDENCIES: ParserDependencies = {
  now: () => performance.now(),
  yieldControl: () => new Promise((resolve) => setTimeout(resolve, 0)),
};

export class CsvStatementParser implements StatementParser {
  public readonly id = "financial-intelligence/csv";
  public readonly version = "1.0.0";

  public constructor(private readonly dependencies: ParserDependencies = DEFAULT_DEPENDENCIES) {}

  public supports(metadata: ParseStatementInput["metadata"]): boolean {
    const name = metadata.fileName.toLowerCase();
    return (
      name.endsWith(".csv") ||
      name.endsWith(".tsv") ||
      metadata.mediaType === "text/csv" ||
      metadata.mediaType === "text/tab-separated-values" ||
      metadata.mediaType === "text/plain"
    );
  }

  public async parse(
    input: ParseStatementInput,
    signal: AbortSignal,
    reportProgress?: ParseProgressReporter,
  ): Promise<ParseStatementResult> {
    const options = parseCsvOptions(input.formatOptions);
    const { limits } = options;
    const startedAt = this.dependencies.now();
    validateInput(input, limits);
    throwIfCancelled(signal);

    const decoded = decodeCsv(input.bytes, options.encoding);
    const delimiter = options.delimiter ?? detectDelimiter(decoded.text, options.quote);
    const issues = new IssueCollector(limits.maxIssues);
    const records = await this.parseRecords(
      decoded.text,
      delimiter,
      options.quote,
      limits,
      options.footerRows,
      signal,
      startedAt,
      issues,
      reportProgress,
      input.bytes.byteLength,
    );

    if (options.footerRows > records.length) {
      throw new CsvImportError(
        "INVALID_OPTIONS",
        "Configured footer rows exceed the parsed record count",
      );
    }
    const withoutFooter = records.slice(0, records.length - options.footerRows);
    if (options.footerRows > 0) {
      issues.add({
        code: "FOOTER_ROWS_IGNORED",
        severity: "information",
        message: `${options.footerRows} configured footer row(s) were ignored`,
      });
    }

    const hasHeader = detectHeader(withoutFooter, options.headerRow);
    const headerRecord = hasHeader ? withoutFooter[0] : undefined;
    const headers = createHeaders(headerRecord?.values, withoutFooter, limits.maxColumns, issues);
    const dataRecords = hasHeader ? withoutFooter.slice(1) : withoutFooter;
    if (dataRecords.length > limits.maxRows) {
      throw new CsvImportError("ROW_LIMIT_EXCEEDED", "CSV row limit exceeded");
    }
    const rows = mapRows(dataRecords, headers, limits, issues);

    reportProgress?.({ completed: input.bytes.byteLength, total: input.bytes.byteLength });
    return {
      parserId: this.id,
      parserVersion: this.version,
      rows,
      issues: issues.values(),
      detectedMetadata: {
        delimiter: delimiter === "\t" ? "tab" : delimiter,
        encoding: decoded.encoding,
        bom: decoded.hadBom,
        headerRow: hasHeader,
        quoteCharacter: options.quote ?? "none",
        quotedFields: options.quote !== null && decoded.text.includes(options.quote),
        lineEnding: detectLineEnding(decoded.text),
        ignoredFooterRows: options.footerRows,
      },
    };
  }

  private async parseRecords(
    text: string,
    delimiter: CsvDelimiter,
    quote: '"' | "'" | null,
    limits: CsvParseLimits,
    footerRows: number,
    signal: AbortSignal,
    startedAt: number,
    issues: IssueCollector,
    reportProgress: ParseProgressReporter | undefined,
    totalBytes: number,
  ): Promise<readonly ParsedRecord[]> {
    if (text.length === 0) return [];
    const records: ParsedRecord[] = [];
    const parser = parse({
      delimiter,
      quote,
      bom: false,
      cast: false,
      info: true,
      raw: true,
      relax_column_count: true,
      skip_empty_lines: true,
      skip_records_with_error: true,
      max_record_size: Math.min(limits.maxFileBytes, limits.maxCellCharacters * limits.maxColumns),
      on_skip: (error, raw) => {
        issues.add(malformedIssue(error, raw));
        return undefined;
      },
    });

    let consumerFailure: unknown;
    let streamEnded = false;
    let wroteInput = false;
    const completion = new Promise<void>((resolve) => {
      parser.on("readable", () => {
        let item: unknown;
        while ((item = parser.read()) !== null) {
          if (consumerFailure !== undefined) continue;
          try {
            const parsed = parseLibraryRecord(item);
            records.push(parsed);
            if (records.length > limits.maxRows + footerRows + 1) {
              throw new CsvImportError("ROW_LIMIT_EXCEEDED", "CSV row limit exceeded");
            }
          } catch (error) {
            consumerFailure = error;
          }
        }
      });
      parser.on("error", (error: unknown) => {
        consumerFailure ??= error;
        streamEnded = true;
        resolve();
      });
      parser.on("end", () => {
        streamEnded = true;
        resolve();
      });
    });

    try {
      for (let offset = 0; offset < text.length; offset += limits.chunkCharacters) {
        throwIfCancelled(signal);
        enforceRuntime(this.dependencies.now(), startedAt, limits.maxRuntimeMs);
        parser.write(text.slice(offset, offset + limits.chunkCharacters));
        wroteInput = true;
        await this.dependencies.yieldControl();
        if (consumerFailure !== undefined) {
          throw consumerFailure;
        }
        const completed = Math.min(
          totalBytes,
          Math.round(
            (Math.min(offset + limits.chunkCharacters, text.length) / text.length) * totalBytes,
          ),
        );
        reportProgress?.({ completed, total: totalBytes });
      }
      parser.end();
      await completion;
      if (consumerFailure !== undefined) {
        throw consumerFailure;
      }
      throwIfCancelled(signal);
      enforceRuntime(this.dependencies.now(), startedAt, limits.maxRuntimeMs);
      return records;
    } catch (error) {
      if (!streamEnded && wroteInput) {
        try {
          parser.end();
          await completion;
        } catch {
          parser.removeAllListeners();
        }
      } else if (!streamEnded) {
        parser.removeAllListeners();
      }
      if (error instanceof CsvImportError) {
        throw error;
      }
      throw new CsvImportError("PARSE_FAILED", "CSV structure could not be parsed", {
        cause: error,
      });
    }
  }
}

class IssueCollector {
  readonly #issues: ImportIssue[] = [];
  #overflowed = false;

  public constructor(private readonly maximum: number) {}

  public add(issue: ImportIssue): void {
    if (this.#issues.length < this.maximum) {
      this.#issues.push(issue);
      return;
    }
    this.#overflowed = true;
  }

  public values(): readonly ImportIssue[] {
    if (!this.#overflowed) {
      return this.#issues;
    }
    const marker: ImportIssue = {
      code: "ISSUE_LIMIT_REACHED",
      severity: "warning",
      message: "Additional CSV issues were omitted after the configured issue limit",
    };
    if (this.maximum === 1) {
      return [marker];
    }
    return [...this.#issues.slice(0, this.maximum - 1), marker];
  }
}

function validateInput(input: ParseStatementInput, limits: CsvParseLimits): void {
  if (input.metadata.byteSize !== input.bytes.byteLength) {
    throw new CsvImportError("INVALID_METADATA", "Source byte size does not match the input");
  }
  if (input.bytes.byteLength > limits.maxFileBytes) {
    throw new CsvImportError("FILE_LIMIT_EXCEEDED", "CSV file exceeds the configured byte limit");
  }
}

function decodeCsv(
  buffer: ArrayBuffer,
  requestedEncoding: CsvEncoding,
): {
  readonly text: string;
  readonly encoding: Exclude<CsvEncoding, "auto">;
  readonly hadBom: boolean;
} {
  const bytes = new Uint8Array(buffer);
  const bom = detectBom(bytes);
  const encoding = requestedEncoding === "auto" ? (bom?.encoding ?? "utf-8") : requestedEncoding;
  const offset = bom?.encoding === encoding ? bom.length : 0;
  try {
    return {
      text: new TextDecoder(encoding, { fatal: true }).decode(bytes.subarray(offset)),
      encoding,
      hadBom: bom !== undefined,
    };
  } catch (error) {
    throw new CsvImportError("DECODE_FAILED", `CSV is not valid ${encoding} text`, {
      cause: error,
    });
  }
}

function detectBom(
  bytes: Uint8Array,
): { readonly encoding: "utf-8" | "utf-16le" | "utf-16be"; readonly length: number } | undefined {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { encoding: "utf-8", length: 3 };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { encoding: "utf-16le", length: 2 };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { encoding: "utf-16be", length: 2 };
  }
  return undefined;
}

function detectDelimiter(text: string, quote: '"' | "'" | null): CsvDelimiter {
  const counts = new Map<CsvDelimiter, number[]>(CSV_DELIMITERS.map((value) => [value, [0]]));
  let quoted = false;
  let lines = 1;
  const sample = text.slice(0, 32 * 1024);
  for (let index = 0; index < sample.length && lines <= 20; index += 1) {
    const character = sample[index];
    if (quote !== null && character === quote) {
      if (quoted && sample[index + 1] === quote) {
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && sample[index + 1] === "\n") index += 1;
      lines += 1;
      for (const values of counts.values()) values.push(0);
    } else if (!quoted && CSV_DELIMITERS.includes(character as CsvDelimiter)) {
      const values = counts.get(character as CsvDelimiter)!;
      values[values.length - 1]! += 1;
    }
  }
  const ranked = [...counts].map(([delimiter, values]) => {
    const useful = values.filter((value) => value > 0);
    const total = useful.reduce((sum, value) => sum + value, 0);
    const spread =
      useful.length === 0 ? Number.POSITIVE_INFINITY : Math.max(...useful) - Math.min(...useful);
    return { delimiter, score: total + useful.length * 4 - spread * 3 };
  });
  ranked.sort(
    (left, right) =>
      right.score - left.score ||
      CSV_DELIMITERS.indexOf(left.delimiter) - CSV_DELIMITERS.indexOf(right.delimiter),
  );
  return ranked[0]?.score && ranked[0].score > 0 ? ranked[0].delimiter : ",";
}

function detectHeader(records: readonly ParsedRecord[], configured: boolean | "auto"): boolean {
  if (configured !== "auto") return configured;
  const first = records[0]?.values.map((value) => value.trim().toLowerCase());
  if (first === undefined || first.length === 0 || first.some((value) => value.length === 0))
    return false;
  const common =
    /^(date|posted|description|details|memo|merchant|amount|debit|credit|balance|currency|transaction|reference)/u;
  return new Set(first).size === first.length && first.some((value) => common.test(value));
}

function createHeaders(
  source: readonly string[] | undefined,
  records: readonly ParsedRecord[],
  maxColumns: number,
  issues: IssueCollector,
): readonly string[] {
  const count = source?.length ?? records[0]?.values.length ?? 0;
  if (count > maxColumns) {
    throw new CsvImportError("COLUMN_LIMIT_EXCEEDED", "CSV column limit exceeded");
  }
  const used = new Map<string, number>();
  return Array.from({ length: count }, (_, index) => {
    const base = source?.[index]?.trim() || `column_${index + 1}`;
    const occurrence = (used.get(base) ?? 0) + 1;
    used.set(base, occurrence);
    if (occurrence > 1) {
      issues.add({
        code: "DUPLICATE_HEADER",
        severity: "warning",
        sourceLocation: "line:1",
        field: base,
        message: `Duplicate header was renamed to ${base}_${occurrence}`,
      });
    }
    return occurrence === 1 ? base : `${base}_${occurrence}`;
  });
}

function mapRows(
  records: readonly ParsedRecord[],
  headers: readonly string[],
  limits: CsvParseLimits,
  issues: IssueCollector,
): readonly SourceRow[] {
  const rows: SourceRow[] = [];
  let outputCharacters = 0;
  for (const record of records) {
    if (record.values.length > limits.maxColumns) {
      issues.add({
        code: "COLUMN_LIMIT_EXCEEDED",
        severity: "error",
        sourceLocation: location(record),
        message: "Row exceeds the configured column limit and was skipped",
      });
      continue;
    }
    if (record.values.length !== headers.length) {
      issues.add({
        code: "COLUMN_COUNT_MISMATCH",
        severity: "warning",
        sourceLocation: location(record),
        message: `Expected ${headers.length} column(s) but found ${record.values.length}`,
      });
    }
    if (record.values.some((value) => value.length > limits.maxCellCharacters)) {
      issues.add({
        code: "CELL_LIMIT_EXCEEDED",
        severity: "error",
        sourceLocation: location(record),
        message: "Row contains a cell that exceeds the configured limit and was skipped",
      });
      continue;
    }
    const fields: Record<string, string> = {};
    const width = Math.max(headers.length, record.values.length);
    for (let index = 0; index < width; index += 1) {
      const key = headers[index] ?? `extra_${index - headers.length + 1}`;
      const value = record.values[index] ?? "";
      fields[key] = value;
      outputCharacters += key.length + value.length;
      if (outputCharacters > limits.maxOutputCharacters) {
        throw new CsvImportError("OUTPUT_LIMIT_EXCEEDED", "CSV output limit exceeded");
      }
    }
    rows.push({ sourceLocation: location(record), fields });
  }
  return rows;
}

function parseLibraryRecord(value: unknown): ParsedRecord {
  if (!isRecord(value) || !Array.isArray(value.record) || !isRecord(value.info)) {
    throw new TypeError("CSV parser returned an invalid record");
  }
  const values = value.record;
  if (!values.every((field) => typeof field === "string")) {
    throw new TypeError("CSV parser returned a non-text field");
  }
  const info = value.info as unknown as InfoRecord;
  const raw = typeof value.raw === "string" ? value.raw : "";
  const endLine = typeof info.lines === "number" ? info.lines : 1;
  const breaks = raw.match(/\r\n|\r|\n/gu)?.length ?? 0;
  const trailing = /(?:\r\n|\r|\n)$/u.test(raw) ? 1 : 0;
  return {
    values,
    startLine: Math.max(1, endLine - breaks + trailing),
    endLine,
  };
}

function malformedIssue(error: CsvError | undefined, raw: string | undefined): ImportIssue {
  const line = typeof error?.lines === "number" ? error.lines : undefined;
  const breaks = raw?.match(/\r\n|\r|\n/gu)?.length ?? 0;
  const start = line === undefined ? undefined : Math.max(1, line - breaks);
  return {
    code: error?.code === "CSV_MAX_RECORD_SIZE" ? "RECORD_LIMIT_EXCEEDED" : "MALFORMED_CSV_ROW",
    severity: "error",
    ...(line === undefined
      ? {}
      : { sourceLocation: start === line ? `line:${line}` : `lines:${start}-${line}` }),
    message:
      error?.code === "CSV_MAX_RECORD_SIZE"
        ? "A CSV record exceeded the configured size limit and was skipped"
        : "A malformed CSV row was skipped; review its quoting and column structure",
  };
}

function location(record: ParsedRecord): string {
  return record.startLine === record.endLine
    ? `line:${record.startLine}`
    : `lines:${record.startLine}-${record.endLine}`;
}

function detectLineEnding(text: string): string {
  if (text.includes("\r\n")) return "crlf";
  if (text.includes("\n")) return "lf";
  if (text.includes("\r")) return "cr";
  return "none";
}

function enforceRuntime(now: number, startedAt: number, maximum: number): void {
  if (now - startedAt > maximum) {
    throw new CsvImportError("RUNTIME_LIMIT_EXCEEDED", "CSV parsing exceeded its time limit");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
