# AGENTS.md

This file is the repository-wide operating contract for AI coding agents. It applies to every file
unless a more specific `AGENTS.md` exists in a subdirectory. Human instructions in the active issue
or conversation take precedence, but must not weaken privacy, security, data-integrity, or
pull-request requirements without explicit maintainer approval.

## Mission and non-negotiable principles

Financial Intelligence is a privacy-first, offline-first personal-finance PWA. Treat financial data
as exceptionally sensitive.

- Keep raw financial data on the device by default.
- Preserve user ownership, portability, provenance, and explainability.
- Prefer deterministic rules and decimal-safe domain logic over probabilistic behavior.
- Do not introduce required accounts, cloud services, telemetry, advertisements, bank connections,
  or remote AI calls into the default path.
- Never commit or expose real statements, account identifiers, user names, API keys, secrets,
  prompts, model transcripts, or production data. Tests and examples use synthetic data only.
- Treat files, imported text, backup containers, model output, plugin output, and portable JSON as
  untrusted input. Bound, parse, validate, and fail closed before mutation.
- Preserve keyboard access, screen-reader semantics, reduced-motion support, high contrast, narrow
  layouts, and the WCAG 2.2 AA target.

Read these before making substantive changes:

1. [`README.md`](README.md)
2. [`CONTRIBUTING.md`](CONTRIBUTING.md)
3. [`docs/00-VISION.md`](docs/00-VISION.md)
4. [`docs/01-DESIGN-PRINCIPLES.md`](docs/01-DESIGN-PRINCIPLES.md)
5. [`docs/02-GLOSSARY.md`](docs/02-GLOSSARY.md)
6. [`docs/03-PRODUCT-REQUIREMENTS.md`](docs/03-PRODUCT-REQUIREMENTS.md)
7. [`docs/07-SYSTEM-ARCHITECTURE.md`](docs/07-SYSTEM-ARCHITECTURE.md)
8. [`docs/12-SECURITY-AND-PRIVACY.md`](docs/12-SECURITY-AND-PRIVACY.md)
9. [`docs/15-ROADMAP.md`](docs/15-ROADMAP.md)
10. [`docs/16-TECHNOLOGY-STACK.md`](docs/16-TECHNOLOGY-STACK.md)
11. [`docs/17-QUALITY-BASELINE.md`](docs/17-QUALITY-BASELINE.md)
12. [`docs/adr/README.md`](docs/adr/README.md) and applicable accepted ADRs

## Source of truth and planning

- GitHub milestones and issues are the execution source of truth: scope, acceptance criteria,
  dependencies, sequencing, and completion status belong there.
- The numbered documents under `docs/` are the product and engineering specification. Keep them
  consistent with implemented behavior.
- JSON Schemas under `schemas/` are normative portable-data contracts. Generated types and
  synthetic examples must remain synchronized with them.
- ADRs record durable decisions; they are not implementation journals.
- `CHANGELOG.md` records notable completed behavior under `Unreleased`.

Before coding:

1. Confirm the issue, milestone, acceptance criteria, and dependency state.
2. Inspect the current branch, working tree, recent changes, relevant tests, specifications, and
   ADRs. Preserve unrelated work; never overwrite or discard changes you do not own.
3. Write a change-impact map covering product/specification, architecture/ADR, portable schema,
   persistence/migration, security/privacy, accessibility, changelog/README, and roadmap/issue
   state. For every category, name the files that must change or record why no update applies.
4. Make a small implementation plan and call out work that is blocked or intentionally deferred.
5. Ask for clarification only when an undiscoverable choice would materially change behavior or
   authority. Otherwise, make a conservative, documented assumption and proceed.

Do not silently expand an issue. Record valuable out-of-scope work as a follow-up issue with its
dependency and sequence rather than folding it into an unrelated PR.

## Mandatory branch and pull-request workflow

**Every change must go through a pull request. Direct commits or pushes to `main` are prohibited,
including documentation, dependency, workflow, schema, and emergency changes.**

