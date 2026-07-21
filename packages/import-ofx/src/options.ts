import { OfxImportError } from "./errors";

export const OFX_ENCODINGS = ["auto", "utf-8", "utf-16le", "utf-16be", "windows-1252"] as const;

export type OfxEncoding = (typeof OFX_ENCODINGS)[number];

export interface OfxParseLimits {
  readonly maxFileBytes: number;
  readonly maxStatements: number;
  readonly maxTransactions: number;
  readonly maxElementDepth: number;
  readonly maxElementCount: number;
  readonly maxFieldLength: number;
  readonly maxIssues: number;
  readonly maxOutputCharacters: number;
  readonly maxRuntimeMs: number;
  readonly chunkCharacters: number;
}

export interface OfxParseOptions {
  readonly encoding?: OfxEncoding;
  readonly limits?: Partial<OfxParseLimits>;
}

export const DEFAULT_OFX_LIMITS: OfxParseLimits = Object.freeze({
  maxFileBytes: 16 * 1024 * 1024,
  maxStatements: 100,
  maxTransactions: 100_000,
  maxElementDepth: 64,
  maxElementCount: 1_000_000,
  maxFieldLength: 64 * 1024,
  maxIssues: 1_000,
  maxOutputCharacters: 16 * 1024 * 1024,
  maxRuntimeMs: 15_000,
  chunkCharacters: 32 * 1024,
});

export interface NormalizedOfxOptions {
  readonly encoding: OfxEncoding;
  readonly limits: OfxParseLimits;
}

export function parseOfxOptions(value: unknown): NormalizedOfxOptions {
  if (value !== undefined && !isRecord(value)) {
    throw new OfxImportError("INVALID_OPTIONS", "OFX options must be an object");
  }
  const options = value ?? {};
  const encoding = options.encoding ?? "auto";

  if (!OFX_ENCODINGS.includes(encoding as OfxEncoding)) {
    throw new OfxImportError("UNSUPPORTED_ENCODING", "Unsupported OFX encoding option");
  }

  const rawLimits = options.limits;
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

  return {
    encoding: encoding as OfxEncoding,
    limits,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
