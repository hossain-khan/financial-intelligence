export type OfxImportErrorCode =
  | "CANCELLED"
  | "DECODE_FAILED"
  | "DEPTH_LIMIT_EXCEEDED"
  | "ELEMENT_LIMIT_EXCEEDED"
  | "FILE_LIMIT_EXCEEDED"
  | "FIELD_LIMIT_EXCEEDED"
  | "INVALID_METADATA"
  | "INVALID_OPTIONS"
  | "MALFORMED_DOCUMENT"
  | "OUTPUT_LIMIT_EXCEEDED"
  | "PARSE_FAILED"
  | "RUNTIME_LIMIT_EXCEEDED"
  | "STATEMENT_LIMIT_EXCEEDED"
  | "TRANSACTION_LIMIT_EXCEEDED"
  | "UNSUPPORTED_ENCODING"
  | "UNSUPPORTED_MARKUP";

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
