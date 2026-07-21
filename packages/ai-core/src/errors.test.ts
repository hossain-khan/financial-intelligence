import { describe, expect, it } from "vitest";

import { aiError, isAiError } from "./errors";

describe("AiError", () => {
  it("builds a normalized error", () => {
    const err = aiError("timeout", "deadline exceeded");
    expect(err).toEqual({ code: "timeout", message: "deadline exceeded" });
  });

  it("recognizes an AiError shape", () => {
    expect(isAiError(aiError("unsupported", "x"))).toBe(true);
    expect(isAiError({ code: "not-a-code" })).toBe(false);
    expect(isAiError(null)).toBe(false);
  });
});
