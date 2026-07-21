import type { AiError } from "./errors";
import type { AiTaskId } from "./tasks";

export type ExecutionLocation = "local" | "selfHosted" | "remote";

export interface AiProviderProfileIdentity {
  readonly profileId: string;
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly executionLocation: ExecutionLocation;
  readonly reportedModel: string | null;
  readonly supportedTasks: readonly AiTaskId[];
  readonly structuredOutput: boolean;
  readonly contextLimit: number;
  readonly outputLimit: number;
}

export interface HealthReport {
  readonly ok: boolean;
  readonly detail?: string;
}

export interface ExecuteOptions {
  readonly signal: AbortSignal;
  readonly deadlineMs: number;
  readonly onProgress?: (fraction: number) => void;
}

export interface AiTaskRequest {
  readonly task: AiTaskId;
  readonly payload: unknown;
}

export type AiResultEnvelope =
  | { readonly ok: true; readonly output: unknown }
  | { readonly ok: false; readonly error: AiError };

export interface AiProvider {
  readonly profile: AiProviderProfileIdentity;
  // health() takes no argument: a provider is structurally incapable of receiving a task payload
  // through its capability probe.
  health(): Promise<HealthReport>;
  execute(request: AiTaskRequest, options: ExecuteOptions): Promise<AiResultEnvelope>;
}
