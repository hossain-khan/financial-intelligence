import {
  computeMetrics,
  evaluateGates,
  runEvaluation,
  type EvalCase,
} from "@financial-intelligence/ai-evaluation";
import { describe, expect, it } from "vitest";

import { CLASSIFIER_PROFILE, type ModelProfile } from "./model-profile";
import { LocalAiProvider, type LocalWorker } from "./provider";
import type { LocalAiRequest, LocalAiResponse } from "./protocol";

// A fake worker whose engine returns the grounded correct category for each case, so the local
// provider can be graded by the #32 harness exactly like any other provider.
class GroundedWorker implements LocalWorker {
  private messageListeners: ((event: { data: LocalAiResponse }) => void)[] = [];
  public constructor(private readonly answer: string) {}
  public postMessage(message: LocalAiRequest): void {
    const response: LocalAiResponse | undefined =
      message.type === "load" || message.type === "warmup"
        ? { protocolVersion: 1, type: "loaded", operationId: message.operationId }
        : message.type === "execute"
          ? {
              protocolVersion: 1,
              type: "result",
              operationId: message.operationId,
              output: this.answer,
            }
          : undefined;
    if (response !== undefined) {
      queueMicrotask(() => {
        for (const listener of this.messageListeners) listener({ data: response });
      });
    }
  }
  public addEventListener(type: "message" | "error", listener: never): void {
    if (type === "message") this.messageListeners.push(listener);
  }
  public removeEventListener(type: "message" | "error", listener: never): void {
    if (type === "message")
      this.messageListeners = this.messageListeners.filter((l) => l !== listener);
  }
  public terminate(): void {}
}

const profile: ModelProfile = {
  ...CLASSIFIER_PROFILE,
  files: [{ path: "a", sha256: "x", byteSize: 1 }],
};

const cases: EvalCase[] = [
  {
    id: "dining-1",
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
  },
];

describe("LocalAiProvider through the ai-evaluation harness", () => {
  it("scores a grounded answer with no safety violations", async () => {
    const answer = JSON.stringify({ categoryId: "dining", confidence: 0.9, rationale: "coffee" });
    const provider = new LocalAiProvider({
      createWorker: () => new GroundedWorker(answer),
      profile,
      isReady: () => Promise.resolve(true),
    });

    const outcomes = await runEvaluation(
      {
        profile: provider.profile,
        health: () => provider.health(),
        execute: (request, options) => provider.execute(request, options),
      },
      cases,
      { perCaseDeadlineMs: 1000, concurrency: 1, now: () => 0 },
    );
    const metrics = computeMetrics(cases, outcomes);
    expect(metrics.groundingViolations).toBe(0);
    expect(metrics.privacyViolations).toBe(0);
    expect(metrics.accuracy).toBe(1);
    // No safety violation, so the harness does not hard-fail the provider. (A full support verdict
    // also depends on abstention coverage, which a single answerable case cannot provide.)
    expect(evaluateGates(metrics).status).not.toBe("failed");
  });
});
