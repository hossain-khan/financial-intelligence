import { describe, expect, it } from "vitest";

import {
  PERF_RESULT_VERSION,
  PerfResultError,
  compareResults,
  validatePerfResult,
  type PerfResult,
} from "./result-schema";

function result(overrides: Partial<PerfResult> = {}): PerfResult {
  return {
    schemaVersion: PERF_RESULT_VERSION,
    generatedAt: "2026-01-01T00:00:00.000Z",
    environment: {
      commit: "abc1234",
      dirty: false,
      node: "24.0.0",
      pnpm: "10.33.0",
      browser: "chromium",
      browserVersion: "140",
      os: "linux",
      hardwareProfile: "ci-linux-2core",
    },
    workloadDigest: "a".repeat(64),
    workloadLabel: "smoke1k",
    metrics: [
      {
        id: "ledger.filter",
        unit: "ms",
        mode: "warm",
        iterations: 5,
        samples: [100, 110, 120, 130, 140],
        median: 120,
        p95: 140,
        memoryBytes: null,
        threshold: 200,
        thresholdKind: "max",
        pass: true,
      },
    ],
    ...overrides,
  };
}

describe("validatePerfResult", () => {
  it("accepts a well-formed result", () => {
    expect(() => validatePerfResult(result())).not.toThrow();
  });

  it("rejects an unsupported schema version", () => {
    expect(() => validatePerfResult(result({ schemaVersion: "9.9.9" as never }))).toThrow(
      PerfResultError,
    );
  });

  it("rejects a non-hex workload digest", () => {
    expect(() => validatePerfResult(result({ workloadDigest: "not-hex" }))).toThrow(
      PerfResultError,
    );
  });

  it("rejects an empty metrics array", () => {
    expect(() => validatePerfResult(result({ metrics: [] }))).toThrow(PerfResultError);
  });
});

describe("compareResults", () => {
  it("reports no regression when a matching profile stays within threshold", () => {
    const comparison = compareResults(result(), result());
    expect(comparison.comparable).toBe(true);
    expect(comparison.regressions).toEqual([]);
  });

  it("treats a different workload digest as a new baseline, not a regression", () => {
    const comparison = compareResults(result(), result({ workloadDigest: "b".repeat(64) }));
    expect(comparison.comparable).toBe(false);
    expect(comparison.regressions).toEqual([]);
  });

  it("treats a different environment as a new baseline", () => {
    const current = result({
      environment: { ...result().environment, hardwareProfile: "macbook-m3" },
    });
    expect(compareResults(result(), current).comparable).toBe(false);
  });

  it("flags a max-threshold metric that crossed its budget", () => {
    const current = result({
      metrics: [{ ...result().metrics[0]!, median: 250, samples: [250], p95: 250, pass: false }],
    });
    const comparison = compareResults(result(), current);
    expect(comparison.comparable).toBe(true);
    expect(comparison.regressions).toHaveLength(1);
    expect(comparison.regressions[0]?.id).toBe("ledger.filter");
  });

  it("flags a min-threshold (throughput) metric that fell below its budget", () => {
    const throughput = result({
      metrics: [
        {
          id: "csv.throughput",
          unit: "rows-per-second",
          mode: "warm",
          iterations: 3,
          samples: [8000],
          median: 8000,
          p95: 8000,
          memoryBytes: null,
          threshold: 10_000,
          thresholdKind: "min",
          pass: false,
        },
      ],
    });
    const comparison = compareResults(throughput, throughput);
    expect(comparison.regressions).toHaveLength(1);
  });
});
