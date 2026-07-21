import type { AIProviderProfile } from "@financial-intelligence/schemas";
import { describe, expect, it } from "vitest";

import {
  AiProviderConfigValidationError,
  GetAiProviderConfig,
  SetAiProviderProfile,
  type AiProviderConfigRepository,
} from "./ai-provider-config";

class MemoryRepo implements AiProviderConfigRepository {
  public stored: AIProviderProfile | undefined;
  public findActive(): Promise<AIProviderProfile | undefined> {
    return Promise.resolve(this.stored);
  }
  public save(p: AIProviderProfile): Promise<void> {
    this.stored = p;
    return Promise.resolve();
  }
}

const deps = (repo: MemoryRepo) => ({
  repository: repo,
  newId: () => "018f6b80-0d62-7d2c-9a5c-7f5f59cda801",
  now: () => "2026-07-21T00:00:00.000Z",
});

describe("GetAiProviderConfig", () => {
  it("seeds and persists a kind:none default on first read", async () => {
    const repo = new MemoryRepo();
    const profile = await new GetAiProviderConfig(deps(repo)).execute();
    expect(profile.kind).toBe("none");
    expect(profile.enabled).toBe(false);
    expect(profile.tasks).toEqual([]);
    expect(repo.stored).toEqual(profile);
  });

  it("returns the stored profile when one exists", async () => {
    const repo = new MemoryRepo();
    await new GetAiProviderConfig(deps(repo)).execute();
    const first = repo.stored;
    const again = await new GetAiProviderConfig(deps(repo)).execute();
    expect(again).toEqual(first);
  });
});

describe("SetAiProviderProfile", () => {
  it("rejects an invalid profile without saving", async () => {
    const repo = new MemoryRepo();
    await expect(
      new SetAiProviderProfile(deps(repo)).execute({
        kind: "none",
      } as unknown as AIProviderProfile),
    ).rejects.toBeInstanceOf(AiProviderConfigValidationError);
    expect(repo.stored).toBeUndefined();
  });
});
