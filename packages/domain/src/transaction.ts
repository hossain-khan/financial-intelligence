import type { AccountId, CategoryId, ImportId, TransactionId } from "./identifiers";
import { parseAccountId, parseCategoryId, parseImportId, parseTransactionId } from "./identifiers";
import { Money } from "./money";
import type { DateOnly, UtcTimestamp } from "./temporal";
import { parseDateOnly, parseUtcTimestamp } from "./temporal";

export type TransactionStatus = "pending" | "posted" | "void";
export type TransactionReviewState = "unreviewed" | "needsReview" | "reviewed";
export type ProvenancePrimitive = string | number | boolean | null;
export type ClassificationMethod =
  "user" | "imported" | "rule" | "merchantMapping" | "heuristic" | "localAi" | "remoteAi";

export interface TransactionClassification {
  readonly method: ClassificationMethod;
  readonly classifierId: string;
  readonly classifierVersion: string;
  readonly confidence?: number;
  readonly evidence: readonly string[];
  readonly locked: boolean;
  readonly decidedAt: UtcTimestamp;
}

export interface TransactionProvenance {
  readonly parserId: string;
  readonly parserVersion: string;
  readonly sourceLocation: string;
  readonly original: Readonly<Record<string, ProvenancePrimitive>>;
  readonly transformations: readonly string[];
}

export interface Transaction {
  readonly id: TransactionId;
  readonly accountId: AccountId;
  readonly importId: ImportId;
  readonly postedDate: DateOnly;
  readonly transactionDate?: DateOnly;
  readonly money: Money;
  readonly description: string;
  readonly sourceTransactionId?: string;
  readonly categoryId?: CategoryId;
  readonly notes?: string;
  readonly status: TransactionStatus;
  readonly reviewState: TransactionReviewState;
  readonly tags: readonly string[];
  readonly classifications: {
    readonly category?: TransactionClassification;
  };
  readonly provenance: TransactionProvenance;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
}

export interface CreateTransactionInput {
  readonly id: TransactionId;
  readonly accountId: AccountId;
  readonly importId: ImportId;
  readonly postedDate: DateOnly;
  readonly transactionDate?: DateOnly;
  readonly money: Money;
  readonly description: string;
  readonly sourceTransactionId?: string;
  readonly categoryId?: CategoryId;
  readonly notes?: string;
  readonly status?: TransactionStatus;
  readonly reviewState?: TransactionReviewState;
  readonly tags?: readonly string[];
  readonly classifications?: {
    readonly category?: TransactionClassification;
  };
  readonly provenance: TransactionProvenance;
  readonly now: UtcTimestamp;
}

