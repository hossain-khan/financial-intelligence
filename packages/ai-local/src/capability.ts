import type { ModelProfile } from "./model-profile";

export type CapabilityTier = "unsupported" | "constrained" | "recommended";

export interface CapabilityReport {
  readonly tier: CapabilityTier;
  readonly reasons: readonly string[];
}

export interface CapabilityEnvironment {
  readonly isSecureContext: boolean;
  readonly hasWorker: boolean;
  readonly gpu?: { requestAdapter(): Promise<unknown> };
  estimateStorage(): Promise<{ usage?: number; quota?: number }>;
}

const HARD_BLOCKERS = ["insecure-context", "no-worker", "no-webgpu", "no-gpu-adapter"];

/**
 * Advisory capability preflight. Returns a coarse tier plus reason codes (no high-entropy hardware
 * detail). A hard blocker (insecure context, no worker, no WebGPU/adapter) is `unsupported` and
 * preserves rules-only mode; adequate storage headroom for the pinned model is `recommended`,
 * otherwise `constrained`. Load/inference still catch device-loss/OOM at runtime.
 */
export async function detectCapability(
  env: CapabilityEnvironment,
  profile: ModelProfile,
): Promise<CapabilityReport> {
  const reasons: string[] = [];
  if (!env.isSecureContext) reasons.push("insecure-context");
  if (!env.hasWorker) reasons.push("no-worker");
  if (env.gpu === undefined) reasons.push("no-webgpu");

  if (env.gpu !== undefined) {
    try {
      if ((await env.gpu.requestAdapter()) == null) reasons.push("no-gpu-adapter");
    } catch {
      reasons.push("no-gpu-adapter");
    }
  }

  if (reasons.some((reason) => HARD_BLOCKERS.includes(reason))) {
    return { tier: "unsupported", reasons };
  }

  let headroom = false;
  try {
    const estimate = await env.estimateStorage();
    const free = (estimate.quota ?? 0) - (estimate.usage ?? 0);
    headroom = free >= profile.totalByteSize;
    if (!headroom) reasons.push("low-storage-headroom");
  } catch {
    reasons.push("storage-estimate-unavailable");
  }

  return headroom ? { tier: "recommended", reasons } : { tier: "constrained", reasons };
}
