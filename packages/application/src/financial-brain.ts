import {
  FINANCIAL_BRAIN_SCHEMA_VERSION,
  parseAndValidateFinancialBrain,
  parseBrainId,
  parseUtcTimestamp,
  planFinancialBrainMerge,
  serializeFinancialBrain,
  type BrainImportPlan,
  type FinancialBrainDocument,
  type FinancialBrainValidator,
} from "@financial-intelligence/domain";

import type { CategoryRepository } from "./categories";
import type { MerchantRepository } from "./merchants";
import type { RuleRepository } from "./rules";
import type { ApplicationClock, IdGenerator } from "./workspaces";

export class ExportFinancialBrainUseCase {
  public constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly merchantRepository: MerchantRepository,
    private readonly ruleRepository: RuleRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(): Promise<{ fileName: string; content: string }> {
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const [categories, merchants, rules] = await Promise.all([
      this.categoryRepository.list(),
      this.merchantRepository.list(),
      this.ruleRepository.list(),
    ]);

    const brainDoc: FinancialBrainDocument = {
      schemaVersion: FINANCIAL_BRAIN_SCHEMA_VERSION,
      brainId: parseBrainId(this.ids.generate()),
      createdAt: now,
      updatedAt: now,
      producer: {
        application: "Financial Intelligence",
        version: "0.1.0",
      },
      categories,
      merchants,
      rules,
      recurringDecisions: [],
      preferences: {
        locale: "en-US",
        firstDayOfWeek: "monday",
        reviewConfidenceThreshold: 0.8,
      },
    };

    const content = serializeFinancialBrain(brainDoc);
    const dateStr = now.slice(0, 10);
    const fileName = `financial-brain-${dateStr}.financial-brain.json`;

    return { fileName, content };
  }
}

export class PreviewFinancialBrainImportUseCase {
  public constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly merchantRepository: MerchantRepository,
    private readonly ruleRepository: RuleRepository,
    private readonly validator?: FinancialBrainValidator,
  ) {}

  public async execute(rawJson: string): Promise<{
    doc: FinancialBrainDocument;
    plan: BrainImportPlan;
  }> {
    const doc = parseAndValidateFinancialBrain(rawJson, this.validator);

    const [categories, merchants, rules] = await Promise.all([
      this.categoryRepository.list(),
      this.merchantRepository.list(),
      this.ruleRepository.list(),
    ]);

    const plan = planFinancialBrainMerge(
      { categories, merchants, rules, recurringDecisions: [] },
      {
        categories: doc.categories,
        merchants: doc.merchants,
        rules: doc.rules,
        recurringDecisions: doc.recurringDecisions,
      },
    );

    return { doc, plan };
  }
}

export class ApplyFinancialBrainImportUseCase {
  public constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly merchantRepository: MerchantRepository,
    private readonly ruleRepository: RuleRepository,
    private readonly ids: IdGenerator,
    private readonly validator?: FinancialBrainValidator,
  ) {}

  public async execute(input: {
    rawJson: string;
    conflictResolutions?: ReadonlyMap<string, "keep-local" | "accept-incoming">;
  }): Promise<{ operationId: string; appliedCount: number }> {
    const doc = parseAndValidateFinancialBrain(input.rawJson, this.validator);

    const [localCategories, localMerchants, localRules] = await Promise.all([
      this.categoryRepository.list(),
      this.merchantRepository.list(),
      this.ruleRepository.list(),
    ]);

    const plan = planFinancialBrainMerge(
      {
        categories: localCategories,
        merchants: localMerchants,
        rules: localRules,
        recurringDecisions: [],
      },
      {
        categories: doc.categories,
        merchants: doc.merchants,
        rules: doc.rules,
        recurringDecisions: doc.recurringDecisions,
      },
    );

    const unresolved = plan.conflicts.filter(
      (c) => input.conflictResolutions?.get(c.id) === undefined,
    );
    if (unresolved.length > 0) {
      throw new Error(`Cannot apply import with ${unresolved.length} unresolved conflict(s)`);
    }

    let appliedCount = 0;

    // Apply category additions & accepted updates
    for (const cat of [...plan.additions.categories, ...plan.updates.categories]) {
      await this.categoryRepository.save(cat);
      appliedCount++;
    }
    for (const conf of plan.conflicts.filter((c) => c.kind === "category")) {
      if (input.conflictResolutions?.get(conf.id) === "accept-incoming") {
        await this.categoryRepository.save(conf.incoming as (typeof localCategories)[0]);
        appliedCount++;
      }
    }

    // Apply merchant additions & accepted updates
    for (const merch of [...plan.additions.merchants, ...plan.updates.merchants]) {
      await this.merchantRepository.save(merch);
      appliedCount++;
    }

    // Apply rule additions & accepted updates
    for (const rule of [...plan.additions.rules, ...plan.updates.rules]) {
      await this.ruleRepository.save(rule);
      appliedCount++;
    }

    const operationId = this.ids.generate();
    return { operationId, appliedCount };
  }
}
