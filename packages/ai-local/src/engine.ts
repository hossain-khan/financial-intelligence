import type { ModelProfile } from "./model-profile";

export interface EngineDecoding {
  readonly temperature: number;
  readonly maxOutputTokens: number;
}

/**
 * The runtime-agnostic engine the worker drives. The real transformers.js engine and the
 * `FakeLocalEngine` both implement it, so the worker adapter, cancellation, and recovery paths are
 * testable without WebGPU or real weights.
 */
export interface LocalEngine {
  load(
    profile: ModelProfile,
    onProgress: (fraction: number) => void,
    signal: AbortSignal,
  ): Promise<void>;
  warmup(signal: AbortSignal): Promise<void>;
  generate(prompt: string, decoding: EngineDecoding, signal: AbortSignal): Promise<string>;
  unload(): Promise<void>;
  dispose(): Promise<void>;
}
