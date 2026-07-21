import { describe, expect, it } from "vitest";

import { NO_AI_PROFILE_ID, NoAiProvider } from "./no-ai-provider";

describe("NoAiProvider", () => {
  it("reports no supported tasks and healthy", async () => {
    const provider = new NoAiProvider();
    expect(provider.profile.profileId).toBe(NO_AI_PROFILE_ID);
    expect(provider.profile.supportedTasks).toEqual([]);
    expect((await provider.health()).ok).toBe(true);
  });

  it("returns unsupported for any execute call", async () => {
    const provider = new NoAiProvider();
    const controller = new AbortController();
    const result = await provider.execute(
      { task: "category.classify.v1", payload: {} },
      { signal: controller.signal, deadlineMs: 1000 },
    );
    expect(result).toEqual({
      ok: false,
      error: { code: "unsupported", message: expect.any(String) },
    });
  });
});
