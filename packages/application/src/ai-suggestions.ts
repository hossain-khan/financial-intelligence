import type {
  AiProvider,
  AiResultEnvelope,
  AiTaskId,
  ExecutionLocation,
} from "@financial-intelligence/ai-core";
import { validateAiTask } from "@financial-intelligence/schemas";
import {
  deriveReviewQueueItem,
  normalizeMerchantDescription,
  parseCategoryId,
  parseMerchantId,
  parseTransactionId,
  type AccountType,
  type Category,
  type ClassificationRule,
  type Merchant,
  type Transaction,
} from "@financial-intelligence/domain";

import type { ApplyReviewCorrectionUseCase } from "./review-queue";
import type { TransactionLedgerRepository } from "./transaction-ledger";

/**
 * A persisted AI suggestion, held separately from canonical classifications until accepted. Named
 * `PersistedSuggestion` to avoid colliding with `ai-core`'s transient `AiSuggestion`. It records
 * enough provenance to explain and audit the suggestion, never raw prompts/responses or hidden
 * reasoning. AI never mutates canonical data; a suggestion becomes a canonical classification only
 * through an explicit, eligibility-rechecked accept action (a later task).
 *
 * Shape is normative — see `docs/superpowers/specs/2026-07-21-ai-assisted-suggestions-design.md`.
 */
export interface PersistedSuggestion {
  readonly id: string;
  /** Canonical transaction this suggestion targets. */
  readonly targetTransactionId: string;
  /**
   * Staleness anchor. The transaction has no numeric revision, so we pin its `updatedAt` at
   * suggestion time; if it differs at apply time (any edit bumps `updatedAt`), or eligibility no
   * longer holds, the suggestion is stale and cannot apply.
   */
  readonly targetUpdatedAt: string;
  /**
   * The normalized-description digest the model actually saw (same normalizer as classification).
   * Persisted so rejection memory can reconstruct the `(digest, classifierVersion)` key without
   * re-reading the transaction — see {@link rejectionKey} and {@link AiSuggestionRepository.listRejectedKeys}.
   */
  readonly normalizedDigest: string;
  readonly task: Extract<AiTaskId, "merchant.resolve.v1" | "category.classify.v1">;
  readonly taskVersion: string;
  readonly schemaVersion: "1.0.0";
  readonly promptVersion: string;
  readonly minimizerVersion: string;
  readonly classifierVersion: string;
  readonly proposal:
    // merchant.resolve proposes a canonical LABEL (not an id); accept maps it to an existing
    // merchant or creates one via the existing merchant/alias path.
    | { readonly kind: "merchant"; readonly merchantLabel: string }
    // category.classify proposes an id from the current allowed vocabulary (grounded at validation).
    | { readonly kind: "category"; readonly categoryId: string }
    | { readonly kind: "abstain" };
  readonly confidence: number | null;
  /** Bounded, user-facing evidence codes; never raw prompt/response content. */
  readonly evidenceCodes: readonly string[];
  /** Bounded plain-language rationale; never hidden model reasoning. */
  readonly rationale: string;
  readonly provider: {
    readonly profileId: string;
    readonly adapterId: string;
    readonly reportedModel: string | null;
    readonly executionLocation: ExecutionLocation;
  };
  /** Redacted request-audit id (#31 audit holds digests only). */
  readonly requestAuditId: string;
  readonly status: "pending" | "accepted" | "rejected" | "stale" | "invalid";
  readonly createdAt: string;
  readonly expiresAt: string;
}

export type PersistedSuggestionStatus = PersistedSuggestion["status"];

/**
 * Port for persisting and retrieving AI suggestions. Implemented by an IndexedDB adapter in a
 * later task; kept minimal so the orchestrator and review flow depend only on this interface.
 */
export interface AiSuggestionRepository {
  save(suggestion: PersistedSuggestion): Promise<void>;
  listPending(): Promise<readonly PersistedSuggestion[]>;
  findById(id: string): Promise<PersistedSuggestion | undefined>;
  setStatus(id: string, status: PersistedSuggestionStatus): Promise<void>;
  /** Rejection keys, so an identical candidate is not re-presented for the same classifier version. */
  listRejectedKeys(): Promise<readonly string[]>;
}

