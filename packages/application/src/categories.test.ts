import type { Category } from "@financial-intelligence/domain";
import { describe, expect, it } from "vitest";

import {
  ListCategories,
  RenameCategory,
  SetCategoryArchived,
  type CategoryRepository,
} from "./categories";

describe("category use cases", () => {
  it("initializes stable starters once and preserves user labels and archive state", async () => {
    const repository = new MemoryCategoryRepository();
    const clock = { now: () => new Date("2026-07-19T17:00:00.000Z") };
    const categories = await new ListCategories(repository, clock).execute();
    expect(categories.length).toBeGreaterThan(5);
    const groceries = categories.find((category) => category.name === "Groceries")!;

    const renamed = await new RenameCategory(repository, clock).execute(
      groceries.id,
      "Food at home",
    );
    await new SetCategoryArchived(repository, clock).execute(renamed.id, true);
    const reloaded = await new ListCategories(repository, clock).execute();

    expect(reloaded.find((category) => category.id === groceries.id)).toMatchObject({
      name: "Food at home",
      archived: true,
    });
  });
});

class MemoryCategoryRepository implements CategoryRepository {
  private categories: Category[] = [];

  public async list(): Promise<readonly Category[]> {
    return this.categories;
  }

  public async putMany(categories: readonly Category[]): Promise<void> {
    this.categories = [...categories];
  }

  public async save(category: Category): Promise<void> {
    this.categories = this.categories.map((current) =>
      current.id === category.id ? category : current,
    );
  }
}
