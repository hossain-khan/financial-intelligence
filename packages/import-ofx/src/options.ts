import { OfxImportError } from "./errors";

export interface OfxParseLimits {
  readonly maxFileBytes: number;
  readonly maxDecodedCharacters: number;
  readonly maxNestingDepth: number;
  readonly maxElements: number;
  readonly maxStatements: number;
  readonly maxTransactions: number;
  readonly maxFieldCharacters: number;
  readonly maxIssues: number;
  readonly maxOutputCharacters: number;
  readonly maxRuntimeMs: number;
}

export interface OfxParseOptions {
  readonly limits?: Partial<OfxParseLimits>;
}

/**
 * Start from the CSV 16 MiB / 100k-record intake envelope (issue #25) until OFX-specific
 * benchmarks justify a tighter bound. The structural limits (depth, element count, field
 * length) additionally cap adversarial documents that stay under the byte ceiling.
 */
export const DEFAULT_OFX_LIMITS: OfxParseLimits = Object.freeze({
  maxFileBytes: 16 * 1024 * 1024,
  maxDecodedCharacters: 16 * 1024 * 1024,
  maxNestingDepth: 64,
  maxElements: 2_000_000,
  maxStatements: 256,
  maxTransactions: 100_000,
  maxFieldCharacters: 10_000,
  maxIssues: 1_000,
  maxOutputCharacters: 16 * 1024 * 1024,
  maxRuntimeMs: 15_000,
});

export interface NormalizedOfxOptions {
  readonly limits: OfxParseLimits;
}

export function parseOfxOptions(value: unknown): NormalizedOfxOptions {
  if (value !== undefined && !isRecord(value)) {
    throw new OfxImportError("INVALID_OPTIONS", "OFX options must be an object");
  }
  const rawLimits = (value ?? {}).limits;
  if (rawLimits !== undefined && !isRecord(rawLimits)) {
    throw new OfxImportError("INVALID_OPTIONS", "OFX limits must be an object");
  }
  const limits = { ...DEFAULT_OFX_LIMITS };
  for (const key of Object.keys(DEFAULT_OFX_LIMITS) as (keyof OfxParseLimits)[]) {
    const candidate = rawLimits?.[key];
    if (candidate !== undefined) {
      if (typeof candidate !== "number" || !Number.isSafeInteger(candidate) || candidate <= 0) {
        throw new OfxImportError("INVALID_OPTIONS", `${key} must be a positive safe integer`);
      }
      limits[key] = candidate;
    }
  }
  return { limits };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
