import {
  type ProgressInfo,
  type TextGenerationPipeline,
  env,
  pipeline,
} from "@huggingface/transformers";

import type { EngineDecoding, LocalEngine } from "./engine";
import type { ModelProfile } from "./model-profile";

// Runtime-only module: it imports the transformers.js runtime and requires WebGPU + real weights, so
// it is excluded from unit coverage and validated by the maintainer's spike. The `LocalEngine`
// contract it fulfils is fully covered via `FakeLocalEngine`.
//
// Privacy: remote model fetching is disabled and browser Cache Storage is the only source, so the
// engine loads exclusively from the sideloaded, digest-verified `model` namespace. This keeps
// `connect-src 'self'` intact — the runtime never reaches the network.
export class TransformersLocalEngine implements LocalEngine {
  private generator: TextGenerationPipeline | undefined;

  public async load(
    profile: ModelProfile,
    onProgress: (fraction: number) => void,
    signal: AbortSignal,
  ): Promise<void> {
    env.allowRemoteModels = false;
    env.allowLocalModels = true;
    env.useBrowserCache = true;

    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    // dtype comes from the pinned profile. Gemma 3n must use `q4`, not `q4f16`: the q4f16 export
    // crashes ORT Web session creation with a float16/float32 mismatch in the AltUp block (#33).
    this.generator = (await pipeline("text-generation", profile.modelRepo, {
      revision: profile.modelRevision,
      device: "webgpu",
      dtype: profile.quantization as "q4" | "q4f16" | "fp16",
      progress_callback: (report: ProgressInfo) => {
        if ("progress" in report && typeof report.progress === "number") {
          onProgress(report.progress / 100);
        }
      },
    })) as TextGenerationPipeline;
  }

  public async warmup(signal: AbortSignal): Promise<void> {
    if (this.generator === undefined) throw new Error("engine not loaded");
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    await this.generator("ping", { max_new_tokens: 1 });
  }

  public async generate(
    prompt: string,
    decoding: EngineDecoding,
    signal: AbortSignal,
  ): Promise<string> {
    if (this.generator === undefined) throw new Error("engine not loaded");
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    const output = (await this.generator(prompt, {
      max_new_tokens: decoding.maxOutputTokens,
      temperature: decoding.temperature,
      do_sample: decoding.temperature > 0,
      return_full_text: false,
    })) as { generated_text: string }[];
    return output[0]?.generated_text ?? "";
  }

  public async unload(): Promise<void> {
    await this.generator?.dispose();
    this.generator = undefined;
  }

  public async dispose(): Promise<void> {
    await this.unload();
  }
}
