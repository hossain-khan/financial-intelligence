# ADR-018: Provider-neutral AI core, task contracts, and no-AI default

- Status: Accepted
- Date: 2026-07-21
- Decision owners: Project maintainers

## Context

Phase 4 introduces optional AI assistance for merchant normalization, uncertain categorization,
natural-language query planning, and concise insight wording (`docs/08-AI-ARCHITECTURE.md`). The
core product rule is that AI is an optional classifier and interface layer, never the ledger: the
application must stay fully useful and correct when every provider is unavailable, and no model
output may mutate financial records or compute authoritative amounts.

Before any provider runtime, model download, or network destination is introduced, issue #31 must
establish the boundary that keeps AI optional, typed, cancellable, and structurally non-authoritative.
The only AI artifact that previously existed was `schemas/ai-provider.schema.json` — a validation
type for a provider profile, read by no runtime. There was no task wire contract, no provider
interface, no router, and no persisted provider configuration.

## Decision

Add a dependency-free `packages/ai-core` boundary, one versioned task wire schema, an always-available
no-AI provider, and a persisted `kind: none` default profile behind an application config port.

**Package boundary.** `ai-core` sits above `domain` and below any provider adapter. It depends only
on `@financial-intelligence/schemas` (generated task types/validators) and
`@financial-intelligence/domain`. It must not import React, IndexedDB/Dexie, `fetch`, provider SDKs,
or application repositories. A dependency-boundary test enforces this. Provider adapters (#33 local,
#34 self-hosted, #35 remote) live in separate packages and depend on `ai-core`, never the reverse.

**Single task contract (A1).** One normative schema `schemas/ai-task.schema.json` holds all four
tasks (`merchant.resolve.v1`, `category.classify.v1`, `query.plan.v1`, `insight.word.v1`) as a
discriminated envelope keyed by `task` + `direction`, with request/response pairs in `$defs`. It is
generated into typed validators by the existing `packages/schemas` pipeline. Co-locating the tasks
keeps shared bounds, allowed-ID patterns, evidence codes, and confidence ranges in one place so the
four contracts cannot drift, mirroring how `ai-provider.schema.json` already nests its `$defs`.

**Structural non-authority.** Providers expose only `health()` (payload-incapable) and
`execute(request, { signal, deadline, onProgress })` returning a typed result envelope. The router
returns immutable `AiSuggestion` and `AiExecutionAudit` values. No `save`/`update`, SQL, repository,
or mutation-capable callback is ever handed to a provider. Output authority is limited to choosing an
allowed ID or producing a constrained, validated query plan.

**Router.** Selects the single configured profile that supports the exact task version; it never
silently switches execution location or endpoint origin. It validates the request before dispatch and
the response after, enforces workspace-current ID membership at runtime (a static schema cannot see
live workspace state), permits at most one repair attempt (fed validation codes, never data access),
and settles exactly once under `AbortSignal` + deadline. Audit records store redacted input/output
digests only — never prompt or response bodies.

**No-AI default (B1).** `NoAiProvider` is always available and returns `unsupported` (normal, not an
error). Provider configuration defaults to `kind: none`, persisted in a new IndexedDB v10
`aiProviderProfiles` store keyed by profile id, behind an application `AiProviderConfigRepository`
port. The default path issues zero AI/model/API network traffic.

## Consequences

- #32–#35 implement adapters and evaluation against a stable, already-tested contract; schema and
  fake-provider work is reviewable before any runtime dependency is selected.
- Workspace-current ID checks live in the router, not the schema, so callers pass their allowed-ID
  set per request.
- Adding a new task version appends a `$def` and a discriminator arm without disturbing existing
  arms. A new persisted profile shape requires a schema major version and a new DB migration.
- The profiles store is keyed by id so #35 can hold multiple named profiles (local + BYOK) without
  reshaping the store.
- Audit metadata is deliberately body-free; richer provider access/invocation logging remains a
  separate decision requiring maintainer approval, a privacy boundary, retention disclosure, and its
  own ADR (per AGENTS.md and `docs/12-SECURITY-AND-PRIVACY.md`).

## Alternatives considered

- **Per-task schema files (one file per task, or per request/response).** Rejected: eight generated
  modules and validators, with shared enums/bounds duplicated or cross-referenced across files —
  more drift risk and churn than a single contract family.
- **Single-row "app settings" store holding one active profile.** Rejected: #35 needs multiple named
  profiles, so the store would be reshaped almost immediately.
- **Providers with repository or mutation access.** Rejected: it breaks structural non-authority and
  would let model output reach canonical records.

## Validation

- Fake-provider contract matrix: success, refusal/abstention, malformed JSON, unknown IDs, oversize
  output, thrown error, cancellation, repair-then-accept, repair-then-abstain.
- Architecture dependency-boundary test for `ai-core`.
- No-network production regression: the rules-only default path makes zero external requests.
- IndexedDB v9→v10 migration preserves canonical data and adds an empty profiles store.
- Schema generation + strict validation of the task contract.

## Related decisions

- [ADR-003: WebGPU as optional local AI acceleration](ADR-003-Why-WebGPU.md)
- [ADR-010: CSP-safe generated validators and narrow WebAssembly execution](ADR-010-CSP-Safe-Generated-Validators-And-WebAssembly.md)
- [ADR-014: Explicit PWA update lifecycle, cache namespaces, and startup recovery](ADR-014-PWA-Update-And-Cache-Lifecycle.md)
