import type { AiProvider } from "@financial-intelligence/ai-core";
import {
  LocalAiProvider,
  createLocalAiWorker,
  type LocalWorker,
} from "@financial-intelligence/ai-local";
import {
  SuggestClassifications,
  activeCategoryIds,
  type AcceptSuggestion,
  type AiSuggestionRepository,
  type EligibilityContext,
  type PersistedSuggestion,
  type RejectSuggestion,
} from "@financial-intelligence/application";
import type {
  Category,
  ClassificationRule,
  Merchant,
  Transaction,
} from "@financial-intelligence/domain";

import { LOCAL_AI_PROFILE, isModelReady } from "./local-ai";

/**
 * Versions stamped onto every suggestion so rejection memory and staleness can key on a stable
 * identity. Bumping `classifierVersion` intentionally re-opens previously rejected candidates.
 */
export const SUGGESTION_VERSIONS = {
  taskVersion: "1.0.0",
  promptVersion: "1.0.0",
  minimizerVersion: "1.0.0",
  classifierVersion: `${LOCAL_AI_PROFILE.profileId}@1.0.0`,
} as const;

/** Below this confidence a proposal abstains rather than surfacing an applyable suggestion. */
const MIN_CONFIDENCE = 0.5;
/** Per-task budget for one on-device inference; generous because local models are slow. */
const DEADLINE_MS = 30_000;
/** A pending suggestion is treated as expired after this long. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A pending suggestion projected into a shape the review section can render directly. */
export interface SuggestionView {
  readonly id: string;
  readonly transactionId: string;
  readonly kind: "merchant" | "category";
  /** Merchant label or resolved category display name. */
  readonly proposedLabel: string;
  /** The raw category id for a category proposal (needed to accept); undefined for merchant. */
  readonly categoryId?: string;
  /** The proposed merchant label (needed to resolve/create on accept); undefined for category. */
  readonly merchantLabel?: string;
  readonly confidence: number | null;
  readonly rationale: string;
  readonly evidenceCodes: readonly string[];
  /** Human-readable provenance, e.g. "Gemma 3n · on-device". */
  readonly provenance: string;
  /** Normalized description the model saw; used to build a "similar" rule on accept. */
  readonly normalizedDigest: string;
}

/** How widely to apply an accepted category suggestion. */
export type AcceptScope = "this-only" | "similar";

export interface SuggestOutcome {
  readonly created: number;
  readonly abstained: number;
}

/** Everything the controller needs from the app's already-wired services. */
export interface AiSuggestionsControllerDeps {
  readonly repository: AiSuggestionRepository;
  readonly acceptSuggestion: AcceptSuggestion;
  readonly rejectSuggestion: RejectSuggestion;
  readonly listTransactions: () => Promise<readonly Transaction[]>;
  readonly listCategories: () => Promise<readonly Category[]>;
  readonly listRules: () => Promise<readonly ClassificationRule[]>;
  readonly listMerchants: () => Promise<readonly Merchant[]>;
  /**
   * The AI provider to run. Defaults to the real browser-local provider; tests inject a fake so no
   * CI run touches a worker, the network, or a model.
   */
  readonly provider?: AiProvider;
  /** Whether a local model is cached and ready; defaults to the real cache probe. */
  readonly isReady?: () => Promise<boolean>;
  readonly now?: () => string;
  readonly newId?: () => string;
}

/**
 * Optional end-to-end test seam. Real WebGPU inference cannot run headless, so an e2e may set
 * `globalThis.__FI_AI_TEST__` to a scripted provider before the section mounts, exercising the real
 * orchestrator, persistence, and accept-to-rule path without a model. It is never set in
 * production (nothing writes it), so the default local provider is used unchanged.
 */
interface AiTestSeam {
  readonly provider: AiProvider;
  readonly ready?: boolean;
}

function readTestSeam(): AiTestSeam | undefined {
  const seam = (globalThis as { __FI_AI_TEST__?: AiTestSeam }).__FI_AI_TEST__;
  return seam !== undefined && typeof seam === "object" ? seam : undefined;
}

function providerModelLabel(provider: AiProvider): string {
  const reported = provider.profile.reportedModel;
  const location =
    provider.profile.executionLocation === "local"
      ? "on-device"
      : provider.profile.executionLocation;
  return reported === null ? `local model · ${location}` : `${reported} · ${location}`;
}

/**
 * Controller for the optional AI-suggestions review flow. Holds no React state; the section owns
 * presentation. All model work goes through the injected provider and the existing application use
 * cases, so canonical data is only ever mutated via the eligibility-rechecked accept path.
 */
export class AiSuggestionsController {
  private readonly provider: AiProvider;
  private readonly ready: () => Promise<boolean>;
  private readonly now: () => string;
  private readonly newId: () => string;

