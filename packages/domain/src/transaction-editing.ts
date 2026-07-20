import type { CategoryId, MerchantId } from "./identifiers";
import type { UtcTimestamp } from "./temporal";
import type { Transaction, TransactionClassification, TransactionReviewState } from "./transaction";

export interface ManualTransactionEdit {
  readonly merchant?: MerchantId | null;
  readonly category?: CategoryId | null;
  readonly notes?: string | null;
  readonly tags?: readonly string[];
  readonly reviewState?: TransactionReviewState;
  readonly unlockCategory?: boolean;
  readonly unlockMerchant?: boolean;
}

export interface AutomaticCategoryEdit {
  readonly category: CategoryId | null;
  readonly classification: Omit<TransactionClassification, "locked">;
}

export interface AutomaticMerchantEdit {
  readonly merchant: MerchantId | null;
  readonly classification: Omit<TransactionClassification, "locked">;
}

/** Manual values are authoritative; a manual category decision is locked by default. */
export function applyManualTransactionEdit(
  current: Transaction,
  edit: ManualTransactionEdit,
  now: UtcTimestamp,
): Transaction {
  const next: MutableTransaction = { ...current, classifications: { ...current.classifications } };
  if (edit.merchant !== undefined) {
    if (edit.merchant === null) delete next.merchantId;
    else next.merchantId = edit.merchant;
    next.classifications = {
      ...next.classifications,
      merchant: userClassification(now, !edit.unlockMerchant),
    };
  } else if (edit.unlockMerchant && next.classifications.merchant !== undefined) {
    next.classifications = {
      ...next.classifications,
      merchant: { ...next.classifications.merchant, locked: false, decidedAt: now },
    };
  }
  if (edit.category !== undefined) {
    if (edit.category === null) delete next.categoryId;
    else next.categoryId = edit.category;
    next.classifications = {
      ...next.classifications,
      category: userClassification(now, !edit.unlockCategory),
    };
  } else if (edit.unlockCategory && next.classifications.category !== undefined) {
    next.classifications = {
      ...next.classifications,
      category: { ...next.classifications.category, locked: false, decidedAt: now },
    };
  }
  if (edit.notes !== undefined) {
    if (edit.notes === null || edit.notes.trim().length === 0) delete next.notes;
    else next.notes = normalizeNote(edit.notes);
  }
  if (edit.tags !== undefined) next.tags = normalizeTags(edit.tags);
  if (edit.reviewState !== undefined) next.reviewState = validateReviewState(edit.reviewState);
  return { ...next, updatedAt: now };
}

/** A locked category is never overwritten by a rule, heuristic, or model. */
export function applyAutomaticCategoryEdit(
  current: Transaction,
  edit: AutomaticCategoryEdit,
  now: UtcTimestamp,
): Transaction {
  if (current.classifications.category?.locked === true) return current;
  const next: MutableTransaction = { ...current };
  if (edit.category === null) delete next.categoryId;
  else next.categoryId = edit.category;
  next.classifications = {
    ...current.classifications,
    category: { ...edit.classification, locked: false },
  };
  return { ...next, updatedAt: now };
}

/** A locked merchant is never overwritten by a rule, heuristic, or model. */
export function applyAutomaticMerchantEdit(
  current: Transaction,
  edit: AutomaticMerchantEdit,
  now: UtcTimestamp,
): Transaction {
  if (current.classifications.merchant?.locked === true) return current;
  const next: MutableTransaction = { ...current };
  if (edit.merchant === null) delete next.merchantId;
  else next.merchantId = edit.merchant;
  next.classifications = {
    ...current.classifications,
    merchant: { ...edit.classification, locked: false },
  };
  return { ...next, updatedAt: now };
}

type MutableTransaction = {
  -readonly [Key in keyof Transaction]: Transaction[Key];
};

function userClassification(now: UtcTimestamp, locked: boolean): TransactionClassification {
  return {
    method: "user",
    classifierId: "manual-ledger",
    classifierVersion: "1",
    evidence: ["user-confirmed"],
    locked,
    decidedAt: now,
  };
}

function normalizeNote(value: string): string {
  const normalized = value.normalize("NFKC").trim();
  if (normalized.length > 2_000) throw new RangeError("Transaction notes exceed 2,000 characters");
  return normalized;
}

function normalizeTags(values: readonly string[]): readonly string[] {
  if (values.length > 50) throw new RangeError("Transaction tags exceed 50 values");
  const normalized = values.map((value) => value.normalize("NFKC").trim());
  if (normalized.some((value) => value.length === 0 || value.length > 60)) {
    throw new RangeError("Transaction tags must contain between 1 and 60 characters");
  }
  if (new Set(normalized).size !== normalized.length) {
    throw new RangeError("Transaction tags must be unique");
  }
  return normalized;
}

function validateReviewState(value: TransactionReviewState): TransactionReviewState {
  if (!(["unreviewed", "needsReview", "reviewed"] as const).includes(value)) {
    throw new RangeError("Transaction review state is invalid");
  }
  return value;
}
