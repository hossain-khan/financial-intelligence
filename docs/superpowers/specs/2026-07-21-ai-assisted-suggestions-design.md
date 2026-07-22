# AI-assisted merchant and category suggestions (#36)

- Date: 2026-07-21
- Issue: [#36](https://github.com/hossain-khan/financial-intelligence/issues/36)
- Epic: [#16 — Phase 4, Optional AI assistance](https://github.com/hossain-khan/financial-intelligence/issues/16)
- Status: Approved design, pending implementation

## Purpose

Offer schema-validated merchant and category **suggestions** for transactions that deterministic
rules could not resolve, while keeping user rules, locks, and review authoritative. This is the first
feature that consumes the browser-local provider (#33) end-to-end: the user clicks "Suggest", the
local LLM proposes merchants/categories, and each proposal is reviewed and accepted/rejected — never
auto-applied. Accepted corrections flow through the existing atomic edit + rule/alias path so learning
stays deterministic.

## Decisions (locked in brainstorming)

- **Both tasks:** `merchant.resolve.v1` runs first over unique descriptions; `category.classify.v1`
  then runs using the accepted/existing merchant label + current category vocabulary.
- **Explicit user trigger:** a "Suggest" action in the review area runs the batch on demand; no
  background/auto inference.
- **Persisted suggestions:** a new IndexedDB v11 `aiSuggestions` store holds pending/accepted/
  rejected/stale/invalid records (survives reload; powers staleness + rejection memory).
- **Everything to review, no auto-apply.** Confidence is gated from the existing `THRESHOLD_POLICY`;
  the pinned model stays **experimental** until a #32 corpus run yields a support record. Auto-apply
  is a later, separately-justified change.
- **New ADR-022** records the suggestion-store + AI-into-canonical-provenance authority decision.

## Scope

In scope:

- An application-layer `SuggestClassifications` orchestrator consuming the `ai-core` router with an
  injected provider (real `LocalAiProvider` in the app, fake in tests).
- Eligibility selector (unresolved-after-rules, active, unlocked, included, within limits) with
  re-check before apply.
- Batching + minimization by a versioned normalized-description digest → transaction-id map.
- A `PersistedSuggestion` model + v11 `aiSuggestions` store + repository adapter.
- Strict validation (allowed-ID grounding, confidence gate, abstain) and precedence enforcement.
- Review UI (new `TransactionPage` section): Suggest button, per-suggestion accept/reject/abstain
  with provenance and rationale, and accept-to-rule/alias via the existing impact preview.
- Rejection memory keyed to `(digest, classifierVersion)`.
- ADR-022, docs, and tests including an end-to-end accept-to-rule repeat-import test.

Out of scope:

- Auto-apply of any AI result (deferred; requires calibrated evaluation + opt-in + undo trail).
- `query.plan.v1` / natural-language query (#37).
- Uploading feedback or training any model.
- Remote/self-hosted providers as the suggestion source (this wires the local provider; #34/#35
  register through the same injected-provider seam later).

## Non-goals and invariants

- **Explicit user decisions are never overwritten.** AI cannot touch locked fields, exact
  transaction overrides, explicit rules, or confirmed merchant mappings (precedence per
  `docs/10-LEARNING-ENGINE.md`).
- Suggestions **cannot mutate canonical records** before an explicit, eligibility-rechecked apply.
- No AI-authored numeric analysis; no guessed values — invalid/low-confidence/ambiguous/refused
  become abstention or needs-review.
- No raw prompts, responses, or hidden reasoning are persisted; only bounded evidence/rationale text
  and the redacted request-audit id.
- Imported descriptions are untrusted data in typed JSON; they never become instructions or tools.
- Accepted learning is stored as deterministic alias/rule/classification knowledge, not model memory.

## Architecture

```text
apps/web  (review area: "Suggest" button → suggestion rows → accept/reject/convert-to-rule)
  └─► packages/application
        SuggestClassifications (orchestrator; provider injected)
          ├─ SuggestionEligibilitySelector   (active, unresolved-after-rules, unlocked, included)
          ├─ SuggestionBatcher/minimizer      (digest → txn-ids; ai-core minimizers only)
          ├─ AiRouter.execute(merchant.resolve.v1) → then category.classify.v1
          ├─ SuggestionValidator              (allowed-id grounding, confidence gate, abstain)
          └─ AiSuggestionRepository           (v11 aiSuggestions store)
        accept → ApplyReviewCorrectionUseCase  (existing: atomic edit + rule/alias + provenance + lock)
  provider: @financial-intelligence/ai-local LocalAiProvider (worker) in the app; fake in tests
```

- The orchestrator lives in `packages/application` — it coordinates domain entities and ports, with
  no React or direct runtime import. The provider is injected via the `ai-core` `AiProvider`
  interface, so the whole pipeline is CI-testable with a fake provider.
- **Accept reuses `ApplyReviewCorrectionUseCase`** (already atomic: bulk edit + optional rule/alias +
  operation journal + optional lock) rather than adding a parallel mutation path. **Refinement found
  during planning:** that path currently writes `user`-method classifications only (via
  `planBulkTransactionEdit` → `applyManualTransactionEdit`), so it must be **extended with an optional
  provenance parameter** (`{ method, classifierId, classifierVersion, confidence, evidence }`) to
  record `method: "localAi"` on an accepted AI suggestion while a manual tweak still records `user`.
  The domain already has the primitive (`applyAutomaticCategoryEdit`/`applyAutomaticMerchantEdit`
  take a `classification` with a `method`); this threads it through the review use case. A manual
  correction with no provenance argument keeps today's exact behavior (backward compatible).
- New IndexedDB **v11 `aiSuggestions`** store + `IndexedDbAiSuggestionRepository`, following the v10
  provider-profile pattern; extends the migration matrix test.

## Suggestion data model (v11)

To avoid clashing with `ai-core`'s transient `AiSuggestion`, the persisted record is
`PersistedSuggestion`:

```ts
interface PersistedSuggestion {
  readonly id: string;
  readonly targetTransactionId: string;
  readonly targetRevision: number;          // staleness anchor
  readonly task: "merchant.resolve.v1" | "category.classify.v1";
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
  readonly evidenceCodes: readonly string[]; // bounded, user-facing
  readonly rationale: string;                // bounded text; never hidden reasoning
  readonly provider: {
    readonly profileId: string;
    readonly adapterId: string;
    readonly reportedModel: string | null;
    readonly executionLocation: "local" | "selfHosted" | "remote";
  };
  readonly requestAuditId: string;           // #31 audit holds digests only
  readonly status: "pending" | "accepted" | "rejected" | "stale" | "invalid";
  readonly createdAt: string;
  readonly expiresAt: string;
}
```

- **Staleness:** before apply, re-fetch the transaction; if its revision ≠ `targetRevision`, or a
  rule/merchant-mapping now resolves it, the suggestion is set `stale` and cannot apply.
- **Rejection memory:** a rejected record's `(normalized-description digest, classifierVersion)` key
  suppresses re-presenting the identical candidate until the classifier version changes. It records a
  bounded local feedback event; it never trains or uploads anything.

## Eligibility, batching, and minimization

- **Eligibility:** active, unresolved after rules/merchant-mapping/heuristics (reusing the existing
  precedence evaluation), unlocked, within configured task limits, and included by policy. Rechecked
  immediately before any apply — a concurrent manual edit, rule activation, merchant merge, or
  classifier-version change makes a suggestion stale.
- **Batching/minimization:** deduplicate by a versioned digest of the normalized description plus
  permitted context (direction, allowed non-archived category vocabulary), keeping a local
  digest→transaction-ids map. Never send transaction/account ids, notes, raw rows, balances,
  filenames, or unrelated history. Bound batch size by provider capability.
- **Two-pass composition:** `merchant.resolve.v1` over unique descriptions first; then
  `category.classify.v1` using the accepted/existing merchant label and the current category
  vocabulary. Descriptions travel as typed JSON data only.

## Validation, precedence, and thresholds

- Every model output passes the `ai-core` router's strict validation (strict JSON, no unknown props,
  bounded, workspace-current ids, allowed-id grounding). Invalid id, low confidence, ambiguity,
  conflicting alias/category, or provider refusal → abstain / needs-review, never a guessed value.
- Precedence (`docs/10-LEARNING-ENGINE.md`) is enforced by excluding anything locks/overrides/rules/
  confirmed-mappings already resolve, and rechecking before apply.
- Thresholds come from the versioned `THRESHOLD_POLICY` (confidence below the task floor → abstain).
  **All results default to review; nothing auto-applies.** The pinned local model is `experimental`
  until a #32 corpus evaluation records a support verdict; auto-apply is a later change gated on that.

## Review UI

A new review section in `TransactionPage`, mirroring `TransferReviewSection`/`RecurringReviewSection`
and using the standardized paper-panel treatment:

- a **"Suggest categories & merchants"** button (explicit trigger) that runs the batch through the
  injected `LocalAiProvider`, with an accessible progress/status line (reusing the download-panel
  progress idiom);
- per-suggestion rows showing the proposed merchant/category, confidence, plain-language
  rationale + evidence codes, and provenance ("Gemma 3n · on-device"), with **Accept / Reject** and
  the correction scope **this transaction only / similar / all from confirmed merchant**;
- accept-to-rule/alias shows the existing impact preview (match count, changes, locked, conflicts)
  before atomic activation;
- designed empty, loading, unsupported (no local model / device), offline, and error states;
  keyboard operable, status announcements, reduced-motion, forced-colors, 320px reflow validated.

## Data flow

1. User clicks Suggest. The orchestrator selects eligible transactions, builds a minimized deduped
   batch, and runs merchant resolution then category classification through the router + provider.
2. Each validated proposal is written as a `pending` `PersistedSuggestion`; invalid/low-confidence/
   refused become `abstain`/needs-review (or are dropped) and are not shown as applyable.
3. The review UI lists pending suggestions with provenance. On Accept, eligibility is rechecked;
   `ApplyReviewCorrectionUseCase` applies the edit (optionally creating a rule/alias, optionally
   locking) with `localAi` provenance and an optimistic revision check; the suggestion becomes
   `accepted`.
4. On Reject, a bounded feedback event is recorded; the suggestion becomes `rejected` and the
   candidate is not re-presented for the same classifier version.

## Error handling

- Stale (revision moved / now rule-resolved) → marked `stale`, apply refused, user informed.
- Provider refusal / device loss / OOM → abstention/needs-review; no guessed value; rules-only
  unaffected; never a remote fallback.
- Invalid or ungrounded output → `invalid`; never written to canonical records.
- Concurrent accept of a suggestion whose transaction changed → optimistic revision check rejects it.

## Testing

- Precedence + threshold table tests (locks/overrides/rules/mappings always win; below-floor
  confidence abstains).
- Provider-contract + injection-resistant output tests (adversarial descriptions never become
  instructions; ungrounded ids rejected).
- Staleness/race tests (revision moved, rule now resolves, concurrent edit).
- Deduplicated-batch fan-out (one suggestion maps to many transactions).
- Rejection-memory test (same candidate not re-presented until classifier version changes).
- Provenance test (`localAi` written; no raw prompt/response persisted).
- End-to-end accept-to-rule **repeat-import** test: accept a category correction → re-import similar
  transactions → deterministically classified with no new suggestion.
- All CI tests use the fake provider; the real `LocalAiProvider` path is exercised manually.

## Documentation impact

- New ADR `docs/adr/ADR-022-AI-Suggestions-And-Provenance.md` + index entry: suggestions persisted
  separately from canonical classifications; AI never mutates canonical records before an
  eligibility-rechecked apply; accept flows through the existing atomic edit/rule/alias path with
  `localAi`/`remoteAi` provenance; review-only default; rejection memory; no raw prompt/response
  persistence.
- `docs/10-LEARNING-ENGINE.md`: concretize the "optional AI suggestion" precedence step and the
  correction/accept-to-rule workflow for AI-sourced suggestions.
- `docs/08-AI-ARCHITECTURE.md`: the classification pipeline now has a consuming feature.
- `docs/09-DATA-MODEL.md` + `docs/07-SYSTEM-ARCHITECTURE.md`: the v11 `aiSuggestions` store and
  `PersistedSuggestion`.
- `docs/13-UX-GUIDELINES.md`/`docs/21-DESIGN-SYSTEM.md` review as applicable for the new review
  section; `CHANGELOG.md`, `docs/15-ROADMAP.md`.

## Delivery order (staged commits)

1. Eligibility selector, `PersistedSuggestion` + v11 store/repository, and fake-provider
   orchestration.
2. Batching/minimization, staleness, precedence, and threshold policy.
3. Review UI with accept/reject/abstain and provenance explanation.
4. Accept-to-deterministic-rule workflow and repeat-import e2e.
5. Wire the real `LocalAiProvider`; ADR-022 + docs.

## Acceptance criteria (from #36)

- Explicit rules always win.
- Low-confidence or invalid results enter review or abstain.
- Repeated accepted corrections are handled deterministically on later imports.
- Suggestions cannot mutate canonical records before an allowed apply action.
- Stale results are detected and cannot overwrite newer decisions.