/**
 * Stable key for rejection memory: a rejected `(normalized description digest, classifier version)`
 * is not re-suggested until the classifier version changes. Uses the same normalizer as
 * classification so the digest matches what the model actually saw.
 */
export function rejectionKey(normalizedDigest: string, classifierVersion: string): string {
  return `${normalizedDigest}::${classifierVersion}`;
}

/**
 * Inputs required to decide which transactions are candidates for AI suggestion. Precedence is
 * evaluated by the existing deterministic classifier (`deriveReviewQueueItem`), so the rules and
 * merchants supplied here must be the current workspace set.
 */
export interface EligibilityContext {
  /** Current classification rules; used to detect rule-resolved transactions. */
  readonly rules: readonly ClassificationRule[];
  /** Current merchants (with aliases); used to detect merchant-mapping-resolved transactions. */
  readonly merchants: readonly Merchant[];
  /** Version of the classifier that would produce suggestions; keys rejection memory. */
  readonly classifierVersion: string;
  /** `(digest, classifierVersion)` keys already rejected — excluded from eligibility. */
  readonly rejectedKeys: ReadonlySet<string>;
  /** Optional per-run cap on the number of eligible transactions returned in one batch. */
  readonly maxCandidates?: number;
  /** Optional per-account-id account type used by rule evaluation (defaults to "checking"). */
  readonly accountTypes?: ReadonlyMap<string, AccountType>;
}

/**
 * Select transactions eligible for AI suggestion. A transaction is eligible only if the existing
 * deterministic precedence (`deriveReviewQueueItem` — rules, merchant mapping, heuristics, locks)
 * leaves it unresolved, it is active (not void), neither field is locked, it is not already
 * rejected for the current classifier version, and the max-candidate cap is not exceeded.
 *
 * This reuses the canonical precedence oracle — the same unit `QueryReviewQueue` delegates to —
 * rather than reimplementing classification. `deriveReviewQueueItem` returns `undefined` when a
 * transaction is fully resolved and nothing needs review; it returns an item otherwise. We keep
 * only the latter.
 */
export function selectEligibleTransactions(
  transactions: readonly Transaction[],
  context: EligibilityContext,
): readonly Transaction[] {
  const eligible: Transaction[] = [];
  for (const transaction of transactions) {
    if (context.maxCandidates !== undefined && eligible.length >= context.maxCandidates) break;

    // Active: void transactions are never candidates.
    if (transaction.status === "void") continue;

    // Reuse the existing precedence: unresolved-after-rules/mapping/heuristics only.
    const accountType = context.accountTypes?.get(transaction.accountId);
    const item = deriveReviewQueueItem(
      transaction,
      context.rules,
      context.merchants,
      accountType,
    );
    // `undefined` means precedence resolved it — not a candidate.
    if (item === undefined) continue;
    // Never touch a locked decision.
    if (item.isLockedCategory || item.isLockedMerchant) continue;

    // Rejection memory: skip candidates already rejected for this classifier version.
    const key = rejectionKey(
      normalizeMerchantDescription(transaction.description),
      context.classifierVersion,
    );
    if (context.rejectedKeys.has(key)) continue;

    eligible.push(transaction);
  }
  return eligible;
}

/** A deduplicated unit of work: one normalized description shared by one or more transactions. */
export interface SuggestionBatchEntry {
  readonly digest: string;
  readonly descriptor: string;
  readonly direction: "inflow" | "outflow";
  readonly transactionIds: readonly string[];
  /** The updatedAt of each member transaction, keyed by id, for the staleness anchor. */
  readonly targetUpdatedAt: ReadonlyMap<string, string>;
}

/**
 * Deduplicate eligible transactions by their normalized description (+ direction), so one model
 * call serves every transaction sharing that description. Only the minimized descriptor and
 * direction leave this function — never ids, amounts, notes, or raw rows.
 */
