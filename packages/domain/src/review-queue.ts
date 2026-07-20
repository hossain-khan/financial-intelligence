import {
  evaluateClassificationRules,
  type ClassificationRule,
  type TransactionRuleEvaluationContext,
} from "./classification-rule";
import type { AccountId, CategoryId, MerchantId, TransactionId } from "./identifiers";
import {
  matchDescriptionToMerchants,
  normalizeMerchantDescription,
  type Merchant,
} from "./merchant";
import type { Money } from "./money";
import type { AccountType } from "./account";
import type { DateOnly } from "./temporal";
import type { Transaction } from "./transaction";

export type ReviewReason =
  "unclassified" | "rule-conflict" | "low-confidence" | "merchant-collision" | "rule-changed";

export interface ReviewQueueItem {
  readonly transactionId: TransactionId;
  readonly accountId: AccountId;
  readonly postedDate: DateOnly;
  readonly rawDescription: string;
  readonly normalizedDescription: string;
  readonly amount: Money;
  readonly currentCategoryId?: CategoryId;
  readonly currentMerchantId?: MerchantId;
  readonly reason: ReviewReason;
  readonly explanation: string;
  readonly suggestedCategory?: CategoryId;
  readonly suggestedMerchant?: MerchantId;
  readonly isLockedCategory: boolean;
  readonly isLockedMerchant: boolean;
}

