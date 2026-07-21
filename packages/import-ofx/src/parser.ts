import type {
  ImportIssue,
  ParseProgressReporter,
  ParseStatementInput,
  ParseStatementResult,
  SourceRow,
  StatementParser,
} from "@financial-intelligence/import-core";

import { decodeOfx } from "./decoder";
import { OfxImportError, throwIfCancelled } from "./errors";
import { KNOWN_OFX_LEAF_TAGS, tokenizeOfx } from "./ofx/lexer";
import { buildOfxTree, detectDialect, parseOfxHeader, type OfxDialect } from "./ofx/dialect";
import { extractStatements } from "./ofx/extractor";
import { parseOfxOptions, type NormalizedOfxOptions, type OfxParseLimits } from "./options";

interface ParserDependencies {
  readonly now: () => number;
  readonly yieldControl: () => Promise<void>;
}

const DEFAULT_DEPENDENCIES: ParserDependencies = {
  now: () => performance.now(),
  yieldControl: () => new Promise((resolve) => setTimeout(resolve, 0)),
};

export class OfxStatementParser implements StatementParser {
  public readonly id = "financial-intelligence/ofx";
  public readonly version = "1.0.0";

  public constructor(private readonly dependencies: ParserDependencies = DEFAULT_DEPENDENCIES) {}

  public supports(metadata: ParseStatementInput["metadata"]): boolean {
    const name = metadata.fileName.toLowerCase();
    const mediaType = metadata.mediaType.toLowerCase();
    return (
      name.endsWith(".ofx") ||
      name.endsWith(".qfx") ||
      mediaType === "application/ofx" ||
      mediaType === "application/x-ofx" ||
      mediaType === "application/vnd.intu.qfx" ||
      mediaType === "text/ofx" ||
      mediaType === "text/xml"
    );
  }

  public async parse(
    input: ParseStatementInput,
    signal: AbortSignal,
    reportProgress?: ParseProgressReporter,
  ): Promise<ParseStatementResult> {
    const options = parseOfxOptions(input.formatOptions);
    const { limits } = options;
    const startedAt = this.dependencies.now();
    validateInput(input, limits);
    throwIfCancelled(signal);

    const dialect = detectDialectByContent(input.bytes);
    const headerEncoding =
      dialect === "sgml" ? parseOfxHeaderHeaderEncoding(input.bytes) : undefined;
    const decoded = decodeOfx(input.bytes, options.encoding, headerEncoding);
    throwIfCancelled(signal);

    const text = decoded.text;
    let headerless = text;
    if (dialect === "sgml") {
      const headerEnd = text.indexOf("<OFX");
      headerless = headerEnd === -1 ? text : text.slice(headerEnd);
    }

    await this.dependencies.yieldControl();
    enforceRuntime(this.dependencies.now(), startedAt, limits.maxRuntimeMs);

    const tokens = tokenizeOfx(headerless, {
      maxElementCount: limits.maxElementCount,
      maxFieldLength: limits.maxFieldLength,
      maxOutputCharacters: limits.maxOutputCharacters,
    });
    throwIfCancelled(signal);

    const tree = buildOfxTree(tokens, limits.maxElementDepth, KNOWN_OFX_LEAF_TAGS);
    throwIfCancelled(signal);
    await this.dependencies.yieldControl();

    const extraction = extractStatements(tree, limits);
    throwIfCancelled(signal);

    if (extraction.statements.length > limits.maxStatements) {
      throw new OfxImportError("STATEMENT_LIMIT_EXCEEDED", "OFX statement count limit exceeded");
    }

    const { rows, statementIssues } = flattenStatements(
      extraction.statements,
      limits,
      extraction.issues,
    );

    reportProgress?.({ completed: input.bytes.byteLength, total: input.bytes.byteLength });

    const metadata: Record<string, string | number | boolean> = {
      dialect,
      encoding: decoded.encoding,
      bom: decoded.hadBom,
      statementCount: extraction.statements.length,
      transactionCount: rows.length,
    };

    if (extraction.statements[0] !== undefined) {
      const first = extraction.statements[0];
      metadata.accountType = first.accountType;
      metadata.accountHint = first.accountHint;
      metadata.currency = first.currency;
      if (first.ledgerBalance !== undefined) {
        metadata.ledgerBalanceAmount = first.ledgerBalance.amount;
        metadata.ledgerBalanceDate = first.ledgerBalance.date;
      }
      if (first.availableBalance !== undefined) {
        metadata.availableBalanceAmount = first.availableBalance.amount;
        metadata.availableBalanceDate = first.availableBalance.date;
      }
    }

    if (extraction.unsupportedSections.length > 0) {
      metadata.unsupportedSections = extraction.unsupportedSections.join(", ");
    }

    return {
      parserId: this.id,
      parserVersion: this.version,
      rows,
      issues: statementIssues,
      detectedMetadata: metadata,
    };
  }
}

function detectDialectByContent(buffer: ArrayBuffer): OfxDialect {
  const sample = new Uint8Array(buffer.slice(0, 256));
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: false }).decode(sample);
  } catch {
    text = new TextDecoder("windows-1252", { fatal: false }).decode(sample);
  }
  return detectDialect(text);
}

function parseOfxHeaderHeaderEncoding(buffer: ArrayBuffer): string | undefined {
  try {
    const text = new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(buffer));
    const headerEnd = text.indexOf("<OFX");
    const header = headerEnd === -1 ? text : text.slice(0, headerEnd);
    const parsed = parseOfxHeader(header);
    return parsed.encoding;
  } catch {
    return undefined;
  }
}

function validateInput(input: ParseStatementInput, limits: OfxParseLimits): void {
  if (input.metadata.byteSize !== input.bytes.byteLength) {
    throw new OfxImportError("INVALID_METADATA", "Source byte size does not match the input");
  }
  if (input.bytes.byteLength > limits.maxFileBytes) {
    throw new OfxImportError("FILE_LIMIT_EXCEEDED", "OFX file exceeds the configured byte limit");
  }
}

function enforceRuntime(now: number, startedAt: number, maximum: number): void {
  if (now - startedAt > maximum) {
    throw new OfxImportError("RUNTIME_LIMIT_EXCEEDED", "OFX parsing exceeded its time limit");
  }
}

function flattenStatements(
  statements: readonly {
    readonly transactions: readonly SourceRow[];
    readonly issues?: readonly ImportIssue[];
  }[],
  limits: OfxParseLimits,
  baseIssues: readonly ImportIssue[],
): { readonly rows: readonly SourceRow[]; readonly statementIssues: readonly ImportIssue[] } {
  const rows: SourceRow[] = [];
  let outputCharacters = 0;
  const issues: ImportIssue[] = [...baseIssues];

  for (const statement of statements) {
    if (statement.issues !== undefined) {
      issues.push(...statement.issues);
    }
    for (const row of statement.transactions) {
      for (const value of Object.values(row.fields)) {
        outputCharacters += value.length;
      }
      if (outputCharacters > limits.maxOutputCharacters) {
        throw new OfxImportError("OUTPUT_LIMIT_EXCEEDED", "OFX output character limit exceeded");
      }
      rows.push(row);
    }
  }

  if (rows.length > limits.maxTransactions) {
    throw new OfxImportError("TRANSACTION_LIMIT_EXCEEDED", "OFX transaction limit exceeded");
  }

  return { rows, statementIssues: issues.slice(0, limits.maxIssues) };
}

export { parseOfxOptions, type NormalizedOfxOptions };
