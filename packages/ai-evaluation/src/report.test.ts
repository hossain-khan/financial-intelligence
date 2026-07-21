import { describe, expect, it } from "vitest";

import { assertNoSensitiveContent } from "./privacy-guard";
import { renderMarkdownSummary } from "./report";
import type { EvalResult } from "./result-schema";

const result = {
  schemaVersion: "1.0.0",
  generatedAt: "2026-07-21T00:00:00.000Z",
  profile: {
    corpusDigest: "a".repeat(64),
    appCommit: "abc1234",
    taskVersion: "1.0.0",
    schemaVersion: "1.0.0",
    promptVersion: "1.0.0",
    minimizerVersion: "1.0.0",
    adapterId: "eval-fake",
    adapterVersion: "1.0.0",
    model: "fake-model",
    tokenizer: "none",
    runtime: "in-process",
    executionLocation: "local",
    decodingParams: "seed-1",
    deviceTier: "ci",
  },
  metrics: {
    schemaValidRate: 1,
    invalidOutputRate: 0,
    accuracy: 1,
    abstentionPrecision: 1,
    abstentionRecall: 1,
    groundingViolations: 0,
    privacyViolations: 0,
    latencyMedianMs: 5,
    latencyP95Ms: 9,
    denominators: { total: 2 },
  },
  support: { status: "supported", reviewer: "maintainer", date: "2026-07-21", perTaskTier: {} },
} as EvalResult;

describe("renderMarkdownSummary", () => {
  it("includes the model, accuracy, and support status", () => {
    const md = renderMarkdownSummary(result);
    expect(md).toContain("fake-model");
    expect(md).toContain("supported");
    expect(md).toContain("Accuracy");
  });

  it("passes the artifact privacy guard for the underlying result", () => {
    expect(() => assertNoSensitiveContent(result)).not.toThrow();
  });
});