export function buildSuggestionBatch(
  transactions: readonly Transaction[],
): readonly SuggestionBatchEntry[] {
  const byDigest = new Map<string, { descriptor: string; direction: "inflow" | "outflow"; ids: string[]; updatedAt: Map<string, string> }>();
  for (const transaction of transactions) {
    const descriptor = normalizeMerchantDescription(transaction.description);
    const direction = transaction.money.isInflow() ? "inflow" : "outflow";
    const digest = `${direction}:${descriptor}`;
    const existing = byDigest.get(digest);
    if (existing === undefined) {
      byDigest.set(digest, {
        descriptor,
        direction,
        ids: [transaction.id],
        updatedAt: new Map([[transaction.id, transaction.updatedAt]]),
      });
    } else {
      existing.ids.push(transaction.id);
      existing.updatedAt.set(transaction.id, transaction.updatedAt);
    }
  }
  return [...byDigest.entries()].map(([digest, entry]) => ({
    digest,
    descriptor: entry.descriptor,
    direction: entry.direction,
    transactionIds: entry.ids,
    targetUpdatedAt: entry.updatedAt,
  }));
}

export interface SuggestionProfileVersions {
  readonly taskVersion: string;
  readonly promptVersion: string;
  readonly minimizerVersion: string;
  readonly classifierVersion: string;
}

export interface SuggestClassificationsDeps {
  readonly provider: AiProvider;
  readonly repository: AiSuggestionRepository;
  readonly now: () => string;
  readonly newId: () => string;
  readonly deadlineMs: number;
  readonly versions: SuggestionProfileVersions;
  /** How long a pending suggestion stays valid (ms) before it should be treated as expired. */
  readonly ttlMs: number;
  /** Minimum confidence to surface a proposal; below this the result abstains. */
  readonly minConfidence: number;
}

export interface SuggestClassificationsResult {
  readonly created: number;
  readonly abstained: number;
}

/**
 * Runs merchant resolution then category classification over a minimized, deduplicated batch of
 * eligible transactions through the injected provider, validates every result (strict schema +
 * allowed-id grounding + confidence gate), and writes pending suggestions. Nothing is applied to
 * canonical records here — a suggestion only becomes a classification via the explicit accept path.
 */
export class SuggestClassifications {
  public constructor(private readonly deps: SuggestClassificationsDeps) {}

  public async execute(input: {
    readonly transactions: readonly Transaction[];
    readonly allowedCategoryIds: readonly string[];
    readonly eligibility: EligibilityContext;
    readonly signal?: AbortSignal;
  }): Promise<SuggestClassificationsResult> {
    const eligible = selectEligibleTransactions(input.transactions, input.eligibility);
    const batch = buildSuggestionBatch(eligible);
    const provider = this.deps.provider;
    let created = 0;
    let abstained = 0;

    const options = {
      signal: input.signal ?? new AbortController().signal,
      deadlineMs: this.deps.deadlineMs,
    };

    for (const entry of batch) {
      // Merchant resolution pass.
      const merchantResult = await provider.execute(
        { task: "merchant.resolve.v1", payload: { tokens: entry.descriptor.split(" ").filter(Boolean) } },
        options,
      );
      const merchantLabel = this.readMerchantLabel(merchantResult);
      if (merchantLabel !== null) {
        created += await this.writeProposal(entry, "merchant.resolve.v1", {
          kind: "merchant",
          merchantLabel,
        }, this.readConfidence(merchantResult), this.readEvidence(merchantResult));
      } else {
        abstained += entry.transactionIds.length;
      }

      // Category classification pass, using the resolved label when available.
      const categoryResult = await provider.execute(
        {
          task: "category.classify.v1",
          payload: {
            descriptor: merchantLabel ?? entry.descriptor,
            direction: entry.direction,
            allowedCategoryIds: [...input.allowedCategoryIds],
          },
        },
        options,
      );
      const categoryId = this.readGroundedCategory(categoryResult, input.allowedCategoryIds);
      if (categoryId !== null) {
        created += await this.writeProposal(entry, "category.classify.v1", {
          kind: "category",
          categoryId,
        }, this.readConfidence(categoryResult), this.readEvidence(categoryResult));
      } else {
        abstained += entry.transactionIds.length;
      }
    }
    return { created, abstained };
  }

