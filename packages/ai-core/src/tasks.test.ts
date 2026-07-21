import { describe, expect, it } from "vitest";

import { AI_TASK_IDS, TASK_DATA_CLASSES, minimizeCategoryClassify } from "./tasks";

describe("task ids", () => {
  it("lists the four documented tasks", () => {
    expect(AI_TASK_IDS).toEqual([
      "merchant.resolve.v1",
      "category.classify.v1",
      "query.plan.v1",
      "insight.word.v1",
    ]);
  });

  it("declares a data-class surface for every task", () => {
    for (const id of AI_TASK_IDS) {
      expect(TASK_DATA_CLASSES[id].length).toBeGreaterThan(0);
    }
  });
});

describe("minimizeCategoryClassify", () => {
  it("bounds the descriptor and dedupes allowed ids", () => {
    const out = minimizeCategoryClassify({
      descriptor: "x".repeat(500),
      direction: "outflow",
      allowedCategoryIds: ["dining", "dining", "travel"],
    });
    expect(out.descriptor.length).toBe(200);
    expect(out.allowedCategoryIds).toEqual(["dining", "travel"]);
  });
});
