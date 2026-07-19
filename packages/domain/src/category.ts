import type { CategoryId } from "./identifiers";
import { parseCategoryId } from "./identifiers";
import type { UtcTimestamp } from "./temporal";

export type CategoryKind = "income" | "expense" | "transfer" | "other";

export interface Category {
  readonly id: CategoryId;
  readonly name: string;
  readonly parentId?: CategoryId;
  readonly kind: CategoryKind;
  readonly icon?: string;
  readonly color?: string;
  readonly order: number;
  readonly archived: boolean;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
}

export interface CreateCategoryInput {
  readonly id: CategoryId;
  readonly name: string;
  readonly parentId?: CategoryId;
  readonly kind: CategoryKind;
  readonly icon?: string;
  readonly color?: string;
  readonly order: number;
  readonly now: UtcTimestamp;
}

export interface StarterCategoryDefinition {
  readonly id: CategoryId;
  readonly defaultName: string;
  readonly kind: CategoryKind;
  readonly order: number;
}

/**
 * Starter IDs are part of the portable data contract. Labels are intentionally
 * absent from the identity so that users may rename or localize them safely.
 */
export const STARTER_CATEGORY_DEFINITIONS: readonly StarterCategoryDefinition[] = [
  starter("3f791740-0a5b-52a6-9ae1-f46258c30b01", "Income", "income", 0),
  starter("3f791740-0a5b-52a6-9ae1-f46258c30b02", "Housing", "expense", 10),
  starter("3f791740-0a5b-52a6-9ae1-f46258c30b03", "Groceries", "expense", 20),
  starter("3f791740-0a5b-52a6-9ae1-f46258c30b04", "Restaurants", "expense", 30),
  starter("3f791740-0a5b-52a6-9ae1-f46258c30b05", "Transportation", "expense", 40),
  starter("3f791740-0a5b-52a6-9ae1-f46258c30b06", "Utilities", "expense", 50),
  starter("3f791740-0a5b-52a6-9ae1-f46258c30b07", "Healthcare", "expense", 60),
  starter("3f791740-0a5b-52a6-9ae1-f46258c30b08", "Shopping", "expense", 70),
  starter("3f791740-0a5b-52a6-9ae1-f46258c30b09", "Entertainment", "expense", 80),
  starter("3f791740-0a5b-52a6-9ae1-f46258c30b0a", "Transfers", "transfer", 90),
  starter("3f791740-0a5b-52a6-9ae1-f46258c30b0b", "Other", "other", 100),
] as const;

export function createCategory(input: CreateCategoryInput): Category {
  return {
    id: input.id,
    name: normalizeCategoryName(input.name),
    ...(input.parentId === undefined ? {} : { parentId: input.parentId }),
    kind: validateKind(input.kind),
    ...(input.icon === undefined ? {} : { icon: requiredText(input.icon, 80, "Category icon") }),
    ...(input.color === undefined ? {} : { color: validateColor(input.color) }),
    order: validateOrder(input.order),
    archived: false,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function createStarterCategories(now: UtcTimestamp): readonly Category[] {
  return STARTER_CATEGORY_DEFINITIONS.map((definition) =>
    createCategory({
      id: definition.id,
      name: definition.defaultName,
      kind: definition.kind,
      order: definition.order,
      now,
    }),
  );
}

export function renameCategory(category: Category, name: string, now: UtcTimestamp): Category {
  return { ...category, name: normalizeCategoryName(name), updatedAt: now };
}

export function validateCategoryHierarchy(categories: readonly Category[], maximumDepth = 3): void {
  if (!Number.isSafeInteger(maximumDepth) || maximumDepth < 1) {
    throw new RangeError("Category maximum depth must be a positive integer");
  }
  const byId = new Map(categories.map((category) => [category.id, category]));
  if (byId.size !== categories.length) throw new RangeError("Category IDs must be unique");
  for (const category of categories) {
    const seen = new Set<CategoryId>([category.id]);
    let current = category;
    let depth = 1;
    while (current.parentId !== undefined) {
      const parent = byId.get(current.parentId);
      if (parent === undefined) throw new RangeError("Category parent does not exist");
      if (seen.has(parent.id)) throw new RangeError("Category hierarchy contains a cycle");
      seen.add(parent.id);
      depth += 1;
      if (depth > maximumDepth) throw new RangeError("Category hierarchy exceeds maximum depth");
      current = parent;
    }
  }
}

function starter(
  id: string,
  defaultName: string,
  kind: CategoryKind,
  order: number,
): StarterCategoryDefinition {
  return { id: parseCategoryId(id), defaultName, kind, order };
}

function normalizeCategoryName(value: string): string {
  const normalized = value.normalize("NFKC").replaceAll(/\s+/gu, " ").trim();
  if (normalized.length === 0 || normalized.length > 120) {
    throw new RangeError("Category name must contain between 1 and 120 characters");
  }
  return normalized;
}

function validateKind(value: CategoryKind): CategoryKind {
  if (!(["income", "expense", "transfer", "other"] as const).includes(value)) {
    throw new RangeError("Category kind is invalid");
  }
  return value;
}

function validateOrder(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError("Category order must be a non-negative safe integer");
  }
  return value;
}

function requiredText(value: string, maximum: number, label: string): string {
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new RangeError(`${label} must contain between 1 and ${maximum} characters`);
  }
  return normalized;
}

function validateColor(value: string): string {
  if (!/^#[0-9a-f]{6}$/iu.test(value)) {
    throw new RangeError("Category color must be a six-digit hexadecimal color");
  }
  return value.toUpperCase();
}
