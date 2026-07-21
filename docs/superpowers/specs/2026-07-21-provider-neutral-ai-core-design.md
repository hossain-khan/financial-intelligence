# Provider-neutral AI core, no-AI adapter, and task schemas (#31)

- Date: 2026-07-21
- Issue: [#31](https://github.com/hossain-khan/financial-intelligence/issues/31)
- Epic: [#16 — Phase 4, Optional AI assistance](https://github.com/hossain-khan/financial-intelligence/issues/16)
- Status: Approved design, pending implementation

## Purpose

Create the boundary that keeps all AI optional, typed, cancellable, and structurally
**incapable of mutating financial records**. This issue delivers contracts and a rules-only
default — no provider SDK, no model runtime, no network traffic. Provider adapters
(#33 browser-local, #34 self-hosted, #35 BYOK) and consumers (#36 suggestions, #37 query)
build on top of this in later issues.

The application must remain fully useful and correct with no provider configured. That is the
default state this issue ships.

## Scope

In scope:

- A dependency-free `packages/ai-core` boundary above `domain` and below provider adapters.
- Versioned request/response JSON Schemas for the four documented tasks, generated into typed
  validators via the existing `packages/schemas` pipeline.
- Provider/task runtime contracts: capability discovery, `health()`, `execute()` with
  `AbortSignal`/deadline, a normalized error taxonomy, immutable suggestion + audit values.
- An explicit router that selects only the configured profile supporting the exact task version
  and never silently changes execution location.
- An always-available `NoAiProvider` and a `kind: none` default persisted provider profile.
- A minimal application config port + IndexedDB adapter (v10 store) to hold provider profiles.

Out of scope (later issues):

- Any provider SDK, model runtime, WebGPU/WASM inference, or network adapter (#33–#35).
- Application orchestration that routes suggestions into review, and UI (#36, #37).
- `insight.word.v1` runtime behavior — its schema is defined here; execution is deferred.
- Any Settings UI. This issue persists the default profile and exposes a config port only.

## Non-goals and invariants

- No provider receives a repository, a mutation capability, `save`/`update`, SQL, arbitrary tool
  calls, or a callback capable of mutation. Output authority is structurally limited to choosing
  from allowed IDs or producing a constrained, validated query plan.
- No model-written totals or monetary arithmetic. AI is a classifier/interface layer, not the
  ledger (`docs/08-AI-ARCHITECTURE.md`).
- The default path (startup, imports, rules, ledger queries, dashboards, review) instantiates no
  network adapter and issues zero AI/model/API requests.
- All model output is untrusted: strict-parsed, schema-validated, bounded, and rendered as text.

## Architecture

New dependency-free package `packages/ai-core`, above `domain`, below provider adapters:

```text
application use cases  ── uses ──►  ai-core (router, contracts, NoAiProvider, audit)
                                       ▲
domain  ◄── types only ── ai-core      │ implements AiProvider
                                       │
schemas (generated task types + validators) ──► ai-core
                                       ▲
ai-local / ai-openai-compatible / …  ── depend on ──► ai-core   (LATER: #33–#35)
```

Boundaries:

- `ai-core` depends only on `@financial-intelligence/schemas` (generated task types/validators)
  and `@financial-intelligence/domain` (branded IDs / value types, read-only). It must **not**
  import React, IndexedDB, `fetch`, provider SDKs, or application repositories.
- Provider adapters live in separate packages and depend on `ai-core`, never the reverse.
- A dependency-boundary test asserts `ai-core` never references forbidden packages, and that no
  `packages/ai-*` adapter is imported by core.
- The application config port lives in `packages/application`; its IndexedDB adapter lives in
  `packages/storage-indexeddb`. `ai-core` itself stays persistence-free.

## Task contracts (single-file, A1)

One new normative schema `schemas/ai-task.schema.json` (with `$id`
`https://financial-intelligence.local/schemas/ai-task.schema.json` and a `schemaVersion` const),
auto-discovered by `packages/schemas/scripts/generate-types.mjs` → generated
`packages/schemas/src/generated/ai-task.ts` plus a `validateAiTaskSchema` standalone validator
registered in the generator's validator map.

Structure: a discriminated envelope keyed by `task` + `version`, with request/response pairs as
`$defs`. All objects use `additionalProperties: false`.

| Task | Request (minimized) | Response |
| --- | --- | --- |
| `merchant.resolve.v1` | Normalized description tokens (bounded array + length); optional country/category hints | Candidate merchant label, `confidence` (0–1), evidence codes |
| `category.classify.v1` | Redacted description/merchant, `direction`, allowed category IDs (bounded) | Chosen category ID, `confidence`, concise rationale (bounded) |
| `query.plan.v1` | Question (bounded), metric/dimension vocabulary, available date range | Constrained read-only plan: metric, dimensions, filters, period, comparison, sort/limit |
| `insight.word.v1` | Deterministic aggregate facts (schema only this issue) | Plain-language summary with fact references |

Shared `$defs`: `confidence`, `evidenceCode` (enum, e.g. `matched_alias`,
`similar_confirmed_merchant`, `model_category_candidate`, `insufficient_evidence`),
bounded-string/array primitives, and the **`dataClasses` enum re-used from
`ai-provider.schema.json`** so consent disclosure and adapter payload construction cannot drift.

Rationale for one file over per-task files: the four tasks share bounded-string limits, allowed-ID
patterns, evidence-code enums, and confidence ranges. Co-locating them prevents contract drift and
matches how `ai-provider.schema.json` already nests `consent`/`localModel` as `$defs`. Adding
`task.vNEXT` later appends a `$def` and a discriminator arm without disturbing existing arms.

Schema-only constraints (enum membership, bounds) are enforced by the generated validator.
**Workspace-current ID membership** (e.g. the chosen category must exist in the caller's allowed
set) is a runtime check in the router, since it depends on live workspace state a static schema
cannot express.

## Runtime contracts (hand-written TypeScript in `ai-core`)

- `AiProvider` interface: immutable `profile` identity — id, `adapterId`/`adapterVersion`,
  `executionLocation` (`local` | `selfHosted` | `remote`), reported model identity, supported
  task+schema versions, structured-output flag, context/output limits; `health()` — a typed
  capability probe that is **compile-time incapable of receiving a task payload**;
  `execute(request, { signal, deadline, onProgress })` → `AiResultEnvelope`.
- Error taxonomy — a discriminated union covering `unsupported`, `consent_required`,
  `invalid_request`, `invalid_output`, `timeout`, `cancelled`, `rate_limited`,
  `resource_exhausted`, `network`, `provider_error`.
- `NoAiProvider` — always present, reports zero task capabilities; `execute` → `unsupported`.
  This is normal, not an application error.
- Router — selects the single configured profile supporting the exact task+version; never silently
  switches execution location or origin. Pipeline: minimize context → validate request → dispatch
  under `AbortSignal` + deadline → validate output (strict JSON, no unknown properties, bounded
  strings/arrays, workspace-current IDs only, numeric ranges, policy checks) → at most **one**
  repair attempt (fed validation codes, never data access) → a second invalid result becomes an
  abstention/review outcome.
- Immutable outputs — `AiSuggestion` (validated, non-authoritative) and `AiExecutionAudit`. No
  `save`/`update`/mutation-capable callback is exposed on either.
- Timeout aborts the adapter and settles exactly once; a late provider response is discarded and
  never produces a success audit.

### Audit metadata

`AiExecutionAudit` contains: request ID, task/schema/prompt version, profile/adapter/model
identity, execution location, consent reference/state, timestamps rendered as a duration bucket,
outcome/error code, and **redacted input/output digests**. Prompt and response bodies are **not**
stored by default. This aligns with `docs/12-SECURITY-AND-PRIVACY.md` (no prompt/transcript
retention without explicit maintainer approval + ADR).

## Context minimization

Each task owns a `minimize(input)` function at the boundary that reduces domain input to the
minimal declared `dataClasses` before it can reach any adapter. Raw source documents, account
identifiers, unrelated transactions, notes, and full history are excluded. Minimizers are pure and
unit-tested against the schema so the payload can never exceed the declared disclosure surface.

## Config persistence (B1)

- `packages/application`: an `AiProviderConfigRepository` port + use cases `GetAiProviderConfig`
  and `SetAiProviderProfile`. Both validate against the generated `validateAiProvider` at the
  trust boundary. On first read with no stored profile, seed and persist the default `kind: none`
  profile. Use cases return immutable config values.
- `packages/storage-indexeddb`: `IndexedDbAiProviderProfileRepository` implementing the port. New
  additive **DB migration v10** adds an `aiProviderProfiles` store keyed by profile `id`
  (`CURRENT_DATABASE_VERSION` becomes 10). The compatibility migration-matrix test extends
  automatically via `DATABASE_MIGRATIONS.slice(0, n)`; a v9→v10 preservation assertion is added.

Profiles store keyed by id (over a single-row settings store) because #35 requires multiple named
profiles (local + BYOK); a single-row store would be reshaped almost immediately.

## Data flow

1. An application use case builds a task request and calls `router.execute(task, minimizedInput,
   { signal, deadline })`.
2. The router validates the request, dispatches to the one configured provider under the abort
   signal + deadline, then validates the output.
3. The router returns an immutable `AiSuggestion` + `AiExecutionAudit` upward.
4. The application decides whether a validated suggestion enters review. Providers never touch
   repositories and never mutate.
5. With no provider configured, the router resolves to `NoAiProvider` → `unsupported`; the caller
   proceeds rules-only with no network traffic.

## Error handling

- Every normalized error maps to a taxonomy code and a redacted audit entry; no error path exposes
  raw payloads.
- A provider error yields `unclassified` or preserves the best deterministic candidate; it never
  fabricates a category.
- Cancellation and timeout settle exactly once and never write a success audit.
- Malformed or unknown-ID output is rejected without any state mutation.

## Testing

- Fake-provider contract suite: success, refusal/abstention, malformed JSON, unknown IDs, oversize
  output, thrown error, timeout, cancellation race, mismatched reported model.
- Property/fuzz tests on task validators; assert model-controlled strings are always treated as
  text (never executed or rendered as raw HTML).
- Context-minimizer unit tests: output never exceeds declared `dataClasses`.
- Architecture dependency-boundary test for `ai-core`.
- No-network production-build regression: with no provider configured, assert zero AI/model/API
  requests across startup, import, rules, ledger, and dashboard paths.
- Config persistence tests: default `kind: none` seeded on first read; v9→v10 migration preserves
  data; profile round-trips through validation.

## Documentation impact

- New ADR `docs/adr/ADR-018-Provider-Neutral-AI-Core.md` + index entry in `docs/adr/README.md`:
  records the dependency-free `ai-core` boundary, single-file task contract (A1), structural
  non-authority, `kind: none` default + no-network guarantee, profiles-store-keyed-by-id (B1),
  router with no silent location switch, and the one-repair policy. Alternatives: per-task schema
  files (A2/A3), single-row settings store (B2), providers writing to repositories.
- `docs/08-AI-ARCHITECTURE.md`: task contract specifics and the router/validation surface.
- `docs/12-SECURITY-AND-PRIVACY.md`: audit-digest boundary and no-body-storage default.
- `docs/09-DATA-MODEL.md` and `docs/07-SYSTEM-ARCHITECTURE.md`: the v10 `aiProviderProfiles` store.
- `schemas/`: new `ai-task.schema.json`, generated types, synthetic example, and generator
  validator registration.
- `CHANGELOG.md` (Unreleased), `docs/15-ROADMAP.md`, and issue/milestone state.

## Delivery order

1. `ai-task.schema.json`, generated types, and validators.
2. Provider/task interfaces, execution envelope, error taxonomy, and `NoAiProvider`.
3. Router, timeout/cancellation, audit metadata, and context minimizers.
4. Fake-provider contract suite and architecture / no-network tests.
5. Application config port + IndexedDB v10 store with the persisted `kind: none` default.
6. Documentation and ADR-018.

## Acceptance criteria (from #31)

- App functions fully with no provider configured.
- Malformed output is rejected without state mutation.
- Every request records provider mode, task/schema version, and consent state.
- Task schemas are generated, strict, versioned, bounded, and shared by every adapter.
- Provider selection cannot silently change execution location or endpoint origin.
