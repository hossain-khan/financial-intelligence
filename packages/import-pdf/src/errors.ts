export type PdfImportErrorCode =
  | "CANCELLED"
  | "EXTRACTION_FAILED"
  | "FILE_LIMIT_EXCEEDED"
  | "IMAGE_ONLY_DOCUMENT"
  | "INVALID_METADATA"
  | "INVALID_OPTIONS"
  | "MALFORMED_DOCUMENT"
  | "OUTPUT_LIMIT_EXCEEDED"
  | "PAGE_LIMIT_EXCEEDED"
  | "PARSE_FAILED"
  | "PASSWORD_PROTECTED"
  | "RUNTIME_LIMIT_EXCEEDED"
  | "TEXT_LIMIT_EXCEEDED"
  | "UNSUPPORTED_LAYOUT";

export class PdfImportError extends Error {
  public constructor(
    public readonly code: PdfImportErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PdfImportError";
  }
}

export function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new PdfImportError("CANCELLED", "Statement parsing was cancelled");
  }
}
