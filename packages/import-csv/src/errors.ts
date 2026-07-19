export type CsvImportErrorCode =
  | "CANCELLED"
  | "COLUMN_LIMIT_EXCEEDED"
  | "DECODE_FAILED"
  | "FILE_LIMIT_EXCEEDED"
  | "INVALID_METADATA"
  | "INVALID_OPTIONS"
  | "OUTPUT_LIMIT_EXCEEDED"
  | "PARSE_FAILED"
  | "ROW_LIMIT_EXCEEDED"
  | "RUNTIME_LIMIT_EXCEEDED";

export class CsvImportError extends Error {
  public constructor(
    public readonly code: CsvImportErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CsvImportError";
  }
}

export function throwIfCancelled(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new CsvImportError("CANCELLED", "Statement parsing was cancelled");
  }
}
