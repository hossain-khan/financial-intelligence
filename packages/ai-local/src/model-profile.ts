import type { AiTaskId } from "@financial-intelligence/ai-core";

export interface ModelProfileFile {
  readonly path: string;
  readonly sha256: string;
  readonly byteSize: number;
}

export interface ModelProfile {
  readonly profileId: string;
  readonly runtime: "transformers.js";
  readonly runtimeVersion: string;
  readonly modelRepo: string;
  readonly modelRevision: string;
  /**
   * Base URL the app fetches the pinned files from during the one-click download. Files live at
   * `${downloadBaseUrl}/${file.path}`. This is a project-controlled mirror (see ADR-023), decoupled
   * from `modelRepo`/`modelRevision`, which remain the provenance record of the upstream source.
   */
  readonly downloadBaseUrl: string;
  readonly quantization: string;
  readonly tokenizerId: string;
  readonly files: readonly ModelProfileFile[];
  readonly license: string;
  readonly totalByteSize: number;
  readonly minCapabilityTier: "constrained" | "recommended";
  readonly task: AiTaskId;
  readonly promptVersion: string;
  readonly schemaVersion: "1.0.0";
  readonly decoding: { readonly temperature: number; readonly maxOutputTokens: number };
}

// Pinned from the #33 runtime/model spike (see ADR-020 and docs/ai-evaluation-baseline.md).
// onnx-community/gemma-3n-E2B-it-ONNX loads and classifies correctly in transformers.js on WebGPU at
// dtype `q4`. The `q4f16` export was rejected: it crashes ORT Web session creation with a
// float16/float32 type mismatch in Gemma 3n's AltUp block. Only the text components are pinned
// (embed_tokens + decoder); the audio/vision encoders are unused for classification. The revision is
// an immutable commit, never the mutable `main` tag. File digests were captured from a verified
// in-browser load; every downloaded/sideloaded file is checked against them before use.
//
// Download host: a project-controlled Cloudflare R2 mirror (ADR-023) that holds byte-identical copies
// of the pinned files, so acquisition is fast and not gated by Hugging Face. `modelRepo`/`modelRevision`
// remain the upstream provenance record; integrity is still enforced by the per-file SHA-256 digests,
// so a compromised or wrong mirror cannot substitute a different model.
export const CLASSIFIER_PROFILE: ModelProfile = {
  profileId: "gemma-3n-e2b-q4-classifier-v1",
  runtime: "transformers.js",
  runtimeVersion: "4.2.0",
  modelRepo: "onnx-community/gemma-3n-E2B-it-ONNX",
  modelRevision: "d3068b2ea2b9e9de85b33cb356121c4ca0510c0c",
  downloadBaseUrl: "https://light-llm-storage.gohk.xyz/gemma-3n-E2B-it-ONNX",
  quantization: "q4",
  tokenizerId: "onnx-community/gemma-3n-E2B-it-ONNX",
  files: [
    {
      path: "config.json",
      sha256: "e66748fac1e92882a19ac288416d95ceca1526effd2565e4b400b6465244dc45",
      byteSize: 5274,
    },
    {
      path: "generation_config.json",
      sha256: "2ff57fef908e4da8accc2e369d2c848785e6f2f8c5d1ed102bd9cb9aa70f7aaa",
      byteSize: 244,
    },
    {
      path: "tokenizer_config.json",
      sha256: "e5381f672b3b65a1420bc6b49b61f0b28a8b97d849217b6ecf2a2249ecb18e1f",
      byteSize: 2644,
    },
    {
      path: "tokenizer.json",
      sha256: "44cb3d7d545cf895311e004d9a2b2ce823be5eb84c9aa31f73858b607c44c924",
      byteSize: 20366294,
    },
    {
      path: "onnx/embed_tokens_q4.onnx",
      sha256: "54431e64a782ed74220a0af6b4184a6bf59e4b47e0b14ea4e1335810bc0f4f9b",
      byteSize: 3413,
    },
    {
      path: "onnx/embed_tokens_q4.onnx_data",
      sha256: "a94d38d81555f7143d1f2108433f866aa54cd4b574e3a527e3edacc34c475d70",
      byteSize: 1634017280,
    },
    {
      path: "onnx/decoder_model_merged_q4.onnx",
      sha256: "4fcb3a37937db577756270c504851e9366ffa738ace6c5ee7d345728aa8dcbd0",
      byteSize: 1686685,
    },
    {
      path: "onnx/decoder_model_merged_q4.onnx_data",
      sha256: "297a9301058969f1e67e42546a48875b4250f58b10a28249ff08d76e0b5ead57",
      byteSize: 1620499456,
    },
  ],
  license: "Gemma Terms of Use",
  totalByteSize: 3276581290,
  minCapabilityTier: "recommended",
  task: "category.classify.v1",
  promptVersion: "1.0.0",
  schemaVersion: "1.0.0",
  decoding: { temperature: 0, maxOutputTokens: 256 },
};
