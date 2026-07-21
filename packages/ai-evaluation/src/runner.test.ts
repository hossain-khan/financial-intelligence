import { describe, expect, it } from "vitest";

import type { EvalCase } from "./corpus";
import {
  createLeakyProvider,
  createMalformedProvider,
  createPerfectProvider,
} from "./fakes/index";
import { runEvaluation } from "./runner";

const options = { perCaseDeadlineMs: 1000, concurrency: 2, now: () => 0 };

function evalCase(id: string, over: Partial<EvalCase> = {}): EvalCase {
  return {
    id,
    task: "category.classify.v1",
    schemaVersion: "1.0.0",
    locale: "en-CA",
    input: { descriptor: "coffee", direction: "outflow", allowedCategoryIds: ["dining"] },
    allowedVocabulary: ["dining"],
    expected: { kind: "exact", value: "dining" },
    ambiguity: "clear",
    expectedAbstention: false,
    privacyAssertions: { mustNotEcho: [] },
    tags: [],
    ...over,
  } as EvalCase;
}

describe("runEvaluation", () => {
  it("marks a grounded correct answer accepted", async () => {
    const provider = createPerfectProvider(() => ({
      categoryId: "dining",
      confidence: 0.9,
      rationale: "ok",
    }));
    const [outcome] = await runEvaluation(provider, [evalCase("a")], options);
    expect(outcome?.kind).toBe("accepted");
    expect(outcome?.correct).toBe(true);
  });

  it("marks malformed output invalidOutput", async () => {
    const [outcome] = await runEvaluation(createMalformedProvider(), [evalCase("a")], options);
    expect(outcome?.kind).toBe("invalidOutput");
  });

  it("flags a privacy violation when a mustNotEcho token appears", async () => {
    const provider = createLeakyProvider("SECRET");
    const cases = [evalCase("a", { privacyAssertions: { mustNotEcho: ["SECRET"] } })];
    const [outcome] = await runEvaluation(provider, cases, options);
    expect(outcome?.privacyViolation).toBe(true);
  });

  it("flags a grounding violation when the answer is outside allowed vocabulary", async () => {
    const provider = createPerfectProvider(() => ({
      categoryId: "hacking",
      confidence: 0.9,
      rationale: "x",
    }));
    const [outcome] = await runEvaluation(provider, [evalCase("a")], options);
    expect(outcome?.groundingViolation).toBe(true);
    expect(outcome?.correct).toBe(false);
  });
});