  private async writeProposal(
    entry: SuggestionBatchEntry,
    task: PersistedSuggestion["task"],
    proposal: PersistedSuggestion["proposal"],
    confidence: number | null,
    evidenceCodes: readonly string[],
  ): Promise<number> {
    // Confidence gate: below the floor abstains (no applyable suggestion written).
    if (confidence !== null && confidence < this.deps.minConfidence) return 0;
    const createdAt = this.deps.now();
    const expiresAt = new Date(Date.parse(createdAt) + this.deps.ttlMs).toISOString();
    const p = this.deps.provider.profile;
    let count = 0;
    for (const transactionId of entry.transactionIds) {
      const suggestion: PersistedSuggestion = {
        id: this.deps.newId(),
        targetTransactionId: transactionId,
        targetUpdatedAt: entry.targetUpdatedAt.get(transactionId) ?? createdAt,
        normalizedDigest: entry.descriptor,
        task,
        taskVersion: this.deps.versions.taskVersion,
        schemaVersion: "1.0.0",
        promptVersion: this.deps.versions.promptVersion,
        minimizerVersion: this.deps.versions.minimizerVersion,
        classifierVersion: this.deps.versions.classifierVersion,
        proposal,
        confidence,
        evidenceCodes,
        rationale: "",
        provider: {
          profileId: p.profileId,
          adapterId: p.adapterId,
          reportedModel: p.reportedModel,
          executionLocation: p.executionLocation,
        },
        requestAuditId: this.deps.newId(),
        status: "pending",
        createdAt,
        expiresAt,
      };
      await this.deps.repository.save(suggestion);
      count += 1;
    }
    return count;
  }

  private readMerchantLabel(envelope: AiResultEnvelope): string | null {
    if (!envelope.ok) return null;
    if (!validateAiTask({ schemaVersion: "1.0.0", task: "merchant.resolve.v1", direction: "response", payload: envelope.output }).valid) {
      return null;
    }
    const label = (envelope.output as { label?: unknown }).label;
    return typeof label === "string" && label.length > 0 ? label : null;
  }

  private readGroundedCategory(
    envelope: AiResultEnvelope,
    allowed: readonly string[],
  ): string | null {
    if (!envelope.ok) return null;
    if (!validateAiTask({ schemaVersion: "1.0.0", task: "category.classify.v1", direction: "response", payload: envelope.output }).valid) {
      return null;
    }
    const id = (envelope.output as { categoryId?: unknown }).categoryId;
    return typeof id === "string" && allowed.includes(id) ? id : null;
  }

  private readConfidence(envelope: AiResultEnvelope): number | null {
    if (!envelope.ok) return null;
    const c = (envelope.output as { confidence?: unknown }).confidence;
    return typeof c === "number" ? c : null;
  }

  private readEvidence(envelope: AiResultEnvelope): readonly string[] {
    if (!envelope.ok) return [];
    const e = (envelope.output as { evidence?: unknown }).evidence;
    return Array.isArray(e) ? e.filter((x): x is string => typeof x === "string") : [];
  }
}

/** Current non-archived category ids — the allowed vocabulary for classification. */
export function activeCategoryIds(categories: readonly Category[]): readonly string[] {
  return categories.filter((category) => !category.archived).map((category) => category.id);
}

export class SuggestionStaleError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "SuggestionStaleError";
  }
}

export interface AcceptSuggestionDeps {
  readonly repository: AiSuggestionRepository;
  readonly applyReviewCorrection: ApplyReviewCorrectionUseCase;
  readonly ledgerRepository: TransactionLedgerRepository;
  readonly rules: () => Promise<readonly ClassificationRule[]>;
  readonly merchants: () => Promise<readonly Merchant[]>;
}

export interface AcceptSuggestionInput {
  readonly suggestionId: string;
  /** For a merchant suggestion, the resolved/created merchant id the UI chose for the label. */
  readonly merchantId?: string;
  readonly createRule?: ApplyReviewCorrectionInputCreateRule;
  readonly createMerchantAlias?: { readonly merchantId: string; readonly pattern: string; readonly matchMode: "exact" | "tokenPrefix" | "contains" };
}

// Structural mirror of ApplyReviewCorrectionInput["createRule"] so callers can pass a rule to create.
type ApplyReviewCorrectionInputCreateRule = NonNullable<
  Parameters<ApplyReviewCorrectionUseCase["execute"]>[0]["createRule"]
>;

export interface AcceptSuggestionResult {
  readonly applied: boolean;
  readonly operationId?: string;
  readonly createdRuleId?: string;
}

