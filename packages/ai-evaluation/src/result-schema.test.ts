import { describe, expect, it } from "vitest";

import {
  EvalResultError,
  compareEvalResults,
  validateEvalResult,
  type EvalResult,
} from "./result-schema";

function result(over: Partial<EvalResult> = {}): EvalResult {
  return {
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
    ...over,
  };
}

describe("validateEvalResult", () => {
  it("accepts a well-formed result", () => {
    expect(() => validateEvalResult(result())).not.toThrow();
  });

  it("rejects a bad corpusDigest", () => {
    expect(() =>
      validateEvalResult(result({ profile: { ...result().profile, corpusDigest: "short" } })),
    ).toThrow(EvalResultError);
  });
});

describe("compareEvalResults", () => {
  it("reports incomparable when the profile differs", () => {
    const cmp = compareEvalResults(
      result(),
      result({ profile: { ...result().profile, model: "other" } }),
    );
    expect(cmp.comparable).toBe(false);
  });

  it("flags an accuracy regression on a matching profile", () => {
    const cmp = compareEvalResults(
      result(),
      result({ metrics: { ...result().metrics, accuracy: 0.5 } }),
    );
    expect(cmp.comparable).toBe(true);
    expect(cmp.regressions.some((r) => r.id === "accuracy")).toBe(true);
  });

  it("flags a privacy-violation increase as a regression", () => {
    const cmp = compareEvalResults(
      result(),
      result({ metrics: { ...result().metrics, privacyViolations: 2 } }),
    );
    expect(cmp.regressions.some((r) => r.id === "privacyViolations")).toBe(true);
  });
});