export interface CanonicalTransactionDocument {
  readonly schemaVersion: "1.0.0";
  readonly id: string;
  readonly accountId: string;
  readonly importId: string;
  readonly postedDate: string;
  readonly transactionDate?: string;
  readonly amount: string;
  readonly currency: string;
  readonly description: string;
  readonly sourceTransactionId?: string;
  readonly categoryId?: string;
  readonly notes?: string;
  readonly tags: readonly string[];
  readonly status: TransactionStatus;
  readonly reviewState: TransactionReviewState;
  readonly classifications: {
    readonly category?: TransactionClassification;
  };
  readonly provenance: {
    readonly parserId: string;
    readonly parserVersion: string;
    readonly sourceLocation: string;
    readonly original: Readonly<Record<string, ProvenancePrimitive>>;
    readonly transformations: readonly string[];
  };
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function createTransaction(input: CreateTransactionInput): Transaction {
  const description = input.description.normalize("NFKC").replaceAll(/\s+/gu, " ").trim();
  if (description.length === 0 || description.length > 1_000) {
    throw new RangeError("Transaction description must contain between 1 and 1,000 characters");
  }
  const sourceTransactionId = optionalText(input.sourceTransactionId, 240, "Source transaction ID");
  const notes = optionalText(input.notes, 2_000, "Transaction notes");
  const tags = input.tags ?? [];
  if (tags.length > 50 || new Set(tags).size !== tags.length) {
    throw new RangeError("Transaction tags must be unique and contain at most 50 values");
  }
  for (const tag of tags) {
    if (tag.length === 0 || tag.length > 60) {
      throw new RangeError("Transaction tags must contain between 1 and 60 characters");
    }
  }
  const provenance = validateProvenance(input.provenance);
  const status = input.status ?? "posted";
  const reviewState = input.reviewState ?? "unreviewed";
  if (!(["pending", "posted", "void"] as const).includes(status)) {
    throw new RangeError("Transaction status is invalid");
  }
  if (!(["unreviewed", "needsReview", "reviewed"] as const).includes(reviewState)) {
    throw new RangeError("Transaction review state is invalid");
  }
  return {
    id: input.id,
    accountId: input.accountId,
    importId: input.importId,
    postedDate: input.postedDate,
    ...(input.transactionDate === undefined ? {} : { transactionDate: input.transactionDate }),
    money: input.money,
    description,
    ...(sourceTransactionId === undefined ? {} : { sourceTransactionId }),
    ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
    ...(notes === undefined ? {} : { notes }),
    status,
    reviewState,
    tags: [...tags],
    classifications: validateClassifications(input.classifications ?? {}),
    provenance,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function transactionToCanonical(transaction: Transaction): CanonicalTransactionDocument {
  const amount = transaction.money.toJSON();
  return {
    schemaVersion: "1.0.0",
    id: transaction.id,
    accountId: transaction.accountId,
    importId: transaction.importId,
    postedDate: transaction.postedDate,
    ...(transaction.transactionDate === undefined
      ? {}
      : { transactionDate: transaction.transactionDate }),
    amount: amount.amount,
    currency: amount.currency,
    description: transaction.description,
    ...(transaction.sourceTransactionId === undefined
      ? {}
      : { sourceTransactionId: transaction.sourceTransactionId }),
    ...(transaction.categoryId === undefined ? {} : { categoryId: transaction.categoryId }),
    ...(transaction.notes === undefined ? {} : { notes: transaction.notes }),
    tags: [...transaction.tags],
    status: transaction.status,
    reviewState: transaction.reviewState,
    classifications: transaction.classifications,
    provenance: {
      parserId: transaction.provenance.parserId,
      parserVersion: transaction.provenance.parserVersion,
      sourceLocation: transaction.provenance.sourceLocation,
      original: { ...transaction.provenance.original },
      transformations: [...transaction.provenance.transformations],
    },
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

export function transactionFromCanonical(document: CanonicalTransactionDocument): Transaction {
  if (document.schemaVersion !== "1.0.0") {
    throw new TypeError("Unsupported canonical transaction schema version");
  }
  const transaction = createTransaction({
    id: parseTransactionId(document.id),
    accountId: parseAccountId(document.accountId),
    importId: parseImportId(document.importId),
    postedDate: parseDateOnly(document.postedDate),
    ...(document.transactionDate === undefined
      ? {}
      : { transactionDate: parseDateOnly(document.transactionDate) }),
    money: Money.from(document.amount, document.currency),
    description: document.description,
    ...(document.sourceTransactionId === undefined
      ? {}
      : { sourceTransactionId: document.sourceTransactionId }),
    ...(document.categoryId === undefined
      ? {}
      : { categoryId: parseCategoryId(document.categoryId) }),
    ...(document.notes === undefined ? {} : { notes: document.notes }),
    status: document.status,
    reviewState: document.reviewState,
    tags: document.tags,
    classifications: document.classifications,
    provenance: document.provenance,
    now: parseUtcTimestamp(document.createdAt),
  });
  return { ...transaction, updatedAt: parseUtcTimestamp(document.updatedAt) };
}

function validateClassifications(
  classifications: CreateTransactionInput["classifications"],
): Transaction["classifications"] {
  if (classifications?.category === undefined) return {};
  const classification = classifications.category;
  if (
    !(
      ["user", "imported", "rule", "merchantMapping", "heuristic", "localAi", "remoteAi"] as const
    ).includes(classification.method) ||
    typeof classification.locked !== "boolean"
  ) {
    throw new RangeError("Classification method or lock state is invalid");
  }
  const confidence = classification.confidence;
  if (
    confidence !== undefined &&
    (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)
  ) {
    throw new RangeError("Classification confidence must be between 0 and 1");
  }
  if (classification.evidence.length > 20) {
    throw new RangeError("Classification evidence exceeds 20 entries");
  }
  return {
    category: {
      method: classification.method,
      classifierId: requiredText(classification.classifierId, 100, "Classifier ID"),
      classifierVersion: requiredText(classification.classifierVersion, 40, "Classifier version"),
      ...(confidence === undefined ? {} : { confidence }),
      evidence: classification.evidence.map((value) =>
        requiredText(value, 160, "Classification evidence"),
      ),
      locked: classification.locked,
      decidedAt: parseUtcTimestamp(classification.decidedAt),
    },
  };
}

function validateProvenance(provenance: TransactionProvenance): TransactionProvenance {
  const parserId = requiredText(provenance.parserId, 100, "Parser ID");
  const parserVersion = requiredText(provenance.parserVersion, 40, "Parser version");
  const sourceLocation = requiredText(provenance.sourceLocation, 160, "Source location");
  const entries = Object.entries(provenance.original);
  if (entries.length > 30) throw new RangeError("Provenance original values exceed 30 fields");
  for (const [key, value] of entries) {
    if (key.length === 0 || key.length > 80)
      throw new RangeError("Provenance field name is invalid");
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new RangeError("Provenance numbers must be finite");
    }
  }
  if (provenance.transformations.length > 30) {
    throw new RangeError("Provenance transformations exceed 30 entries");
  }
  const transformations = provenance.transformations.map((value) =>
    requiredText(value, 120, "Provenance transformation"),
  );
  return {
    parserId,
    parserVersion,
    sourceLocation,
    original: { ...provenance.original },
    transformations,
  };
}

function requiredText(value: string, maximum: number, label: string): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new RangeError(`${label} must contain between 1 and ${maximum} characters`);
  }
  return normalized;
}

function optionalText(
  value: string | undefined,
  maximum: number,
  label: string,
): string | undefined {
  if (value === undefined) return undefined;
  return requiredText(value, maximum, label);
}
