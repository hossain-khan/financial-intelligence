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
import type { RecurringDecisionRepository } from "./recurring";
import type { RuleRepository } from "./rules";
import type { ApplicationClock, IdGenerator } from "./workspaces";
import type { AtomicLearningRepository, LearningOperationChange } from "./learning-operations";

export interface FinancialBrainDigest {
  digest(value: string): Promise<string>;
}

export class ExportFinancialBrainUseCase {
  public constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly merchantRepository: MerchantRepository,
    private readonly ruleRepository: RuleRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
    private readonly recurringRepository?: RecurringDecisionRepository,
    private readonly validator?: FinancialBrainValidator,
  ) {}

  public async execute(): Promise<{ fileName: string; content: string }> {
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const [categories, merchants, rules, recurringDecisions] = await Promise.all([
      this.categoryRepository.list(),
      this.merchantRepository.list(),
      this.ruleRepository.list(),
      this.recurringRepository?.list() ?? [],
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
      recurringDecisions: recurringDecisions.flatMap((decision) => {
        if (
          decision.status !== "confirmed" &&
          decision.status !== "dismissed" &&
          decision.status !== "muted"
        )
          return [];
        return [
          {
            id: decision.id,
            signature: decision.signature,
            ...(decision.name === undefined ? {} : { name: decision.name }),
            ...(decision.merchantId === undefined ? {} : { merchantId: decision.merchantId }),
            status: decision.status,
            ...(decision.cadence === undefined ? {} : { cadence: decision.cadence }),
            ...(decision.toleranceDays === undefined
              ? {}
              : { toleranceDays: decision.toleranceDays }),
            updatedAt: decision.updatedAt,
          },
        ];
      }),
      preferences: {
        locale: "en-US",
        firstDayOfWeek: "monday",
        reviewConfidenceThreshold: 0.8,
      },
    };

    const content = serializeFinancialBrain(brainDoc);
    parseAndValidateFinancialBrain(content, this.validator);
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
    private readonly recurringRepository?: RecurringDecisionRepository,
    private readonly atomicRepository?: AtomicLearningRepository,
    private readonly digest?: FinancialBrainDigest,
  ) {}

  public async execute(rawJson: string): Promise<{
    doc: FinancialBrainDocument;
    plan: BrainImportPlan;
    sourceRevision: string;
    inputDigest: string;
  }> {
    const doc = parseAndValidateFinancialBrain(rawJson, this.validator);

    const [categories, merchants, rules, recurringDecisions] = await Promise.all([
      this.categoryRepository.list(),
      this.merchantRepository.list(),
      this.ruleRepository.list(),
      this.recurringRepository?.list() ?? [],
    ]);

    const plan = planFinancialBrainMerge(
      { categories, merchants, rules, recurringDecisions },
      {
        categories: doc.categories,
        merchants: doc.merchants,
        rules: doc.rules,
        recurringDecisions: doc.recurringDecisions,
      },
    );

    const [sourceRevision, inputDigest] = await Promise.all([
      this.atomicRepository?.revision() ?? Promise.resolve("legacy-unversioned"),
      this.digest?.digest(rawJson) ?? Promise.resolve(`legacy-${rawJson.length}`),
    ]);
    return { doc, plan, sourceRevision, inputDigest };
  }
}

export class ApplyFinancialBrainImportUseCase {
  public constructor(
    private readonly categoryRepository: CategoryRepository,
    private readonly merchantRepository: MerchantRepository,
    private readonly ruleRepository: RuleRepository,
    private readonly ids: IdGenerator,
    private readonly validator?: FinancialBrainValidator,
    private readonly recurringRepository?: RecurringDecisionRepository,
    private readonly atomicRepository?: AtomicLearningRepository,
    private readonly digest?: FinancialBrainDigest,
    private readonly clock: ApplicationClock = { now: () => new Date() },
  ) {}

