import type { EngineDecoding, LocalEngine } from "./engine";
import type { ModelProfile } from "./model-profile";

export interface FakeEngineScript {
  readonly generateOutput?: string;
  readonly loadSteps?: number;
  readonly deviceLostOnGenerate?: boolean;
  readonly generateDelayMs?: number;
}

/** In-memory engine for tests: scriptable output, load progress, delay, and device-loss. */
export class FakeLocalEngine implements LocalEngine {
  public loaded = false;
  public disposed = false;

  public constructor(private readonly script: FakeEngineScript = {}) {}

  public async load(
    _profile: ModelProfile,
    onProgress: (fraction: number) => void,
    signal: AbortSignal,
  ): Promise<void> {
    const steps = this.script.loadSteps ?? 2;
    for (let step = 1; step <= steps; step += 1) {
      if (signal.aborted) throw new DOMException("aborted", "AbortError");
      onProgress(step / steps);
    }
    this.loaded = true;
  }

  public warmup(): Promise<void> {
    return Promise.resolve();
  }

  public async generate(
    _prompt: string,
    _decoding: EngineDecoding,
    signal: AbortSignal,
  ): Promise<string> {
    if (this.script.deviceLostOnGenerate === true) throw new Error("device lost");
    if ((this.script.generateDelayMs ?? 0) > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.script.generateDelayMs));
    }
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    return this.script.generateOutput ?? '{"categoryId":"dining","confidence":0.9,"rationale":"ok"}';
  }

  public unload(): Promise<void> {
    this.loaded = false;
    return Promise.resolve();
  }

  public dispose(): Promise<void> {
    this.disposed = true;
    return Promise.resolve();
  }
}