1. Start from a clean, current `main`:

   ```sh
   git switch main
   git pull --ff-only origin main
   ```

2. Create a focused branch. Use the repository/user branch prefix when one is specified; otherwise
   use a short issue-oriented name. Never implement on `main`.
3. Keep the diff limited to one coherent issue or tightly coupled issue set. Do not reformat or
   modernize unrelated files.
4. Commit intentional, reviewable changes with an imperative summary.
5. Push the branch and open a PR against `main`. Link the issue with `Closes #NN` when the PR fully
   satisfies it; use `Refs #NN` when it does not.
6. The PR description must explain:
   - the user problem and resulting behavior;
   - scope and important design choices;
   - privacy/security and network impact;
   - data-model, schema, migration, and compatibility impact;
   - accessibility and UI impact, with screenshots when useful;
   - tests and commands run;
   - known limitations, risks, and follow-up work.
   Complete every section of `.github/pull_request_template.md`; do not delete an impact section or
   use a bare "N/A" without a concrete reason.
7. Wait for every required CI job. Inspect failing logs, fix the cause, rerun relevant local checks,
   push the fix, and wait again. Never hide a failure by weakening, skipping, or deleting a gate.
8. Do not merge or bypass branch protection unless the maintainer explicitly asks. After a
   maintainer merges, switch to `main`, pull with `--ff-only`, and confirm a clean worktree before
   starting the next issue.

Avoid force-pushes after review has begun unless history repair is explicitly requested. Never
rewrite shared `main` history.

## Architecture and implementation boundaries

The application is a modular monolith with inward dependencies:

```text
React/PWA presentation
  -> application use cases and ports
    -> framework-independent domain
      <- IndexedDB, parser, worker, crypto, AI, and browser adapters
```

- Domain code must not depend on React, IndexedDB, service workers, provider SDKs, or network APIs.
- Presentation code orchestrates views and commands; it does not parse statements or perform money
  arithmetic.
- Application services define use cases and ports. Browser and persistence details live in
  adapters.
- Store monetary amounts as decimal-safe domain values/canonical strings, never binary floating
  point calculations.
- Preserve stable identifiers, source provenance, explicit revisions, classifications, evidence,
  and user locks.
- Commands validate and mutate atomically. Queries are read-only. Interrupted operations must leave
  prior canonical state intact.
- Heavy parsing, hashing, aggregation, encryption, and inference should use workers when workload
  measurements justify it. Worker messages are bounded, versioned, and structured-clone-safe.
- Keep default workflows network-free. A new network destination requires explicit consent,
  minimization, disclosure, CSP review, network-leak tests, and usually an ADR.
- Keep secrets out of ordinary IndexedDB stores, logs, URLs, diagnostics, error messages, fixtures,
  and source maps.
- Do not add a backend or privileged plugin/database access by incremental convenience.

Prefer a thin, tested vertical slice through domain, application, adapter, and UI over speculative
packages or broad scaffolding.

## Data, schemas, storage, and migrations

- Public and portable formats are versioned. Validate at trust boundaries before narrowing types.
- A breaking portable-schema change requires a major schema version, migration strategy,
  compatibility/round-trip tests, updated generated types, examples, documentation, and an ADR when
  ownership, privacy, or interoperability changes.
- IndexedDB migrations are additive and recoverable when practical. Test upgrades from real prior
  versions, interruption, stale connections, rollback/recovery behavior, and preservation of user
  data.
- Canonical records are the source of truth. Rebuildable indexes and projections must never become
  the only copy of user-owned data without a superseding ADR.
- Imports require bounded intake, normalization, validation, provenance, duplicate handling,
  preview, and an atomic commit.
- Spreadsheet exports must mitigate formula injection. Backup and restore code must authenticate
  containers and validate in temporary/read-only state before any canonical mutation.
- Do not create fixtures from an attached real bank statement. Derive a minimal synthetic fixture
  that preserves only the technical shape needed for a test.

## Documentation and decision discipline

