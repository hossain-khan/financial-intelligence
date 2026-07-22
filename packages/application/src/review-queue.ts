import {
  addAliasToMerchant,
  createClassificationRule,
  createMerchantAlias,
  deriveReviewQueueItem,
  parseAliasId,
  parseOperationId,
  parseRuleId,
  parseUtcTimestamp,
  transactionToCanonical,
  type AccountType,
  type AccountId,
  type AiClassificationProvenance,
  type CategoryId,
  type MatchMode,
  type MerchantId,
  type ReviewQueueItem,
  type ReviewReason,
  type RuleId,
  type TransactionId,
} from "@financial-intelligence/domain";

import type { MerchantRepository } from "./merchants";
import type { AccountRepository } from "./accounts";
import type { AddMerchantAliasUseCase } from "./merchants";
import type { CreateRuleUseCase, RuleRepository } from "./rules";
import { assertNoDefiniteRuleConflict } from "./rules";
import type { ApplyBulkTransactionEdit } from "./transaction-ledger";
import type { TransactionLedgerRepository } from "./transaction-ledger";
import { planBulkTransactionEdit } from "./transaction-ledger";
import type { AtomicLearningRepository, LearningOperationChange } from "./learning-operations";
import type { ApplicationClock, IdGenerator } from "./workspaces";

export interface QueryReviewQueueInput {
  readonly accountId?: AccountId;
  readonly reason?: ReviewReason;
}

export interface ReviewQueueQueryResult {
  readonly items: readonly ReviewQueueItem[];
  readonly totalCount: number;
  readonly countsByReason: Readonly<Record<ReviewReason, number>>;
}

export class QueryReviewQueue {
  public constructor(
    private readonly ledgerRepository: TransactionLedgerRepository,
    private readonly ruleRepository: RuleRepository,
    private readonly merchantRepository: MerchantRepository,
    private readonly accountRepository?: AccountRepository,
  ) {}

  public async execute(input: QueryReviewQueueInput = {}): Promise<ReviewQueueQueryResult> {
    const [transactions, rules, merchants] = await Promise.all([
      this.ledgerRepository.list(),
      this.ruleRepository.list(),
      this.merchantRepository.list(),
    ]);

    const items: ReviewQueueItem[] = [];
    const accountTypes = new Map<string, AccountType>();
    if (this.accountRepository !== undefined) {
      await Promise.all(
        [...new Set(transactions.map(({ accountId }) => accountId))].map(async (accountId) => {
          const account = await this.accountRepository?.findById(accountId);
          if (account !== undefined) accountTypes.set(accountId, account.type);
        }),
      );
    }
    const countsByReason: Record<ReviewReason, number> = {
      unclassified: 0,
      "rule-conflict": 0,
      "low-confidence": 0,
      "merchant-collision": 0,
      "rule-changed": 0,
    };

    for (const tx of transactions) {
      if (input.accountId !== undefined && tx.accountId !== input.accountId) {
        continue;
      }

      const item = deriveReviewQueueItem(tx, rules, merchants, accountTypes.get(tx.accountId));
      if (item !== undefined) {
        countsByReason[item.reason]++;

        if (input.reason === undefined || item.reason === input.reason) {
          items.push(item);
        }
      }
    }

    // Sort by postedDate descending, then transactionId
    items.sort((a, b) => {
      if (a.postedDate !== b.postedDate) {
        return b.postedDate.localeCompare(a.postedDate);
      }
      return a.transactionId.localeCompare(b.transactionId);
    });

    return {
      items,
      totalCount: items.length,
      countsByReason,
    };
  }
}

export interface ApplyReviewCorrectionInput {
  readonly transactionIds: readonly TransactionId[];
  readonly categoryId?: CategoryId;
  readonly merchantId?: MerchantId;
  readonly provenance?: AiClassificationProvenance;
  readonly createRule?: {
    readonly name: string;
    readonly priority?: number;
    readonly conditions: readonly {
      readonly field:
        | "normalizedDescription"
        | "merchantId"
        | "accountId"
        | "accountType"
        | "postedDate"
        | "direction"
        | "amount"
        | "categoryId"
        | "tag";
      readonly operator: "equals" | "contains" | "startsWith" | "inRange";
      readonly value: string | { readonly minimum: string; readonly maximum: string };
    }[];
    readonly actions: readonly {
      readonly type:
        "setMerchant" | "setCategory" | "addTag" | "removeTag" | "markReviewed" | "markIgnored";
      readonly value: string | boolean;
    }[];
  };
  readonly createMerchantAlias?: {
    readonly merchantId: MerchantId;
    readonly pattern: string;
    readonly matchMode: MatchMode;
  };
}

export interface ApplyReviewCorrectionResult {
  readonly operationId: string;
  readonly updatedCount: number;
  readonly createdRuleId?: RuleId;
}

