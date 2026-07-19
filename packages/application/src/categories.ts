import {
  createStarterCategories,
  parseCategoryId,
  parseUtcTimestamp,
  renameCategory,
  validateCategoryHierarchy,
  type Category,
} from "@financial-intelligence/domain";

import type { ApplicationClock } from "./workspaces";

export interface CategoryRepository {
  list(): Promise<readonly Category[]>;
  putMany(categories: readonly Category[]): Promise<void>;
  save(category: Category): Promise<void>;
}

export class ListCategories {
  public constructor(
    private readonly repository: CategoryRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(): Promise<readonly Category[]> {
    const existing = await this.repository.list();
    if (existing.length > 0) return sortCategories(existing);
    const starters = createStarterCategories(parseUtcTimestamp(this.clock.now().toISOString()));
    await this.repository.putMany(starters);
    return starters;
  }
}

export class RenameCategory {
  public constructor(
    private readonly repository: CategoryRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(id: string, name: string): Promise<Category> {
    const categoryId = parseCategoryId(id);
    const categories = await this.repository.list();
    const current = categories.find((category) => category.id === categoryId);
    if (current === undefined) throw new Error("Category was not found");
    const next = renameCategory(current, name, parseUtcTimestamp(this.clock.now().toISOString()));
    validateCategoryHierarchy(
      categories.map((category) => (category.id === next.id ? next : category)),
    );
    await this.repository.save(next);
    return next;
  }
}

export class SetCategoryArchived {
  public constructor(
    private readonly repository: CategoryRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(id: string, archived: boolean): Promise<Category> {
    const categoryId = parseCategoryId(id);
    const categories = await this.repository.list();
    const current = categories.find((category) => category.id === categoryId);
    if (current === undefined) throw new Error("Category was not found");
    const next = {
      ...current,
      archived,
      updatedAt: parseUtcTimestamp(this.clock.now().toISOString()),
    };
    await this.repository.save(next);
    return next;
  }
}

function sortCategories(categories: readonly Category[]): readonly Category[] {
  return [...categories].sort(
    (left, right) => left.order - right.order || left.name.localeCompare(right.name),
  );
}
