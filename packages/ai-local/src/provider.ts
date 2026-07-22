import {
  aiError,
  type AiProvider,
  type AiProviderProfileIdentity,
  type AiResultEnvelope,
  type AiTaskRequest,
  type ExecuteOptions,
  type HealthReport,
} from "@financial-intelligence/ai-core";
import { validateAiTask } from "@financial-intelligence/schemas";

import type { ModelProfile } from "./model-profile";
import { buildClassifyPrompt } from "./prompt";
import type { LocalAiRequest, LocalAiResponse } from "./protocol";

/** Structural subset of `Worker` the provider needs; the real Worker and test fakes both satisfy it. */
export interface LocalWorker {
  postMessage(message: LocalAiRequest): void;
  addEventListener(type: "message", listener: (event: { data: LocalAiResponse }) => void): void;
  addEventListener(type: "error", listener: (event: unknown) => void): void;
  removeEventListener(type: "message", listener: (event: { data: LocalAiResponse }) => void): void;
  removeEventListener(type: "error", listener: (event: unknown) => void): void;
  terminate(): void;
}

export interface LocalAiProviderDeps {
  readonly createWorker: () => LocalWorker;
  readonly profile: ModelProfile;
  readonly isReady: () => Promise<boolean>;
}

const FAILED_CODE_MAP: Record<string, "cancelled" | "resource_exhausted" | "provider_error"> = {
  CANCELLED: "cancelled",
  DEVICE_LOST: "resource_exhausted",
};

export class LocalAiProvider implements AiProvider {
  public readonly profile: AiProviderProfileIdentity;
  private worker: LocalWorker | undefined;
  private loaded = false;

  public constructor(private readonly deps: LocalAiProviderDeps) {
    const model = deps.profile;
    this.profile = {
      profileId: model.profileId,
      adapterId: "ai-local",
      adapterVersion: "1.0.0",
      executionLocation: "local",
      reportedModel:
        model.modelRepo === "PENDING_SPIKE" ? null : `${model.modelRepo}@${model.modelRevision}`,
      supportedTasks: [model.task],
      structuredOutput: true,
      contextLimit: 4096,
      outputLimit: model.decoding.maxOutputTokens,
    };
  }

  public health(): Promise<HealthReport> {
    return Promise.resolve({ ok: true });
  }

  public async execute(request: AiTaskRequest, options: ExecuteOptions): Promise<AiResultEnvelope> {
    if (!this.profile.supportedTasks.includes(request.task)) {
      return { ok: false, error: aiError("unsupported", "Task not supported by this profile.") };
    }
    if (!(await this.deps.isReady())) {
      return { ok: false, error: aiError("unsupported", "No local model is ready.") };
    }
    if (options.signal.aborted) {
      return { ok: false, error: aiError("cancelled", "Aborted before dispatch.") };
    }

    try {
      const worker = this.ensureWorker();
      // AISPIKE: main-thread timing markers (investigate/ai-suggest-hang). Throwaway.
      const tLoad = performance.now();
      // eslint-disable-next-line no-console
      console.log("[AISPIKE] main: ensureLoaded start; alreadyLoaded=", this.loaded);
      await this.ensureLoaded(worker, options.signal);
      // eslint-disable-next-line no-console
      console.log(
        "[AISPIKE] main: ensureLoaded returned after",
        Math.round(performance.now() - tLoad),
        "ms",
      );
      const prompt = buildClassifyPrompt(request.payload, this.deps.profile.promptVersion);
      const tExec = performance.now();
      const output = await this.runExecute(worker, request.task, prompt, options.signal);
      // eslint-disable-next-line no-console
      console.log(
        "[AISPIKE] main:",
        request.task,
        "execute returned after",
        Math.round(performance.now() - tExec),
        "ms",
      );
      return this.validate(request.task, output);
    } catch (error) {
      if (error instanceof WorkerFailure) {
        const mapped = FAILED_CODE_MAP[error.code] ?? "provider_error";
        return { ok: false, error: aiError(mapped, error.message) };
      }
      return { ok: false, error: aiError("provider_error", "Local inference failed.") };
    }
  }

