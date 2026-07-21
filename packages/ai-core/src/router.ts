import { validateAiTask } from "@financial-intelligence/schemas";

import { aiError, type AiErrorCode } from "./errors";
import type { AiProvider } from "./provider";
import type { AiExecutionAudit, AiOutcome, AiSuggestion } from "./suggestion";
import type { AiTaskId } from "./tasks";

export interface RouterDeps {
  readonly provider: AiProvider;
  readonly now: () => number;
  readonly newRequestId: () => string;
  readonly digest: (value: unknown) => string;
  readonly promptVersion?: string;
  readonly consentState?: "none" | "granted";
  readonly allowRepair?: boolean;
}

export interface RouterExecuteInput {
  readonly task: AiTaskId;
  readonly payload: unknown;
  readonly allowedIds?: readonly string[];
  readonly signal?: AbortSignal;
  readonly deadlineMs?: number;
}

export interface RouterResult {
  readonly suggestion: AiSuggestion | null;
  readonly audit: AiExecutionAudit;
}

const SCHEMA_VERSION = "1.0.0";
const DEFAULT_DEADLINE_MS = 15_000;

export class AiRouter {
  public constructor(private readonly deps: RouterDeps) {}

  public async execute(input: RouterExecuteInput): Promise<RouterResult> {
    const signal = input.signal ?? new AbortController().signal;

    if (signal.aborted) {
      return this.settle(input, "cancelled", "cancelled", null, null);
    }
    if (!this.deps.provider.profile.supportedTasks.includes(input.task)) {
      return this.settle(input, "error", "unsupported", null, null);
    }
    if (!this.validEnvelope(input.task, "request", input.payload)) {
      return this.settle(input, "error", "invalid_request", null, null);
    }

    let envelope;
    try {
      envelope = await this.deps.provider.execute(
        { task: input.task, payload: input.payload },
        { signal, deadlineMs: input.deadlineMs ?? DEFAULT_DEADLINE_MS },
      );
    } catch {
      return this.settle(input, "error", "provider_error", null, null);
    }

    if (signal.aborted) {
      return this.settle(input, "cancelled", "cancelled", null, null);
    }
    if (!envelope.ok) {
      return this.settle(input, "error", envelope.error.code, null, null);
    }
    if (!this.validEnvelope(input.task, "response", envelope.output) || !this.allowedOk(input, envelope.output)) {
      if (this.deps.allowRepair === true) {
        const hints = this.hintsFor(input, envelope.output);
        const repaired = await this.dispatchRepair(input, hints, signal);
        if (
          repaired.ok &&
          this.validEnvelope(input.task, "response", repaired.output) &&
          this.allowedOk(input, repaired.output)
        ) {
          const repairedSuggestion: AiSuggestion = {
            task: input.task,
            output: repaired.output,
            confidence: readConfidence(repaired.output),
          };
          return this.settle(input, "accepted", null, repairedSuggestion, repaired.output);
        }
      }
      return this.settle(input, "abstained", "invalid_output", null, null);
    }

    const suggestion: AiSuggestion = {
      task: input.task,
      output: envelope.output,
      confidence: readConfidence(envelope.output),
    };
    return this.settle(input, "accepted", null, suggestion, envelope.output);
  }

  private hintsFor(input: RouterExecuteInput, output: unknown): string[] {
    const result = validateAiTask({
      schemaVersion: SCHEMA_VERSION,
      task: input.task,
      direction: "response",
      payload: output,
    });
    return result.valid ? ["allowed_id"] : result.errors.map((error) => error.keyword);
  }

  private async dispatchRepair(
    input: RouterExecuteInput,
    repairHints: string[],
    signal: AbortSignal,
  ) {
    const payload = { ...(input.payload as object), repairHints };
    try {
      return await this.deps.provider.execute(
        { task: input.task, payload },
        { signal, deadlineMs: input.deadlineMs ?? DEFAULT_DEADLINE_MS },
      );
    } catch {
      return { ok: false as const, error: aiError("provider_error", "Repair dispatch failed.") };
    }
  }

  private validEnvelope(task: AiTaskId, direction: "request" | "response", payload: unknown): boolean {
    return validateAiTask({ schemaVersion: SCHEMA_VERSION, task, direction, payload }).valid;
  }

  private allowedOk(input: RouterExecuteInput, output: unknown): boolean {
    if (input.task !== "category.classify.v1" || input.allowedIds === undefined) return true;
    const id = (output as { categoryId?: unknown }).categoryId;
    return typeof id === "string" && input.allowedIds.includes(id);
  }

  private settle(
    input: RouterExecuteInput,
    outcome: AiOutcome,
    errorCode: AiErrorCode | null,
    suggestion: AiSuggestion | null,
    output: unknown,
  ): RouterResult {
    const p = this.deps.provider.profile;
    const audit: AiExecutionAudit = {
      requestId: this.deps.newRequestId(),
      task: input.task,
      schemaVersion: SCHEMA_VERSION,
      promptVersion: this.deps.promptVersion ?? "1.0.0",
      profileId: p.profileId,
      adapterId: p.adapterId,
      adapterVersion: p.adapterVersion,
      reportedModel: p.reportedModel,
      executionLocation: p.executionLocation,
      consentState: this.deps.consentState ?? "none",
      outcome,
      errorCode,
      durationBucket: "lt_1s",
      inputDigest: this.deps.digest(input.payload),
      outputDigest: output === null ? null : this.deps.digest(output),
    };
    return { suggestion, audit };
  }
}

function readConfidence(output: unknown): number | null {
  const c = (output as { confidence?: unknown }).confidence;
  return typeof c === "number" ? c : null;
}
