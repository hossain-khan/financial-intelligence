import { describe, expect, it } from "vitest";

import type { MetricSet } from "./metrics";
import { THRESHOLD_POLICY, evaluateGates } from "./thresholds";

function metrics(over: Partial<MetricSet> = {}): MetricSet {
  return {
    schemaValidRate: 1,
    invalidOutputRate: 0,
    accuracy: 1,
    abstentionPrecision: 1,
    abstentionRecall: 1,
    groundingViolations: 0,
    privacyViolations: 0,
    latencyMedianMs: 5,
    latencyP95Ms: 9,
    denominators: {},
    ...over,
  };
}

describe("evaluateGates", () => {
  it("passes a clean run", () => {
    expect(evaluateGates(metrics()).status).toBe("supported");
  });

  it("fails hard on any privacy violation regardless of accuracy", () => {
    const result = evaluateGates(metrics({ privacyViolations: 1, accuracy: 1 }));
    expect(result.status).toBe("failed");
    expect(result.failures).toContain("privacyViolations");
  });

  it("fails hard on a grounding violation", () => {
    expect(evaluateGates(metrics({ groundingViolations: 1 })).status).toBe("failed");
  });

  it("marks experimental when quality is below threshold but safety holds", () => {
    const result = evaluateGates(metrics({ accuracy: THRESHOLD_POLICY.quality.minAccuracy - 0.5 }));
    expect(result.status).toBe("experimental");
  });
});
