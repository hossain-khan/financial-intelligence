import type { AiTaskId, ExecutionLocation } from "@financial-intelligence/ai-core";
import {
  deriveReviewQueueItem,
  normalizeMerchantDescription,
  type AccountType,
  type ClassificationRule,
  type Merchant,
  type Transaction,
} from "@financial-intelligence/domain";

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
  readonly task: Extract<AiTaskId, "merchant.resolve.v1" | "category.classify.v1">;
  readonly taskVersion: string;
  readonly schemaVersion: "1.0.0";
  readonly promptVersion: string;
  readonly minimizerVersion: string;
  readonly classifierVersion: string;
  readonly proposal:
    | { readonly kind: "merchant"; readonly merchantId: string }
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
