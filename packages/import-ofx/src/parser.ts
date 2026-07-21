import type {
  ParseProgressReporter,
  ParseStatementInput,
  ParseStatementResult,
  SourceFileMetadata,
  StatementParser,
} from "@financial-intelligence/import-core";

import { decodeOfx } from "./decoder";
import { OfxImportError, throwIfCancelled } from "./errors";
import { extractOfx } from "./extract";
import { parseOfxOptions } from "./options";
import { tokenizeOfx } from "./tokenizer";

interface ParserDependencies {
  readonly now: () => number;
}

const DEFAULT_DEPENDENCIES: ParserDependencies = {
  now: () => performance.now(),
};

/** OFX 1.x SGML preamble or OFX 2.x XML root, checked against a bounded prefix of the bytes. */
const CONTENT_SIGNATURE = /(^|\s)OFXHEADER\s*[:=]|<\s*OFX[\s>]/iu;

export class OfxStatementParser implements StatementParser {
  public readonly id = "ofx";
  public readonly version = "1.0.0";

  public constructor(private readonly dependencies: ParserDependencies = DEFAULT_DEPENDENCIES) {}

  public supports(metadata: SourceFileMetadata): boolean {
    const name = metadata.fileName.toLowerCase();
    return (
      name.endsWith(".ofx") ||
      name.endsWith(".qfx") ||
      metadata.mediaType === "application/x-ofx" ||
      metadata.mediaType === "application/vnd.intu.qfx" ||
      metadata.mediaType === "application/ofx"
    );
  }

  /**
   * Confirm the bytes actually look like OFX. Extension/MIME hints are advisory; a file whose
   * content does not carry an OFX signature is rejected rather than parsed on faith.
   */
  public static hasOfxSignature(bytes: ArrayBuffer): boolean {
    const prefix = new Uint8Array(bytes).subarray(0, 4096);
    const sniff = new TextDecoder("windows-1252", { fatal: false }).decode(prefix);
    return CONTENT_SIGNATURE.test(sniff);
  }

  public async parse(
    input: ParseStatementInput,
    signal: AbortSignal,
    reportProgress?: ParseProgressReporter,
  ): Promise<ParseStatementResult> {
    const { limits } = parseOfxOptions(input.formatOptions);
    const startedAt = this.dependencies.now();
    validateInput(input, limits);
    throwIfCancelled(signal);

    if (!OfxStatementParser.hasOfxSignature(input.bytes)) {
      throw new OfxImportError("MALFORMED_DOCUMENT", "The file does not contain an OFX document");
    }

    const decoded = decodeOfx(input.bytes, limits.maxDecodedCharacters);
    throwIfCancelled(signal);
    reportProgress?.({ completed: 0 });

    const root = tokenizeOfx(decoded.text, decoded.dialect, limits);
    this.enforceRuntime(startedAt, limits.maxRuntimeMs);
    throwIfCancelled(signal);

    const extraction = extractOfx(root, limits);
    this.enforceRuntime(startedAt, limits.maxRuntimeMs);

    const result: ParseStatementResult = {
      parserId: this.id,
      parserVersion: this.version,
      rows: extraction.rows,
      issues: extraction.issues,
      detectedMetadata: { ...extraction.detectedMetadata, dialect: decoded.dialect },
    };
    enforceOutputLimit(result, limits.maxOutputCharacters);
    reportProgress?.({ completed: extraction.rows.length, total: extraction.rows.length });
    return result;
  }

  private enforceRuntime(startedAt: number, maxRuntimeMs: number): void {
    if (this.dependencies.now() - startedAt > maxRuntimeMs) {
      throw new OfxImportError("RUNTIME_LIMIT_EXCEEDED", "OFX parsing exceeded the time limit");
    }
  }
}

function validateInput(
  input: ParseStatementInput,
  limits: { readonly maxFileBytes: number },
): void {
  if (!(input.bytes instanceof ArrayBuffer)) {
    throw new OfxImportError("INVALID_METADATA", "OFX input bytes are missing");
  }
  if (input.bytes.byteLength === 0) {
    throw new OfxImportError("MALFORMED_DOCUMENT", "The OFX file is empty");
  }
  if (input.bytes.byteLength > limits.maxFileBytes) {
    throw new OfxImportError(
      "FILE_LIMIT_EXCEEDED",
      "The OFX file exceeds the configured size limit",
    );
  }
}

function enforceOutputLimit(result: ParseStatementResult, maxOutputCharacters: number): void {
  let total = 0;
  for (const row of result.rows) {
    for (const value of Object.values(row.fields)) total += value.length;
    if (total > maxOutputCharacters) {
      throw new OfxImportError(
        "OUTPUT_LIMIT_EXCEEDED",
        "OFX parsed output exceeds the configured character limit",
      );
    }
  }
}