  private validate(task: AiTaskRequest["task"], output: string): AiResultEnvelope {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFence(output));
    } catch {
      return { ok: false, error: aiError("invalid_output", "Model output was not valid JSON.") };
    }
    const result = validateAiTask({
      schemaVersion: "1.0.0",
      task,
      direction: "response",
      payload: parsed,
    });
    return result.valid
      ? { ok: true, output: parsed }
      : { ok: false, error: aiError("invalid_output", "Model output failed schema validation.") };
  }

  private ensureWorker(): LocalWorker {
    if (this.worker === undefined) this.worker = this.deps.createWorker();
    return this.worker;
  }

  private ensureLoaded(worker: LocalWorker, signal: AbortSignal): Promise<void> {
    if (this.loaded) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      const operationId = crypto.randomUUID();
      const settle = attach(worker, operationId, signal, {
        onLoaded: () => {
          this.loaded = true;
          resolve();
        },
        onResult: () => resolve(),
        onFailed: (code, message) => reject(new WorkerFailure(code, message)),
        onCancel: () => reject(new WorkerFailure("CANCELLED", "Load cancelled")),
      });
      worker.postMessage({
        protocolVersion: 1,
        type: "load",
        operationId,
        profile: this.deps.profile,
      });
      void settle;
    });
  }

  private runExecute(
    worker: LocalWorker,
    task: AiTaskRequest["task"],
    prompt: string,
    signal: AbortSignal,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const operationId = crypto.randomUUID();
      attach(worker, operationId, signal, {
        onResult: (output) => resolve(output),
        onLoaded: () => undefined,
        onFailed: (code, message) => reject(new WorkerFailure(code, message)),
        onCancel: () => {
          worker.postMessage({ protocolVersion: 1, type: "cancel", operationId });
          reject(new WorkerFailure("CANCELLED", "Execution cancelled"));
        },
      });
      worker.postMessage({
        protocolVersion: 1,
        type: "execute",
        operationId,
        task,
        prompt,
        decoding: this.deps.profile.decoding,
      });
    });
  }
}

/**
 * Instruct models (e.g. Gemma 3n) commonly wrap JSON in a markdown code fence. Strip an optional
 * leading ```` ```json ```` / ```` ``` ```` and trailing ```` ``` ```` so the payload can be parsed.
 * If no fence is present the trimmed input is returned unchanged.
 */
function stripJsonFence(output: string): string {
  const trimmed = output.trim();
  const fenced = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/iu.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
}

class WorkerFailure extends Error {
  public constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "WorkerFailure";
  }
}

interface AttachHandlers {
  onLoaded: () => void;
  onResult: (output: string) => void;
  onFailed: (code: string, message: string) => void;
  onCancel: () => void;
}

/** Wires a one-operation message/error/abort listener set and cleans up on the first settle. */
function attach(
  worker: LocalWorker,
  operationId: string,
  signal: AbortSignal,
  handlers: AttachHandlers,
): void {
  const onMessage = (event: { data: LocalAiResponse }): void => {
    const response = event.data;
    if (response.operationId !== operationId || response.type === "progress") return;
    cleanup();
    if (response.type === "loaded") handlers.onLoaded();
    else if (response.type === "result") handlers.onResult(response.output);
    else handlers.onFailed(response.errorCode, response.message);
  };
  const onError = (): void => {
    cleanup();
    handlers.onFailed("ENGINE_ERROR", "The local AI worker errored.");
  };
  const onAbort = (): void => {
    cleanup();
    handlers.onCancel();
  };
  const cleanup = (): void => {
    worker.removeEventListener("message", onMessage);
    worker.removeEventListener("error", onError);
    signal.removeEventListener("abort", onAbort);
  };
  worker.addEventListener("message", onMessage);
  worker.addEventListener("error", onError);
  signal.addEventListener("abort", onAbort, { once: true });
}
