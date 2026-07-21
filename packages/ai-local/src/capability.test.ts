import { describe, expect, it } from "vitest";

import { detectCapability, type CapabilityEnvironment } from "./capability";
import { CLASSIFIER_PROFILE } from "./model-profile";

const profile = { ...CLASSIFIER_PROFILE, totalByteSize: 1_000_000 };

interface EnvOverrides {
  isSecureContext?: boolean;
  hasWorker?: boolean;
  gpu?: { requestAdapter(): Promise<unknown> } | null;
  estimateStorage?: () => Promise<{ usage?: number; quota?: number }>;
}

// `gpu: null` in overrides means "omit the WebGPU capability"; omitting it keeps the default.
function env(over: EnvOverrides = {}): CapabilityEnvironment {
  const gpu = "gpu" in over ? over.gpu : { requestAdapter: () => Promise.resolve({}) };
  return {
    isSecureContext: over.isSecureContext ?? true,
    hasWorker: over.hasWorker ?? true,
    ...(gpu === null || gpu === undefined ? {} : { gpu }),
    estimateStorage:
      over.estimateStorage ?? (() => Promise.resolve({ usage: 0, quota: 10_000_000 })),
  };
}

describe("detectCapability", () => {
  it("reports recommended when GPU, worker, secure context, and storage headroom are present", async () => {
    const report = await detectCapability(env(), profile);
    expect(report.tier).toBe("recommended");
  });

  it("reports unsupported without WebGPU", async () => {
    const report = await detectCapability(env({ gpu: null }), profile);
    expect(report.tier).toBe("unsupported");
    expect(report.reasons).toContain("no-webgpu");
  });

  it("reports unsupported outside a secure context", async () => {
    const report = await detectCapability(env({ isSecureContext: false }), profile);
    expect(report.tier).toBe("unsupported");
  });

  it("reports constrained when storage headroom is below the model size", async () => {
    const report = await detectCapability(
      env({ estimateStorage: () => Promise.resolve({ usage: 9_900_000, quota: 10_000_000 }) }),
      profile,
    );
    expect(report.tier).toBe("constrained");
    expect(report.reasons).toContain("low-storage-headroom");
  });

  it("reports unsupported when the adapter cannot be acquired", async () => {
    const report = await detectCapability(
      env({ gpu: { requestAdapter: () => Promise.resolve(null) } }),
      profile,
    );
    expect(report.tier).toBe("unsupported");
    expect(report.reasons).toContain("no-gpu-adapter");
  });
});
