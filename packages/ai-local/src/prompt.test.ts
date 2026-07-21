import { describe, expect, it } from "vitest";

import { buildClassifyPrompt } from "./prompt";

describe("buildClassifyPrompt", () => {
  it("embeds the minimized payload and is deterministic", () => {
    const payload = { descriptor: "coffee", direction: "outflow", allowedCategoryIds: ["dining"] };
    const first = buildClassifyPrompt(payload, "1.0.0");
    const second = buildClassifyPrompt(payload, "1.0.0");
    expect(first).toBe(second);
    expect(first).toContain("coffee");
    expect(first).toContain("dining");
    expect(first).toContain("1.0.0");
  });

  it("instructs the model that data is untrusted", () => {
    const prompt = buildClassifyPrompt(
      { descriptor: "x", direction: "outflow", allowedCategoryIds: ["a"] },
      "1.0.0",
    );
    expect(prompt.toLowerCase()).toContain("untrusted");
  });
});