  public constructor(private readonly deps: AiSuggestionsControllerDeps) {
    const seam = deps.provider === undefined ? readTestSeam() : undefined;
    this.provider =
      deps.provider ??
      seam?.provider ??
      new LocalAiProvider({
        createWorker: (): LocalWorker => createLocalAiWorker(),
        profile: LOCAL_AI_PROFILE,
        isReady: () => isModelReady(),
      });
    this.ready =
      deps.isReady ??
      (seam !== undefined ? () => Promise.resolve(seam.ready ?? true) : isModelReady);
    this.now = deps.now ?? (() => new Date().toISOString());
    this.newId = deps.newId ?? (() => crypto.randomUUID());
  }

  /** Whether the Suggest action can run at all (a local model must be cached and ready). */
  public isReady(): Promise<boolean> {
    return this.ready();
  }

  /** Run one suggestion cycle over the current ledger, writing pending suggestions. */
  public async suggest(signal?: AbortSignal): Promise<SuggestOutcome> {
    const [transactions, categories, rules, merchants, rejectedKeys] = await Promise.all([
      this.deps.listTransactions(),
      this.deps.listCategories(),
      this.deps.listRules(),
      this.deps.listMerchants(),
      this.deps.repository.listRejectedKeys(),
    ]);

    const eligibility: EligibilityContext = {
      rules,
      merchants,
      rejectedKeys: new Set(rejectedKeys),
      classifierVersion: SUGGESTION_VERSIONS.classifierVersion,
    };

    const orchestrator = new SuggestClassifications({
      provider: this.provider,
      repository: this.deps.repository,
      now: this.now,
      newId: this.newId,
      deadlineMs: DEADLINE_MS,
      versions: SUGGESTION_VERSIONS,
      ttlMs: TTL_MS,
      minConfidence: MIN_CONFIDENCE,
    });

    return orchestrator.execute({
      transactions,
      allowedCategoryIds: activeCategoryIds(categories),
      ...(signal ? { signal } : {}),
      eligibility,
    });
  }

  /** List pending suggestions projected for display, resolving category ids to names. */
  public async listPending(): Promise<readonly SuggestionView[]> {
    const [pending, categories] = await Promise.all([
      this.deps.repository.listPending(),
      this.deps.listCategories(),
    ]);
    const categoryName = new Map(categories.map((c) => [c.id, c.name]));
    const provenance = providerModelLabel(this.provider);
    return pending.filter(isApplyable).map((s) => toView(s, categoryName, provenance));
  }

  /**
   * Accept a category suggestion. With scope `similar`, also create a deterministic classification
   * rule (matching the normalized description) so future imports are classified without AI — the
   * accept-to-rule path. Merchant suggestions require resolving the label to a merchant id first (a
   * later refinement); this path applies grounded category proposals.
   */
  public async accept(view: SuggestionView, scope: AcceptScope = "this-only"): Promise<void> {
    const createRule =
      scope === "similar" && view.kind === "category" && view.categoryId !== undefined
        ? {
            name: `AI: ${view.proposedLabel}`,
            conditions: [
              {
                field: "normalizedDescription" as const,
                operator: "equals" as const,
                value: view.normalizedDigest,
              },
            ],
            actions: [{ type: "setCategory" as const, value: view.categoryId }],
          }
        : undefined;
    await this.deps.acceptSuggestion.execute({
      suggestionId: view.id,
      ...(createRule === undefined ? {} : { createRule }),
    });
  }

  public async reject(suggestionId: string): Promise<void> {
    await this.deps.rejectSuggestion.execute({ suggestionId });
  }
}

function isApplyable(s: PersistedSuggestion): boolean {
  return s.status === "pending" && s.proposal.kind !== "abstain";
}

function toView(
  s: PersistedSuggestion,
  categoryName: ReadonlyMap<string, string>,
  provenance: string,
): SuggestionView {
  const base = {
    id: s.id,
    transactionId: s.targetTransactionId,
    confidence: s.confidence,
    rationale: s.rationale,
    evidenceCodes: s.evidenceCodes,
    provenance,
    normalizedDigest: s.normalizedDigest,
  };
  if (s.proposal.kind === "merchant") {
    return {
      ...base,
      kind: "merchant",
      proposedLabel: s.proposal.merchantLabel,
      merchantLabel: s.proposal.merchantLabel,
    };
  }
  // Category proposal (abstentions are filtered out before projection).
  const categoryId = s.proposal.kind === "category" ? s.proposal.categoryId : "";
  return {
    ...base,
    kind: "category",
    proposedLabel: categoryName.get(categoryId) ?? categoryId,
    categoryId,
  };
}
