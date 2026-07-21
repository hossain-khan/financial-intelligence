import { aiError } from "./errors";
import type {
  AiProvider,
  AiProviderProfileIdentity,
  AiResultEnvelope,
  AiTaskRequest,
  ExecuteOptions,
  HealthReport,
} from "./provider";

export const NO_AI_PROFILE_ID = "profile:none";

export class NoAiProvider implements AiProvider {
  public readonly profile: AiProviderProfileIdentity = {
    profileId: NO_AI_PROFILE_ID,
    adapterId: "none",
    adapterVersion: "1.0.0",
    executionLocation: "local",
    reportedModel: null,
    supportedTasks: [],
    structuredOutput: false,
    contextLimit: 0,
    outputLimit: 0,
  };

  public health(): Promise<HealthReport> {
    return Promise.resolve({ ok: true });
  }

  public execute(_request: AiTaskRequest, _options: ExecuteOptions): Promise<AiResultEnvelope> {
    return Promise.resolve({
      ok: false,
      error: aiError("unsupported", "No AI provider is configured."),
    });
  }
}
