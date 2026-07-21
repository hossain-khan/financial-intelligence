import { describe, expect, it } from "vitest";

import { validateAiTask } from "./index";

describe("ai-task schema", () => {
  it("accepts a valid category.classify.v1 request", () => {
    const result = validateAiTask({
      schemaVersion: "1.0.0",
      task: "category.classify.v1",
      direction: "request",
      payload: {
        descriptor: "coffee shop downtown",
        direction: "outflow",
        allowedCategoryIds: ["dining"],
      },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects unknown payload properties", () => {
    const result = validateAiTask({
      schemaVersion: "1.0.0",
      task: "category.classify.v1",
      direction: "response",
      payload: { categoryId: "dining", confidence: 0.5, rationale: "x", extra: true },
    });
    expect(result.valid).toBe(false);
  });

  it("rejects confidence out of range", () => {
    const result = validateAiTask({
      schemaVersion: "1.0.0",
      task: "merchant.resolve.v1",
      direction: "response",
      payload: { label: "Store", confidence: 1.5, evidence: ["matched_alias"] },
    });
    expect(result.valid).toBe(false);
  });
});
