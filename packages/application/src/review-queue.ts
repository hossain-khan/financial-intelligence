import {
  deriveReviewQueueItem,
  type AccountId,
  type CategoryId,
  type MatchMode,
  type MerchantId,
  type ReviewQueueItem,
  type ReviewReason,
  type RuleId,
  type TransactionId,
} from "@financial-intelligence/domain";

import type { MerchantRepository } from "./merchants";
import type { AddMerchantAliasUseCase } from "./merchants";
import type { CreateRuleUseCase, RuleRepository } from "./rules";
import type { ApplyBulkTransactionEdit } from "./transaction-ledger";
import type { TransactionLedgerRepository } from "./transaction-ledger";

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
  ) {}

  public async execute(input: QueryReviewQueueInput = {}): Promise<ReviewQueueQueryResult> {
    const [transactions, rules, merchants] = await Promise.all([
      this.ledgerRepository.list(),
      this.ruleRepository.list(),
      this.merchantRepository.list(),
    ]);

    const items: ReviewQueueItem[] = [];
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

      const item = deriveReviewQueueItem(tx, rules, merchants);
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
  readonly createRule?: {
    readonly name: string;
    readonly priority?: number;
    readonly conditions: readonly {
      readonly field:
        | "normalizedDescription"
        | "merchantId"
        | "accountType"
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
  ) {}

  public async execute(input: ApplyReviewCorrectionInput): Promise<ApplyReviewCorrectionResult> {
    if (input.transactionIds.length === 0) {
      throw new Error("At least one transaction must be selected for correction");
    }

    const edit = {
      ...(input.categoryId === undefined ? {} : { category: input.categoryId }),
    };

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
