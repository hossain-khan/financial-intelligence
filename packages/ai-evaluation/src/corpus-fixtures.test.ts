import { describe, expect, it } from "vitest";

import digests from "../fixtures/digests.json";
import { canonicalJson } from "./canonical-json";
import { assertCorpusDigests, type EvalCase } from "./corpus";
import { loadCorpusFromDisk } from "./corpus-fixtures";
import { sha256Hex } from "./digest";
import {
  createAbstainingProvider,
  createLeakyProvider,
  createMalformedProvider,
  createPerfectProvider,
} from "./fakes/index";
import { computeMetrics } from "./metrics";
import { runEvaluation } from "./runner";
import { evaluateGates } from "./thresholds";

const options = { perCaseDeadlineMs: 1000, concurrency: 4, now: () => 0 };

/** Build the grounded correct response for a case, in the shape its task's response schema expects. */
function perfectAnswerFor(cases: readonly EvalCase[]) {
  const byInput = new Map(cases.map((c) => [canonicalJson(c.input), c]));
  return (request: { task: string; payload: unknown }): unknown => {
    const evalCase = byInput.get(canonicalJson(request.payload));
    const value =
      evalCase?.expected.kind === "exact"
        ? evalCase.expected.value
        : evalCase?.expected.kind === "acceptableSet"
          ? evalCase.expected.values[0]
          : undefined;
    if (value === undefined) return {};
    if (request.task === "merchant.resolve.v1") {
      return { label: value, confidence: 0.9, evidence: ["matched_alias"] };
    }
    if (request.task === "query.plan.v1") {
      return { metric: value, dimensions: ["category"] };
    }
    return { categoryId: value, confidence: 0.9, rationale: "grounded" };
  };
}

describe("corpus fixtures", () => {
  it("every committed case passes the linter and matches the digest lock", async () => {
    const cases = await loadCorpusFromDisk();
    await assertCorpusDigests(cases, digests as Record<string, string>, (c) =>
      sha256Hex(canonicalJson(c)),
    );
    expect(cases.size).toBeGreaterThanOrEqual(12);
  });

  it("the perfect provider passes the answerable cases with no safety violations", async () => {
    const cases = [...(await loadCorpusFromDisk()).values()].filter((c) => !c.expectedAbstention);
    const outcomes = await runEvaluation(
      createPerfectProvider(perfectAnswerFor(cases)),
      cases,
      options,
    );
    const metrics = computeMetrics(cases, outcomes);
    expect(metrics.groundingViolations).toBe(0);
    expect(metrics.privacyViolations).toBe(0);
    expect(metrics.accuracy).toBe(1);
  });

  it("the abstaining provider scores abstention recall on the ambiguous cases", async () => {
    const cases = [...(await loadCorpusFromDisk()).values()].filter((c) => c.expectedAbstention);
    const outcomes = await runEvaluation(createAbstainingProvider(), cases, options);
    const metrics = computeMetrics(cases, outcomes);
    expect(metrics.abstentionRecall).toBe(1);
  });

  it("the leaky provider trips the privacy gate on the adversarial case", async () => {
    const cases = [...(await loadCorpusFromDisk()).values()].filter(
      (c) => c.privacyAssertions.mustNotEcho.length > 0,
    );
    expect(cases.length).toBeGreaterThan(0);
    const token = cases[0]?.privacyAssertions.mustNotEcho[0] ?? "";
    const outcomes = await runEvaluation(createLeakyProvider(token), cases, options);
    const metrics = computeMetrics(cases, outcomes);
    expect(evaluateGates(metrics).status).toBe("failed");
  });

  it("the malformed provider yields a nonzero invalid-output rate", async () => {
    const cases = [...(await loadCorpusFromDisk()).values()].filter(
      (c) => c.task === "category.classify.v1",
    );
    const outcomes = await runEvaluation(createMalformedProvider(), cases, options);
    const metrics = computeMetrics(cases, outcomes);
    expect(metrics.invalidOutputRate).toBeGreaterThan(0);
  });
});
