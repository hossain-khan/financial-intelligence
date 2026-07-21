# ADR-019: AI evaluation harness and release thresholds

- Status: Accepted
- Date: 2026-07-21
- Decision owners: Project maintainers

## Context

Phase 4 will let users enable optional AI providers (browser-local #33, self-hosted #34, remote
#35). Before any provider/model profile can be marked supported, its structured-task correctness,
privacy behavior, latency, and resource use must be measured against a fixed, synthetic corpus —
never against real user statements, and never as a single blended score that could hide a safety
regression. #31 delivered the provider-neutral contracts; a provider existing in code must not make
it supported.

There was no evaluation package, corpus, metric implementation, result schema, or threshold policy.
The repository already has strong precedents to reuse: `packages/qualification` (versioned result
schema with profile-matched `compareResults`, an `assertNoSensitiveContent` artifact guard, and
`canonicalJson` digests) and the immutable digest-locked fixtures under `test-fixtures/compatibility`
(ADR-016, ADR-017).

## Decision

Add `packages/ai-evaluation`, importing only public `ai-core` contracts, `domain`, and `schemas`,
and driving providers through the same `AiProvider` interface the app uses (no evaluator-only
adapter shortcuts). A dependency-boundary test enforces the boundary; providers register into the
harness rather than the harness depending on them.

**Corpus.** A versioned synthetic corpus of one JSON file per case, grouped by task under
`fixtures/<task>/`, locked by `fixtures/digests.json` (SHA-256 over canonical JSON). Each case
carries a stable id, locale, minimized input, allowed vocabulary, expected result or acceptable set,
ambiguity label, expected abstention, privacy assertions, and tags. A fixture linter rejects likely
account numbers, emails, keys, monetary amounts, and any field outside the allow-list. Linter and
digest lock both run in the per-PR test gate.

**Metrics.** Task-specific metrics, never one blended score: schema-valid / invalid-output rate,
accuracy, abstention precision/recall, allowed-ID grounding violations, privacy violations, and
latency percentiles, with documented denominators. Refusal, timeout, invalid output, and abstention
are distinct outcomes.

**Results and comparison.** A versioned `EvalResult` keyed by corpus digest, app commit,
task/schema/prompt/minimizer version, provider/adapter/model/tokenizer/runtime identity, execution
location, decoding parameters, and device tier. `compareEvalResults` compares only matching profiles
— a prompt, schema, corpus, model, runtime, or decoding change is a new baseline, not a regression.
An artifact privacy guard restricts results to counts, rates, timings, digests, and short enum
identifiers.

**Thresholds and support.** A checked-in threshold policy, versioned independently from the corpus.
Structural safety gates are hard (100% allowed-ID grounding, zero privacy/network violations,
bounded invalid-output rate) and cannot be averaged away by accuracy. Quality/latency thresholds are
derived from the measured fake-provider baseline (see `docs/ai-evaluation-baseline.md`) and gate a
real provider once #33 is measured. Support records are `supported` | `experimental` | `failed`, per
task and device tier, with reviewer and date.

**Runner and CI tier.** An in-process runner with bounded concurrency, per-case timeout,
cancellation, and retry-off-by-default, exercised by six fake providers (perfect, abstaining,
malformed, leaky, slow, nondeterministic). Fast fake-provider self-tests run in the existing per-PR
Vitest gate. No standalone CLI binary or new CI workflow yet; the browser/remote tiers and a CLI
arrive with #33 when a real adapter exists to exercise them. CI never requires a contributor API key.

## Consequences

- #33–#35 add their adapters to this harness and earn reviewed gates; they must not write bespoke
  evaluation scripts.
- A corpus, prompt, schema, model, runtime, or decoding change forces reevaluation (new profile).
- The threshold policy's quality numbers are provisional (fake-derived) until a real provider is
  measured; the safety gates are final.
- Raw per-run artifacts and browser/remote evaluation tiers are deferred to #33's CI work.

## Alternatives considered

- **A single consolidated corpus file** — rejected: large, hard to diff/review per case, and every
  edit churns the whole file.
- **A TypeScript-defined corpus** — rejected: couples corpus content to code and forces the "no real
  data" linter to parse TS rather than JSON.
- **A standalone CLI + CI workflow now** — rejected: no real provider exists to exercise them; they
  belong with #33.
- **A single blended quality score** — rejected: it would let category accuracy mask a safety or
  privacy regression, violating an explicit acceptance criterion.
- **Per-provider bespoke evaluation scripts** — rejected: providers register into one harness so
  results are comparable and gates are uniform.

## Validation

- Metric known-answer self-tests; fake-provider contract tests (perfect passes; abstaining scores
  abstention recall; malformed drives invalid-output; leaky trips the privacy gate; slow exercises
  cancellation).
- Corpus digest lock and fixture linter tests.
- Threshold boundary tests (safety hard-fails regardless of accuracy) and incompatible-profile
  comparison.
- Dependency-boundary test.

## Related decisions

- [ADR-018: Provider-neutral AI core, task contracts, and no-AI default](ADR-018-Provider-Neutral-AI-Core.md)
- [ADR-016: Deterministic qualification harness for browser, accessibility, and performance](ADR-016-Qualification-Matrix.md)
- [ADR-017: Compatibility registry, immutable fixtures, and disaster-recovery drills](ADR-017-Compatibility-And-Recovery.md)
