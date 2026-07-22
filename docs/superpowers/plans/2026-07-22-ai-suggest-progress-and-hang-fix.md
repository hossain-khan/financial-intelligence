# AI-suggest hang fix + progress/cancel/deadline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the Suggest hang (a quadratic ledger re-scan) and make the genuinely-slow inference phase responsive with phase-aware progress, a working Cancel, an enforced per-inference deadline, and model warmup.

**Architecture:** Replace the paginating `listAllLedgerTransactions` with a single full-ledger read via a new `ListAllTransactions` use case. Thread an optional progress callback from the worker (load fraction, already emitted) and orchestrator (item counts) out to a progress bar in the section. The section owns an `AbortController` for Cancel; `LocalAiProvider.execute` enforces `deadlineMs` and warms up once. Revert the `[AISPIKE]` instrumentation.

**Tech Stack:** pnpm monorepo, Node 24, strict TypeScript, Vitest, Playwright, React 19, transformers.js worker, Dexie/IndexedDB.

## Global Constraints

- Node 24 with corepack pnpm 10.33.0; run gate commands as `source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm …` in one shell. If `pnpm-lock.yaml` churns on quote style, run `corepack pnpm exec prettier --write pnpm-lock.yaml`.
- Canonical test command is `pnpm test:coverage` (CI enforces the coverage gate). Do not use `pnpm test`.
- No new network destination, no CSP change, no schema/portable-contract change, no IndexedDB migration.
- AI is browser-local only; nothing auto-applies; deterministic rules keep precedence (ADR-022). Never persist raw prompts/model output.
- Do NOT append the `Co-Authored-By: Claude` trailer (CLAUDE.local.md).
- Reuse the existing error taxonomy (`aiError` codes: `unsupported | invalid_output | cancelled | resource_exhausted | provider_error`). No new envelope shape.
- Branch: `hk/ai-suggest-progress-fix` (already created off main). Every commit is a new commit; never amend/force-push.

---

### Task 1: Revert the [AISPIKE] instrumentation

**Files:**
- Modify: `packages/ai-local/src/transformers-engine.ts` (remove all `[AISPIKE]` logging + `detectBackend`)
- Modify: `packages/ai-local/src/provider.ts` (remove all `[AISPIKE]` main-thread markers)

**Interfaces:**
- Consumes: nothing.
- Produces: clean `transformers-engine.ts`/`provider.ts` matching their pre-#110 behavior (no functional change).

- [ ] **Step 1: Remove instrumentation from `transformers-engine.ts`**

Delete the `[AISPIKE]` lines and the `detectBackend` function. The `load` method returns to:

```ts
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    // dtype comes from the pinned profile. Gemma 3n must use `q4`, not `q4f16`: the q4f16 export
    // crashes ORT Web session creation with a float16/float32 mismatch in the AltUp block (#33).
    this.generator = (await pipeline("text-generation", profile.modelRepo, {
      revision: profile.modelRevision,
      device: "webgpu",
      dtype: profile.quantization as "q4" | "q4f16" | "fp16",
      progress_callback: (report: ProgressInfo) => {
        if ("progress" in report && typeof report.progress === "number") {
          onProgress(report.progress / 100);
        }
      },
    })) as TextGenerationPipeline;
  }
```

`warmup` returns to `await this.generator("ping", { max_new_tokens: 1 });` with no logging. `generate` returns to the plain `await this.generator(...)` with no timing log. Delete the entire `detectBackend` function at the bottom.

- [ ] **Step 2: Remove instrumentation from `provider.ts`**

Restore the `execute` try-block to:

```ts
    try {
      const worker = this.ensureWorker();
      await this.ensureLoaded(worker, options.signal);
      const prompt = buildClassifyPrompt(request.payload, this.deps.profile.promptVersion);
      const output = await this.runExecute(worker, request.task, prompt, options.signal);
      return this.validate(request.task, output);
```

- [ ] **Step 3: Verify no [AISPIKE] remains**

Run: `grep -rn "AISPIKE" packages/ apps/ || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 4: Typecheck + commit**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm --filter @financial-intelligence/ai-local typecheck`
Expected: clean.

```bash
git add packages/ai-local/src/transformers-engine.ts packages/ai-local/src/provider.ts
git commit -m "Remove [AISPIKE] diagnostic instrumentation

Refs #38"
```

