import { aiError } from "../errors";
import type {
  AiProvider,
  AiProviderProfileIdentity,
  AiResultEnvelope,
  AiTaskRequest,
  ExecuteOptions,
  HealthReport,
} from "../provider";

export interface FakeProviderScript {
  readonly profile?: Partial<AiProviderProfileIdentity>;
  readonly responses: readonly AiResultEnvelope[];
  readonly throwOnExecute?: boolean;
}

const DEFAULT_PROFILE: AiProviderProfileIdentity = {
  profileId: "profile:fake",
  adapterId: "fake",
  adapterVersion: "1.0.0",
  executionLocation: "local",
  reportedModel: "fake-model",
  supportedTasks: ["category.classify.v1"],
  structuredOutput: true,
  contextLimit: 4096,
  outputLimit: 512,
};

export class FakeProvider implements AiProvider {
  public readonly profile: AiProviderProfileIdentity;
  public readonly calls: AiTaskRequest[] = [];
  private index = 0;

  public constructor(private readonly script: FakeProviderScript) {
    this.profile = { ...DEFAULT_PROFILE, ...script.profile };
  }

  public health(): Promise<HealthReport> {
    return Promise.resolve({ ok: true });
  }

  public execute(request: AiTaskRequest, options: ExecuteOptions): Promise<AiResultEnvelope> {
    this.calls.push(request);
    if (options.signal.aborted) {
      return Promise.resolve({ ok: false, error: aiError("cancelled", "Aborted before dispatch.") });
    }
    if (this.script.throwOnExecute === true) {
      throw new Error("fake provider failure");
    }
    const response = this.script.responses[this.index] ?? this.script.responses.at(-1);
    this.index += 1;
    if (response === undefined) {
      return Promise.resolve({ ok: false, error: aiError("provider_error", "No scripted response.") });
    }
    return Promise.resolve(response);
  }
}
