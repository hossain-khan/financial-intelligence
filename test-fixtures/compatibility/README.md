# Compatibility fixtures

Immutable, synthetic artifacts captured from a released producer, used to prove that stored data,
Financial Brains, and backups remain recoverable across supported version changes (issue #30,
[ADR-017](../../docs/adr/ADR-017-Compatibility-And-Recovery.md)).

## Rules

- **Immutable once committed.** A fixture's bytes and its expected SHA-256 digest never change. The
  `compatibility-fixtures.test.ts` suite fails if a committed fixture's digest drifts.
- **New version ⇒ new directory.** A breaking format change adds
  `<artifact>/<new-version>/` with fresh bytes; it never edits an existing version's files. The
  prior version's reader fixture must exist before the new writer merges.
- **Synthetic only.** No real financial data, account labels, or production secrets. Passphrases are
  test-only references committed alongside their fixtures deliberately (these back up nothing real).
- **Do not regenerate old fixtures with the current serializer** — that would only test the current
  version against itself. Capture bytes from the producer at release time.

## Layout

```
compatibility/
  digests.json                     # expected SHA-256 of every committed fixture (immutability lock)
  canonical/                       # portable domain documents (transaction/import 1.0.0)
  financial-brain/v1.0.0/          # Financial Brain export
  encrypted-backup/v1.0.0/         # encrypted workspace backup (v2 snapshot) + test passphrase
```

IndexedDB schema fixtures are produced in-process from the immutable `VERSION_ONE_MIGRATION`
definition and `DATABASE_MIGRATIONS.slice(0, n)` (see `packages/storage-indexeddb`), so they are
code-defined rather than committed binary databases.
