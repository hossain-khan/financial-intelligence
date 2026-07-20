import { describe, expect, it } from "vitest";

import {
  parseBrainId,
  parseCategoryId,
  parseMerchantId,
  parseRuleId,
  parseUtcTimestamp,
  serializeFinancialBrain,
  type Category,
  type ClassificationRule,
  type FinancialBrainDocument,
  type Merchant,
} from "@financial-intelligence/domain";

import type { CategoryRepository } from "./categories";
import {
  ApplyFinancialBrainImportUseCase,
  ExportFinancialBrainUseCase,
  PreviewFinancialBrainImportUseCase,
} from "./financial-brain";
import type { MerchantRepository } from "./merchants";
import type { RuleRepository } from "./rules";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");

class InMemoryCategoryRepository implements CategoryRepository {
  private readonly items = new Map<string, Category>();
  public async list(): Promise<readonly Category[]> {
    return Array.from(this.items.values());
  }
  public async findById(id: string): Promise<Category | undefined> {
    return this.items.get(id);
  }
  public async save(category: Category): Promise<void> {
    this.items.set(category.id, category);
  }
  public async putMany(categories: readonly Category[]): Promise<void> {
    for (const c of categories) this.items.set(c.id, c);
  }
}

class InMemoryMerchantRepository implements MerchantRepository {
  private readonly items = new Map<string, Merchant>();
  public async list(): Promise<readonly Merchant[]> {
    return Array.from(this.items.values());
  }
  public async findById(id: string): Promise<Merchant | undefined> {
    return this.items.get(id);
  }
  public async save(merchant: Merchant): Promise<void> {
    this.items.set(merchant.id, merchant);
  }
  public async saveMany(merchants: readonly Merchant[]): Promise<void> {
    for (const m of merchants) this.items.set(m.id, m);
  }
}

class InMemoryRuleRepository implements RuleRepository {
  private readonly items = new Map<string, ClassificationRule>();
  public async list(): Promise<readonly ClassificationRule[]> {
    return Array.from(this.items.values());
  }
  public async findById(id: string): Promise<ClassificationRule | undefined> {
    return this.items.get(id);
  }
  public async save(rule: ClassificationRule): Promise<void> {
    this.items.set(rule.id, rule);
  }
  public async delete(id: string): Promise<void> {
    this.items.delete(id);
  }
}

describe("Financial Brain application services", () => {
  it("exports Financial Brain JSON with canonical structure", async () => {
    const categories = new InMemoryCategoryRepository();
    const merchants = new InMemoryMerchantRepository();
    const rules = new InMemoryRuleRepository();

    const catId = parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b01");
    await categories.save({
      id: catId,
      name: "Food",
      kind: "expense",
      order: 1,
      archived: false,
      createdAt: NOW,
      updatedAt: NOW,
    });

    const exportUseCase = new ExportFinancialBrainUseCase(
      categories,
      merchants,
      rules,
      { now: () => new Date("2026-07-20T10:00:00Z") },
      { generate: () => "018f6b80-0d62-7d2c-9a5c-7f5f59cda999" },
    );

    const res = await exportUseCase.execute();
    expect(res.fileName).toContain("financial-brain-2026-07-20");
    expect(res.content).toContain('"name": "Food"');
  });

  it("previews and applies Financial Brain import", async () => {
    const categories = new InMemoryCategoryRepository();
    const merchants = new InMemoryMerchantRepository();
    const rules = new InMemoryRuleRepository();

    const previewUseCase = new PreviewFinancialBrainImportUseCase(categories, merchants, rules);
    const applyUseCase = new ApplyFinancialBrainImportUseCase(categories, merchants, rules, {
      generate: () => "018f6b80-0d62-7d2c-9a5c-7f5f59cda888",
    });

    const catId = parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b01");
    const merchId = parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda230");
    const ruleId = parseRuleId("018f6b80-0d62-7d2c-9a5c-7f5f59cda240");

    const brainDoc: FinancialBrainDocument = {
      schemaVersion: "1.0.0",
      brainId: parseBrainId("018f6b80-0d62-7d2c-9a5c-7f5f59cda999"),
      createdAt: NOW,
      updatedAt: NOW,
      producer: { application: "Financial Intelligence", version: "0.1.0" },
      categories: [
        {
          id: catId,
          name: "Groceries",
          kind: "expense",
          order: 1,
          archived: false,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      merchants: [
        {
          id: merchId,
          name: "Metro",
          aliases: [],
          archived: false,
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      rules: [
        {
          schemaVersion: "1.0.0",
          id: ruleId,
          name: "Groceries Rule",
          enabled: true,
          priority: 5,
          conditions: [{ field: "normalizedDescription", operator: "startsWith", value: "metro" }],
          actions: [{ type: "setCategory", value: catId }],
          createdBy: "user",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      recurringDecisions: [],
      preferences: { locale: "en-US", firstDayOfWeek: "monday", reviewConfidenceThreshold: 0.8 },
    };

    const json = serializeFinancialBrain(brainDoc);
    const preview = await previewUseCase.execute(json);
    expect(preview.plan.additions.categories).toHaveLength(1);
    expect(preview.plan.additions.merchants).toHaveLength(1);

    const applyRes = await applyUseCase.execute({ rawJson: json });
    expect(applyRes.appliedCount).toBe(3);

    const importedCats = await categories.list();
    expect(importedCats).toHaveLength(1);
    expect(importedCats[0]?.name).toBe("Groceries");
  });
});
