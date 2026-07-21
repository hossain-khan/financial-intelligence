# AI evaluation harness and release thresholds (#32)

- Date: 2026-07-21
- Issue: [#32](https://github.com/hossain-khan/financial-intelligence/issues/32)
- Epic: [#16 — Phase 4, Optional AI assistance](https://github.com/hossain-khan/financial-intelligence/issues/16)
- Status: Approved design, pending implementation

## Purpose

Measure structured-task correctness, privacy behavior, latency, and resource use before any
provider/model profile can be marked supported. This issue delivers the evaluation package, a
versioned synthetic corpus, task-specific metrics, fake providers spanning the behaviors we must
detect, a result/threshold schema with profile-aware regression comparison, and the initial
threshold policy — all exercised by fast self-tests. It integrates no real provider (those arrive
in #33–#35 and register into this harness).

A provider existing in code must never make it supported: support is earned by passing the gates
defined here.

## Scope

In scope:

- New `packages/ai-evaluation` importing only public `ai-core` contracts, `domain`, and `schemas`.
- A versioned, digest-locked synthetic corpus under `packages/ai-evaluation/fixtures/`, one JSON
  file per case grouped by task, plus a fixture linter rejecting real-data-shaped content.
- Task-specific metrics (never one blended score) with known-answer self-tests.
- Six fake providers (perfect, abstaining, malformed, leaky, slow, nondeterministic).
- An in-process runner with bounded concurrency, per-case timeout, cancellation, retry-off-by-
  default, and resumable accumulation, invoked from Vitest self-tests.
- A versioned result schema + Markdown summary generator + `compareEvalResults` profile matching.
- A checked-in threshold policy (versioned independently from the corpus) and support records.
- ADR-019 and an evaluation report recording the measured fake baseline and threshold rationale.

Out of scope (later issues):

- Any real provider adapter, model runtime, or network evaluation (#33 browser-local, #34 self-
  hosted, #35 remote). Each registers into this harness and establishes its reviewed gates then.
- A standalone CLI binary and a new CI workflow. The fast fake-provider self-tests run in the
  existing per-PR Vitest gate; the browser/remote tiers and CLI land with #33 when a real adapter
  exists to exercise them.
- Final task-quality accuracy numbers invented before a real provider is measured.

## Non-goals and invariants

- No evaluation on real user statements; no leaderboard from subjective samples.
- The corpus contains no real financial data or secrets — only fictional/synthetic content.
- Safety/privacy gates (allowed-ID grounding, zero privacy/network violations) cannot be averaged
  away by category accuracy.
- Result artifacts never contain request bodies or any transaction text/amount — only counts,
  rates, timings, digests, and enum metadata.
- The harness imports only public `ai-core` contracts and drives providers through the same
  `AiProvider` interface the app uses; no evaluator-only adapter shortcuts.

## Architecture

New framework-independent package `packages/ai-evaluation`:

```text
ai-evaluation ── imports ──► ai-core (AiProvider, AiRouter, task types, error taxonomy, FakeProvider)
              ── imports ──► domain (branded IDs / value types, read-only)
              ── imports ──► schemas (validateAiTask, for corpus input/output validation)
```

- Dependencies: `@financial-intelligence/ai-core`, `@financial-intelligence/domain`,
  `@financial-intelligence/schemas` (all `workspace:*`).
- A dependency-boundary test asserts it never imports React, IndexedDB/Dexie, `fetch`, provider
  SDKs, or a concrete provider-adapter package (#33–#35). Providers register into the harness; the
  harness never depends on them.
- `tsconfig.json` mirrors `ai-core`/`qualification`: `lib: ["ES2023", "DOM"]`, `types: ["node"]`
  (node for fixture/file self-tests; DOM for `AbortSignal`).

## Corpus (JSON-per-task, digest-locked)

`packages/ai-evaluation/fixtures/<task>/<case-id>.json`. Each file is one `EvalCase`:

```ts
interface EvalCase {
  readonly id: string;              // stable, kebab; unique across corpus
  readonly task: AiTaskId;
  readonly schemaVersion: "1.0.0";
  readonly locale: string;          // BCP-47, e.g. "en-CA", "fr-CA"
  readonly input: unknown;          // minimized task request payload (validates against ai-task schema)
  readonly allowedVocabulary: readonly string[]; // allowed category/merchant IDs for this case
  readonly expected:
    | { readonly kind: "exact"; readonly value: string }
    | { readonly kind: "acceptableSet"; readonly values: readonly string[] }
    | { readonly kind: "abstain" };
  readonly ambiguity: "clear" | "ambiguous" | "adversarial";
  readonly expectedAbstention: boolean;
  readonly privacyAssertions: { readonly mustNotEcho: readonly string[] };
  readonly tags: readonly string[];
}
```

Coverage (the issue's required case types): merchant noise, multilingual descriptions, unseen
merchants, transfer-like descriptions, category collisions, adversarial prompt text embedded in
transaction data, invalid IDs, ambiguous dates, unsupported query intent, and cases where
abstention is the correct outcome.

Integrity and safety:

- `fixtures/digests.json` locks every case file by SHA-256 over its `canonicalJson` bytes (keys
  sorted at every level). `canonicalJson` is copied locally so the package depends only on
  ai-core/domain/schemas (same choice qualification made). A digest-lock test fails if a committed
  case drifts or a new case is unlisted.
- A fixture linter rejects likely account numbers, API keys, emails, money-like decimal strings,
  and any field outside the `EvalCase` allow-list. Both linter and digest lock run in the per-PR
  Vitest gate.
- A corpus revision string + overall corpus digest are computed from the locked case set and
  recorded in every result for profile keying.

## Metrics and scoring

Task-specific metrics, never one blended score. Each is a pure function over the case set and the
recorded run outcomes, with known-answer self-tests. Denominators are documented; refusal, timeout,
invalid output, and abstention are distinct outcomes.

- strict schema-valid rate and invalid-output rate;
- exact / top-k merchant and category accuracy where a unique answer exists;
- abstention precision and recall over ambiguous cases;
- allowed-ID and grounding violations (must be zero for support);
- query-plan structural accuracy and deterministic-result reconciliation;
- confidence calibration (Brier score / ECE) only when a provider emits confidence;
- latency median/p95, time to first progress/result, timeout/cancel success, peak memory where
  observable, and local download / on-disk size;
- privacy/redaction violations and unexpected network destinations (must be zero).

A run outcome per case is one of `accepted`, `abstained`, `invalidOutput`, `refused`, `timeout`,
`cancelled`, `error`, plus a `privacyViolation` flag when a `mustNotEcho` token appears in output.

## Result schema, profile identity, and comparison

- `EvalResult` (adapted from `packages/qualification/src/result-schema.ts`): keyed by corpus
  revision/digest, app commit, task/schema/prompt/minimizer version, provider/adapter/model/
  tokenizer/runtime identity, execution location, decoding parameters, device-capability bucket,
  and timestamp. `validateEvalResult()` throws on any structural problem.
- `compareEvalResults(baseline, current)` compares only matching profiles; a prompt, schema,
  corpus, model, runtime, or decoding change reports `comparable: false` (a new baseline), never a
  regression. Regressions are metrics crossing their threshold in the failing direction.
- An `assertNoSensitiveContent`-style guard runs over every result artifact: allow-listed keys
  only; reject money-like or free-text string values. Raw request bodies can never enter an
  artifact.
- A Markdown summary generator renders a human-readable report. Small approved baseline summaries
  are checked into the repo; raw runs would upload as CI artifacts in later tiers.

## Threshold policy and support records

- A checked-in threshold policy file, versioned independently from the corpus.
- Structural safety gates ship hard now: 100% allowed-ID grounding, zero privacy/redaction
  violations, zero unexpected network destinations, and a bounded invalid-output rate.
- Task-quality and latency/resource thresholds are derived from the measured fake-provider baseline
  in this PR, with rationale recorded in the evaluation report and ADR-019 — no invented accuracy
  numbers. These quality gates apply to a real provider once it is measured in #33.
- Support records are `supported` | `experimental` | `failed`, per task and per device-capability
  tier, with reviewer and date metadata.
- The gate evaluation is structured so a safety violation fails support regardless of accuracy —
  safety cannot be averaged away.

## Fake providers and runner

Six providers implementing `ai-core`'s `AiProvider` interface, each representing a behavior the
harness must detect:

- perfect (always correct, grounded), abstaining (declines ambiguous cases), malformed (emits
  schema-invalid output), leaky (echoes a `mustNotEcho` token — must be caught by the privacy
  gate), slow (exceeds the per-case deadline — exercises timeout/cancel), nondeterministic (varies
  by call index — exercises repeatability recording).

Runner:

- bounded concurrency, per-case timeout, cancellation via `AbortSignal`, retry off by default,
  resumable result accumulation;
- deterministic where the provider supports it (seed/temperature pinned); records when provider
  nondeterminism prevents exact repeatability;
- invoked from Vitest self-tests. No standalone CLI binary this PR.
- Fast fake-provider self-tests run in the existing per-PR Vitest gate; no new workflow file yet.

## Data flow

1. The runner loads the locked corpus, verifies digests, and for each case builds a task request
   through `ai-core` task types.
2. It drives the configured provider via `execute(request, { signal, deadline })`, recording the
   outcome and any privacy-assertion violation.
3. Metrics reduce the outcomes into task-specific values; the result assembles metrics + profile
   identity into an `EvalResult`.
4. The privacy guard asserts the artifact is content-free; `compareEvalResults` checks it against a
   matching baseline; the gate evaluation produces a support record.

## Error handling

- A provider throw maps to an `error` outcome for that case; the run continues (bounded, resumable).
- Timeout and cancellation are distinct recorded outcomes, never silent successes.
- A malformed or unknown-ID output is an `invalidOutput` / grounding violation, never coerced into a
  guessed answer.
- Any `mustNotEcho` token in output sets `privacyViolation`, which hard-fails the safety gate.

## Testing

- Metric known-answer fixtures (each metric computed against a hand-verified outcome set).
- Fake-provider contract self-tests: perfect passes; abstaining scores abstention precision/recall;
  malformed drives invalid-output rate; leaky trips the privacy gate; slow trips timeout/cancel;
  nondeterministic is flagged non-repeatable.
- Determinism/repeatability checks for deterministic providers.
- Privacy/redaction assertions on result artifacts (leaky provider fails the gate).
- Threshold boundary tests (just-passing vs just-failing) and incompatible-profile comparison.
- Fixture linter tests (rejects account-number/email/key/money-like/unknown-field) and corpus
  digest lock.
- Dependency-boundary test for the package.

## Documentation impact

- New ADR `docs/adr/ADR-019-AI-Evaluation-Harness.md` + index entry: harness-imports-only-ai-core
  boundary; JSON-per-task digest-locked corpus; task-specific (not blended) metrics; profile-keyed
  results with `compareEvalResults`; structural-gates-hard + quality-from-baseline threshold
  policy; support-record model; fake-provider self-test tier. Alternatives: consolidated corpus
  file, TS-defined corpus, CLI + workflow now, single blended score, providers writing their own
  evaluation scripts.
- Evaluation report doc capturing the measured fake baseline and threshold rationale.
- `docs/08-AI-ARCHITECTURE.md` (Model evaluation section): the concrete harness, corpus, metrics,
  and support gate.
- `docs/06-NON-FUNCTIONAL-REQUIREMENTS.md`: cross-reference where evaluation evidence supports an
  NFR, if applicable.
- `CHANGELOG.md` (Unreleased), `docs/15-ROADMAP.md`, `docs/adr/README.md`.

## Delivery order

1. Corpus / result / threshold schemas and the fixture linter.
2. Metrics implementation with known-answer self-tests.
3. Fake providers (perfect, abstaining, malformed, leaky, slow, nondeterministic).
4. Runner, Markdown report generation, and regression comparison.
5. Threshold policy derived from the measured fake baseline + support-record gate; docs and
   ADR-019.

## Acceptance criteria (from #32)

- A provider profile cannot be marked supported without passing gates.
- Results are reproducible and versioned.
- Regressions are visible (comparison output; CI artifacts arrive with later tiers).
- Safety/privacy gates cannot be averaged away by category accuracy.
- The corpus contains no real user financial data or secrets.