export function deriveReviewQueueItem(
  transaction: Transaction,
  rules: readonly ClassificationRule[] = [],
  merchants: readonly Merchant[] = [],
  accountType: AccountType = "checking",
): ReviewQueueItem | undefined {
  const normDescription = normalizeMerchantDescription(transaction.description);

  const isLockedCategory =
    transaction.classifications.category?.locked ??
    transaction.classifications.category?.method === "user";
  const isLockedMerchant =
    transaction.classifications.merchant?.locked ??
    transaction.classifications.merchant?.method === "user";

  const evalContext: TransactionRuleEvaluationContext = {
    transactionId: transaction.id,
    rawDescription: transaction.description,
    normalizedDescription: normDescription,
    accountId: transaction.accountId,
    accountType,
    postedDate: transaction.postedDate,
    amount: transaction.money,
    tags: transaction.tags,
    isLockedCategory,
    isLockedMerchant: transaction.merchantId !== undefined,
    ...(transaction.merchantId === undefined ? {} : { merchantId: transaction.merchantId }),
    ...(transaction.categoryId === undefined ? {} : { categoryId: transaction.categoryId }),
  };

  const ruleEval = evaluateClassificationRules(evalContext, rules);

  const suggestedCategory =
    ruleEval.categoryResult.status === "matched" && ruleEval.categoryResult.value !== undefined
      ? (ruleEval.categoryResult.value as CategoryId)
      : undefined;

  const suggestedMerchant =
    ruleEval.merchantResult.status === "matched" && ruleEval.merchantResult.value !== undefined
      ? (ruleEval.merchantResult.value as MerchantId)
      : undefined;

  // 1. Rule conflicts
  if (
    ruleEval.categoryResult.status === "conflict" ||
    ruleEval.merchantResult.status === "conflict"
  ) {
    const conflictReason =
      ruleEval.categoryResult.status === "conflict"
        ? ruleEval.categoryResult.reason
        : ruleEval.merchantResult.reason;

    return {
      transactionId: transaction.id,
      accountId: transaction.accountId,
      postedDate: transaction.postedDate,
      rawDescription: transaction.description,
      normalizedDescription: normDescription,
      amount: transaction.money,
      reason: "rule-conflict",
      explanation: conflictReason,
      isLockedCategory,
      isLockedMerchant,
      ...(transaction.categoryId === undefined
        ? {}
        : { currentCategoryId: transaction.categoryId }),
      ...(transaction.merchantId === undefined
        ? {}
        : { currentMerchantId: transaction.merchantId }),
      ...(suggestedCategory === undefined ? {} : { suggestedCategory }),
      ...(suggestedMerchant === undefined ? {} : { suggestedMerchant }),
    };
  }

  // 2. Merchant collisions (multiple alias matches)
  const merchantMatches = matchDescriptionToMerchants(transaction.description, merchants);
  if (merchantMatches.length > 1) {
    const matchedNames = merchantMatches
      .map((m) => merchants.find((merch) => merch.id === m.merchantId)?.name ?? m.merchantId)
      .join(", ");

    return {
      transactionId: transaction.id,
      accountId: transaction.accountId,
      postedDate: transaction.postedDate,
      rawDescription: transaction.description,
      normalizedDescription: normDescription,
      amount: transaction.money,
      reason: "merchant-collision",
      explanation: `Multiple merchant aliases matched description: ${matchedNames}`,
      isLockedCategory,
      isLockedMerchant,
      ...(transaction.categoryId === undefined
        ? {}
        : { currentCategoryId: transaction.categoryId }),
      ...(transaction.merchantId === undefined
        ? {}
        : { currentMerchantId: transaction.merchantId }),
      ...(suggestedCategory === undefined ? {} : { suggestedCategory }),
      ...(suggestedMerchant === undefined ? {} : { suggestedMerchant }),
    };
  }

  // 3. Rule changed / suggested different category
  if (
    suggestedCategory !== undefined &&
    transaction.categoryId !== undefined &&
    suggestedCategory !== transaction.categoryId &&
    !isLockedCategory
  ) {
    return {
      transactionId: transaction.id,
      accountId: transaction.accountId,
      postedDate: transaction.postedDate,
      rawDescription: transaction.description,
      normalizedDescription: normDescription,
      amount: transaction.money,
      currentCategoryId: transaction.categoryId,
      ...(transaction.merchantId === undefined
        ? {}
        : { currentMerchantId: transaction.merchantId }),
      reason: "rule-changed",
      explanation: `Rule evaluation proposed category '${suggestedCategory}' differing from current category '${transaction.categoryId}'`,
      suggestedCategory,
      isLockedCategory,
      isLockedMerchant,
      ...(suggestedMerchant === undefined ? {} : { suggestedMerchant }),
    };
  }

  // 4. Low confidence review state
  if (transaction.reviewState === "needsReview" && !isLockedCategory) {
    return {
      transactionId: transaction.id,
      accountId: transaction.accountId,
      postedDate: transaction.postedDate,
      rawDescription: transaction.description,
      normalizedDescription: normDescription,
      amount: transaction.money,
      reason: "low-confidence",
      explanation: "Transaction classification marked for review",
      isLockedCategory,
      isLockedMerchant,
      ...(transaction.categoryId === undefined
        ? {}
        : { currentCategoryId: transaction.categoryId }),
      ...(transaction.merchantId === undefined
        ? {}
        : { currentMerchantId: transaction.merchantId }),
      ...(suggestedCategory === undefined ? {} : { suggestedCategory }),
      ...(suggestedMerchant === undefined ? {} : { suggestedMerchant }),
    };
  }

  // 5. Unclassified category
  if (transaction.categoryId === undefined && !isLockedCategory) {
    return {
      transactionId: transaction.id,
      accountId: transaction.accountId,
      postedDate: transaction.postedDate,
      rawDescription: transaction.description,
      normalizedDescription: normDescription,
      amount: transaction.money,
      reason: "unclassified",
      explanation: "Transaction has no assigned category",
      isLockedCategory,
      isLockedMerchant,
      ...(transaction.merchantId === undefined
        ? {}
        : { currentMerchantId: transaction.merchantId }),
      ...(suggestedCategory === undefined ? {} : { suggestedCategory }),
      ...(suggestedMerchant === undefined ? {} : { suggestedMerchant }),
    };
  }

  return undefined;
}
