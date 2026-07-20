# ADR-008: Atomic operation journals and revision-consistent snapshots

- Status: Accepted
- Date: 2026-07-20
- Decision owners: Project maintainers

## Context

Phase 2 commands can change several canonical stores at once. Financial Brain apply and a review
correction that also creates a rule or merchant alias must not leave partial learning behind after
quota failure, interruption, or a second-tab edit. Transfer and recurring decisions also require
recoverable history. Dashboards previously loaded related stores independently, allowing one screen
to combine values from different revisions.

## Decision

IndexedDB version 9 adds bounded `learningOperations` and `decisionEvents` stores.

- Learning commands carry the preview digest, expected canonical revision, and exact before/after
  records. The adapter compares and writes every affected store and the journal in one Dexie `rw`
  transaction.
- Undo compares the current value with the recorded after-state. It fails closed when a later edit
  exists instead of overwriting that edit.
- Transfer confirmation re-reads both transaction documents and active links in one transaction.
  Recurring multi-record split, merge, supersession, invalidation, and undo use one journal event.
- Dashboard queries read transactions, categories, merchants, transfer links, and recurring
  decisions in one read transaction and return a deterministic source revision. Presentation drops
  results from superseded requests.
- Full encrypted backup includes operational journals. Financial Brain exports only reusable
  recurring knowledge and never includes raw member transaction IDs or operation history.

## Consequences

Operations are stale-safe, all-or-nothing, and locally recoverable, including across tabs. Journal
records increase local storage and may contain sensitive before/after learning data, so retention is
bounded and the records remain inside the encrypted full backup boundary. A source revision is an
opaque concurrency token, not a public content hash or user-facing identifier.

## Alternatives considered

- Sequential repository calls were rejected because they cannot guarantee atomic rollback.
- Compensating writes were rejected because interruption can also interrupt compensation.
- A cached dashboard projection was deferred; the measured 50,000-row analysis budget currently
  permits a correctness-first snapshot query without another source of truth.
- Last-write-wins undo was rejected because it can erase later user decisions.

## Validation

Migration tests cover versions 1–9. Repository tests cover atomic apply, stale rejection,
multi-record recurring supersession, and conflict-safe undo. Analysis tests cover shared filters and
50,000-row bounds; UI tests require chart/table parity and exact drilldown.

## Related decisions

- [ADR-001](ADR-001-Offline-First.md)
- [ADR-002](ADR-002-Why-IndexedDB.md)
- [ADR-007](ADR-007-Encrypted-Workspace-Backup.md)
