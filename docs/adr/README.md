# Architecture Decision Records

ADRs capture decisions that materially constrain architecture, privacy, compatibility, or operations.

## Lifecycle

Status is one of `Proposed`, `Accepted`, `Deprecated`, or `Superseded by ADR-NNN`. Accepted ADRs are immutable except for typo/link corrections. A changed decision receives a new ADR that supersedes the old one; history is preserved.

## Template

```markdown
# ADR-NNN: Decision title

- Status: Proposed
- Date: YYYY-MM-DD
- Decision owners: Project maintainers

## Context
## Decision
## Consequences
## Alternatives considered
## Validation
## Related decisions
```

## Index

- [ADR-001: Offline-first core architecture](ADR-001-Offline-First.md)
- [ADR-002: IndexedDB as primary browser persistence](ADR-002-Why-IndexedDB.md)
- [ADR-003: WebGPU as optional local AI acceleration](ADR-003-Why-WebGPU.md)
- [ADR-004: TypeScript React PWA technology stack](ADR-004-Technology-Stack.md)
- [ADR-005: CSV Parse for bounded delimited-text intake](ADR-005-CSV-Parser.md)
- [ADR-006: TypeScript 7 native compiler with a TypeScript 6 compatibility API](ADR-006-TypeScript-7-Toolchain.md)
- [ADR-007: Versioned encrypted workspace backup](ADR-007-Encrypted-Workspace-Backup.md)
- [ADR-008: Atomic operation journals and revision-consistent snapshots](ADR-008-Atomic-Operation-Journals-And-Revision-Snapshots.md)
- [ADR-009: Cloudflare Workers Static Assets as the reference host](ADR-009-Cloudflare-Workers-Static-Hosting.md)
- [ADR-010: CSP-safe generated validators and narrow WebAssembly execution](ADR-010-CSP-Safe-Generated-Validators-And-WebAssembly.md)
- [ADR-011: Persistent Cloudflare invocation logging](ADR-011-Cloudflare-Invocation-Logging.md)
- [ADR-012: Purpose-built bounded OFX/QFX parser](ADR-012-OFX-Parser.md)
- [ADR-013: Text-based PDF statement import using a hardened, worker-isolated PDF.js](ADR-013-PDF-Parser.md)
- [ADR-014: Explicit PWA update lifecycle, cache namespaces, and startup recovery](ADR-014-PWA-Update-And-Cache-Lifecycle.md)