Documentation is part of the implementation, not optional cleanup.

### Mandatory documentation impact audit

Every feature, fix, schema, storage, UI, workflow, or architectural PR must complete this audit.
The implementing agent owns the documentation for its own slice; do not assume a later agent, epic
cleanup PR, or maintainer will add it. Documentation changes belong in the same PR as the behavior.

| Change made | Required artifact review |
| --- | --- |
| User-visible behavior, acceptance criteria, workflow, or limitation | Applicable numbered specification under `docs/`; `README.md` when project capabilities/status change |
| Added, removed, or materially changed capability | `CHANGELOG.md` under `Unreleased` |
| Epic or milestone progress, exit evidence, sequencing, or deferral | `docs/15-ROADMAP.md` and the GitHub issue/milestone state |
| Domain entity, canonical field, persisted record, relationship, or invariant | `docs/09-DATA-MODEL.md`; architecture or feature-specific guide when applicable |
| Portable/public JSON shape or validation behavior | Normative file in `schemas/`, generated type, synthetic example, compatibility/round-trip tests, and version/migration notes |
| IndexedDB store, index, version, transaction boundary, migration, or recovery behavior | `docs/07-SYSTEM-ARCHITECTURE.md`, data-model/storage guidance, migration tests, and an ADR when the decision is durable |
| Privacy, security, network, cryptography, AI disclosure, or plugin permission boundary | `docs/12-SECURITY-AND-PRIVACY.md` and usually an ADR |
| Durable architectural or technology choice, including a rejected alternative with long-term consequences | New ADR plus `docs/adr/README.md` index entry |
| Developer workflow, quality gate, or agent operating rule | `AGENTS.md`, `CONTRIBUTING.md`, quality documentation, and PR template as applicable |

Before declaring implementation complete:

1. Compare the final diff with the impact map; revise both when implementation scope changed.
2. Confirm at least one applicable numbered specification was updated for a feature or behavior
   change. If none applies, explain precisely in the PR which documents were reviewed and why the
   existing text remains accurate.
3. Confirm schemas, generated types, examples, and compatibility tests changed together whenever a
   portable contract changed. A runtime type alone is not the portable contract.
4. Confirm a durable decision has either an ADR and index update or a concrete explanation of why
   it follows an existing accepted decision.
5. Confirm `CHANGELOG.md`, roadmap wording, and issue/milestone state do not overclaim completion.
6. Include the completed audit in the PR description. Missing documentation is an incomplete
   implementation, not optional follow-up work.

Update the relevant artifacts in the same PR when behavior changes:

- product behavior or acceptance criteria: applicable numbered specification;
- architecture, boundaries, data flow, security posture, or technology guidance: applicable guide;
- portable contract: schema, generated type, example, version/migration notes;
- notable user/developer capability: `README.md` and/or `CHANGELOG.md`;
- completed milestone behavior: issue/milestone status and roadmap wording when the documented state
  would otherwise be misleading;
- developer workflow: `CONTRIBUTING.md`, `AGENTS.md`, or quality documentation.

Create an ADR for a decision that materially constrains architecture, privacy, security,
compatibility, persistence, cryptography, AI/provider disclosure, plugin permissions, or major
technology selection. Follow `docs/adr/README.md`:

- investigate current implementation and credible alternatives first;
- document context, decision, consequences, rejected alternatives, validation, and related records;
- add the ADR to the ADR index;
- do not use an ADR merely to narrate routine code changes;
- accepted ADRs are immutable except for typo/link fixes. Supersede an accepted ADR with a new ADR
  instead of rewriting history.

When an issue reveals a reusable operational rule, update this file or the appropriate guide so the
next agent does not have to rediscover it.

## Testing and mandatory quality gates

Add tests at the lowest useful layer and at every affected boundary:

