import {
  aiError,
  type AiProvider,
  type AiProviderProfileIdentity,
  type AiResultEnvelope,
  type AiTaskRequest,
  type ExecuteOptions,
  type HealthReport,
} from "@financial-intelligence/ai-core";

function profile(over: Partial<AiProviderProfileIdentity>): AiProviderProfileIdentity {
  return {
    profileId: "profile:eval-fake",
    adapterId: "eval-fake",
    adapterVersion: "1.0.0",
    executionLocation: "local",
    reportedModel: "eval-fake-model",
    supportedTasks: [
      "merchant.resolve.v1",
      "category.classify.v1",
      "query.plan.v1",
      "insight.word.v1",
    ],
    structuredOutput: true,
    contextLimit: 4096,
    outputLimit: 512,
    ...over,
  };
}

function baseProvider(
  id: string,
  execute: (request: AiTaskRequest, options: ExecuteOptions) => Promise<AiResultEnvelope>,
): AiProvider {
  return {
    profile: profile({ profileId: `profile:eval-${id}`, adapterId: `eval-${id}` }),
    health(): Promise<HealthReport> {
      return Promise.resolve({ ok: true });
    },
    execute,
  };
}

/** Always returns the grounded correct answer supplied by `answerFor`. */
export function createPerfectProvider(answerFor: (request: AiTaskRequest) => unknown): AiProvider {
  return baseProvider("perfect", (request) =>
    Promise.resolve({ ok: true, output: answerFor(request) }),
  );
}

/** Declines every case (reports unsupported), modelling correct abstention. */
export function createAbstainingProvider(): AiProvider {
  return baseProvider("abstaining", () =>
    Promise.resolve({ ok: false, error: aiError("unsupported", "abstains on this case") }),
  );
}

/** Emits schema-invalid output to exercise the invalid-output rate. */
export function createMalformedProvider(): AiProvider {
  return baseProvider("malformed", () =>
    Promise.resolve({ ok: true, output: { categoryId: 123 } }),
  );
}

/** Echoes a forbidden token so the privacy gate must catch it. */
export function createLeakyProvider(token: string): AiProvider {
  return baseProvider("leaky", () =>
    Promise.resolve({
      ok: true,
      output: { categoryId: "dining", confidence: 0.5, rationale: `contains ${token}` },
    }),
  );
}

/** Resolves only after `delayMs`, so a shorter per-case deadline aborts it. */
export function createSlowProvider(delayMs: number): AiProvider {
  return baseProvider("slow", (_request, options) => {
    if (options.signal.aborted) {
      return Promise.resolve({ ok: false, error: aiError("cancelled", "aborted before dispatch") });
    }
    return new Promise<AiResultEnvelope>((resolve) => {
      const timer = setTimeout(
        () =>
          resolve({
            ok: true,
            output: { categoryId: "dining", confidence: 0.5, rationale: "slow" },
          }),
        delayMs,
      );
      options.signal.addEventListener("abort", () => {
        clearTimeout(timer);
        resolve({ ok: false, error: aiError("cancelled", "aborted") });
      });
    });
  });
}

/** Alternates its answer by call index, so exact repeatability cannot hold. */
export function createNondeterministicProvider(): AiProvider {
  let call = 0;
  return baseProvider("nondeterministic", () => {
    call += 1;
    const categoryId = call % 2 === 0 ? "dining" : "travel";
    return Promise.resolve({
      ok: true,
      output: { categoryId, confidence: 0.5, rationale: "varies" },
    });
  });
}