---

### Task 2: `ListAllTransactions` use case (the hang fix)

**Files:**
- Create: `packages/application/src/list-all-transactions.ts`
- Modify: `packages/application/src/index.ts` (export it)
- Test: `packages/application/src/list-all-transactions.test.ts`

**Interfaces:**
- Consumes: `TransactionLedgerRepository.list(): Promise<readonly TransactionLedgerRecord[]>` (from `./transaction-ledger`), `Transaction` (domain).
- Produces: `class ListAllTransactions { constructor(repository: TransactionLedgerRepository); execute(): Promise<readonly Transaction[]> }`. Calls `repository.list()` exactly once.

- [ ] **Step 1: Write the failing test**

Create `packages/application/src/list-all-transactions.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

import { ListAllTransactions } from "./list-all-transactions";
import type { TransactionLedgerRepository } from "./transaction-ledger";

describe("ListAllTransactions", () => {
  it("returns the full ledger with a single repository read", async () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }] as unknown as Awaited<
      ReturnType<TransactionLedgerRepository["list"]>
    >;
    const list = vi.fn().mockResolvedValue(rows);
    const repository = { list } as unknown as TransactionLedgerRepository;

    const result = await new ListAllTransactions(repository).execute();

    expect(result).toEqual(rows);
    expect(list).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm exec vitest run packages/application/src/list-all-transactions.test.ts`
Expected: FAIL (cannot find module `./list-all-transactions`).

- [ ] **Step 3: Implement the use case**

Create `packages/application/src/list-all-transactions.ts`:

```ts
import type { Transaction } from "@financial-intelligence/domain";

import type { TransactionLedgerRepository } from "./transaction-ledger";

/**
 * Read the entire canonical ledger in one pass. Unlike `QueryTransactionLedger` (which filters,
 * sorts, and paginates), this returns every transaction with a single repository read — the shape AI
 * eligibility needs. Paginating over the sorting query re-scans the whole ledger per page and blocks
 * the main thread; this avoids that (see the 2026-07-22 hang-fix spec).
 */
export class ListAllTransactions {
  public constructor(private readonly repository: TransactionLedgerRepository) {}

  public execute(): Promise<readonly Transaction[]> {
    return this.repository.list();
  }
}
```

- [ ] **Step 4: Export it from the package index**

In `packages/application/src/index.ts`, add to the transaction-ledger export block:

```ts
export { ListAllTransactions } from "./list-all-transactions";
```

- [ ] **Step 5: Run test + typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm exec vitest run packages/application/src/list-all-transactions.test.ts && corepack pnpm --filter @financial-intelligence/application typecheck`
Expected: PASS + clean.

- [ ] **Step 6: Commit**

```bash
git add packages/application/src/list-all-transactions.ts packages/application/src/list-all-transactions.test.ts packages/application/src/index.ts
git commit -m "Add ListAllTransactions single-read ledger use case

Refs #36 #38"
```

---

### Task 3: Wire `ListAllTransactions` into the app and remove the quadratic loader

**Files:**
- Modify: `apps/web/src/infrastructure.ts` (import + interface member + instantiation)
- Modify: `apps/web/src/AiSuggestionsSection.tsx` (use the service; delete `listAllLedgerTransactions`)

**Interfaces:**
- Consumes: `ListAllTransactions` (Task 2).
- Produces: `ApplicationServices.listAllTransactions: ListAllTransactions`; the section's controller uses `services.listAllTransactions.execute()` for `listTransactions`.

- [ ] **Step 1: Add the service to `infrastructure.ts`**

Add `ListAllTransactions` to the `@financial-intelligence/application` import list. Add to the `ApplicationServices` interface near `queryTransactionLedger`:

```ts
  readonly listAllTransactions: ListAllTransactions;
```

Add to the `applicationServices` object literal (the module-private `ledgerRepository` is already in scope):

```ts
  listAllTransactions: new ListAllTransactions(ledgerRepository),
```

- [ ] **Step 2: Use it in the section and delete the quadratic loader**

In `apps/web/src/AiSuggestionsSection.tsx`, delete the entire `listAllLedgerTransactions` helper function (and its `Transaction` import if now unused — keep the import only if still referenced). Change the controller construction:

```ts
        listTransactions: () => services.listAllTransactions.execute(),
