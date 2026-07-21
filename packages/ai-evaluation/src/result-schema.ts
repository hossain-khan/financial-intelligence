import type { MetricSet } from "./metrics";

/**
 * Versioned evaluation result. A result is comparable to another only when its full profile
 * matches (corpus digest, task/schema/prompt/minimizer version, model/tokenizer/runtime, decoding,
 * device tier); a changed profile produces a new baseline rather than a false regression. Results
 * carry only rates, counts, timings, digests, and enum metadata — never request bodies.
 */
export const EVAL_RESULT_VERSION = "1.0.0";

export interface EvalProfile {
  readonly corpusDigest: string;
  readonly appCommit: string;
  readonly taskVersion: string;
  readonly schemaVersion: string;
  readonly promptVersion: string;
  readonly minimizerVersion: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly model: string;
  readonly tokenizer: string;
  readonly runtime: string;
  readonly executionLocation: string;
  readonly decodingParams: string;
  readonly deviceTier: string;
}

export type SupportStatus = "supported" | "experimental" | "failed";

export interface SupportRecord {
  readonly status: SupportStatus;
  readonly reviewer: string;
  readonly date: string;
  readonly perTaskTier: Record<string, SupportStatus>;
}

export interface EvalResult {
  readonly schemaVersion: typeof EVAL_RESULT_VERSION;
  readonly generatedAt: string;
  readonly profile: EvalProfile;
  readonly metrics: MetricSet;
  readonly support: SupportRecord;
}

export class EvalResultError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EvalResultError";
  }
}

export function validateEvalResult(value: unknown): asserts value is EvalResult {
  if (!isRecord(value)) throw new EvalResultError("result must be an object");
  if (value.schemaVersion !== EVAL_RESULT_VERSION) {
    throw new EvalResultError("unsupported schemaVersion");
  }
  if (typeof value.generatedAt !== "string" || Number.isNaN(Date.parse(value.generatedAt))) {
    throw new EvalResultError("generatedAt must be an ISO timestamp");
  }
  const profile = value.profile;
  if (!isRecord(profile)) throw new EvalResultError("profile must be an object");
  if (typeof profile.corpusDigest !== "string" || !/^[0-9a-f]{64}$/u.test(profile.corpusDigest)) {
    throw new EvalResultError("profile.corpusDigest must be a 64-hex SHA-256");
  }
  for (const key of ["appCommit", "model", "runtime", "executionLocation", "deviceTier"]) {
    if (typeof profile[key] !== "string" || (profile[key] as string).length === 0) {
      throw new EvalResultError(`profile.${key} is required`);
    }
  }
  if (!isRecord(value.metrics)) throw new EvalResultError("metrics must be an object");
  if (!isRecord(value.support)) throw new EvalResultError("support must be an object");
}

export interface ProfileComparison {
  readonly comparable: boolean;
  readonly reason?: string;
  readonly regressions: readonly {
    readonly id: string;
    readonly baseline: number;
    readonly current: number;
  }[];
}

/** Metrics where a decrease is a regression (higher is better). */
const HIGHER_IS_BETTER: (keyof MetricSet)[] = [
  "schemaValidRate",
  "accuracy",
  "abstentionPrecision",
  "abstentionRecall",
];
/** Metrics where an increase is a regression (lower is better — safety/error rates). */
const LOWER_IS_BETTER: (keyof MetricSet)[] = [
  "invalidOutputRate",
  "groundingViolations",
  "privacyViolations",
];

/**
 * Compare two results, but only when their full profile matches. A mismatch is reported as
 * `comparable: false` (a new baseline), never a regression.
 */
export function compareEvalResults(baseline: EvalResult, current: EvalResult): ProfileComparison {
  const mismatch = profileMismatch(baseline.profile, current.profile);
  if (mismatch !== undefined) return { comparable: false, reason: mismatch, regressions: [] };

  const regressions: { id: string; baseline: number; current: number }[] = [];
  for (const id of HIGHER_IS_BETTER) {
    const before = baseline.metrics[id] as number;
    const after = current.metrics[id] as number;
    if (after < before) regressions.push({ id, baseline: before, current: after });
  }
  for (const id of LOWER_IS_BETTER) {
    const before = baseline.metrics[id] as number;
    const after = current.metrics[id] as number;
    if (after > before) regressions.push({ id, baseline: before, current: after });
  }
  return { comparable: true, regressions };
}

function profileMismatch(a: EvalProfile, b: EvalProfile): string | undefined {
  const keys: (keyof EvalProfile)[] = [
    "corpusDigest",
    "taskVersion",
    "schemaVersion",
    "promptVersion",
    "minimizerVersion",
    "model",
    "tokenizer",
    "runtime",
    "decodingParams",
    "deviceTier",
  ];
  for (const key of keys) if (a[key] !== b[key]) return `profile.${key} differs`;
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
