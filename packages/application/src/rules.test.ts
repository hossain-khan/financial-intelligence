import { describe, expect, it } from "vitest";
import {
  Money,
  parseAccountId,
  parseCategoryId,
  parseTransactionId,
  type ClassificationRule,
  type RuleId,
  type TransactionRuleEvaluationContext,
} from "@financial-intelligence/domain";

import {
  CreateRuleUseCase,
  DeleteRuleUseCase,
  EvaluateTransactionRulesUseCase,
  ListRules,
  PreviewRuleImpactUseCase,
  RuleActivationConflictError,
  UpdateRuleUseCase,
  type RuleRepository,
} from "./rules";

class InMemoryRuleRepository implements RuleRepository {
  private readonly rules = new Map<string, ClassificationRule>();

  public async list(): Promise<readonly ClassificationRule[]> {
    return Array.from(this.rules.values());
  }

  public async findById(id: RuleId): Promise<ClassificationRule | undefined> {
    return this.rules.get(id);
  }

  public async save(rule: ClassificationRule): Promise<void> {
    this.rules.set(rule.id, rule);
  }

  public async delete(id: RuleId): Promise<void> {
    this.rules.delete(id);
  }
}

const mockClock = {
  now: () => new Date("2026-07-20T10:00:00Z"),
};

let counter = 1;
const mockIds = {
  generate: () => `018f6b80-0d62-7d2c-9a5c-7f5f59cda20${counter++}`,
};

const CATEGORY_ID_RESTAURANTS = parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b04");
const CATEGORY_ID_GROCERIES = parseCategoryId("3f791740-0a5b-52a6-9ae1-f46258c30b05");
const TRANSACTION_ID = parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda210");
const ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda220");

const SAMPLE_CONTEXT: TransactionRuleEvaluationContext = {
  transactionId: TRANSACTION_ID,
  rawDescription: "TIM HORTONS #145 OSHAWA ON",
  normalizedDescription: "tim hortons oshawa on",
  accountId: ACCOUNT_ID,
  accountType: "checking",
  amount: Money.from("-5.25", "CAD"),
};

describe("Rule application use cases", () => {
  it("creates, lists, updates, and deletes rules", async () => {
    const repository = new InMemoryRuleRepository();
    const createUseCase = new CreateRuleUseCase(repository, mockClock, mockIds);
    const listUseCase = new ListRules(repository);
    const updateUseCase = new UpdateRuleUseCase(repository, mockClock);
    const deleteUseCase = new DeleteRuleUseCase(repository);

    const created = await createUseCase.execute({
      name: "Tim Hortons Rule",
      priority: 20,
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setCategory", value: CATEGORY_ID_RESTAURANTS }],
    });

    expect(created.name).toBe("Tim Hortons Rule");
    expect(created.priority).toBe(20);

    const rules = await listUseCase.execute();
    expect(rules).toHaveLength(1);

    const updated = await updateUseCase.execute({
      id: created.id,
      priority: 50,
    });
    expect(updated.priority).toBe(50);

    await deleteUseCase.execute(created.id);
    expect(await listUseCase.execute()).toHaveLength(0);
  });

  it("evaluates transaction rules and previews impact", async () => {
    const repository = new InMemoryRuleRepository();
    const createUseCase = new CreateRuleUseCase(repository, mockClock, mockIds);
    const evalUseCase = new EvaluateTransactionRulesUseCase(repository);
    const previewUseCase = new PreviewRuleImpactUseCase(repository);

    await createUseCase.execute({
      name: "Tim Hortons Rule",
      conditions: [
        { field: "normalizedDescription", operator: "startsWith", value: "tim hortons" },
      ],
      actions: [{ type: "setCategory", value: CATEGORY_ID_RESTAURANTS }],
    });

    const evalResult = await evalUseCase.execute(SAMPLE_CONTEXT);
    expect(evalResult.categoryResult.status).toBe("matched");
    expect(evalResult.categoryResult.value).toBe(CATEGORY_ID_RESTAURANTS);

    const preview = await previewUseCase.execute([SAMPLE_CONTEXT]);
    expect(preview.totalTransactions).toBe(1);
    expect(preview.matchedTransactions).toBe(1);
    expect(preview.lockedTransactions).toBe(0);
    expect(preview.conflictTransactions).toBe(0);
  });

  it("rejects a definite equal-precedence conflict before activation", async () => {
    const repository = new InMemoryRuleRepository();
    const createUseCase = new CreateRuleUseCase(repository, mockClock, mockIds);
    const conditions = [
      { field: "normalizedDescription" as const, operator: "startsWith" as const, value: "market" },
    ];
    await createUseCase.execute({
      name: "Market restaurants",
      priority: 10,
      conditions,
      actions: [{ type: "setCategory", value: CATEGORY_ID_RESTAURANTS }],
    });

    await expect(
      createUseCase.execute({
        name: "Market groceries",
        priority: 10,
        conditions,
        actions: [{ type: "setCategory", value: CATEGORY_ID_GROCERIES }],
      }),
    ).rejects.toBeInstanceOf(RuleActivationConflictError);
    expect(await repository.list()).toHaveLength(1);
  });
});
