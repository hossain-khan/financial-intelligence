import {
  createClassificationRule,
  evaluateClassificationRules,
  parseRuleId,
  parseUtcTimestamp,
  type ActionType,
  type AmountRange,
  type ClassificationRule,
  type ConditionField,
  type ConditionOperator,
  type RuleId,
  type RuleSource,
  type TransactionRuleEvaluation,
  type TransactionRuleEvaluationContext,
} from "@financial-intelligence/domain";

import type { ApplicationClock, IdGenerator } from "./workspaces";

export interface RuleRepository {
  list(): Promise<readonly ClassificationRule[]>;
  findById(id: RuleId): Promise<ClassificationRule | undefined>;
  save(rule: ClassificationRule): Promise<void>;
  delete(id: RuleId): Promise<void>;
}

export interface RuleImpactPreview {
  readonly totalTransactions: number;
  readonly matchedTransactions: number;
  readonly lockedTransactions: number;
  readonly conflictTransactions: number;
  readonly sampleEvaluations: readonly TransactionRuleEvaluation[];
}

export class ListRules {
  public constructor(private readonly repository: RuleRepository) {}

  public async execute(): Promise<readonly ClassificationRule[]> {
    const rules = await this.repository.list();
    return [...rules].sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.name.localeCompare(b.name);
    });
  }
}

export class CreateRuleUseCase {
  public constructor(
    private readonly repository: RuleRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(input: {
    id?: string;
    name: string;
    enabled?: boolean;
    priority?: number;
    conditions: readonly {
      field: ConditionField;
      operator: ConditionOperator;
      value: string | AmountRange;
    }[];
    actions: readonly {
      type: ActionType;
      value: string | boolean;
    }[];
    createdBy?: RuleSource;
  }): Promise<ClassificationRule> {
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const ruleId = input.id ? parseRuleId(input.id) : parseRuleId(this.ids.generate());

    const rule = createClassificationRule({
      id: ruleId,
      name: input.name,
      ...(input.enabled === undefined ? {} : { enabled: input.enabled }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      conditions: input.conditions,
      actions: input.actions,
      ...(input.createdBy === undefined ? {} : { createdBy: input.createdBy }),
      now,
    });

    await this.repository.save(rule);
    return rule;
  }
}

export class UpdateRuleUseCase {
  public constructor(
    private readonly repository: RuleRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(input: {
    id: string;
    name?: string;
    enabled?: boolean;
    priority?: number;
    conditions?: readonly {
      field: ConditionField;
      operator: ConditionOperator;
      value: string | AmountRange;
    }[];
    actions?: readonly {
      type: ActionType;
      value: string | boolean;
    }[];
  }): Promise<ClassificationRule> {
    const ruleId = parseRuleId(input.id);
    const existing = await this.repository.findById(ruleId);
    if (existing === undefined) {
      throw new Error(`Rule ${input.id} was not found`);
    }

    const now = parseUtcTimestamp(this.clock.now().toISOString());

    const updated = createClassificationRule({
      id: existing.id,
      name: input.name ?? existing.name,
      enabled: input.enabled ?? existing.enabled,
      priority: input.priority ?? existing.priority,
      conditions: input.conditions ?? existing.conditions,
      actions: input.actions ?? existing.actions,
      createdBy: existing.createdBy,
      now,
    });

    await this.repository.save(updated);
    return updated;
  }
}

export class DeleteRuleUseCase {
  public constructor(private readonly repository: RuleRepository) {}

  public async execute(id: string): Promise<void> {
    const ruleId = parseRuleId(id);
    const existing = await this.repository.findById(ruleId);
    if (existing === undefined) {
      throw new Error(`Rule ${id} was not found`);
    }
    await this.repository.delete(ruleId);
  }
}

export class EvaluateTransactionRulesUseCase {
  public constructor(private readonly repository: RuleRepository) {}

  public async execute(
    context: TransactionRuleEvaluationContext,
  ): Promise<TransactionRuleEvaluation> {
    const rules = await this.repository.list();
    return evaluateClassificationRules(context, rules);
  }
}

export class PreviewRuleImpactUseCase {
  public constructor(private readonly repository: RuleRepository) {}

  public async execute(
    contexts: readonly TransactionRuleEvaluationContext[],
    proposedRule?: ClassificationRule,
  ): Promise<RuleImpactPreview> {
    let rules = await this.repository.list();
    if (proposedRule !== undefined) {
      rules = [...rules.filter((r) => r.id !== proposedRule.id), proposedRule];
    }

    let matchedCount = 0;
    let lockedCount = 0;
    let conflictCount = 0;

    const evaluations: TransactionRuleEvaluation[] = [];

    for (const ctx of contexts) {
      const result = evaluateClassificationRules(ctx, rules);
      evaluations.push(result);

      const isMatched =
        result.merchantResult.status === "matched" || result.categoryResult.status === "matched";
      const isLocked =
        result.merchantResult.status === "locked" || result.categoryResult.status === "locked";
      const isConflict =
        result.merchantResult.status === "conflict" || result.categoryResult.status === "conflict";

      if (isMatched) matchedCount++;
      if (isLocked) lockedCount++;
      if (isConflict) conflictCount++;
    }

    return {
      totalTransactions: contexts.length,
      matchedTransactions: matchedCount,
      lockedTransactions: lockedCount,
      conflictTransactions: conflictCount,
      sampleEvaluations: evaluations.slice(0, 20),
    };
  }
}
