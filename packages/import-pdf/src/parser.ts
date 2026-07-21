import type {
  ImportIssue,
  ParseProgressReporter,
  ParseStatementInput,
  ParseStatementResult,
  SourceFileMetadata,
  SourceRow,
  StatementParser,
} from "@financial-intelligence/import-core";

import { PdfImportError, throwIfCancelled } from "./errors";
import { extractPdfText, hasPdfSignature, type ExtractDependencies } from "./extractor";
import { PDF_FIELDS } from "./layout";
import { parsePdfOptions } from "./options";
import type { PdfjsModule } from "./pdfjs";
import { selectAdapter } from "./registry";

export interface PdfParserDependencies {
  readonly pdfjs: PdfjsModule;
  readonly now?: () => number;
}

/**
 * PDF statement parser. Extraction and layout selection are isolated: the PDF.js module is injected
 * (the worker binds the hardened legacy build; tests inject a fake), so this class never imports
 * pdfjs-dist directly and stays runnable under Node.
 */
export class PdfStatementParser implements StatementParser {
  public readonly id = "pdf";
  public readonly version = "1.0.0";

  private readonly pdfjs: PdfjsModule;
  private readonly now: () => number;

  public constructor(dependencies: PdfParserDependencies) {
    this.pdfjs = dependencies.pdfjs;
    this.now = dependencies.now ?? (() => performance.now());
  }

  public supports(metadata: SourceFileMetadata): boolean {
    const name = metadata.fileName.toLowerCase();
    return name.endsWith(".pdf") || metadata.mediaType === "application/pdf";
  }

  public async parse(
    input: ParseStatementInput,
    signal: AbortSignal,
    reportProgress?: ParseProgressReporter,
  ): Promise<ParseStatementResult> {
    const { limits } = parsePdfOptions(input.formatOptions);
    const startedAt = this.now();
    validateInput(input, limits);
    throwIfCancelled(signal);

    if (!hasPdfSignature(input.bytes)) {
      throw new PdfImportError("MALFORMED_DOCUMENT", "The file does not contain a PDF document");
    }
    reportProgress?.({ completed: 0 });

    const deps: ExtractDependencies = { pdfjs: this.pdfjs, now: this.now };
    const document = await extractPdfText(input.bytes, limits, deps, signal);
    this.enforceRuntime(startedAt, limits.maxRuntimeMs);
    throwIfCancelled(signal);

    const selection = selectAdapter(document);
    const layout = selection.adapter.extract(document, signal);
    this.enforceRuntime(startedAt, limits.maxRuntimeMs);
    throwIfCancelled(signal);

    if (layout.rows.length > limits.maxOutputRows) {
      throw new PdfImportError("OUTPUT_LIMIT_EXCEEDED", "The PDF produced too many rows");
    }

    const rows: SourceRow[] = layout.rows.map((row) => ({
      sourceLocation: row.sourceLocation,
      fields: {
        [PDF_FIELDS.postedDate]: row.postedDate,
        [PDF_FIELDS.description]: row.description,
        [PDF_FIELDS.amount]: row.amount,
        ...(row.currency === undefined ? {} : { [PDF_FIELDS.currency]: row.currency }),
      },
    }));

    const issues: readonly ImportIssue[] = layout.issues.slice(0, limits.maxIssues);
    const result: ParseStatementResult = {
      parserId: this.id,
      parserVersion: this.version,
      rows,
      issues,
      detectedMetadata: {
        ...layout.detectedMetadata,
        pageCount: document.pageCount,
        textCharacterCount: document.textCharacterCount,
        detectionScore: selection.detection.score,
      },
    };
    enforceOutputLimit(result, limits.maxOutputCharacters);
    reportProgress?.({ completed: rows.length, total: rows.length });
    return result;
  }

  private enforceRuntime(startedAt: number, maxRuntimeMs: number): void {
    if (this.now() - startedAt > maxRuntimeMs) {
      throw new PdfImportError("RUNTIME_LIMIT_EXCEEDED", "PDF parsing exceeded the time limit");
    }
  }
}

function validateInput(
  input: ParseStatementInput,
  limits: { readonly maxFileBytes: number },
): void {
  if (!(input.bytes instanceof ArrayBuffer)) {
    throw new PdfImportError("INVALID_METADATA", "PDF input bytes are missing");
  }
  if (input.bytes.byteLength === 0) {
    throw new PdfImportError("MALFORMED_DOCUMENT", "The PDF file is empty");
  }
  if (input.bytes.byteLength > limits.maxFileBytes) {
    throw new PdfImportError(
      "FILE_LIMIT_EXCEEDED",
      "The PDF file exceeds the configured size limit",
    );
  }
}

function enforceOutputLimit(result: ParseStatementResult, maxOutputCharacters: number): void {
  let total = 0;
  for (const row of result.rows) {
    for (const value of Object.values(row.fields)) total += value.length;
    if (total > maxOutputCharacters) {
      throw new PdfImportError(
        "OUTPUT_LIMIT_EXCEEDED",
        "PDF parsed output exceeds the configured character limit",
      );
    }
  }
}