export class ApplyReviewCorrectionUseCase {
  public constructor(
    private readonly applyBulkEdit: ApplyBulkTransactionEdit,
    private readonly createRuleUseCase?: CreateRuleUseCase,
    private readonly addMerchantAliasUseCase?: AddMerchantAliasUseCase,
    private readonly atomicRepository?: AtomicLearningRepository,
    private readonly ledgerRepository?: TransactionLedgerRepository,
    private readonly ruleRepository?: RuleRepository,
    private readonly merchantRepository?: MerchantRepository,
    private readonly clock?: ApplicationClock,
    private readonly ids?: IdGenerator,
  ) {}

  public async execute(input: ApplyReviewCorrectionInput): Promise<ApplyReviewCorrectionResult> {
    if (input.transactionIds.length === 0) {
      throw new Error("At least one transaction must be selected for correction");
    }

    const edit = {
      ...(input.merchantId === undefined ? {} : { merchant: input.merchantId }),
      ...(input.categoryId === undefined ? {} : { category: input.categoryId }),
      ...(input.provenance === undefined ? {} : { provenance: input.provenance }),
    };

    if (
      this.atomicRepository !== undefined &&
      this.ledgerRepository !== undefined &&
      this.ruleRepository !== undefined &&
      this.merchantRepository !== undefined &&
      this.clock !== undefined &&
      this.ids !== undefined
    ) {
      const now = parseUtcTimestamp(this.clock.now().toISOString());
      const operationId = parseOperationId(this.ids.generate());
      const transactionOperation = planBulkTransactionEdit(
        await this.ledgerRepository.list(),
        input.transactionIds,
        edit,
        operationId,
        now,
      );
      const changes: LearningOperationChange[] = transactionOperation.changes.map(
        ({ transactionId, before, after }) => ({
          store: "transactions",
          id: transactionId,
          before: transactionToCanonical(before),
          after: transactionToCanonical(after),
        }),
      );
      let createdRuleId: RuleId | undefined;
      if (input.createRule !== undefined) {
        const rule = createClassificationRule({
          id: parseRuleId(this.ids.generate()),
          name: input.createRule.name,
          ...(input.createRule.priority === undefined
            ? {}
            : { priority: input.createRule.priority }),
          conditions: input.createRule.conditions,
          actions: input.createRule.actions,
          now,
        });
        if ((await this.ruleRepository.findById(rule.id)) !== undefined) {
          throw new Error("Generated rule ID already exists");
        }
        assertNoDefiniteRuleConflict(rule, await this.ruleRepository.list());
        changes.push({ store: "classificationRules", id: rule.id, after: rule });
        createdRuleId = rule.id;
      }
      if (input.createMerchantAlias !== undefined) {
        const existing = await this.merchantRepository.findById(
          input.createMerchantAlias.merchantId,
        );
        if (existing === undefined) throw new Error("Merchant was not found");
        const alias = createMerchantAlias({
          id: parseAliasId(this.ids.generate()),
          pattern: input.createMerchantAlias.pattern,
          matchMode: input.createMerchantAlias.matchMode,
          now,
        });
        const updated = addAliasToMerchant(existing, alias, now);
        changes.push({ store: "merchants", id: existing.id, before: existing, after: updated });
      }
      const expectedRevision = await this.atomicRepository.revision();
      await this.atomicRepository.apply({
        id: operationId,
        kind: "review-correction",
        inputDigest: `correction-v1:${operationId}`,
        expectedRevision,
        changes,
        createdAt: now,
      });
      return {
        operationId,
        updatedCount: transactionOperation.changes.length,
        ...(createdRuleId === undefined ? {} : { createdRuleId }),
      };
    }

    const operation = await this.applyBulkEdit.execute(
      input.transactionIds as unknown as string[],
      edit,
    );

    let createdRuleId: RuleId | undefined;

    if (input.createRule !== undefined && this.createRuleUseCase !== undefined) {
      const createdRule = await this.createRuleUseCase.execute({
        name: input.createRule.name,
        ...(input.createRule.priority === undefined ? {} : { priority: input.createRule.priority }),
        conditions: input.createRule.conditions,
        actions: input.createRule.actions,
      });
      createdRuleId = createdRule.id;
    }

    if (input.createMerchantAlias !== undefined && this.addMerchantAliasUseCase !== undefined) {
      await this.addMerchantAliasUseCase.execute({
        merchantId: input.createMerchantAlias.merchantId,
        pattern: input.createMerchantAlias.pattern,
        matchMode: input.createMerchantAlias.matchMode,
      });
    }

    return {
      operationId: operation.id,
      updatedCount: operation.changes.length,
      ...(createdRuleId === undefined ? {} : { createdRuleId }),
    };
  }
}
