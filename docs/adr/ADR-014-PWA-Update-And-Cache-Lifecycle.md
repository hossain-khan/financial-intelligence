# ADR-014: Explicit PWA update lifecycle, cache namespaces, and startup recovery

- Status: Accepted
- Date: 2026-07-21
- Decision owners: Project maintainers

## Context

Phase 3 hardens installation and offline operation (issue #27). The previous service worker
precached versioned assets and reloaded the page as soon as an update was detected. That is unsafe
for a local-first financial app: a forced reload during an import commit, bulk edit, backup, or
IndexedDB migration can strand or corrupt staged work, and a failed database open had no recovery
path. The app must download updates in the background, activate only at a boundary the user
confirms, coordinate multiple tabs, keep the current version usable offline, and never treat cache
deletion as a substitute for data recovery (NFR-001, NFR-003, NFR-020, NFR-030).

## Decision

Model the service-worker lifecycle as an explicit state machine owned by a page-side controller,
define a versioned Cache Storage namespace contract, and add a startup database-health gate with a
recovery screen.

**Update lifecycle.** A `PwaController` (`apps/web/src/pwa/lifecycle.ts`) tracks states `checking`,
`ready`, `offline-ready`, `update-available`, `activating`, `reload-required`, and `failed`. Updates
download in the background while the active worker keeps serving the current build. Activation
(`skipWaiting` + a single coordinated reload) happens only after the user confirms, and is deferred
while any protected operation is in progress. A ref-counted protected-operations registry
(`protected-operations.ts`) is entered around import commits, backups, and other staged mutations;
the controller applies a confirmed-but-deferred update automatically once the last operation
releases. Tabs coordinate over a `BroadcastChannel`: a tab that activates broadcasts
`reload-required` so other tabs reload to the same build rather than each deciding independently.
Registration and activation are injected through a port so the state machine is unit-tested without
a real worker. Registration/activation errors resolve to a sanitized `failed` state (no raw error
text, which can contain paths) and the current version keeps working.

**Service worker.** `sw.ts` keeps Workbox precaching of the versioned shell (including lazy chunks
and the parser/crypto workers) and adds a navigation route that falls back to the precached
`index.html` so any in-scope route opens offline instead of a browser error page. There is no
runtime caching: remote/AI requests, exports, blob URLs, and query strings are never written to
Cache Storage. The worker answers `SKIP_WAITING` and `GET_VERSION` messages and reports its build id.

**Cache namespaces.** `cache-namespaces.ts` defines three versioned categories — `app-shell`
(Workbox-managed, protected from clearing because it is the offline recovery copy), `model` (future
#38 local model artifacts), and `source` (optional retained source files). Only the app-shell
namespace is populated today; the model and source namespaces are declared so #28/#38 can adopt the
contract without fabricating stores now. Canonical financial data lives in IndexedDB only and is
never represented as a cache. A storage-inventory service reports `navigator.storage.estimate()`
usage/quota (labelled an estimate), `persisted()` status, and per-namespace item/byte counts, and
clears only clearable namespaces — never IndexedDB, exports, or the app shell. Every browser
capability is optional and degrades to an accurate "not available" state.

**Startup recovery.** `checkDatabaseHealth()` opens (and migrates) the database through the normal
journaled path at app start. On failure the app renders a `RecoveryScreen` with retry, a diagnostic
export (error code + build id + user agent only — never financial data), and backup guidance. It
never clears storage, deletes a database, or reload-loops; app-update activation and IndexedDB
migration remain separate operations and cache deletion is never used as a migration rollback.

## Consequences

### Positive

- Updates never activate during a protected staged operation without explicit confirmation, and a
  deferred update applies automatically and safely afterward.
- Multi-tab activation is coordinated; a stale tab is told to reload rather than silently diverging.
- Users can inspect storage usage and clear disposable caches with exact counts, with canonical data
  provably untouched.
- A failed database open shows recovery guidance and preserves all data instead of clearing it.
- The lifecycle is fully unit-testable through injected ports; browser behavior is covered by
  Playwright offline/settings/cache-clear specs under the network guard.

### Negative

- The app now owns a non-trivial lifecycle state machine and a cache-namespace contract that #28 and
  #38 must adopt; the model/source namespaces are declared but unexercised until those features land.
- `BroadcastChannel` is unavailable on older Safari; multi-tab coordination degrades to per-tab
  decisions there (each tab still updates safely, just without cross-tab reload notification).
- The build id is injected via Vite `define` from CI commit metadata; local builds use a coarse
  date-bucketed id.

## Alternatives considered

- **Keep auto-reload-on-update:** rejected. It is the exact behavior that risks corrupting staged
  financial operations and gives the user no control.
- **A Service Worker-owned state machine instead of a page-side controller:** rejected for v1. The
  protected-operation state and UI live on the page; keeping the decision logic page-side keeps it
  testable and avoids duplicating operation state into the worker. The worker only precaches, falls
  back for navigation, and responds to `SKIP_WAITING`/`GET_VERSION`.
- **Building real model/source cache stores now:** rejected. Their consumer features (#38, source
  retention) do not exist; fabricating stores would couple this work to unbuilt designs. The
  namespace contract is published so those issues can adopt it.
- **Clearing/rebuilding storage on a failed open:** rejected outright. That destroys user data;
  recovery must preserve databases and guide the user to retry, export a diagnostic, or restore.

## Validation

- Unit tests drive the controller through update-available → protected-operation deferral →
  automatic activation → reload, multi-tab `reload-required`, unsupported browsers, and sanitized
  activation/registration failures.
- Storage-inventory tests verify per-namespace aggregation, approximate-byte flagging, app-shell
  clear refusal, targeted model clear, and persistence requests, with injected fakes.
- Component tests verify the startup health gate renders the app on success and the recovery screen
  (with retry) on failure without exposing the ledger.
- Playwright (Chromium, with Firefox/WebKit in release evidence per the offline emulation note)
  covers the settings storage/cache UI with an Axe pass, clearing a disposable cache while the
  IndexedDB workspace survives, offline core-ledger open after a cold start, and the existing
  synthetic DB-open-failure recovery path — all under the local network guard.

## Related decisions

- [ADR-001](ADR-001-Offline-First.md)
- [ADR-002](ADR-002-Why-IndexedDB.md)
- [ADR-008](ADR-008-Atomic-Operation-Journals-And-Revision-Snapshots.md)
- [ADR-009](ADR-009-Cloudflare-Workers-Static-Hosting.md)
- [System architecture](../07-SYSTEM-ARCHITECTURE.md)
- [Security and privacy](../12-SECURITY-AND-PRIVACY.md)
