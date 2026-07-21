# System Architecture

## Purpose

Define implementation boundaries, data flow, deployment assumptions, and architectural constraints for the offline-first web application.

## Architectural style

Use a modular monolith delivered as a Progressive Web App. Domain logic is organized as framework-independent TypeScript packages. Browser APIs, React, model runtimes, and file parsers sit behind ports. Heavy work runs in dedicated workers. There is no required application backend.

```text
Presentation (React/PWA)
        |
Application use cases and command/query bus
        |
Domain: imports, ledger, rules, analysis, portability
        |
Ports: repositories, parser, classifier, crypto, clock, files
        |
Adapters: IndexedDB, Web Workers, WebGPU/WASM, provider HTTP, browser APIs
```

Dependencies point inward. Domain packages must not import React, IndexedDB implementations, service-worker code, or provider SDKs.

## Runtime components

### Application shell

- Routes, navigation, responsive layout, accessibility announcements, and view composition.
- Reads projections through application queries and submits explicit commands.
- Never performs monetary arithmetic or source parsing directly.

### Application layer

- Coordinates use cases, validation, transactions, progress, cancellation, and audit events.
- Defines command/query DTOs and permission-aware service interfaces.
- Owns no browser-specific persistence code.

### Domain modules

| Module | Responsibilities |
| --- | --- |
| Workspace | Local identity, settings, lifecycle, storage status |
| Ledger | Accounts, canonical transactions, transfers, decimal-safe totals |
| Import | Detection, mapping, normalization, validation, deduplication, commit plan |
| Catalog | Categories, merchants, aliases, tags |
| Learning | Rules, precedence, conflicts, corrections, review queue |
| Analysis | Aggregates, recurring series, insights, query plans |
| AI | Task contracts, eligibility, redaction, evidence, provider routing |
| Portability | Brain export/import, backup/restore, migrations |
| Plugins | Manifests, permissions, isolated host API |

### Worker pool

Dedicated workers execute CSV/OFX/PDF parsing, hashing, bulk normalization, index rebuilds, aggregation, encryption, and local inference. Messages use versioned, structured-clone-safe contracts. Worker crashes fail the staged operation and cannot partially mutate canonical storage.

### Persistence adapter

IndexedDB is the primary store (see [ADR-002](adr/ADR-002-Why-IndexedDB.md)). Suggested stores:

- `meta`: workspace and database versions;
- `accounts`, `imports`, `transactions`, `categories`, `merchants`;
- `rules`, `corrections`, `recurringSeries`, `providerProfiles`;
- `operationJournal`, `auditEvents`;
- rebuildable indexes/projections keyed by time, account, category, and merchant.

Large source files and model artifacts should use browser facilities suited to blobs/cache storage, with metadata and integrity hashes in IndexedDB. Source retention is optional. Secrets do not belong in ordinary stores.

## Primary data flow

```text
Untrusted source file
  -> detect and size-limit
  -> parser worker
  -> source rows + warnings
  -> mapping and normalization
  -> canonical candidates
  -> validation + duplicate candidates
  -> user preview
  -> atomic commit
  -> deterministic classification
  -> optional eligible AI tasks
  -> review queue
  -> projections and dashboards
```

Every boundary uses data objects rather than executable content. Imported descriptions are never interpolated into HTML, code, SQL-like expressions, or privileged model instructions.

## Command and query separation

Commands mutate canonical state and run through authorization/validation, journaling, and storage transactions. Queries are read-only and can use rebuildable projections. Natural-language questions compile to a constrained query plan and execute through the same query services as dashboards.

Examples:

- Commands: `CommitImport`, `ConfirmClassification`, `CreateRule`, `PairTransfer`, `RestoreBackup`.
- Queries: `ListTransactions`, `CashFlowByMonth`, `RuleMatchPreview`, `ImportErrorReport`.

## Consistency and atomicity

- The canonical ledger is the source of truth.
- Imports use a staged plan and one IndexedDB transaction for canonical commit.
- Bulk operations append an operation record containing inverse data or a bounded snapshot before mutation.
- Derived projections carry a source revision; stale projections are ignored and rebuilt.
- Cross-worker writes are serialized through an application coordinator or revision-checked command handler.
- Restore uses a separate temporary database or namespace and swaps only after full validation.

## Offline and service worker

The service worker caches only versioned application assets and user-selected local model artifacts. It must not cache remote AI requests or sensitive exports. Updates download in the background but activate only at a safe boundary after the user is told a reload is required. The currently installed version remains usable offline.

## Provider boundary

AI providers implement a task-based interface rather than exposing arbitrary chat:

```ts
interface AiProvider {
  capabilities(signal: AbortSignal): Promise<ProviderCapabilities>;
  run<TInput, TOutput>(task: AiTask<TInput, TOutput>, signal: AbortSignal): Promise<AiResult<TOutput>>;
}
```

The AI application service performs consent checks, minimization, redaction, schema validation, and evidence conversion before/after this adapter. Provider code cannot access repositories directly.

## Plugin boundary

Plugins run outside the main execution realm when feasible and receive opaque capability handles. They never receive a database connection, DOM ownership, API keys, or unrestricted network access. All reads are field-scoped; all mutations are proposals validated by host commands.

## Suggested package layout

