# ADR-017: Compatibility registry, immutable fixtures, and disaster-recovery drills

- Status: Accepted
- Date: 2026-07-21
- Decision owners: Project maintainers

## Context

By the close of Phase 3 the app produces many independently-versioned portable artifacts: the
IndexedDB schema (v9), canonical documents (transaction/import/rule `1.0.0`, workspace `1`), the
Financial Brain export (`1.0.0`), the encrypted-backup container (`1.0.0`) and its manifest-bearing
workspace-backup snapshot (`2.0.0`), parser/normalizer versions, and the app-shell/cache build. Each
migration and format already fails closed on an unknown version, and the storage layer has strong
migration/journal tests — but there was **no single source of truth binding these versions, no
immutable corpus of released bytes to test against, and no automated cross-format recovery drill**.
Issue #30 (the Phase 3 closer) makes recoverability across supported version changes provable, per
NFR-030..034 and NFR-070..072.

## Decision

Add a machine-readable **compatibility registry**, an **immutable released-fixture corpus**, a
**migration/portable-format fault matrix**, and **fresh-profile recovery drills**, with a CI split
between per-PR blocking checks and a scheduled full matrix.

**Compatibility registry** (`packages/qualification/src/compatibility-registry.ts`) is pure data:
one entry per versioned axis recording current version, readable/writable version windows,
lossless flag, downgrade policy, unsupported-version recovery guidance, the fixture that proves it,
and a removal milestone. A **drift test** imports the live version constant from each producing
package and fails if it diverges from the registry — so a version bump cannot merge without updating
the registry, and a breaking bump must add the prior version's reader fixture first. Unknown future
major versions fail closed everywhere; compatible minor extensions follow a documented
preserve-and-ignore policy and never gain execution capability.

**Immutable fixtures** live under `test-fixtures/compatibility/<artifact>/<version>/` with synthetic,
no-real-data documents captured from the released producer: canonical transaction/import documents,
a Financial Brain export, and an encrypted workspace backup (v2 snapshot) with a committed test-only
passphrase. A `digests.json` manifest locks every fixture's SHA-256; a test fails if any committed
byte drifts. Fixtures are regenerated only by an explicit gated builder (`GENERATE_FIXTURES=1`) and a
new format version adds a new directory — an existing version's bytes are never rewritten. IndexedDB
schema fixtures are code-defined (the immutable `VERSION_ONE_MIGRATION` plus
`DATABASE_MIGRATIONS.slice(0, n)`) rather than committed binary databases.

**Fault matrix** (unit): every supported IndexedDB version upgrades to current losslessly and
idempotently; a mid-upgrade failure aborts to the prior valid state; a too-new database fails closed
(`VERSION_INCOMPATIBLE`) without data loss; the frozen backup decrypts, and rejects wrong-passphrase,
tampered, future-major, and missing-required-section variants; the Financial Brain round-trips and
rejects a future major. Every assertion checks **old-valid-or-new-valid, never a mixture**.

**Recovery drills** (Playwright, fresh profiles): restore a supported backup as a new workspace and
reconcile its preview; and prove a too-new/unopenable database shows the recovery screen (retry +
diagnostic export) without clearing or looping. Evidence attachments carry no descriptions, amounts,
or passphrases.

**Downgrade policy is export-based.** Preserve and read old data long enough to export/backup, but an
older app is not promised the ability to open a newer IndexedDB database. This is stated in the
registry, the compatibility guide, and the recovery UI.

**CI tiers.** Registry-integrity, the immutable-fixture digest lock, and the current+previous
migration/backup/Brain paths run on **every PR** (in the `verify` job, blocking). The full
historical version matrix and the fresh-profile recovery drills run on a **scheduled** workflow.
Missing a supported fixture or a registry link is a CI failure.

## Consequences

### Positive

- One authoritative, drift-checked registry ties every portable version together; a silent version
  bump can no longer slip through.
- Released bytes are frozen and integrity-locked, so migrations and readers are tested against real
  prior output rather than freshly-seeded current data.
- Atomicity and fail-closed behavior are proven across DB, backup, and Brain formats and surfaced to
  the user through the existing recovery screen.

### Negative

- At Phase 3 close every format is at its first released version (workspace-backup at v2 with no v1
  reader by ADR-015), so the fixtures are baselines; the first true cross-version upgrade will be
  exercised when a second version ships.
- The compatibility registry is hand-maintained data; the drift test guards the version numbers but
  the policy fields (downgrade, recovery guidance) still require reviewer diligence.
- The qualification package gains dev-dependencies on the producer packages so the drift test can
  import their live constants.

## Alternatives considered

- **Scatter version checks and rely on each package's own tests:** rejected — there was no
  cross-format source of truth and no guard against a bump landing without a fixture.
- **Synthesize a fake "legacy" version to exercise an upgrade now:** rejected — it would test the app
  against a format that was never released, which the issue explicitly warns against.
- **Commit binary IndexedDB databases as fixtures:** rejected — the migration-slice technique
  materialises any historical schema deterministically from the immutable registry without opaque
  binary blobs.
- **Blocking the full historical/recovery matrix on every PR:** rejected — kept to a scheduled tier
  to bound PR time; the high-signal current+previous paths and integrity checks block per PR.

## Validation

- Registry drift test asserts every `currentVersion` equals the live constant (DB 9, Brain 1.0.0,
  backup container 1.0.0 / snapshot 2.0.0 / manifest 1.0.0, mapping/merchant normalizers 1.0.0, OFX
  parser, perf-result 1.0.0) and its own structural integrity.
- Immutable-fixture test validates each committed fixture under the current reader, decrypts the
  backup with its committed passphrase, and locks every file's SHA-256 against `digests.json`.
- Version-matrix test upgrades every supported DB version to current (lossless, idempotent), aborts a
  mid-upgrade failure to the prior state, and fails closed on a too-new database.
- Backup/Brain compatibility drills reject wrong-passphrase, tampered, future-major, and
  missing-required-section variants.
- Playwright recovery drills restore a supported backup on a fresh profile and show recovery
  guidance for an unopenable database, under the local network guard.

## Related decisions

- [ADR-002](ADR-002-Why-IndexedDB.md)
- [ADR-008](ADR-008-Atomic-Operation-Journals-And-Revision-Snapshots.md)
- [ADR-014](ADR-014-PWA-Update-And-Cache-Lifecycle.md)
- [ADR-015](ADR-015-Production-Encrypted-Backup-Restore.md)
- [ADR-016](ADR-016-Qualification-Matrix.md)
- [Compatibility and recovery](../23-COMPATIBILITY-AND-RECOVERY.md)
- [Data model](../09-DATA-MODEL.md)
