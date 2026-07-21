import type { AiProvider, AiResultEnvelope } from "@financial-intelligence/ai-core";
import { validateAiTask } from "@financial-intelligence/schemas";

import type { EvalCase } from "./corpus";
import type { CaseOutcome, CaseOutcomeKind } from "./outcomes";

export interface RunnerOptions {
  readonly perCaseDeadlineMs: number;
  readonly concurrency: number;
  readonly now: () => number;
}

/**
 * Map a provider envelope plus the case expectation to a `CaseOutcome`: validate the output against
 * the ai-task response schema, check allowed-vocabulary grounding, and flag any `mustNotEcho` token
 * appearing in the serialized output. A model can never be "correct" while violating grounding or
 * privacy.
 */
export function classifyOutcome(
  evalCase: EvalCase,
  envelope: AiResultEnvelope,
  latencyMs: number,
): CaseOutcome {
  const base = {
    caseId: evalCase.id,
    task: evalCase.task,
    latencyMs,
    groundingViolation: false,
    privacyViolation: false,
    confidence: null as number | null,
  };

  if (!envelope.ok) {
    const kind: CaseOutcomeKind =
      envelope.error.code === "unsupported" ? "abstained" : mapError(envelope.error.code);
    return { ...base, kind, correct: evalCase.expectedAbstention && kind === "abstained" };
  }

  const output = envelope.output;
  const valid = validateAiTask({
    schemaVersion: "1.0.0",
    task: evalCase.task,
    direction: "response",
    payload: output,
  }).valid;
  if (!valid) return { ...base, kind: "invalidOutput", correct: false };

  const privacyViolation = echoesForbidden(output, evalCase.privacyAssertions.mustNotEcho);
  const chosen = chosenId(output);
  const grounded = chosen === null || evalCase.allowedVocabulary.includes(chosen);
  const confidence = readConfidence(output);
  const correct = !privacyViolation && grounded && isCorrect(evalCase, chosen);

  return {
    ...base,
    kind: "accepted",
    correct,
    groundingViolation: !grounded,
    privacyViolation,
    confidence,
  };
}

/**
 * Drive a provider over the corpus with bounded concurrency and a per-case deadline (abort signal),
 * recording one outcome per case. Retry is off by default. Outcomes are returned in input order for
 * deterministic reporting.
 */
export async function runEvaluation(
  provider: AiProvider,
  cases: readonly EvalCase[],
  options: RunnerOptions,
): Promise<readonly CaseOutcome[]> {
  const outcomes: CaseOutcome[] = [];
  const queue = [...cases];

  async function worker(): Promise<void> {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const evalCase = next;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.perCaseDeadlineMs);
      const start = options.now();
      let envelope: AiResultEnvelope;
      try {
        envelope = await provider.execute(
          { task: evalCase.task, payload: evalCase.input },
          { signal: controller.signal, deadlineMs: options.perCaseDeadlineMs },
        );
      } catch {
        envelope = { ok: false, error: { code: "provider_error", message: "threw" } };
      } finally {
        clearTimeout(timer);
      }
      outcomes.push(classifyOutcome(evalCase, envelope, options.now() - start));
    }
  }

  const workers = Array.from({ length: Math.max(1, options.concurrency) }, () => worker());
  await Promise.all(workers);
  const order = new Map(cases.map((c, index) => [c.id, index]));
  return [...outcomes].sort((a, b) => (order.get(a.caseId) ?? 0) - (order.get(b.caseId) ?? 0));
}

function mapError(code: string): CaseOutcomeKind {
  if (code === "timeout") return "timeout";
  if (code === "cancelled") return "cancelled";
  return "error";
}

function echoesForbidden(output: unknown, tokens: readonly string[]): boolean {
  if (tokens.length === 0) return false;
  const serialized = JSON.stringify(output);
  return tokens.some((token) => serialized.includes(token));
}

function chosenId(output: unknown): string | null {
  const record = output as { categoryId?: unknown; label?: unknown };
  if (typeof record.categoryId === "string") return record.categoryId;
  if (typeof record.label === "string") return record.label;
  return null;
}

function isCorrect(evalCase: EvalCase, chosen: string | null): boolean {
  if (evalCase.expected.kind === "abstain") return false;
  if (chosen === null) return false;
  if (evalCase.expected.kind === "exact") return chosen === evalCase.expected.value;
  return evalCase.expected.values.includes(chosen);
}

function readConfidence(output: unknown): number | null {
  const c = (output as { confidence?: unknown }).confidence;
  return typeof c === "number" ? c : null;
}