```text
packages/
  app/                 React application and PWA shell
  domain/              Entities, value objects, policies
  application/         Use cases, ports, commands, queries
  storage-indexeddb/   Persistence adapter and migrations
  import-core/         Parser contracts and normalization
  import-csv/          CSV adapter
  import-ofx/          OFX/QFX adapter
  import-pdf/          Supported PDF adapters
  ai-core/             Tasks, provider contracts, guards
  ai-local/            Browser model adapter
  analysis/            Aggregates and query engine
  schemas/             Generated types and validators
  plugin-sdk/          Manifest types and host client
  test-fixtures/       Synthetic data builders
```

This is a target layout, not permission to create all packages before a vertical slice proves the boundaries.

## Deployment

The reference deployment is an assets-only Cloudflare Worker configured by `wrangler.jsonc`; see
[ADR-009](adr/ADR-009-Cloudflare-Workers-Static-Hosting.md). Wrangler publishes `apps/web/dist` with
single-page-application fallback so direct React Router navigations return the application shell.
The Worker has no script entrypoint, runtime bindings, application API, or remote canonical store.

Cloudflare Workers Builds promotes reviewed changes from `main` and uploads non-production branches
as preview versions. This deployment step follows GitHub CI and does not replace the repository's
quality gates. The checked-in `_headers` file supplies the restrictive CSP, `Referrer-Policy`,
`Permissions-Policy`, MIME-sniffing protection, framing protection, and cache policy.

Portable JSON Schemas are compiled into standalone validator modules during schema generation.
Production code imports those generated functions and must not initialize Ajv or compile schemas in
the browser, because runtime compilation depends on dynamic code evaluation that the deployment CSP
intentionally forbids. Schema generation and stale-artifact checks remain build-time concerns.
The policy permits only the narrower WebAssembly compilation source expression needed by the local
Argon2id backup adapter; it does not enable JavaScript `eval` or `Function` construction. See
[ADR-010](adr/ADR-010-CSP-Safe-Generated-Validators-And-WebAssembly.md).

The static artifact remains host-portable. Another HTTPS static host may replace Cloudflare when it
implements equivalent SPA routing, asset caching, headers, and release verification. Cross-origin
isolation is enabled only if a selected local runtime requires it and deployment assets remain
compatible.

## Observability

The application does not emit custom remote logs or automatic diagnostic bundles. The reference
Cloudflare host persists invocation logs at 100% sampling for operational diagnosis while traces
remain disabled. Invocation logs can contain request URLs and provider-generated request/response
metadata. They do not grant the Worker access to IndexedDB, statement files, transaction records,
backup plaintext, or Financial Brain contents.

Dashboard query strings can contain opaque account/merchant identifiers, tags, currency, and date
filters, so those values may enter invocation logs. Restricted transaction text, exact amounts,
account labels, filenames, prompts, secrets, or backup contents must never be placed in URLs or
application logs. See [ADR-011](adr/ADR-011-Cloudflare-Invocation-Logging.md).

User-exported diagnostic state remains local and redacted:

- stable error code, component version, duration bucket, browser capability flags;
- no transaction text, exact amounts, account labels, file contents, prompts, secrets, or full URLs;
- user previews and explicitly exports a diagnostic bundle;
- no automatic upload in v1.0.

## Testing strategy

- Unit: value objects, rule precedence, transfer logic, decimal calculations, migrations.
- Contract: parsers, providers, repositories, plugins, schemas.
- Property/fuzz: CSV/OFX parsing, normalization, rule conflict behavior, round trips.
- Integration: IndexedDB transactions, interrupted operations, worker cancellation.
- End-to-end: first import, overlapping import, review, dashboard drill-down, backup/restore.
- Security: CSP, injection fixtures, malicious imports/plugins/models, network-leak assertions.
- Accessibility/performance: defined gates from non-functional requirements.

## Failure handling

| Failure | Required behavior |
| --- | --- |
| Storage quota | Stop before commit, retain prior data, offer cleanup/export |
| Worker crash | Mark staged operation failed; allow retry |
| Provider timeout | Preserve deterministic results; queue manual review |
| Invalid model output | Reject, record safe error code, never coerce silently |
| Migration interruption | Reopen previous valid version or resume journaled migration |
| Service-worker update | Keep current app operational until coordinated reload |

## Phase 2 atomic commands and snapshots

Database version 9 adds `learningOperations` and `decisionEvents`. Cross-store learning changes,
transfer confirmation, and recurring supersession write canonical records and their bounded journal
inside one IndexedDB transaction. Commands compare an expected revision or exact before-state; undo
compares the journaled after-state and refuses to overwrite a later edit.

Each operation journal retains at most 1,000 records during ordinary command writes; older entries
are pruned chronologically inside the same transaction. Full backup captures the retained window.

Dashboard queries use one read transaction across transactions, categories, merchants, transfer
links, and recurring decisions. The adapter returns an opaque deterministic source revision. The UI
cancels superseded requests and renders charts and tables from one returned report bundle. See
[ADR-008](adr/ADR-008-Atomic-Operation-Journals-And-Revision-Snapshots.md).

## Open questions

- Choose the framework/build tooling only when implementation begins and record an ADR.
- Benchmark whether analytical projections need a WASM query engine at the large workload.
- Determine browser support for durable storage and file-system handles without making either mandatory.

## Related documents

- [AI architecture](08-AI-ARCHITECTURE.md)
- [Data model](09-DATA-MODEL.md)
- [Security and privacy](12-SECURITY-AND-PRIVACY.md)
