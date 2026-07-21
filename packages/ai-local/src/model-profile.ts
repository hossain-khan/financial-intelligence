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

// Placeholder pending the maintainer's runtime/model spike (see the #33 spec and ADR-020). The
// exact repo/revision/file digests are pinned only after a real in-browser load is confirmed.
// Target: a Gemma 3n edge ONNX export (E2B/E4B); fallback: a known-good smaller ONNX instruct model.
export const CLASSIFIER_PROFILE: ModelProfile = {
  profileId: "local-classifier-v1",
  runtime: "transformers.js",
  runtimeVersion: "PENDING_SPIKE",
  modelRepo: "PENDING_SPIKE",
  modelRevision: "PENDING_SPIKE",
  quantization: "PENDING_SPIKE",
  tokenizerId: "PENDING_SPIKE",
  files: [],
  license: "PENDING_SPIKE",
  totalByteSize: 0,
  minCapabilityTier: "recommended",
  task: "category.classify.v1",
  promptVersion: "1.0.0",
  schemaVersion: "1.0.0",
  decoding: { temperature: 0, maxOutputTokens: 64 },
};
