import { describe, expect, it } from "vitest";

import type { EvalCase } from "./corpus";
import { computeMetrics } from "./metrics";
import type { CaseOutcome } from "./outcomes";

function evalCase(id: string, over: Partial<EvalCase> = {}): EvalCase {
  return {
    id,
    task: "category.classify.v1",
    schemaVersion: "1.0.0",
    locale: "en-CA",
    input: {},
    allowedVocabulary: ["dining"],
    expected: { kind: "exact", value: "dining" },
    ambiguity: "clear",
    expectedAbstention: false,
    privacyAssertions: { mustNotEcho: [] },
    tags: [],
    ...over,
  } as EvalCase;
}
function outcome(id: string, over: Partial<CaseOutcome> = {}): CaseOutcome {
  return {
    caseId: id,
    task: "category.classify.v1",
    kind: "accepted",
    correct: true,
    groundingViolation: false,
    privacyViolation: false,
    latencyMs: 10,
    confidence: null,
    ...over,
  };
}

describe("computeMetrics", () => {
  it("scores a perfect run", () => {
    const cases = [evalCase("a"), evalCase("b")];
    const m = computeMetrics(cases, [outcome("a"), outcome("b")]);
    expect(m.accuracy).toBe(1);
    expect(m.invalidOutputRate).toBe(0);
    expect(m.groundingViolations).toBe(0);
  });

  it("counts invalid output and grounding violations distinctly", () => {
    const cases = [evalCase("a"), evalCase("b")];
    const outcomes = [
      outcome("a", { kind: "invalidOutput", correct: false }),
      outcome("b", { kind: "accepted", correct: false, groundingViolation: true }),
    ];
    const m = computeMetrics(cases, outcomes);
    expect(m.invalidOutputRate).toBe(0.5);
    expect(m.groundingViolations).toBe(1);
    expect(m.accuracy).toBe(0);
  });

  it("computes abstention precision and recall", () => {
    const cases = [
      evalCase("amb", {
        ambiguity: "ambiguous",
        expectedAbstention: true,
        expected: { kind: "abstain" },
      }),
      evalCase("clear"),
    ];
    const outcomes = [outcome("amb", { kind: "abstained", correct: true }), outcome("clear")];
    const m = computeMetrics(cases, outcomes);
    expect(m.abstentionPrecision).toBe(1);
    expect(m.abstentionRecall).toBe(1);
  });
});