  public async execute(input: {
    rawJson: string;
    conflictResolutions?: ReadonlyMap<string, "keep-local" | "accept-incoming">;
    sourceRevision?: string;
    inputDigest?: string;
    acknowledgeSemanticDuplicates?: boolean;
  }): Promise<{ operationId: string; appliedCount: number }> {
    const doc = parseAndValidateFinancialBrain(input.rawJson, this.validator);

    const [localCategories, localMerchants, localRules, localRecurringDecisions] =
      await Promise.all([
        this.categoryRepository.list(),
        this.merchantRepository.list(),
        this.ruleRepository.list(),
        this.recurringRepository?.list() ?? [],
      ]);

    const plan = planFinancialBrainMerge(
      {
        categories: localCategories,
        merchants: localMerchants,
        rules: localRules,
        recurringDecisions: localRecurringDecisions,
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
    if (plan.semanticDuplicates.length > 0 && input.acknowledgeSemanticDuplicates !== true) {
      throw new Error("Possible semantic duplicates must be explicitly acknowledged");
    }

    if (this.atomicRepository !== undefined) {
      if (input.sourceRevision === undefined || input.inputDigest === undefined) {
        throw new Error("Financial Brain apply requires its preview revision and digest");
      }
      const actualDigest = await this.digest?.digest(input.rawJson);
      if (actualDigest !== undefined && actualDigest !== input.inputDigest) {
        throw new Error("Financial Brain input changed after preview");
      }
      const changes = brainLearningChanges(plan, input.conflictResolutions, {
        localCategories,
        localMerchants,
        localRules,
        localRecurringDecisions,
      });
      const operationId = this.ids.generate();
      await this.atomicRepository.apply({
        id: operationId,
        kind: "brain-import",
        inputDigest: input.inputDigest,
        expectedRevision: input.sourceRevision,
        changes,
        createdAt: parseUtcTimestamp(this.clock.now().toISOString()),
      });
      return { operationId, appliedCount: changes.length };
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
    for (const conf of plan.conflicts.filter((c) => c.kind === "merchant")) {
      if (input.conflictResolutions?.get(conf.id) === "accept-incoming") {
        await this.merchantRepository.save(conf.incoming as (typeof localMerchants)[0]);
        appliedCount++;
      }
    }

    // Apply rule additions & accepted updates
    for (const rule of [...plan.additions.rules, ...plan.updates.rules]) {
      await this.ruleRepository.save(rule);
      appliedCount++;
    }

    if (this.recurringRepository !== undefined) {
      for (const decision of [
        ...plan.additions.recurringDecisions,
        ...plan.updates.recurringDecisions,
      ]) {
        await this.recurringRepository.save(decision);
        appliedCount++;
      }
      for (const conf of plan.conflicts.filter((c) => c.kind === "recurringDecision")) {
        if (input.conflictResolutions?.get(conf.id) === "accept-incoming") {
          await this.recurringRepository.save(conf.incoming as (typeof localRecurringDecisions)[0]);
          appliedCount++;
        }
      }
    } else if (
      plan.additions.recurringDecisions.length > 0 ||
      plan.updates.recurringDecisions.length > 0
    ) {
      throw new Error("Recurring decision storage is unavailable");
    }

    const operationId = this.ids.generate();
    return { operationId, appliedCount };
  }
}

function brainLearningChanges(
  plan: BrainImportPlan,
  resolutions: ReadonlyMap<string, "keep-local" | "accept-incoming"> | undefined,
  local: {
    readonly localCategories: readonly { readonly id: string }[];
    readonly localMerchants: readonly { readonly id: string }[];
    readonly localRules: readonly { readonly id: string }[];
    readonly localRecurringDecisions: readonly { readonly id: string }[];
  },
): readonly LearningOperationChange[] {
  const changes: LearningOperationChange[] = [];
  const append = (
    store: LearningOperationChange["store"],
    incoming: readonly { readonly id: string }[],
    existing: readonly { readonly id: string }[],
  ) => {
    const byId = new Map(existing.map((value) => [value.id, value]));
    for (const after of incoming) {
      const before = byId.get(after.id);
      changes.push({ store, id: after.id, ...(before === undefined ? {} : { before }), after });
    }
  };
  append(
    "categories",
    [...plan.additions.categories, ...plan.updates.categories],
    local.localCategories,
  );
  append(
    "merchants",
    [...plan.additions.merchants, ...plan.updates.merchants],
    local.localMerchants,
  );
  append("classificationRules", [...plan.additions.rules, ...plan.updates.rules], local.localRules);
  append(
    "recurringDecisions",
    [...plan.additions.recurringDecisions, ...plan.updates.recurringDecisions],
    local.localRecurringDecisions,
  );
  for (const conflict of plan.conflicts) {
    if (resolutions?.get(conflict.id) !== "accept-incoming") continue;
    const store =
      conflict.kind === "category"
        ? "categories"
        : conflict.kind === "merchant"
          ? "merchants"
          : conflict.kind === "rule"
            ? "classificationRules"
            : "recurringDecisions";
    changes.push({ store, id: conflict.id, before: conflict.local, after: conflict.incoming });
  }
  return changes;
}
