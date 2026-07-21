# ADR-015: Production encrypted backup with authenticated manifest and staged atomic restore

- Status: Accepted
- Date: 2026-07-21
- Decision owners: Project maintainers

## Context

ADR-007 established an experimental, preview-only encrypted backup: an Argon2id + AES-256-GCM
container (format `financial-intelligence.encrypted-backup` v1.0.0) wrapping a canonical workspace
snapshot (`financial-intelligence.workspace-backup` v1.0.0), with in-memory validation and no write
path. Issue #28 promotes this to a production capability: a real restore that writes canonical data,
across-store integrity that survives truncation and partial writes, and explicit restore modes with
atomicity guarantees. ADR-007 required that any change to the payload layout become a new snapshot
version with a superseding/extending ADR; adding a manifest is exactly such a change.

## Decision

Extend ADR-007 (which remains accepted for the container envelope and cryptographic parameters) with
a production snapshot format, worker-isolated cryptography, and a staged atomic restore. **This
project does not maintain a v1 snapshot reader**: the manifest-bearing v2 format is the only accepted
workspace-backup payload, so a snapshot without a valid manifest is rejected rather than read.

**Authenticated manifest (snapshot v2.0.0).** Every backup payload embeds a manifest describing the
backup: manifest version, snapshot format/version, producing build id, created time, workspace id +
revision, source database version, snapshot-version compatibility range, and — per canonical section
— record count, canonical byte length, and SHA-256 digest, plus a required/optional flag. The
manifest lives inside the AES-GCM payload, so it is authenticated by the same tag as the data. On
decrypt, the reader verifies the manifest against the live sections (workspace identity, per-section
counts, and per-section digests over a deterministic key-sorted JSON encoding); any mismatch is a
tamper/corruption signal and fails closed. A required section that is missing fails closed; the
reader never silently ignores an unknown required section.

**Worker-isolated cryptography.** Serialization, Argon2id derivation, AES-GCM encrypt/decrypt, and
manifest verification run in a short-lived dedicated worker, off the main thread. The worker is
created per operation and terminated on completion or failure so passphrase-derived key material does
not outlive the request; only ciphertext, the validated snapshot, or a sanitized error code crosses
the boundary. Wrong passphrase and tampering remain indistinguishable generic `DECRYPTION_FAILED`
failures. The crypto boundary is injected (`BackupEncryptor` / `BackupDecryptor` ports) so the
application use cases stay pure and testable; the in-process functions remain the default.

**Staged, atomic restore.** Restore is: decrypt + validate → verify manifest → stage the snapshot in
a uniquely-named temporary IndexedDB database (proving it is internally consistent and writable) →
quota preflight via `navigator.storage.estimate()` (an estimate is never permission to partially
write) → metadata-only preview + conflict plan → explicit user confirmation → one atomic Dexie
transaction over every affected primary store → staging cleanup. Temporary database names are random
and prefixed; startup cleanup removes only staging databases older than a bounded age and never
touches other databases. App-update activation and IndexedDB migration remain separate operations;
cache deletion is never used as a restore or migration rollback.

**Restore modes.**

- *Restore as new* (default): write the workspace under its original internal IDs; reject if that
  workspace already exists locally.
- *Replace*: after full staging validation, clear the existing workspace's account-scoped records
  and workspace-scoped shared stores, then bulk-write the backup — all in one transaction, so an
  abort leaves the original intact. Requires a typed confirmation and shows what is removed.
- *Merge* (conflict-free only): write only records whose IDs are absent, or that are byte-identical
  to the existing record. Any divergent same-id record is surfaced as a conflict and the merge is
  rejected; conflicts are never resolved by timestamp or overwrite. Supporting only conflict-free
  merges in v1 is an accepted, documented limitation.

The complete canonical inventory is: workspace, accounts, imports, transactions, categories,
merchants, classification rules, transfer decisions, recurring decisions, learning operations,
decision events, transaction operations, and duplicate-resolution events. Rebuildable fingerprints,
projections, caches, and the migration journal are excluded, as are all secrets, retained source
files, model artifacts, logs, prompts, and diagnostics.

## Consequences

### Positive

- A full workspace round-trips across a fresh browser profile, and truncation/tamper/partial-write
  is caught by the authenticated manifest before any restore begins.
- Restore is atomic per mode; an interrupted restore leaves the original workspace intact.
- Heavy cryptography no longer blocks the UI thread, and key material is confined to a short-lived
  worker.
- The section inventory is explicit, so recovery can never silently drop a required Phase 2 store.

### Negative

- The v2 format is not backward compatible with the ADR-007 v1 spike payload; there is intentionally
  no v1 reader. (No v1 production backups exist, so no migration is owed.)
- Merge is limited to conflict-free backups in v1; conflicting merges are rejected rather than
  resolved.
- Replace and restore-as-new hold a single transaction over many stores; very large workspaces are
  bounded by the existing 64 MiB / 250k-transaction envelope pending further device benchmarks.
- Production cryptographic parameters still inherit ADR-007's OWASP-minimum Argon2id profile pending
  an independent review; this ADR does not change them.

## Alternatives considered

- **Keep the manifest as an optional v1.1 section:** rejected. A required, authenticated manifest for
  every backup is the integrity guarantee; making it optional would let an older or crafted payload
  skip verification, and it contradicts ADR-007's "new version on payload-layout change" rule.
- **Maintain a v1 reader for compatibility:** rejected per maintainer direction — no v1 production
  backups exist, so a compatibility path is pure cost and attack surface.
- **Cross-database rename to "promote" the staging database:** rejected. IndexedDB has no atomic
  rename; the temporary database is validation staging only, and the final write is one transaction
  over the primary database.
- **Timestamp/last-writer-wins merge:** rejected. Silent overwrite of divergent financial records is
  unacceptable; conflicts are surfaced and the merge is rejected.
- **Encrypt/decrypt on the main thread:** rejected for production. Argon2id is deliberately slow;
  running it on the UI thread would jank the app and keep key material in the main realm longer.

## Validation

- Manifest tests cover build/verify, count mismatch, digest mismatch (same-count record swap),
  workspace mismatch, and malformed manifests.
- Backup crypto tests cover round-trip, wrong passphrase, modified salt/nonce/header/ciphertext,
  truncation, and unsupported versions, none revealing content.
- Restore repository integration tests (fake-indexeddb) cover restore-as-new into a fresh database,
  restore-as-new collision rejection, atomic replace, wrong-passphrase safety, and bounded
  abandoned-staging cleanup that preserves unrelated databases.
- Restore use-case tests cover metadata-only planning, generic decryption failure, mode-precondition
  rejection (exists/missing), conflict-free merge, and conflicting-merge rejection without apply.
- Restore UI tests cover the metadata-only plan, typed replace confirmation, conflicting-merge
  blocking, and wrong-passphrase messaging.
- Chromium/Firefox/WebKit Playwright flows exercise backup + fresh-profile restore under the local
  network guard.

## Related decisions

- [ADR-007](ADR-007-Encrypted-Workspace-Backup.md)
- [ADR-001](ADR-001-Offline-First.md)
- [ADR-002](ADR-002-Why-IndexedDB.md)
- [ADR-008](ADR-008-Atomic-Operation-Journals-And-Revision-Snapshots.md)
- [ADR-014](ADR-014-PWA-Update-And-Cache-Lifecycle.md)
- [Security and privacy](../12-SECURITY-AND-PRIVACY.md)
- [Encrypted backup spike](../19-ENCRYPTED-BACKUP-SPIKE.md)
