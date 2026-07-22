# AI-assisted merchant and category suggestions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Offer schema-validated merchant + category suggestions for rule-unresolved transactions, reviewed and accepted/rejected by the user (never auto-applied), with accepted corrections flowing through the existing atomic edit/rule/alias path and recording `localAi` provenance. Wire it to the real browser-local provider so suggestions run on-device.

**Architecture:** An application-layer `SuggestClassifications` orchestrator consumes the `ai-core` router with an injected `AiProvider` (real `LocalAiProvider` in the app, fake in tests). Eligible transactions are batched + minimized, run through `merchant.resolve.v1` then `category.classify.v1`, validated, and stored as `PersistedSuggestion` records in a new IndexedDB v11 store. A review UI lists them; Accept reuses `ApplyReviewCorrectionUseCase` (extended with an optional provenance parameter).

**Tech Stack:** TypeScript (strict), Vitest, React 19, IndexedDB (Dexie), the `ai-core`/`ai-local`/`schemas` packages, Playwright.

## Global Constraints

- Node 24 (`nvm use 24`); pnpm; after any `pnpm install` run `pnpm exec prettier --write pnpm-lock.yaml`.
- **Precedence is absolute:** AI never overwrites locked fields, exact overrides, explicit rules, or confirmed merchant mappings (`docs/10-LEARNING-ENGINE.md`). Eligibility excludes anything those resolve; apply rechecks.
- Suggestions cannot mutate canonical records before an explicit, eligibility-rechecked apply.
- No auto-apply. All results default to review. Confidence gated from `THRESHOLD_POLICY`; below-floor → abstain.
- No raw prompt/response or hidden reasoning persisted — only bounded evidence/rationale + the redacted request-audit id.
- Minimization: never send transaction/account ids, notes, raw rows, balances, filenames, or history; imported descriptions are untrusted JSON data, never instructions. Build only through `ai-core` minimizers.
- Accepted learning is deterministic (alias/rule/classification), not model memory.
- New DB migration is additive/contiguous; extend the migration matrix test.
- The persisted record is `PersistedSuggestion` (avoid colliding with `ai-core`'s transient `AiSuggestion`).
- Commits: no `Co-Authored-By` trailer. Canonical test: `pnpm test:coverage`.
- Full gate: `pnpm typescript:check && pnpm format:check && pnpm lint && pnpm schema:check && pnpm typecheck && pnpm test:coverage && pnpm build && pnpm security:headers:check -- apps/web/dist/_headers && pnpm audit --audit-level high`, plus `pnpm browser:test` for the UI/e2e.

## Verified integration points

- `TransactionClassification` (domain): `{ method: ClassificationMethod; classifierId; classifierVersion; confidence?; evidence[]; locked; decidedAt }`; `method` already includes `"localAi" | "remoteAi"`.
- `applyAutomaticCategoryEdit` / `applyAutomaticMerchantEdit` (domain `transaction-editing.ts`) take `{ category|merchant, classification: Omit<TransactionClassification,"locked"> }` — the primitive for non-user provenance.
- `planBulkTransactionEdit(records, ids, edit: ManualTransactionEdit, opId, now)` (application `transaction-ledger.ts`) currently only does manual edits.
- `ApplyReviewCorrectionUseCase` (application `review-queue.ts`) is the atomic accept path: bulk edit + optional `createRule` + `createMerchantAlias` + operation journal; exported with `ApplyReviewCorrectionInput`/`Result`.
- Transaction has `locked: boolean`, `reviewState`, and a revision via the reviewable record (revision lives in the storage `REVIEWABLE_TRANSACTION_SCHEMA` / ledger record — confirm exact field when implementing staleness).
- v10 store pattern: migration entry + `EntityTable` field + `IndexedDb*Repository` in `database.ts`; matrix test slices `DATABASE_MIGRATIONS`.

---

## File Structure

**`packages/domain/`:** extend `transaction-editing.ts` (optional provenance on the applied classification — see Task 1). Test alongside.

**`packages/application/`:**
- `src/ai-suggestions.ts` — `PersistedSuggestion` type, `AiSuggestionRepository` port, `SuggestClassifications` orchestrator, `AcceptSuggestion`/`RejectSuggestion` use cases, eligibility + batching + validation helpers.
- `src/ai-suggestions.test.ts` (+ focused test files per concern if large).
- Modify `src/review-queue.ts` (thread optional provenance through `ApplyReviewCorrectionUseCase`) and `src/transaction-ledger.ts` (`planBulkTransactionEdit` accepts optional provenance).
- Modify `src/index.ts` (exports).

**`packages/storage-indexeddb/`:** v11 migration + `aiSuggestions` store + `IndexedDbAiSuggestionRepository`; matrix test + repo test.

**`apps/web/`:** `src/AiSuggestionsSection.tsx` (+ test), glue in `src/ai-suggestions.ts`, mount in `TransactionPage.tsx`. `e2e/ai-suggestions.spec.ts`.

**Docs:** `docs/adr/ADR-022-AI-Suggestions-And-Provenance.md`; modify `docs/adr/README.md`, `docs/10-LEARNING-ENGINE.md`, `docs/08-AI-ARCHITECTURE.md`, `docs/09-DATA-MODEL.md`, `docs/07-SYSTEM-ARCHITECTURE.md`, `CHANGELOG.md`, `docs/15-ROADMAP.md`.

---

## Task 1: Thread optional provenance through the accept path

**Files:** Modify `packages/domain/src/transaction-editing.ts`, `packages/application/src/transaction-ledger.ts`, `packages/application/src/review-queue.ts`; tests alongside.

**Interfaces:**
- Produces: `ManualTransactionEdit` gains optional `provenance?: { method: "localAi" | "remoteAi"; classifierId: string; classifierVersion: string; confidence?: number; evidence: readonly string[] }`. When present on a merchant/category edit, the applied classification uses that `method` (not `user`) and is **not** auto-locked (AI-accepted values are reviewable, not user-locked, unless the review policy locks separately). `ApplyReviewCorrectionInput` gains the same optional `provenance`.

- [ ] **Step 1: Write the failing domain test**

In `packages/domain/src/transaction-editing.test.ts`, add:

```ts
it("records localAi provenance when an edit carries it", () => {
  const edited = applyManualTransactionEdit(
    baseTransaction(),
    {
      category: parseCategoryId(CATEGORY_ID),
      provenance: { method: "localAi", classifierId: "ai-local", classifierVersion: "1.0.0", evidence: ["model_category_candidate"] },
    },
    now,
  );
  expect(edited.classifications.category?.method).toBe("localAi");
  expect(edited.classifications.category?.locked).toBe(false);
});

it("still records a user-locked decision with no provenance", () => {
  const edited = applyManualTransactionEdit(baseTransaction(), { category: parseCategoryId(CATEGORY_ID) }, now);
  expect(edited.classifications.category?.method).toBe("user");
  expect(edited.classifications.category?.locked).toBe(true);
});
```

- [ ] **Step 2: Run to verify the first fails**

Run: `nvm use 24 && pnpm vitest run packages/domain/src/transaction-editing.test.ts`
Expected: the localAi test FAILS (provenance ignored).

- [ ] **Step 3: Implement in transaction-editing.ts**

Add `provenance?` to `ManualTransactionEdit`. In `applyManualTransactionEdit`, when `edit.category`/`edit.merchant` is set AND `edit.provenance` is present, build the classification from the provenance (method, classifierId, classifierVersion, confidence, evidence, `locked: false`, `decidedAt: now`) instead of `userClassification(...)`. With no provenance, keep the exact current behavior (`userClassification`, locked-by-default).

- [ ] **Step 4: Thread through planBulkTransactionEdit + ApplyReviewCorrection**

`planBulkTransactionEdit` already forwards `edit: ManualTransactionEdit`, so passing `provenance` in the edit flows automatically. In `ApplyReviewCorrectionUseCase`, add optional `provenance` to `ApplyReviewCorrectionInput` and include it in the `edit` object it builds (both the atomic and non-atomic branches).

- [ ] **Step 5: Run tests to verify pass**

Run: `nvm use 24 && pnpm vitest run packages/domain packages/application/src/review-queue.test.ts && pnpm --filter @financial-intelligence/domain typecheck && pnpm --filter @financial-intelligence/application typecheck`
Expected: PASS; existing review-correction tests unaffected (provenance optional).

- [ ] **Step 6: Commit**

```bash
git add packages/domain/ packages/application/
git commit -m "Thread optional AI provenance through the review accept path

Refs #36"
```

---

## Task 2: PersistedSuggestion model + eligibility + repository port

**Files:** Create `packages/application/src/ai-suggestions.ts` (types + eligibility + port), `src/ai-suggestions.test.ts`; modify `src/index.ts`.

**Interfaces:**
- Produces:
  - `PersistedSuggestion` (exact shape from the spec's data-model section).
  - `interface AiSuggestionRepository { save(s: PersistedSuggestion): Promise<void>; listPending(): Promise<readonly PersistedSuggestion[]>; findById(id): Promise<PersistedSuggestion | undefined>; setStatus(id, status): Promise<void>; listRejectedKeys(): Promise<readonly string[]> }`
  - `function rejectionKey(normalizedDigest: string, classifierVersion: string): string`
  - `interface EligibilityContext { readonly rules; readonly merchants; readonly ... }` and `function selectEligibleTransactions(records, context): readonly TransactionLedgerRecord[]` — active, unresolved-after-rules/mapping/heuristics, unlocked, within limit. Reuse the existing precedence evaluation (`EvaluateTransactionRulesUseCase` / review-queue's resolution) rather than reimplementing.

- [ ] **Step 1: Write the failing eligibility test**

Create `src/ai-suggestions.test.ts`: a locked transaction is excluded; one already resolved by a rule/merchant-mapping is excluded; an active unresolved unlocked one is included; the batch respects a max-limit.

- [ ] **Step 2: Run to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/application/src/ai-suggestions.test.ts`
Expected: FAIL (unresolved module).

- [ ] **Step 3: Implement the types, port, and eligibility selector**

Define `PersistedSuggestion`, `AiSuggestionRepository`, `rejectionKey`, and `selectEligibleTransactions`. For eligibility, resolve each transaction through the existing rule/merchant/heuristic precedence (reuse the review-queue resolution logic or `EvaluateTransactionRulesUseCase`); keep only those still unresolved, active, unlocked, and not already rejected for the current classifier version.

- [ ] **Step 4: Export + run**

Export from `src/index.ts`. Run the test + `pnpm --filter @financial-intelligence/application typecheck`. Expected PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/application/
git commit -m "Add PersistedSuggestion model, repository port, and eligibility selector

Refs #36"
```

---

## Task 3: Batching, minimization, and the SuggestClassifications orchestrator (fake provider)

**Files:** Modify `packages/application/src/ai-suggestions.ts`; add `src/ai-suggestions-orchestrator.test.ts`.

**Interfaces:**
- Consumes: `AiRouter` (or `AiProvider` + a thin router) from `ai-core`, `ai-core` minimizers, `AiSuggestionRepository`, eligibility selector.
- Produces:
  - `function buildSuggestionBatch(transactions): { digest: string; input: unknown; transactionIds: string[] }[]` — dedup by versioned normalized-description digest → txn-ids; minimized payload only.
  - `class SuggestClassifications { constructor(deps: { provider: AiProvider; repository: AiSuggestionRepository; ...; now; ids; digest }); execute(input): Promise<{ created: number }> }` — merchant.resolve pass then category.classify pass; validates each output (router validation + allowed-id + confidence gate); writes `pending` `PersistedSuggestion`s; abstains where appropriate.

- [ ] **Step 1: Write the failing orchestrator test**

Create `src/ai-suggestions-orchestrator.test.ts` using `ai-core`'s `FakeProvider` (or a local fake): a batch of 3 transactions with 2 unique descriptions produces suggestions fanned out to all 3; a low-confidence output is not written as an applyable suggestion (abstains); an ungrounded category id is rejected (no suggestion); adversarial description text does not alter behavior (treated as data).

- [ ] **Step 2: Run to verify it fails**

Run: `nvm use 24 && pnpm vitest run packages/application/src/ai-suggestions-orchestrator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement buildSuggestionBatch + SuggestClassifications**

Dedup by digest, keep the digest→ids map; build minimized task payloads via `ai-core` minimizers. Run merchant resolution over unique descriptions, then category classification using resolved/existing merchant label + category vocabulary. Validate each result; write `pending` suggestions (fanned out to all txn ids sharing the digest) or record abstention. Confidence below the `THRESHOLD_POLICY` floor → abstain.

- [ ] **Step 4: Run + commit**

Run the test + typecheck. Expected PASS.

```bash
git add packages/application/
git commit -m "Add batching/minimization and the SuggestClassifications orchestrator

Refs #36"
```

---

## Task 4: Accept / reject use cases with staleness + provenance

**Files:** Modify `packages/application/src/ai-suggestions.ts`; add `src/ai-suggestions-accept.test.ts`.

**Interfaces:**
- Produces:
  - `class AcceptSuggestion { constructor(deps: { repository; applyReviewCorrection: ApplyReviewCorrectionUseCase; ledgerRepository; now }); execute(input: { suggestionId; scope: "thisOnly"|"similar"|"allFromMerchant"; createRule?; createMerchantAlias? }): Promise<AcceptResult> }` — rechecks eligibility/staleness (transaction revision vs `targetRevision`, and that no rule/mapping now resolves it); on stale → sets `stale`, throws/returns a stale result, no mutation. On success → calls `ApplyReviewCorrectionUseCase` with `provenance: { method: "localAi", classifierId, classifierVersion, confidence, evidence }`; sets suggestion `accepted`.
  - `class RejectSuggestion { execute(input: { suggestionId }): Promise<void> }` — sets `rejected`, records the `rejectionKey`.

- [ ] **Step 1: Write failing tests**

Create `src/ai-suggestions-accept.test.ts`: accept applies via `ApplyReviewCorrectionUseCase` and the resulting classification method is `localAi`; accept of a suggestion whose transaction revision moved is refused as `stale` with no mutation; accept where a rule now resolves the transaction is refused; reject sets status + records the rejection key so the orchestrator won't re-create it. Use a fake `ApplyReviewCorrectionUseCase` spy or the real one with in-memory repos.

- [ ] **Step 2: Run to verify it fails; Step 3: Implement; Step 4: Run + commit**

Run: `nvm use 24 && pnpm vitest run packages/application/src/ai-suggestions-accept.test.ts && pnpm --filter @financial-intelligence/application typecheck`
Expected PASS.

```bash
git add packages/application/
git commit -m "Add accept/reject suggestion use cases with staleness and provenance

Refs #36"
```

---

## Task 5: IndexedDB v11 aiSuggestions store + repository

**Files:** Modify `packages/storage-indexeddb/src/migrations.ts`, `src/database.ts`, `src/index.ts`, `src/migrations.test.ts`, `src/compatibility.test.ts`; add `src/ai-suggestion.test.ts`.

- [ ] **Step 1: Add the schema + v11 migration**

In `migrations.ts` add `const AI_SUGGESTION_SCHEMA = "&id, targetTransactionId, status, task, createdAt";`, append a v11 migration entry (copy v10's stores + `aiSuggestions: AI_SUGGESTION_SCHEMA`), and set `CURRENT_DATABASE_VERSION = 11`.

- [ ] **Step 2: Add the table + repository in database.ts**

Add `aiSuggestions!: EntityTable<PersistedSuggestion, "id">` and `class IndexedDbAiSuggestionRepository implements AiSuggestionRepository` (mirror `IndexedDbAiProviderProfileRepository`: `save` via rw transaction, `listPending` via `where("status").equals("pending")`, `setStatus`, `findById`, `listRejectedKeys`). Export from `src/index.ts`.

- [ ] **Step 3: Update the version-matrix + compatibility tests**

In `migrations.test.ts` bump the version list to include 11 and add `aiSuggestions` to the expected table-name set. In `compatibility.test.ts` add a v10→v11 preservation assertion (workspaces preserved, empty `aiSuggestions`).

- [ ] **Step 4: Repository test + run**

Create `src/ai-suggestion.test.ts` (fake-indexeddb): save a pending suggestion, `listPending` returns it, `setStatus` to accepted removes it from pending. Run `pnpm vitest run packages/storage-indexeddb` + typecheck. Expected PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/storage-indexeddb/
git commit -m "Add v11 aiSuggestions store and repository adapter

Refs #36"
```

---

## Task 6: Review UI section (fake provider wired in web glue)

**Files:** Create `apps/web/src/AiSuggestionsSection.tsx`, `AiSuggestionsSection.test.tsx`, `src/ai-suggestions.ts` (glue); modify `apps/web/src/TransactionPage.tsx`.

**Interfaces:** Glue wires the orchestrator + repositories with an injected provider (default the real `LocalAiProvider`; tests inject fakes). The section: a "Suggest categories & merchants" button, a progress/status line, per-suggestion rows (proposed value, confidence, rationale + evidence, provenance label, Accept/Reject + scope this-only/similar/all-from-merchant), accept-to-rule impact preview, and designed empty/loading/unsupported/offline/error states.

- [ ] **Step 1: Write the failing panel test**

Create `AiSuggestionsSection.test.tsx` (jsdom, injected fakes): clicking Suggest renders returned suggestion rows with provenance; Accept calls the accept use case and removes the row; Reject removes it; unsupported (no capability/model) shows a rules-only message and no Suggest button.

- [ ] **Step 2: Implement the section + glue + mount**

Mirror `TransferReviewSection`/`RecurringReviewSection` and the standardized paper-panel treatment. Mount in `TransactionPage.tsx` near the other review sections. Reuse the download-panel progress idiom for the run status. Use the shared `Button`; primary "Suggest" action, secondary Accept/Reject per row (or the established review-row pattern).

- [ ] **Step 3: Run + typecheck + lint**

Run: `nvm use 24 && pnpm vitest run apps/web/src/AiSuggestionsSection.test.tsx && pnpm --filter @financial-intelligence/web typecheck && pnpm exec eslint apps/web/src/AiSuggestionsSection.tsx apps/web/src/ai-suggestions.ts`
Expected PASS/clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/
git commit -m "Add AI suggestions review section with accept/reject and provenance

Refs #36"
```

---

## Task 7: Accept-to-rule repeat-import e2e + real provider wiring

**Files:** Add `e2e/ai-suggestions.spec.ts`; confirm the web glue defaults to the real `LocalAiProvider`.

- [ ] **Step 1: e2e accept-to-rule repeat-import (fake-provider seam)**

Because real WebGPU inference can't run headless, the e2e drives the flow with a **test-injected fake provider** (via a window hook the app exposes only under a test flag, mirroring existing e2e seams) or by seeding suggestions directly, then: accept a category suggestion choosing "similar" → creates a deterministic rule (impact preview shown) → re-import similar transactions → they are classified by the rule with **no new suggestion**. Assert precedence (a locked/ruled transaction never gets an AI suggestion) and that no external network request occurs (network guard). Document that real-LLM generation is verified manually.

- [ ] **Step 2: Confirm real provider default**

Ensure `apps/web/src/ai-suggestions.ts` defaults the orchestrator's provider to the real `LocalAiProvider` (from #33) when not injected, gated on model-ready + capability, so a maintainer with the model downloaded sees real suggestions. No CSP/network change (inference is offline).

- [ ] **Step 3: Run (Chromium) + commit**

Run: `nvm use 24 && pnpm exec playwright test e2e/ai-suggestions.spec.ts --project=chromium`
Expected PASS.

```bash
git add apps/web/ e2e/
git commit -m "Add accept-to-rule repeat-import e2e and wire the real local provider

Refs #36"
```

---

## Task 8: ADR-022 + documentation

**Files:** Create `docs/adr/ADR-022-AI-Suggestions-And-Provenance.md`; modify `docs/adr/README.md`, `docs/10-LEARNING-ENGINE.md`, `docs/08-AI-ARCHITECTURE.md`, `docs/09-DATA-MODEL.md`, `docs/07-SYSTEM-ARCHITECTURE.md`, `CHANGELOG.md`, `docs/15-ROADMAP.md`.

- [ ] **Step 1: ADR-022**

Template (Accepted, 2026-07-21). Decision: suggestions persisted separately (v11 store) from canonical classifications; AI never mutates canonical records before an eligibility-rechecked apply; accept flows through the extended `ApplyReviewCorrectionUseCase` recording `localAi`/`remoteAi` provenance (unlocked, reviewable); review-only default (no auto-apply until #32-backed policy + opt-in); rejection memory keyed to `(digest, classifierVersion)`; no raw prompt/response persistence. Consequences: the accept path now carries optional provenance; a v11 migration; auto-apply is a future gated change. Alternatives: accept-as-user (loses provenance fidelity), in-memory suggestions (loses staleness/rejection persistence). Related: ADR-018/019/020/021, `docs/10-LEARNING-ENGINE.md`.

- [ ] **Step 2: Update specs + index + changelog + roadmap**

- `docs/adr/README.md`: ADR-022 line.
- `docs/10-LEARNING-ENGINE.md`: concretize the "optional AI suggestion" precedence step + AI correction/accept-to-rule workflow.
- `docs/08-AI-ARCHITECTURE.md`: classification pipeline now has a consuming feature.
- `docs/09-DATA-MODEL.md` + `docs/07-SYSTEM-ARCHITECTURE.md`: v11 `aiSuggestions` store + `PersistedSuggestion`.
- `CHANGELOG.md` (Unreleased), `docs/15-ROADMAP.md` (#36 landed; auto-apply + #37 remain).

- [ ] **Step 3: Commit**

```bash
git add docs/ CHANGELOG.md
git commit -m "Add ADR-022 and document AI-assisted suggestions

Refs #36"
```

---

## Task 9: Full gate + PR

- [ ] **Step 1: Full local gate**

```bash
nvm use 24 && pnpm install --frozen-lockfile && pnpm exec prettier --write pnpm-lock.yaml && \
pnpm typescript:check && pnpm format:check && pnpm lint && pnpm schema:check && \
pnpm typecheck && pnpm test:coverage && pnpm build && \
pnpm security:headers:check -- apps/web/dist/_headers && pnpm audit --audit-level high
```

Run `pnpm format` then re-check if needed. Fix root causes.

- [ ] **Step 2: Browser suite (UI + storage change → all three)**

Run: `nvm use 24 && pnpm browser:test`

- [ ] **Step 3: Push + PR**

```bash
git push -u origin hk/ai-suggestions-36
gh pr create --title "AI-assisted merchant and category suggestions (#36)" --body-file <template>
```

PR body: privacy/network — inference is offline (no CSP change); default path unaffected. Data — new v11 `aiSuggestions` store, no canonical schema change; accept path gains optional provenance (backward compatible). a11y — new review section validated. Verification — full gate + note the real-LLM suggestion path is manually verified (CI uses the fake provider). Closes #36.

- [ ] **Step 4: Watch CI**

Run: `gh pr checks --watch` — fix root causes, never force-push/amend, until green.

---

## Self-Review

**Spec coverage:** provenance-carrying accept → Task 1. PersistedSuggestion + eligibility + port → Task 2. batching/minimization/orchestrator (merchant→category, validation, abstain) → Task 3. accept/reject + staleness + precedence recheck → Task 4. v11 store → Task 5. review UI → Task 6. accept-to-rule repeat-import e2e + real provider → Task 7. ADR-022 + docs → Task 8. ✅ all acceptance criteria mapped (rules-win: Task 2 eligibility + Task 4 recheck; low-conf/invalid→review: Task 3; deterministic repeat: Task 7; no pre-apply mutation: Tasks 2/4; staleness: Task 4).

**Placeholder scan:** the transaction *revision field name* for staleness is flagged "confirm exact field when implementing" (Task 4/verified-points) — it's in the reviewable storage record; the implementer reads it rather than guessing. The e2e uses a test-injected fake-provider seam (real WebGPU is manual) — described concretely. No unresolved TODOs.

**Type consistency:** `PersistedSuggestion` defined Task 2, used Tasks 3/4/5/6. `AiSuggestionRepository` Task 2 → implemented Task 5. `provenance` shape identical across Task 1 (domain edit + review input) and Task 4 (accept). `ApplyReviewCorrectionUseCase` extension in Task 1 consumed in Task 4. Reuses verified real signatures (`applyManualTransactionEdit`, `planBulkTransactionEdit`, `ApplyReviewCorrectionInput`).

**Honest risk flags:** (1) eligibility must reuse the existing precedence evaluation, not reimplement it — Task 2 says so explicitly to avoid a second, drifting classifier. (2) The provenance extension is backward-compatible (optional), so existing review-correction tests must stay green — asserted in Task 1 Step 5. (3) Real-LLM path is only manually verified; CI proves the orchestration/precedence/staleness against the fake provider.