import { describe, expect, it } from "vitest";

import { FakeProvider } from "./fake-provider";

describe("FakeProvider", () => {
  it("returns scripted responses in order and records calls", async () => {
    const provider = new FakeProvider({
      profile: { supportedTasks: ["category.classify.v1"] },
      responses: [{ ok: true, output: { categoryId: "dining", confidence: 0.9, rationale: "x" } }],
    });
    const controller = new AbortController();
    const result = await provider.execute(
      { task: "category.classify.v1", payload: {} },
      { signal: controller.signal, deadlineMs: 1000 },
    );
    expect(result).toEqual({
      ok: true,
      output: { categoryId: "dining", confidence: 0.9, rationale: "x" },
    });
    expect(provider.calls).toHaveLength(1);
  });

  it("settles cancelled when the signal is already aborted", async () => {
    const provider = new FakeProvider({ responses: [{ ok: true, output: {} }] });
    const controller = new AbortController();
    controller.abort();
    const result = await provider.execute(
      { task: "category.classify.v1", payload: {} },
      { signal: controller.signal, deadlineMs: 1000 },
    );
    expect(result).toEqual({
      ok: false,
      error: { code: "cancelled", message: expect.any(String) },
    });
  });
});
