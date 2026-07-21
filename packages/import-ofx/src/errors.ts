export type OfxImportErrorCode =
  | "CANCELLED"
  | "DECODE_FAILED"
  | "ENCODING_CONFLICT"
  | "FILE_LIMIT_EXCEEDED"
  | "INVALID_METADATA"
  | "INVALID_OPTIONS"
  | "INVALID_OFX_STRUCTURE"
  | "OUTPUT_LIMIT_EXCEEDED"
  | "PARSE_FAILED"
  | "RUNTIME_LIMIT_EXCEEDED"
  | "STATEMENT_LIMIT_EXCEEDED"
  | "TRANSACTION_LIMIT_EXCEEDED"
  | "UNSUPPORTED_ENCODING"
  | "XML_FORBIDDEN_CONSTRUCT";

export class OfxImportError extends Error {
  public constructor(
    public readonly code: OfxImportErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "OfxImportError";
  }
}

export function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new OfxImportError("CANCELLED", "Statement parsing was cancelled");
  }
}