- unit tests for domain behavior and validation;
- contract/round-trip tests for schemas, parsers, providers, repositories, and portable formats;
- integration tests for IndexedDB transactions, migrations, cancellation, recovery, and workers;
- adversarial tests for malformed, oversized, duplicate, truncated, tampered, and injection input;
- Playwright tests for user-visible workflows, offline/network boundaries, persistence, routing,
  accessibility, responsive layout, and supported browsers.

Regression tests must fail before the fix when practical. Test error and interruption paths, not
only success. Avoid timing-dependent assertions, live services, real financial data, and snapshots
that hide meaningful behavior.

Before opening or updating a PR, install from the lockfile and run the same checks as CI:

```sh
pnpm install --frozen-lockfile
pnpm typescript:check
pnpm format:check
pnpm lint
pnpm schema:check
pnpm typecheck
pnpm test
pnpm build
pnpm security:headers:check -- apps/web/dist/_headers
pnpm audit --audit-level high
pnpm browser:test
```

Run `pnpm format` to fix formatting, then rerun `pnpm format:check`. UI, storage, routing, service
worker, cryptography, worker, import, or network changes must pass Chromium, Firefox, and WebKit.
Documentation-only changes still run the complete CI-equivalent gate unless a maintainer explicitly
authorizes a narrower check; CI remains mandatory in all cases.

If a command cannot run locally because of environment limitations, state exactly what was not run
and why in the PR, run every remaining gate, and rely on—not skip—remote CI. A locally passing suite
is not completion until required PR checks pass.

## Dependency and toolchain changes

- Use the package manager and pinned toolchain declared by the repository. Do not hand-edit generated
  dependency state when the package manager can produce it.
- Keep lockfile changes minimal and inspect them for unrelated churn.
- Verify current official migration guidance, supported browsers/Node versions, license,
  maintenance, bundle size, runtime/network behavior, and known vulnerabilities before adding or
  upgrading a dependency.
- Prefer small, well-maintained libraries behind an adapter over framework leakage into domain code.
- Experimental, canary, cryptographic, AI-runtime, parser, storage-engine, or provider dependencies
  require explicit evaluation evidence and may require an ADR.
- Do not weaken lint, TypeScript strictness, tests, CSP, audit level, or browser coverage to make an
  upgrade pass.

## Safe autonomous-agent behavior

- Inspect before editing. Prefer established patterns, utilities, and naming over parallel
  abstractions.
- Make small patches, review the resulting diff, and run `git diff --check` before committing.
- Preserve a dirty worktree and unrelated user files. Never use destructive reset/checkout/clean
  commands without explicit authorization and exact target verification.
- Never expose secrets through commands, logs, test output, PR text, screenshots, or tool results.
- Do not claim a check passed, issue completed, PR created, or remote state changed without verifying
  it.
- Do not fabricate APIs, requirements, measurements, citations, or compatibility claims. Verify
  unstable technical facts against primary/official sources and record relevant evidence.
- Keep comments focused on why a constraint exists. Prefer clear code and tests over lengthy
  implementation commentary.
- Do not leave unexplained TODOs, commented-out code, debug logging, generated artifacts, or test
  reports in a PR.
- On failure, diagnose the root cause. Do not repeatedly rerun, suppress, or route around the same
  failure.
- Report blockers early with evidence and the smallest decision needed from a maintainer.

## Definition of done

Work is complete only when:

- the linked issue's acceptance criteria and applicable requirements are satisfied;
- architecture and privacy boundaries remain intact;
- success, failure, interruption, accessibility, and compatibility behavior are tested in proportion
  to risk;
- schemas, examples, guides, ADR index, changelog, roadmap, and issue/milestone state are updated as
  applicable;
- the final diff was reconciled against a completed documentation impact audit, with concrete
  reasons recorded for every intentionally unchanged artifact category;
- no real or sensitive data, secrets, unexplained network access, or unrelated changes are present;
- all local CI-equivalent checks pass, the branch is pushed, a focused PR links the issue, and every
  required remote CI job is green;
- known limitations and follow-up work are recorded rather than hidden.

When these conditions are not met, describe the remaining work accurately; do not mark the issue or
goal complete.