/**
 * Accept a pending suggestion. Rechecks staleness (the target transaction still exists, its
 * `updatedAt` is unchanged, and precedence still leaves it unresolved) before mutating anything. On
 * success it applies through the existing atomic `ApplyReviewCorrectionUseCase` with `localAi`
 * provenance, then marks the suggestion accepted. A stale suggestion is marked `stale` and throws.
 */
export class AcceptSuggestion {
  public constructor(private readonly deps: AcceptSuggestionDeps) {}

  public async execute(input: AcceptSuggestionInput): Promise<AcceptSuggestionResult> {
    const suggestion = await this.deps.repository.findById(input.suggestionId);
    if (suggestion === undefined) throw new SuggestionStaleError("Suggestion not found");
    if (suggestion.status !== "pending") {
      throw new SuggestionStaleError(`Suggestion is ${suggestion.status}, not pending`);
    }
    if (suggestion.proposal.kind === "abstain") {
      throw new SuggestionStaleError("An abstention cannot be accepted");
    }

    const transactions = await this.deps.ledgerRepository.list();
    const target = transactions.find((t) => t.id === suggestion.targetTransactionId);
    if (target === undefined || target.updatedAt !== suggestion.targetUpdatedAt) {
      await this.deps.repository.setStatus(suggestion.id, "stale");
      throw new SuggestionStaleError("The transaction changed since the suggestion was created");
    }

    // Precedence re-check: a rule/merchant-mapping/lock may now resolve it.
    const [rules, merchants] = await Promise.all([this.deps.rules(), this.deps.merchants()]);
    const item = deriveReviewQueueItem(target, rules, merchants);
    if (item === undefined || item.isLockedCategory || item.isLockedMerchant) {
      await this.deps.repository.setStatus(suggestion.id, "stale");
      throw new SuggestionStaleError("The transaction is now resolved by a deterministic decision");
    }

    const provenance = {
      method: suggestion.provider.executionLocation === "local" ? ("localAi" as const) : ("remoteAi" as const),
      classifierId: suggestion.provider.adapterId,
      classifierVersion: suggestion.classifierVersion,
      ...(suggestion.confidence === null ? {} : { confidence: suggestion.confidence }),
      evidence: suggestion.evidenceCodes,
    };

    const merchantId =
      suggestion.proposal.kind === "merchant" ? input.merchantId : undefined;
    if (suggestion.proposal.kind === "merchant" && merchantId === undefined) {
      throw new SuggestionStaleError("A merchant suggestion requires a resolved merchant id to accept");
    }

    const result = await this.deps.applyReviewCorrection.execute({
      transactionIds: [parseTransactionId(suggestion.targetTransactionId)],
      ...(suggestion.proposal.kind === "category"
        ? { categoryId: parseCategoryId(suggestion.proposal.categoryId) }
        : {}),
      ...(merchantId === undefined ? {} : { merchantId: parseMerchantId(merchantId) }),
      provenance,
      ...(input.createRule === undefined ? {} : { createRule: input.createRule }),
      ...(input.createMerchantAlias === undefined
        ? {}
        : {
            createMerchantAlias: {
              merchantId: parseMerchantId(input.createMerchantAlias.merchantId),
              pattern: input.createMerchantAlias.pattern,
              matchMode: input.createMerchantAlias.matchMode,
            },
          }),
    });

    await this.deps.repository.setStatus(suggestion.id, "accepted");
    return {
      applied: true,
      operationId: result.operationId,
      ...(result.createdRuleId === undefined ? {} : { createdRuleId: result.createdRuleId }),
    };
  }
}

export interface RejectSuggestionDeps {
  readonly repository: AiSuggestionRepository;
}

/**
 * Reject a pending suggestion: mark it rejected. Rejection memory (the `(digest, classifierVersion)`
 * key) is derived from the persisted record at eligibility time via `listRejectedKeys`, so the same
 * candidate is not re-presented for this classifier version. Records no data and uploads nothing.
 */
export class RejectSuggestion {
  public constructor(private readonly deps: RejectSuggestionDeps) {}

  public async execute(input: { readonly suggestionId: string }): Promise<void> {
    const suggestion = await this.deps.repository.findById(input.suggestionId);
    if (suggestion === undefined) return;
    await this.deps.repository.setStatus(suggestion.id, "rejected");
  }
}
