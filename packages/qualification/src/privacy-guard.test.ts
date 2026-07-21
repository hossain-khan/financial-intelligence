import { describe, expect, it } from "vitest";

import { ArtifactPrivacyError, assertNoSensitiveContent } from "./privacy-guard";

const cleanResult = {
  schemaVersion: "1.0.0",
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
      samples: [100, 120],
      median: 110,
      p95: 120,
      memoryBytes: null,
      threshold: 200,
      thresholdKind: "max",
      pass: true,
    },
  ],
};

describe("assertNoSensitiveContent", () => {
  it("accepts a clean perf result", () => {
    expect(() => assertNoSensitiveContent(cleanResult)).not.toThrow();
  });

  it("rejects a disallowed key (e.g. a leaked transaction description field)", () => {
    expect(() => assertNoSensitiveContent({ ...cleanResult, description: "COFFEE SHOP" })).toThrow(
      ArtifactPrivacyError,
    );
  });

  it("rejects a string that looks like a monetary amount", () => {
    // Smuggle a money-like value onto an allow-listed key.
    expect(() => assertNoSensitiveContent({ ...cleanResult, workloadLabel: "-12.34" })).toThrow(
      /monetary amount/u,
    );
  });

  it("rejects free text with spaces on an allowed key", () => {
    expect(() =>
      assertNoSensitiveContent({ ...cleanResult, workloadLabel: "Grocery Market downtown" }),
    ).toThrow(ArtifactPrivacyError);
  });

  it("allows identifiers, timestamps, and digests", () => {
    expect(() =>
      assertNoSensitiveContent({
        ...cleanResult,
        metrics: [{ ...cleanResult.metrics[0], id: "dashboard.query" }],
      }),
    ).not.toThrow();
  });
});
