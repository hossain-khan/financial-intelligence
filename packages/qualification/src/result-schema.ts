/**
 * Versioned performance-result schema. A result is only comparable to another when its environment
 * profile matches (same generator/workload digest, browser, OS, hardware, cold/warm); a changed
 * environment produces a new baseline rather than a false regression. Results carry only timings,
 * counts, digests, and enum metadata — never descriptions, amounts, or account labels.
 */
export const PERF_RESULT_VERSION = "1.0.0";

export type PerfMode = "cold" | "warm";

export interface PerfEnvironment {
  readonly commit: string;
  readonly dirty: boolean;
  readonly node: string;
  readonly pnpm: string;
  readonly browser: string;
  readonly browserVersion: string;
  readonly os: string;
  /** Coarse hardware descriptor (e.g. "ci-linux-2core"); never a device serial. */
  readonly hardwareProfile: string;
}

export interface PerfMetric {
  /** Stable metric id, e.g. "ledger.filter". Never contains data values. */
  readonly id: string;
  readonly unit: "ms" | "rows-per-second" | "count" | "bytes";
  readonly mode: PerfMode;
  readonly iterations: number;
  readonly samples: readonly number[];
  readonly median: number;
  readonly p95: number;
  /** Memory bytes where the browser exposes it; null (not zero) when unavailable. */
  readonly memoryBytes: number | null;
  readonly threshold: number;
  /** Comparison direction: `max` = fail above threshold; `min` = fail below (throughput). */
  readonly thresholdKind: "max" | "min";
  readonly pass: boolean;
}

export interface PerfResult {
  readonly schemaVersion: typeof PERF_RESULT_VERSION;
  readonly generatedAt: string;
  readonly environment: PerfEnvironment;
  readonly workloadDigest: string;
  readonly workloadLabel: string;
  readonly metrics: readonly PerfMetric[];
}

export class PerfResultError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PerfResultError";
  }
}

/** Validate structural correctness of a perf result; throws `PerfResultError` on any problem. */
export function validatePerfResult(value: unknown): asserts value is PerfResult {
  if (!isRecord(value)) throw new PerfResultError("result must be an object");
  if (value.schemaVersion !== PERF_RESULT_VERSION) {
    throw new PerfResultError(`unsupported schemaVersion: ${String(value.schemaVersion)}`);
  }
  if (typeof value.generatedAt !== "string" || Number.isNaN(Date.parse(value.generatedAt))) {
    throw new PerfResultError("generatedAt must be an ISO timestamp");
  }
  if (typeof value.workloadDigest !== "string" || !/^[0-9a-f]{64}$/u.test(value.workloadDigest)) {
    throw new PerfResultError("workloadDigest must be a 64-hex SHA-256");
  }
  if (typeof value.workloadLabel !== "string" || value.workloadLabel.length === 0) {
    throw new PerfResultError("workloadLabel is required");
  }
  validateEnvironment(value.environment);
  if (!Array.isArray(value.metrics) || value.metrics.length === 0) {
    throw new PerfResultError("metrics must be a non-empty array");
  }
  for (const metric of value.metrics) validateMetric(metric);
}

function validateEnvironment(value: unknown): void {
  if (!isRecord(value)) throw new PerfResultError("environment must be an object");
  for (const key of [
    "commit",
    "node",
    "pnpm",
    "browser",
    "browserVersion",
    "os",
    "hardwareProfile",
  ]) {
    if (typeof value[key] !== "string") {
      throw new PerfResultError(`environment.${key} must be a string`);
    }
  }
  if (typeof value.dirty !== "boolean")
    throw new PerfResultError("environment.dirty must be boolean");
}

function validateMetric(value: unknown): void {
  if (!isRecord(value)) throw new PerfResultError("metric must be an object");
  if (typeof value.id !== "string" || value.id.length === 0) {
    throw new PerfResultError("metric.id is required");
  }
  if (!["ms", "rows-per-second", "count", "bytes"].includes(value.unit as string)) {
    throw new PerfResultError(`metric.unit invalid for ${String(value.id)}`);
  }
  if (value.mode !== "cold" && value.mode !== "warm") {
    throw new PerfResultError(`metric.mode invalid for ${String(value.id)}`);
  }
  if (!Array.isArray(value.samples) || value.samples.some((s) => typeof s !== "number")) {
    throw new PerfResultError(`metric.samples invalid for ${String(value.id)}`);
  }
  for (const key of ["iterations", "median", "p95", "threshold"]) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key])) {
      throw new PerfResultError(`metric.${key} invalid for ${String(value.id)}`);
    }
  }
  if (value.memoryBytes !== null && typeof value.memoryBytes !== "number") {
    throw new PerfResultError(
      `metric.memoryBytes must be a number or null for ${String(value.id)}`,
    );
  }
  if (value.thresholdKind !== "max" && value.thresholdKind !== "min") {
    throw new PerfResultError(`metric.thresholdKind invalid for ${String(value.id)}`);
  }
  if (typeof value.pass !== "boolean") {
    throw new PerfResultError(`metric.pass must be boolean for ${String(value.id)}`);
  }
}

export interface ProfileComparison {
  readonly comparable: boolean;
  readonly reason?: string;
  readonly regressions: readonly {
    readonly id: string;
    readonly baseline: number;
    readonly current: number;
    readonly threshold: number;
  }[];
}

/**
 * Compare two results, but only when they describe the same environment profile and workload. A
 * mismatch is reported as `comparable: false` (a new baseline), never as a regression. Regressions
 * are metrics whose current median crosses the threshold in the failing direction.
 */
export function compareResults(baseline: PerfResult, current: PerfResult): ProfileComparison {
  const mismatch = profileMismatch(baseline, current);
  if (mismatch !== undefined) return { comparable: false, reason: mismatch, regressions: [] };

  const baselineById = new Map(baseline.metrics.map((metric) => [metric.id, metric]));
  const regressions: ProfileComparison["regressions"] = current.metrics
    .filter((metric) => {
      const prior = baselineById.get(metric.id);
      if (prior === undefined) return false;
      return metric.thresholdKind === "max"
        ? metric.median > metric.threshold
        : metric.median < metric.threshold;
    })
    .map((metric) => ({
      id: metric.id,
      baseline: baselineById.get(metric.id)?.median ?? Number.NaN,
      current: metric.median,
      threshold: metric.threshold,
    }));
  return { comparable: true, regressions };
}

function profileMismatch(a: PerfResult, b: PerfResult): string | undefined {
  if (a.workloadDigest !== b.workloadDigest) return "workload digest differs";
  if (a.workloadLabel !== b.workloadLabel) return "workload label differs";
  const keys: (keyof PerfEnvironment)[] = ["browser", "os", "hardwareProfile", "node", "pnpm"];
  for (const key of keys) {
    if (a.environment[key] !== b.environment[key]) return `environment.${key} differs`;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
