# ADR-001: Offline-First Core Architecture

- Status: Accepted
- Date: 2026-07-19
- Decision owners: Project maintainers

## Context

Financial statements reveal sensitive behavior. A mandatory server would expand the trust boundary, create account/operations burden, make offline use impossible, and contradict the product's ownership promise. Import, categorization rules, aggregation, visualization, and backup can run on modern client devices.

## Decision

The core product will be a client-side, offline-capable web application with no required application backend. Creating a workspace, importing supported statements, editing/classifying records, learning deterministic rules, viewing dashboards, searching, exporting, backing up, restoring, and deleting data must work without transmitting financial data.

Network capabilities—static application/model asset installation, remote AI, update checks, and future plugins—are separate adapters with explicit purpose and consent. No feature may silently fall back from local to remote.

## Consequences

### Positive

- Smaller default privacy and breach surface.
- No registration or continuous service required.
- Application remains usable during outages and can be statically hosted.
- Architecture enforces portable data and replaceable external services.

### Negative

- Browser quota/eviction and device loss become user-visible risks.
- Cross-device sync and collaboration are not inherent.
- Client devices constrain parsing, model size, and large-dataset performance.
- Updates and migrations must be carefully coordinated in a PWA.

### Required mitigations

- Prominent storage persistence and encrypted backup workflows.
- Atomic migrations/imports and tested recovery.
- Worker-based processing and performance budgets.
- Clear network indicators, disclosure, and automated local-mode leak tests.

## Alternatives considered

- **Cloud-first SaaS:** easier sync/central operations, rejected because it violates default privacy and offline goals.
- **Desktop-only native app:** strong local control, rejected as the initial surface due to distribution and cross-platform cost; packaging may come later.
- **Hybrid with mandatory encrypted cloud:** server cannot read content but still creates identity, metadata, availability, and recovery dependencies; deferred as optional post-v1 sync.

## Validation

- End-to-end core journey passes with network disabled after installation.
- Production tests assert no unexpected requests in no-AI/local mode.
- Backup/restore and browser-storage-loss usability tests pass.

## Related decisions

- [ADR-002](ADR-002-Why-IndexedDB.md)
- [ADR-003](ADR-003-Why-WebGPU.md)
