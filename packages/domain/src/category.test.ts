import { describe, expect, it } from "vitest";

import { parseCategoryId } from "./identifiers";
import { parseUtcTimestamp } from "./temporal";
import {
  STARTER_CATEGORY_DEFINITIONS,
  createCategory,
  createStarterCategories,
  renameCategory,
  validateCategoryHierarchy,
} from "./category";

const now = parseUtcTimestamp("2026-07-19T16:00:00.000Z");
const later = parseUtcTimestamp("2026-07-19T17:00:00.000Z");

describe("Category", () => {
  it("creates a complete starter set with stable unique IDs", () => {
    const first = createStarterCategories(now);
    const second = createStarterCategories(later);

    expect(first).toHaveLength(STARTER_CATEGORY_DEFINITIONS.length);
    expect(new Set(first.map(({ id }) => id)).size).toBe(first.length);
    expect(second.map(({ id }) => id)).toEqual(first.map(({ id }) => id));
    expect(first.map(({ kind }) => kind)).toEqual(
      expect.arrayContaining(["income", "expense", "transfer", "other"]),
    );
  });

  it("keeps identity stable when the editable label changes", () => {
    const category = createStarterCategories(now)[2];
    if (category === undefined) throw new Error("Starter category is missing");

    expect(renameCategory(category, "  Food at home ", later)).toMatchObject({
      id: category.id,
      name: "Food at home",
      updatedAt: later,
    });
  });

  it("validates custom category names and ordering", () => {
    const input = {
      id: parseCategoryId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f5"),
      name: "Custom",
      kind: "expense" as const,
      order: 1,
      now,
    };
    expect(() => createCategory({ ...input, name: " " })).toThrow(RangeError);
    expect(() => createCategory({ ...input, order: -1 })).toThrow(RangeError);
  });

  it("validates parent existence, cycles, depth, icon, and color", () => {
    const root = createCategory({
      id: parseCategoryId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2a1"),
      name: "Root",
      kind: "expense",
      icon: "home",
      color: "#aabbcc",
      order: 0,
      now,
    });
    const child = createCategory({
      id: parseCategoryId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2a2"),
      parentId: root.id,
      name: "Child",
      kind: "expense",
      order: 1,
      now,
    });
    expect(root.color).toBe("#AABBCC");
    expect(() => validateCategoryHierarchy([root, child], 2)).not.toThrow();
    expect(() => validateCategoryHierarchy([{ ...root, parentId: child.id }, child])).toThrow(
      /cycle/u,
    );
    expect(() => createCategory({ ...root, id: root.id, color: "red", now })).toThrow(/color/u);
  });
});
