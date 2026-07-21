import type { AiErrorCode } from "./errors";
import type { AiTaskId, ExecutionLocation } from "./index-types";

export type AiOutcome = "accepted" | "abstained" | "error" | "cancelled";

export interface AiSuggestion {
  readonly task: AiTaskId;
  readonly output: unknown;
  readonly confidence: number | null;
}

export interface AiExecutionAudit {
  readonly requestId: string;
  readonly task: AiTaskId;
  readonly schemaVersion: string;
  readonly promptVersion: string;
  readonly profileId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly reportedModel: string | null;
  readonly executionLocation: ExecutionLocation;
  readonly consentState: "none" | "granted";
  readonly outcome: AiOutcome;
  readonly errorCode: AiErrorCode | null;
  readonly durationBucket: string;
  readonly inputDigest: string;
  readonly outputDigest: string | null;
}
