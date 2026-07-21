# Compatibility and Recovery

## Purpose

Define the forward/backward compatibility policy for every portable format and the reproducible
disaster-recovery drills that prove stored data, Financial Brains, and backups remain recoverable
across supported version changes (issue #30, [ADR-017](adr/ADR-017-Compatibility-And-Recovery.md)).
The machine-readable source of truth is `packages/qualification/src/compatibility-registry.ts`; this
document is its human-readable companion.

## Compatibility policy

- **Fail closed on unknown versions.** Any artifact whose version is newer/unknown is rejected, not
  guessed. The user is guided to export/upgrade from the newer app.
- **Preserve and ignore compatible minor extensions.** Unknown optional fields on an otherwise-valid
  document are preserved or ignored and never gain execution capability.
- **Downgrade is export-based.** Old data is read long enough to export or back up, but an older app
  is not promised the ability to open a newer IndexedDB database.
- **Released fixtures are immutable.** Once committed under `test-fixtures/compatibility/`, a
  fixture's bytes and digest never change; a new version adds a new directory. A breaking version
  must ship its prior-version reader fixture before its writer merges.

## Version matrix

| Axis | Current | Readable | Downgrade | Unsupported-version recovery |
| --- | --- | --- | --- | --- |
| IndexedDB schema | 9 | 1–9 | export-only | Too-new DB fails closed (VERSION_INCOMPATIBLE); export from the newer app |
| Canonical transaction | 1.0.0 | 1.0.0 | preserve/ignore | Unknown schemaVersion rejected |
| Canonical import | 1.0.0 | 1.0.0 | preserve/ignore | Unknown schemaVersion rejected |
| Classification rule | 1.0.0 | 1.0.0 | preserve/ignore | Unknown schemaVersion rejected |
| Workspace | 1 | 1 | preserve/ignore | Unknown schemaVersion rejected |
| Financial Brain | 1.0.0 | 1.0.0 | preserve/ignore | Future-major rejected at preview |
| Encrypted-backup container | 1.0.0 | 1.0.0 | export-only | Unknown container version fails closed |
| Workspace-backup snapshot | 2.0.0 | 2.0.0 | export-only | Non-2.x fails closed; no v1 reader (ADR-015) |
| Backup manifest | 1.0.0 | 1.0.0 | export-only | Unknown/malformed manifest fails the backup |
| CSV/OFX/PDF parser | 1.0.0 | 1.0.0 | preserve/ignore | Version recorded in provenance for explainability |
| Mapping / merchant normalizer | 1.0.0 | 1.0.0 | preserve/ignore | Version stamped into provenance |
| Perf result | 1.0.0 | 1.0.0 | n/a | Unknown version rejected; regenerate |

At Phase 3 close every format is at its first released version except the workspace-backup snapshot
(v2, manifest-bearing). The registry drift test fails if any of these numbers diverges from the live
constant, forcing this table and the fixtures to stay in step.

## Disaster-recovery playbooks

### If the app cannot open your local data

The app shows a recovery screen — it never clears your data. Options:

1. **Try again** — transient failures (a second tab mid-upgrade, a stale connection) often clear on
   retry.
2. **Close other tabs** of the app and retry — an uncoordinated tab can block an upgrade.
3. **Export a diagnostic** — contains only an error code, build id, and browser version (never your
   financial data) to attach to a bug report.
4. **Restore from a backup** once the app opens, if the database cannot be recovered.

### If a backup or Brain is from a newer app

It fails closed with an unsupported-version message. Open it in the newer app and export a
compatible version, or upgrade this app.

### Restoring a backup

Restore verifies and validates in a temporary space, shows a metadata-only preview, and applies
atomically (restore-as-new, replace, or conflict-free merge). An interrupted restore leaves your
existing workspace intact. Keep the original until the restored workspace is verified.

## Automated drills

- **Per-PR (blocking):** registry-integrity + drift, immutable-fixture digest lock, and
  current+previous migration/backup/Brain paths (unit; part of `pnpm test:coverage`).
- **Scheduled (full matrix):** every historical IndexedDB version → current, fault injection at
  durable checkpoints, and fresh-profile Playwright recovery drills across Chromium/Firefox/WebKit.
- **Manual (release):** supported-device recovery drill recorded in release evidence.

Recovery-drill evidence never contains transaction descriptions, labels, amounts, passphrases, or
plaintext backup data.

## Related documents

- [ADR-017](adr/ADR-017-Compatibility-And-Recovery.md)
- [Data model](09-DATA-MODEL.md)
- [Encrypted backup](adr/ADR-015-Production-Encrypted-Backup-Restore.md)
- [PWA update and recovery](adr/ADR-014-PWA-Update-And-Cache-Lifecycle.md)
- [Non-functional requirements](06-NON-FUNCTIONAL-REQUIREMENTS.md)
