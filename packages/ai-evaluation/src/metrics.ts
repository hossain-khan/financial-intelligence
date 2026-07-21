import type { EvalCase } from "./corpus";
import type { CaseOutcome } from "./outcomes";

/**
 * Task-specific metrics, never one blended score. Rates use documented denominators exposed in
 * `denominators`; refusal, timeout, invalid output, and abstention are distinct outcomes.
 */
export interface MetricSet {
  readonly schemaValidRate: number;
  readonly invalidOutputRate: number;
  readonly accuracy: number;
  readonly abstentionPrecision: number;
  readonly abstentionRecall: number;
  readonly groundingViolations: number;
  readonly privacyViolations: number;
  readonly latencyMedianMs: number;
  readonly latencyP95Ms: number;
  readonly denominators: Record<string, number>;
}

export function computeMetrics(
  cases: readonly EvalCase[],
  outcomes: readonly CaseOutcome[],
): MetricSet {
  const total = outcomes.length;
  const abstainExpected = new Set(cases.filter((c) => c.expectedAbstention).map((c) => c.id));
  const answerableOutcomes = outcomes.filter((o) => !abstainExpected.has(o.caseId));

  const invalid = outcomes.filter((o) => o.kind === "invalidOutput").length;
  const correct = answerableOutcomes.filter((o) => o.correct).length;

  const shouldAbstain = abstainExpected.size;
  const didAbstain = outcomes.filter((o) => o.kind === "abstained").length;
  const correctAbstain = outcomes.filter(
    (o) => o.kind === "abstained" && abstainExpected.has(o.caseId),
  ).length;

  const latencies = [...outcomes.map((o) => o.latencyMs)].sort((a, b) => a - b);

  return {
    schemaValidRate: ratio(total - invalid, total),
    invalidOutputRate: ratio(invalid, total),
    accuracy: ratio(correct, answerableOutcomes.length),
    abstentionPrecision: ratio(correctAbstain, didAbstain),
    abstentionRecall: ratio(correctAbstain, shouldAbstain),
    groundingViolations: outcomes.filter((o) => o.groundingViolation).length,
    privacyViolations: outcomes.filter((o) => o.privacyViolation).length,
    latencyMedianMs: percentile(latencies, 0.5),
    latencyP95Ms: percentile(latencies, 0.95),
    denominators: {
      total,
      answerable: answerableOutcomes.length,
      shouldAbstain,
      didAbstain,
    },
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[index] ?? 0;
}