```

- [ ] **Step 3: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm --filter @financial-intelligence/web typecheck`
Expected: clean (if `Transaction` import became unused, remove it; re-run).

- [ ] **Step 4: Run the existing section tests**

Run: `corepack pnpm exec vitest run apps/web/src/AiSuggestionsSection.test.tsx`
Expected: PASS (6 tests; unchanged behavior — they inject a controller so this path isn't exercised, but must stay green).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/infrastructure.ts apps/web/src/AiSuggestionsSection.tsx
git commit -m "Load the full ledger in one read for AI suggestions (fix Suggest hang)

Replaces the paginating listAllLedgerTransactions, which re-scanned and
re-sorted the entire IndexedDB ledger per page on the main thread and
froze the tab, with a single ListAllTransactions read.

Refs #36 #38"
```

---

### Task 4: Progress event type + orchestrator item progress

**Files:**
- Modify: `packages/application/src/ai-suggestions.ts` (add `SuggestProgress`, thread `onProgress` through `SuggestClassifications.execute`)
- Modify: `packages/application/src/index.ts` (export `SuggestProgress`)
- Test: `packages/application/src/ai-suggestions-orchestrator.test.ts` (add a progress test)

**Interfaces:**
- Consumes: existing `SuggestClassifications` deps; `AiProvider.execute(request, options)` where `options.onProgress?: (fraction: number) => void` already exists.
- Produces: exported type `SuggestProgress = { phase: "preparing"; loadedFraction: number } | { phase: "analyzing"; completed: number; total: number }`. `SuggestClassifications.execute` accepts `onProgress?: (event: SuggestProgress) => void` in its input object. It emits `{ phase: "analyzing", completed, total }` after each batch entry finishes, and forwards provider load fraction as `{ phase: "preparing", loadedFraction }` via `options.onProgress`.

- [ ] **Step 1: Write the failing test**

Add to `packages/application/src/ai-suggestions-orchestrator.test.ts` (reuses existing `TaskFake`, `MemoryRepo`, `deps`, `eligibility`, `transaction`, `okMerchant`, `okCategory` helpers):

```ts
  it("emits analyzing progress once per batch entry with a stable total", async () => {
    const repo = new MemoryRepo();
    const provider = new TaskFake(() => okMerchant("coffee-co"), () => okCategory("dining"));
    const events: SuggestProgress[] = [];
    await new SuggestClassifications(deps(provider, repo)).execute({
      transactions: [transaction("SQ *COFFEE #1"), transaction("SQ *TACOS #2")],
      allowedCategoryIds: ["dining"],
      eligibility: eligibility(),
      onProgress: (e) => events.push(e),
    });
    const analyzing = events.filter((e) => e.phase === "analyzing");
    expect(analyzing.length).toBe(2);
    expect(analyzing.every((e) => e.phase === "analyzing" && e.total === 2)).toBe(true);
    expect(analyzing.map((e) => (e.phase === "analyzing" ? e.completed : 0))).toEqual([1, 2]);
  });
```

Add `SuggestProgress` to the import from `./ai-suggestions` at the top of the test file.

- [ ] **Step 2: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm exec vitest run packages/application/src/ai-suggestions-orchestrator.test.ts`
Expected: FAIL (`onProgress` not accepted / `SuggestProgress` not exported).

- [ ] **Step 3: Add the type and thread the callback**

In `packages/application/src/ai-suggestions.ts`, add near `SuggestClassificationsResult`:

```ts
/** Progress reported during a suggestion run. Advisory; a provider that reports nothing still runs. */
export type SuggestProgress =
  | { readonly phase: "preparing"; readonly loadedFraction: number }
  | { readonly phase: "analyzing"; readonly completed: number; readonly total: number };
```

Change `execute`'s input to accept the callback:

```ts
  public async execute(input: {
    readonly transactions: readonly Transaction[];
    readonly allowedCategoryIds: readonly string[];
    readonly eligibility: EligibilityContext;
    readonly signal?: AbortSignal;
    readonly onProgress?: (event: SuggestProgress) => void;
  }): Promise<SuggestClassificationsResult> {
```

Build the execute options to forward load progress (place before the `for` loop, replacing the existing `options` object):

```ts
    const options = {
      signal: input.signal ?? new AbortController().signal,
      deadlineMs: this.deps.deadlineMs,
      ...(input.onProgress
        ? {
            onProgress: (fraction: number) =>
              input.onProgress?.({ phase: "preparing", loadedFraction: fraction }),
          }
        : {}),
    };
```

Emit analyzing progress at the end of each entry iteration. After the category pass block inside
`for (const entry of batch) { … }`, before the loop closes, add:

```ts
      completedEntries += 1;
      input.onProgress?.({ phase: "analyzing", completed: completedEntries, total: batch.length });
```

And declare `let completedEntries = 0;` next to `let created = 0;`.

- [ ] **Step 4: Export the type**

In `packages/application/src/index.ts`, add `SuggestProgress` to the `export type { … } from "./ai-suggestions";` block.

- [ ] **Step 5: Run tests + typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm exec vitest run packages/application/src/ai-suggestions-orchestrator.test.ts && corepack pnpm --filter @financial-intelligence/application typecheck`
Expected: PASS + clean.

- [ ] **Step 6: Commit**

```bash
git add packages/application/src/ai-suggestions.ts packages/application/src/ai-suggestions-orchestrator.test.ts packages/application/src/index.ts
git commit -m "Emit phase-aware progress from the suggestion orchestrator

Refs #38"
```

---

### Task 5: Provider deadline enforcement + warmup

**Files:**
- Modify: `packages/ai-local/src/provider.ts` (warmup after load; deadline wrapper around `runExecute`; forward worker `progress` to `options.onProgress`)
- Test: `packages/ai-local/src/provider.test.ts` (deadline + warmup tests)

**Interfaces:**
- Consumes: existing `LocalWorker`, worker protocol (`warmup`, `cancel`, `progress` messages already defined).
- Produces: `LocalAiProvider.execute` rejects/returns `aiError("resource_exhausted", …)` when the worker does not settle within `options.deadlineMs`, posting a `cancel` for that operation; sends exactly one `warmup` before the first `execute` per worker; invokes `options.onProgress(fraction)` on each worker `progress` message during load.

- [ ] **Step 1: Read the existing provider test setup**

Open `packages/ai-local/src/provider.test.ts` to reuse its fake worker (`deps(worker)`, `options()`) helpers. The fake worker lets a test drive `message`/`error` events. Note the existing `options()` helper's `deadlineMs`.

- [ ] **Step 2: Write the failing deadline test**

Add to `packages/ai-local/src/provider.test.ts` a test using a fake worker that acknowledges `load` (posts `loaded`) and `warmup` (posts `loaded`) but never posts a `result` for `execute`, with a short `deadlineMs`:

```ts
  it("returns resource_exhausted and cancels when execute exceeds the deadline", async () => {
    vi.useFakeTimers();
    const worker = makeFakeWorker(); // reuse the file's existing fake-worker factory/pattern
    worker.autoRespond({ load: "loaded", warmup: "loaded" }); // never responds to execute
    const provider = new LocalAiProvider(deps(worker));
    const promise = provider.execute(request, options({ deadlineMs: 50 }));
    await vi.advanceTimersByTimeAsync(60);
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("resource_exhausted");
    expect(worker.posted).toContainEqual(expect.objectContaining({ type: "cancel" }));
    vi.useRealTimers();
  });
```

Adapt `makeFakeWorker`/`autoRespond`/`worker.posted` to the file's actual existing fake-worker
shape (match the patterns already used by the other `provider.test.ts` tests; do not invent a new
harness if one exists — reuse it and only add what the deadline path needs).

- [ ] **Step 3: Run test to verify it fails**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm exec vitest run packages/ai-local/src/provider.test.ts`
Expected: FAIL (no deadline → promise never settles / no `cancel` posted).

- [ ] **Step 4: Implement warmup + deadline in `provider.ts`**

Add a `warmedUp` flag beside `loaded`. In `execute`, after `ensureLoaded`, warm up once:

```ts
      await this.ensureLoaded(worker, options.signal);
      if (!this.warmedUp) {
        await this.runWarmup(worker, options.signal);
        this.warmedUp = true;
      }
```

Add a `runWarmup` mirroring `ensureLoaded` (posts `{ type: "warmup", operationId }`, resolves on
`loaded`, rejects on failed/cancel). Wrap `runExecute` with a deadline:

```ts
      const output = await this.withDeadline(
        worker,
        options.deadlineMs,
        (operationId) => this.runExecute(worker, request.task, prompt, options.signal, operationId),
      );
```

Refactor `runExecute` to accept an `operationId` parameter (so the deadline path can post `cancel`
for the same id) instead of generating its own. Implement `withDeadline`:

```ts
  private withDeadline(
    worker: LocalWorker,
    deadlineMs: number,
    run: (operationId: string) => Promise<string>,
  ): Promise<string> {
    const operationId = crypto.randomUUID();
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        worker.postMessage({ protocolVersion: 1, type: "cancel", operationId });
        reject(new WorkerFailure("DEADLINE", "Inference exceeded the deadline"));
      }, deadlineMs);
      run(operationId).then(
        (out) => {
          clearTimeout(timer);
          resolve(out);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
```

Map `DEADLINE` in `FAILED_CODE_MAP` to `resource_exhausted`. Forward load progress: in the
`ensureLoaded` `attach(...)` handlers, the worker `progress` message is currently ignored by `attach`
(it early-returns on `type === "progress"`). Add an `onProgress` handler to `attach` that fires for
`progress` messages and wire `ensureLoaded` to call `options.onProgress?.(fraction)`. (Pass `options`
into `ensureLoaded`, or read the fraction from the `progress` message `fraction` field.)

- [ ] **Step 5: Write/adjust the warmup test**

Add:

```ts
  it("sends exactly one warmup before the first execute", async () => {
    const worker = makeFakeWorker();
    worker.autoRespond({ load: "loaded", warmup: "loaded", execute: "result:{}" });
    const provider = new LocalAiProvider(deps(worker));
    await provider.execute(request, options());
    await provider.execute(request, options());
    expect(worker.posted.filter((m) => m.type === "warmup").length).toBe(1);
  });
```

- [ ] **Step 6: Run tests + typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm exec vitest run packages/ai-local/src/provider.test.ts && corepack pnpm --filter @financial-intelligence/ai-local typecheck`
Expected: PASS + clean. (Existing provider tests must remain green — warmup is idempotent and load-gated.)

- [ ] **Step 7: Commit**

```bash
git add packages/ai-local/src/provider.ts packages/ai-local/src/provider.test.ts
git commit -m "Enforce per-inference deadline and warm up the local model once

Refs #38"
```

---

### Task 6: Glue — thread progress + expose cancel

**Files:**
- Modify: `apps/web/src/ai-suggestions.ts` (`suggest(signal?, onProgress?)`)
- Test: `apps/web/src/ai-suggestions.test.ts` (create if absent) OR extend section tests in Task 7

**Interfaces:**
- Consumes: `SuggestProgress` (Task 4), `SuggestClassifications` with `onProgress`.
- Produces: `AiSuggestionsController.suggest(signal?: AbortSignal, onProgress?: (e: SuggestProgress) => void): Promise<SuggestOutcome>` — forwards both to the orchestrator.

- [ ] **Step 1: Update the controller signature**

In `apps/web/src/ai-suggestions.ts`, import `type SuggestProgress` from `@financial-intelligence/application`. Change `suggest`:

```ts
  public async suggest(
    signal?: AbortSignal,
    onProgress?: (event: SuggestProgress) => void,
  ): Promise<SuggestOutcome> {
```

Pass both into `orchestrator.execute({ … })`:

```ts
    return orchestrator.execute({
      transactions,
      allowedCategoryIds: activeCategoryIds(categories),
      ...(signal ? { signal } : {}),
      ...(onProgress ? { onProgress } : {}),
      eligibility,
    });
```

- [ ] **Step 2: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm --filter @financial-intelligence/web typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/ai-suggestions.ts
git commit -m "Thread progress and cancel signal through the suggestions controller

Refs #38"
```

---

### Task 7: Section UI — progress bar + Cancel + tests

**Files:**
- Modify: `apps/web/src/AiSuggestionsSection.tsx` (AbortController, progress state, progress bar, Cancel button)
- Modify: `apps/web/src/styles.css` (reuse `.local-ai-progress` idiom for `.ai-suggestions-progress`)
- Test: `apps/web/src/AiSuggestionsSection.test.tsx`

**Interfaces:**
- Consumes: `AiSuggestionsController.suggest(signal, onProgress)` (Task 6), `SuggestProgress` (Task 4).
- Produces: during `running`, a `role="progressbar"` element and a Cancel button (`aria-label="Cancel suggestion run"`) that aborts.

- [ ] **Step 1: Write the failing tests**

Add to `apps/web/src/AiSuggestionsSection.test.tsx`. Extend `fakeController` so `suggest` accepts `(signal, onProgress)` and drives progress + can be aborted:

```ts
  it("shows a progress bar and Cancel while a run is in progress", async () => {
    let resolveRun: (v: { created: number; abstained: number }) => void = () => {};
    const controller = fakeController({
      suggest: vi.fn((_signal?: AbortSignal, onProgress?: (e: unknown) => void) => {
        onProgress?.({ phase: "analyzing", completed: 1, total: 3 });
        return new Promise((res) => {
          resolveRun = res;
        });
      }),
    });
    render(<AiSuggestionsSection services={services} controller={controller} />);
    fireEvent.click(await screen.findByRole("button", { name: /Suggest categories/i }));
    expect(await screen.findByRole("progressbar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel suggestion run/i })).toBeInTheDocument();
    resolveRun({ created: 0, abstained: 0 });
  });

  it("aborts the run when Cancel is clicked", async () => {
    let seenSignal: AbortSignal | undefined;
    const controller = fakeController({
      suggest: vi.fn((signal?: AbortSignal) => {
        seenSignal = signal;
        return new Promise(() => {}); // never resolves; cancelled via signal
      }),
    });
    render(<AiSuggestionsSection services={services} controller={controller} />);
    fireEvent.click(await screen.findByRole("button", { name: /Suggest categories/i }));
    fireEvent.click(await screen.findByRole("button", { name: /Cancel suggestion run/i }));
    await waitFor(() => expect(seenSignal?.aborted).toBe(true));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm exec vitest run apps/web/src/AiSuggestionsSection.test.tsx`
Expected: FAIL (no progressbar / no Cancel).

- [ ] **Step 3: Implement in `AiSuggestionsSection.tsx`**

Add state and an abort ref:

```ts
  const [progress, setProgress] = useState<SuggestProgress>();
  const abortRef = useRef<AbortController>();
```

Rewrite `onSuggest` to own an `AbortController`, pass a progress setter, and clear on settle:

```ts
  const onSuggest = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(undefined);
    setPhase("running");
    setStatus("Analyzing transactions on your device…");
    try {
      const outcome = await controllerRef.current.suggest(controller.signal, setProgress);
      await refreshPending();
      setPhase("idle");
      setStatus(
        controller.signal.aborted
          ? "Cancelled."
          : outcome.created > 0
            ? `Found ${outcome.created} suggestion(s) to review.`
            : "No new suggestions — everything eligible is already resolved or below the confidence floor.",
      );
    } catch {
      setPhase(abortRef.current?.signal.aborted ? "idle" : "error");
      setStatus(
        abortRef.current?.signal.aborted
          ? "Cancelled."
          : "The model could not finish. Your data was not changed; rules-only remains available.",
      );
    } finally {
      abortRef.current = undefined;
      setProgress(undefined);
    }
  };

  const onCancel = () => abortRef.current?.abort();
```

Import `type SuggestProgress` from `@financial-intelligence/application` and `useRef`. In the
`running` branch of the JSX, render a progress view + Cancel:

```tsx
          {phase === "running" && (
            <div className="ai-suggestions-progress">
              <p role="status">{progressLabel(progress)}</p>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercent(progress)}
                aria-valuetext={progressLabel(progress)}
              >
                <span className="progress-fill" style={{ inlineSize: `${progressPercent(progress)}%` }} />
              </div>
              <Button
                className="secondary-button"
                onClick={onCancel}
                aria-label="Cancel suggestion run"
              >
                Cancel
              </Button>
            </div>
          )}
```

Add the helpers (module scope):

```ts
function progressPercent(progress: SuggestProgress | undefined): number {
  if (progress === undefined) return 0;
  if (progress.phase === "preparing") return Math.round(progress.loadedFraction * 100);
  return progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
}

function progressLabel(progress: SuggestProgress | undefined): string {
  if (progress === undefined) return "Preparing…";
  return progress.phase === "preparing"
    ? `Preparing model… ${Math.round(progress.loadedFraction * 100)}%`
    : `Analyzing ${progress.completed} of ${progress.total}…`;
}
```

Keep the existing "Analyzing…" button label; the progress block supplements it. Ensure the Suggest
button stays disabled (`phase === "running"`).

- [ ] **Step 4: Add styles**

In `apps/web/src/styles.css`, after the `.ai-suggestion-controls` block, add (mirrors `.local-ai-progress`):

```css
.ai-suggestions-progress {
  display: grid;
  gap: 0.5rem;
}

.ai-suggestions-progress [role="progressbar"] {
  block-size: 0.6rem;
  background: var(--forest-soft);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.ai-suggestions-progress .progress-fill {
  display: block;
  block-size: 100%;
  background: var(--forest);
  border-radius: inherit;
  transition: inline-size 0.2s ease;
}

@media (prefers-reduced-motion: reduce) {
  .ai-suggestions-progress .progress-fill {
    transition: none;
  }
}
```

- [ ] **Step 5: Run tests + typecheck + lint**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm exec vitest run apps/web/src/AiSuggestionsSection.test.tsx && corepack pnpm --filter @financial-intelligence/web typecheck && corepack pnpm exec eslint apps/web/src/AiSuggestionsSection.tsx apps/web/src/ai-suggestions.ts`
Expected: PASS + clean. Run `corepack pnpm exec prettier --write apps/web/src/AiSuggestionsSection.tsx apps/web/src/styles.css` then re-check.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/AiSuggestionsSection.tsx apps/web/src/styles.css apps/web/src/AiSuggestionsSection.test.tsx
git commit -m "Add progress bar and Cancel to the AI suggestions section

Refs #38"
```

---

### Task 8: e2e — progress + cancel appear during a run

**Files:**
- Modify: `e2e/ai-suggestions.spec.ts` (add a delayed-provider progress/cancel assertion; keep accept-to-rule)

**Interfaces:**
- Consumes: the `globalThis.__FI_AI_TEST__` seam (already present).

- [ ] **Step 1: Add a progress/cancel assertion**

In `e2e/ai-suggestions.spec.ts`, add a test whose scripted provider delays its category response so the run stays in `running` long enough to observe the UI. Reuse `installScriptedProvider` but with an `execute` that waits (e.g. `await new Promise(r => setTimeout(r, 1500))` before returning the category result). After importing a transaction and clicking Suggest (via `dispatchEvent` per the existing helper), assert:

```ts
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByRole("button", { name: /Cancel suggestion run/i })).toBeVisible();
```

Keep it a separate `test(...)` so the existing accept-to-rule test is untouched.

- [ ] **Step 2: Run it (chromium, fresh build)**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && lsof -ti:4173 | xargs kill -9 2>/dev/null; CI=1 corepack pnpm exec playwright test e2e/ai-suggestions.spec.ts --project=chromium`
Expected: PASS (both tests). If Playwright `.click()` stalls, use `dispatchEvent("click")` as the existing test does.

- [ ] **Step 3: Commit**

```bash
git add e2e/ai-suggestions.spec.ts
git commit -m "Assert progress and Cancel appear during an AI suggestion run

Refs #38"
```

---

### Task 9: Docs + full gate + PR

**Files:**
- Modify: `CHANGELOG.md`, `docs/10-LEARNING-ENGINE.md`, `docs/08-AI-ARCHITECTURE.md`

- [ ] **Step 1: Changelog**

In `CHANGELOG.md` under `## [Unreleased]`, add to `### Fixed`:

```markdown
- Fix the AI-suggestions "Suggest" action freezing the tab ("Page Unresponsive") when transactions
  were present: eligibility loaded the ledger by paging a sorting query, which re-scanned and
  re-deserialized the entire IndexedDB ledger on the main thread per page. It now reads the ledger
  once (`ListAllTransactions`). Diagnosed via on-device instrumentation (issue #38 slice).
```

And to `### Added` (or a new `### Changed` bullet):

```markdown
- AI suggestions now show phase-aware progress ("Preparing model…" then "Analyzing N of M…"), a
  Cancel control that keeps any suggestions already found, and a per-inference deadline so one slow
  description degrades to an abstention instead of stalling the batch; the local model is warmed up
  once after load (issue #38 slice, browser-local only).
```

- [ ] **Step 2: Spec docs**

In `docs/10-LEARNING-ENGINE.md` "Optional AI suggestions", append a sentence: the explicit-run flow shows progress and is cancellable; a per-inference deadline bounds each proposal. In `docs/08-AI-ARCHITECTURE.md` classification-pipeline area, note the optional-AI step is progress-reporting and time-bounded/cancellable. No precedence change.

- [ ] **Step 3: Full gate**

Run:
```
source ~/.nvm/nvm.sh && nvm use 24 && corepack pnpm install --frozen-lockfile && \
corepack pnpm typescript:check && corepack pnpm format:check && corepack pnpm lint && \
corepack pnpm schema:check && corepack pnpm typecheck && corepack pnpm test:coverage && \
corepack pnpm build && corepack pnpm security:headers:check -- apps/web/dist/_headers && \
corepack pnpm audit --audit-level high
```
Expected: all pass. Run `corepack pnpm format` then re-check if format:check fails. Fix root causes.

- [ ] **Step 4: Browser suite**

Run: `source ~/.nvm/nvm.sh && nvm use 24 && lsof -ti:4173 | xargs kill -9 2>/dev/null; CI=1 corepack pnpm browser:test`
Expected: all pass across chromium/firefox/webkit (UI + section change → all three).

- [ ] **Step 5: Commit docs + push + PR**

```bash
git add CHANGELOG.md docs/10-LEARNING-ENGINE.md docs/08-AI-ARCHITECTURE.md
git commit -m "Document the AI-suggest hang fix and progress/cancel/deadline

Refs #38"
git push -u origin hk/ai-suggest-progress-fix
```

Open a PR against `main` with `gh pr create`, completing every `.github/pull_request_template.md`
section. Body must cover: root cause (quadratic ledger re-scan on the main thread) and the
single-read fix; progress/cancel/deadline/warmup; privacy/network = none (no CSP change, offline);
data = none (no schema/migration); a11y = new progressbar + Cancel validated across browsers;
verification = full gate + browser suite, real-model path manually verified; `Refs #38` (slice, does
not close). Note the `[AISPIKE]` instrumentation from #110 is reverted here and PR #111 is closed
unmerged.

- [ ] **Step 6: Close PR #111 unmerged + watch CI**

Run: `gh pr close 111 --comment "Superseded — root cause found (quadratic ledger read, not the model). Fix in the #38 UX slice PR; instrumentation reverted there."`
Then `gh pr checks <new-pr> --watch` until green; fix root causes, never force-push/amend.

---

## Self-Review

**Spec coverage:** single-read fix → Tasks 2–3. Progress (preparing+analyzing) → Tasks 4 (orchestrator/type), 5 (provider load-fraction forward), 6 (glue), 7 (UI). Cancel → Tasks 6–7 (signal already reaches worker). Deadline + warmup → Task 5. Instrumentation cleanup → Task 1. Tests: single-read regression (Task 2), progress (Task 4), deadline+warmup (Task 5), section progress/cancel (Task 7), e2e (Task 8). Docs → Task 9. Scope boundary (registry/eviction/concurrency out) honored; `Refs #38`. ✅

**Placeholder scan:** provider fake-worker test (Task 5) intentionally says "reuse the file's existing fake-worker pattern" rather than inventing a harness — this is a real instruction to match existing code, not a placeholder; the deadline/warmup assertions are concrete. All other steps show full code.

**Type consistency:** `SuggestProgress` defined Task 4, consumed Tasks 6/7. `ListAllTransactions.execute(): Promise<readonly Transaction[]>` defined Task 2, used Task 3. `suggest(signal?, onProgress?)` defined Task 6, called Task 7. `resource_exhausted` is an existing `aiError` code (verified). `warmup`/`cancel`/`progress` worker messages already exist in the protocol (verified). `ExecuteOptions.onProgress` already exists (verified) — Task 5 wires it, Task 4 consumes it.
