import { PdfImportError } from "./errors";

export interface PdfParseLimits {
  readonly maxFileBytes: number;
  readonly maxPages: number;
  readonly maxTextItemsPerPage: number;
  readonly maxTextItemCharacters: number;
  readonly maxTotalTextCharacters: number;
  readonly maxIssues: number;
  readonly maxOutputRows: number;
  readonly maxOutputCharacters: number;
  readonly maxRuntimeMs: number;
  /**
   * Coordinate quantization step, in unscaled PDF user-space units. Extracted item coordinates are
   * snapped to this grid so column/row matching is deterministic across sub-pixel rendering jitter
   * while the bounded original position is retained for provenance.
   */
  readonly coordinateQuantum: number;
  /**
   * A page contributing fewer usable text characters than this is treated as image-only when the
   * whole document falls below the usable-text floor. Prevents silently importing a scanned page.
   */
  readonly minUsableTextCharacters: number;
}

export interface PdfParseOptions {
  readonly limits?: Partial<PdfParseLimits>;
}

/**
 * Start from the CSV/OFX 16 MiB intake envelope (issues #25, ADR-012) until PDF-specific benchmarks
 * justify a tighter bound. The structural limits (pages, items, characters) additionally cap
 * adversarial documents that stay under the byte ceiling. `coordinateQuantum` and
 * `minUsableTextCharacters` are tuning knobs for deterministic layout matching and image-only
 * classification respectively.
 */
export const DEFAULT_PDF_LIMITS: PdfParseLimits = Object.freeze({
  maxFileBytes: 16 * 1024 * 1024,
  maxPages: 100,
  maxTextItemsPerPage: 20_000,
  maxTextItemCharacters: 2_000,
  maxTotalTextCharacters: 4 * 1024 * 1024,
  maxIssues: 1_000,
  maxOutputRows: 100_000,
  maxOutputCharacters: 16 * 1024 * 1024,
  maxRuntimeMs: 20_000,
  coordinateQuantum: 2,
  minUsableTextCharacters: 24,
});

const INTEGER_LIMIT_KEYS: readonly (keyof PdfParseLimits)[] = [
  "maxFileBytes",
  "maxPages",
  "maxTextItemsPerPage",
  "maxTextItemCharacters",
  "maxTotalTextCharacters",
  "maxIssues",
  "maxOutputRows",
  "maxOutputCharacters",
  "maxRuntimeMs",
  "coordinateQuantum",
  "minUsableTextCharacters",
];

export interface NormalizedPdfOptions {
  readonly limits: PdfParseLimits;
}

export function parsePdfOptions(value: unknown): NormalizedPdfOptions {
  if (value !== undefined && !isRecord(value)) {
    throw new PdfImportError("INVALID_OPTIONS", "PDF options must be an object");
  }
  const rawLimits = (value ?? {}).limits;
  if (rawLimits !== undefined && !isRecord(rawLimits)) {
    throw new PdfImportError("INVALID_OPTIONS", "PDF limits must be an object");
  }
  const limits = { ...DEFAULT_PDF_LIMITS };
  for (const key of INTEGER_LIMIT_KEYS) {
    const candidate = rawLimits?.[key];
    if (candidate !== undefined) {
      if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate <= 0) {
        throw new PdfImportError("INVALID_OPTIONS", `${key} must be a positive safe integer`);
      }
      limits[key] = candidate;
    }
  }
  return { limits };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
