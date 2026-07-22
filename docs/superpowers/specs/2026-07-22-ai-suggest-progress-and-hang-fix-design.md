# AI suggestions: fix the Suggest hang + add progress/cancel/deadline

- Status: Approved
- Date: 2026-07-22
- Issue: Refs #38 (UX-defect slice; does not close #38), Refs #36
- Related: ADR-022 (AI suggestions & provenance), ADR-020/021 (browser-local runtime), ADR-014 (PWA cache lifecycle)

## Problem

Clicking **Suggest categories & merchants** with transactions present freezes the tab ("Page
Unresponsive"). On-device instrumentation (`[AISPIKE]`, PRs #110/#111) proved the freeze is **not**
the model, WebGPU, worker, or inference:

- 0 transactions → the whole flow completes in ~4 ms (`orchestrator done`, `suggest resolved`).
- With transactions → it logs `glue.suggest: loading ledger…` and **never reaches** `loaded in … ms`.

The hang is in the ledger-loading step that runs **before** any AI work.

### Root cause

`listAllLedgerTransactions` in `apps/web/src/AiSuggestionsSection.tsx` (added in #36) pages the ledger
by repeatedly calling `queryTransactionLedger.execute({ limit, offset })`. Each call runs
`repository.list()` → reads **every** IndexedDB row, deserializes each via `transactionFromCanonical`,
then filters and sorts — from scratch, on every page. For N transactions that is ⌈N/1000⌉ full
deserializations + sorts of the entire ledger, all synchronous on the main thread. This starves the
microtask queue (the other four reads in the `Promise.all` can't resolve), and the tab trips the
browser's unresponsive watchdog. The pagination loop existed only to dodge the query's 1000-row cap.

A secondary, real (but separate) UX gap: even once loading is fixed, inference is genuinely slow —
first click loads the model into the WebGPU session, then each unique description runs two sequential
inferences (merchant → category). Today the UI shows only a static "Analyzing…" with no progress, no
cancel, and the passed `deadlineMs` is never enforced.

## Goals

1. **Eliminate the freeze** by loading the full ledger in a single read (no re-scan pagination).
2. **Show phase-aware progress** (preparing model → analyzing N of M → done).
3. **Make a run cancellable**, keeping any suggestions already written.
4. **Enforce a per-inference deadline** so one slow/stuck description degrades to an abstention
   instead of wedging the batch; **warm up** the model after load so the first real inference is not
   inside a cold-start.
5. **Remove the `[AISPIKE]` instrumentation** merged in #110 and open in #111.

## Non-goals (deferred to the rest of #38)

Profile/artifact registry and state machine; storage accounting and model-cache eviction; inference
concurrency; memory-pressure recovery/fallback; version attribution beyond what suggestions already
record. This is the UX-defect slice only. PR says `Refs #38`, not `Closes`.

## Design

### 1. Single-read ledger load (the fix)

Replace the quadratic pagination helper with a single full-ledger read.

- Add a use case `ListAllTransactions` in `packages/application` that returns
  `ledgerRepository.list()` directly (one read, no filter/sort/paginate) as `readonly Transaction[]`.
  Expose it on `ApplicationServices` in `apps/web/src/infrastructure.ts` (it reuses the already-wired
  module-private `ledgerRepository`).
- `AiSuggestionsSection` builds the controller with `listTransactions: () =>
  services.listAllTransactions.execute()`, deleting `listAllLedgerTransactions`.
- `repository.list()` is called **exactly once** per Suggest run.

Rationale: eligibility needs the whole ledger, not a page; the paginated, re-sorting query is the
wrong tool and was the sole cause of the freeze. A single `toArray().map(fromCanonical)` is linear and
already what one page did — we just stop repeating it.

### 2. Progress plumbing (preparing → analyzing)

A structured progress event flows outward from where the data exists:

```ts
type SuggestProgress =
  | { phase: "preparing"; loadedFraction: number }        // model load, first run only
  | { phase: "analyzing"; completed: number; total: number }; // per batch item
```

- **Worker → provider:** the worker already emits `progress` messages during `engine.load`
  (`progress_callback`), and `ExecuteOptions` **already declares** `onProgress?: (fraction: number) =>
  void` — it is simply never wired. `LocalAiProvider.execute` will invoke `options.onProgress(fraction)`
  when a `progress` message arrives during load. The orchestrator maps that fraction to
  `{ phase: "preparing", loadedFraction }`.
- **Orchestrator → glue:** `SuggestClassifications.execute` accepts `onProgress?: (e: SuggestProgress)
  => void`. It emits `{ phase: "analyzing", completed, total }` before/after each batch entry
  (`total = batch.length`), and passes the provider's `preparing` events through.
- **Glue → section:** `AiSuggestionsController.suggest(signal?, onProgress?)` forwards to the
  orchestrator. The section passes a setter that stores the latest `SuggestProgress` in React state.
- **Section UI:** while `phase === "running"`, render a `role="progressbar"` reusing the
  `.local-ai-progress` treatment. `preparing` → determinate `loadedFraction` ("Preparing model… 42%");
  `analyzing` → determinate `completed/total` ("Analyzing 3 of 12…"). `aria-live` announces phase
  transitions.

No new store, schema, or CSP change. Progress is advisory; a provider that reports nothing still runs
(bar shows analyzing counts only).

### 3. Cancel

- The section owns an `AbortController` created on Suggest and cleared on settle. A **Cancel** button
  is shown during `running`; clicking it calls `controller.abort()`.
- The signal is already threaded to `provider.execute` → `runExecute`, which posts a `cancel` message;
  the worker-handler aborts its per-operation controller. The orchestrator checks `signal.aborted`
  between entries and stops issuing new `provider.execute` calls.
- On cancel: suggestions already written stay pending (valid proposals); phase → `idle`; status
  "Cancelled — N found so far." No partial/corrupt state (each suggestion is written atomically per
  the existing repository).

### 4. Deadline + warmup

- **Warmup:** after `ensureLoaded`, `LocalAiProvider` sends the existing `warmup` op once per worker
  lifetime, so the first real `generate` is not paying cold-start inside a timed path.
- **Deadline:** `LocalAiProvider.execute` wraps `runExecute` in a timeout of `options.deadlineMs`. On
  expiry it posts `cancel` for that operation and rejects with `aiError("resource_exhausted", …)` (a
  new stable mapping; reuses the existing error taxonomy — no new envelope shape).
- **Orchestrator tolerance:** a provider error for a single item (deadline, invalid output, refusal)
  is already treated as an abstention for that pass; confirm both merchant and category passes
  continue the loop rather than throwing. One slow description cannot wedge the batch.

### 5. Instrumentation cleanup

Revert every `[AISPIKE]` line: the load/warmup/generate timing + `detectBackend` in
`transformers-engine.ts` and `provider.ts` (merged via #110), and the glue/orchestrator/section logs
(open in #111). Close PR #111 unmerged. No `[AISPIKE]` string remains in the tree.

## Data flow (after)

1. Suggest clicked → section creates an `AbortController`, sets phase `running`.
2. `controller.suggest(signal, onProgress)` → **one** `listAllTransactions.execute()` + the other
   reads (fast, linear).
3. Orchestrator selects eligible, builds the deduped batch, and for each entry runs merchant then
   category through the provider, emitting `analyzing` progress; the provider emits `preparing`
   progress during first-run load and warms up before the first inference.
4. Each item is deadline-bounded; a timed-out/invalid item abstains. Cancel stops new work.
5. Pending suggestions are listed as today; phase → `idle` with a summary, or `error` on a hard
   failure. Rules-only remains fully functional throughout.

## Testing

All CI-safe (fake/scripted provider; no real model in CI):

- **Application unit:** `onProgress` fires once per batch item with correct `completed/total`; a
  deadline-exceeded item (fake provider that never resolves within `deadlineMs`) abstains without
  failing the batch; `signal.aborted` between entries stops further `provider.execute` calls.
- **Provider unit:** `execute` rejects with `resource_exhausted` when the worker does not respond
  within `deadlineMs`, and posts a `cancel` for that operation; `warmup` is sent once before the first
  `execute`.
- **Web/glue unit (regression):** the ledger loader calls `repository.list()` **exactly once** per
  Suggest run (guards against the quadratic regression).
- **Section component (jsdom):** progress bar renders during `running` with phase text; Cancel button
  appears and triggers abort; idle/error transitions; unsupported path unchanged.
- **e2e (`ai-suggestions.spec.ts`):** with a scripted provider that delays, assert the progress UI and
  a Cancel control appear during a run; the existing accept-to-rule repeat-import + network-guard
  assertions stay green.

Regression coverage note: the single-read test is the one that would have caught this bug; it is
mandatory.

## Documentation impact

- `CHANGELOG.md` (Unreleased, Fixed + Changed): fix the Suggest hang; add progress/cancel/deadline.
- `docs/10-LEARNING-ENGINE.md` "Optional AI suggestions": note the explicit-run flow now shows
  progress and is cancellable. No precedence change.
- `docs/08-AI-ARCHITECTURE.md`: the classification pipeline's optional-AI step is progress-reporting
  and cancellable/time-bounded.
- No ADR: this follows ADR-022's accepted design (review-only, on-device); it is a defect fix plus UX,
  not a new durable decision. No schema/portable-contract, migration, or CSP change.
- Roadmap: #38 remains open (this is a slice); note the UX-defect fix under Phase 4 if wording would
  otherwise mislead.

## Risks

- **Progress callback threading** crosses worker → provider → orchestrator → glue → React. Kept as a
  single optional callback with a small typed event to avoid protocol churn; the worker already emits
  the `progress` message, so no worker-protocol change is required.
- **Deadline too aggressive** could abstain on legitimately slow devices. Default stays 30 s per
  inference; it only bounds a genuinely stuck op.
- **Single-read memory** for very large ledgers: one full deserialization is unchanged from what one
  page already did and from every other full-ledger consumer (dashboards, review queue); not a new
  ceiling.
