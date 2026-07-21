import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  EncryptedBackupError,
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_VERSION,
  buildSnapshotWithManifest,
  decryptWorkspaceBackup,
  encryptWorkspaceBackup,
  parseSnapshot,
  webCryptoDigest,
} from "@financial-intelligence/backup";
import {
  importToCanonical,
  parseAndValidateFinancialBrain,
  transactionFromCanonical,
  transactionToCanonical,
} from "@financial-intelligence/domain";
import {
  validateFinancialBrain,
  validateImport,
  validateTransaction,
} from "@financial-intelligence/schemas";
import { afterAll, describe, expect, it } from "vitest";

import {
  FIXTURE_PASSPHRASE,
  fixtureAccount,
  fixtureBrainJson,
  fixtureImport,
  fixtureImportJson,
  fixtureTransaction,
  fixtureTransactionJson,
  fixtureWorkspace,
} from "./fixture-builders";

const ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "test-fixtures",
  "compatibility",
);
const GENERATE = process.env.GENERATE_FIXTURES === "1";
const digest = (value: string | Uint8Array) =>
  createHash("sha256")
    .update(typeof value === "string" ? value : Buffer.from(value))
    .digest("hex");

const generated: Record<string, string> = {};

async function fixture(
  relativePath: string,
  produce: () => Promise<string> | string,
): Promise<string> {
  if (GENERATE) {
    const content = await produce();
    const full = join(ROOT, relativePath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, content);
    generated[relativePath] = digest(content);
    return content;
  }
  return readFile(join(ROOT, relativePath), "utf8");
}

/** Deterministically rebuild the encrypted backup fixture bytes (used only in GENERATE mode). */
async function buildBackupContainer(): Promise<string> {
  const snapshot = await buildSnapshotWithManifest(
    {
      format: WORKSPACE_BACKUP_FORMAT,
      version: WORKSPACE_BACKUP_VERSION,
      exportedAt: "2026-01-02T00:00:00.000Z",
      databaseVersion: 9,
      workspace: fixtureWorkspace(),
      accounts: [fixtureAccount()],
      imports: [importToCanonical(fixtureImport())],
      transactions: [transactionToCanonical(fixtureTransaction())],
      categories: [],
      merchants: [],
      classificationRules: [],
      transferDecisions: [],
      recurringDecisions: [],
      transactionOperations: [],
      duplicateResolutionEvents: [],
    },
    { buildId: "fixture" },
    (bytes) => webCryptoDigest(bytes, crypto),
  );
  return encryptWorkspaceBackup(snapshot, FIXTURE_PASSPHRASE, { buildId: "fixture" });
}

afterAll(async () => {
  if (!GENERATE) return;
  await writeFile(
    join(ROOT, "digests.json"),
    `${JSON.stringify(Object.fromEntries(Object.entries(generated).sort()), null, 2)}\n`,
  );
});

describe("compatibility fixtures", () => {
  it("canonical transaction fixture reads under the current schema", async () => {
    const content = await fixture("canonical/transaction-1.0.0.json", fixtureTransactionJson);
    const document = JSON.parse(content);
    expect(validateTransaction(document)).toEqual({ valid: true, errors: [] });
    // Round-trips through the domain reader without loss.
    expect(transactionToCanonical(transactionFromCanonical(document))).toEqual(document);
  });

  it("canonical import fixture reads under the current schema", async () => {
    const content = await fixture("canonical/import-1.0.0.json", fixtureImportJson);
    expect(validateImport(JSON.parse(content))).toEqual({ valid: true, errors: [] });
  });

  it("financial-brain v1.0.0 fixture validates and parses", async () => {
    const content = await fixture(
      "financial-brain/v1.0.0/brain.financial-brain.json",
      fixtureBrainJson,
    );
    expect(validateFinancialBrain(JSON.parse(content)).valid).toBe(true);
    expect(() => parseAndValidateFinancialBrain(content, validateFinancialBrain)).not.toThrow();
  });

  it("rejects a future-major Financial Brain, keeping the export/upgrade path clear", async () => {
    const content = await readFile(
      join(ROOT, "financial-brain/v1.0.0/brain.financial-brain.json"),
      "utf8",
    );
    const future = JSON.stringify({ ...JSON.parse(content), schemaVersion: "2.0.0" });
    expect(validateFinancialBrain(JSON.parse(future)).valid).toBe(false);
    expect(() => parseAndValidateFinancialBrain(future, validateFinancialBrain)).toThrow();
  });

  it("encrypted-backup v1.0.0 fixture decrypts with its committed passphrase", async () => {
    const container = await fixture(
      "encrypted-backup/v1.0.0/workspace.fintbackup",
      buildBackupContainer,
    );
    const passphrase = (
      await fixture("encrypted-backup/v1.0.0/passphrase.txt", () => `${FIXTURE_PASSPHRASE}\n`)
    ).trim();
    const snapshot = await decryptWorkspaceBackup(container, passphrase);
    expect(snapshot.version).toBe(WORKSPACE_BACKUP_VERSION);
    expect(snapshot.accounts).toHaveLength(1);
    expect(snapshot.transactions).toHaveLength(1);
    // Re-parse proves the committed bytes are a structurally valid v2 snapshot payload.
    expect(() => parseSnapshot(new TextEncoder().encode(JSON.stringify(snapshot)))).not.toThrow();
  });

  it("rejects the frozen container under a wrong passphrase without revealing content", async () => {
    const container = await fixture(
      "encrypted-backup/v1.0.0/workspace.fintbackup",
      buildBackupContainer,
    );
    const failure = await decryptWorkspaceBackup(container, "the wrong passphrase").catch(
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(EncryptedBackupError);
    expect((failure as EncryptedBackupError).code).toBe("DECRYPTION_FAILED");
    expect(String(failure)).not.toContain("Fixture");
  });

  it("rejects a tampered or future-major container", async () => {
    const container = await fixture(
      "encrypted-backup/v1.0.0/workspace.fintbackup",
      buildBackupContainer,
    );
    const passphrase = (
      await fixture("encrypted-backup/v1.0.0/passphrase.txt", () => `${FIXTURE_PASSPHRASE}\n`)
    ).trim();
    const parsed = JSON.parse(container) as { ciphertext: string };
    const tampered = JSON.stringify({
      ...parsed,
      ciphertext: `${parsed.ciphertext[0] === "A" ? "B" : "A"}${parsed.ciphertext.slice(1)}`,
    });
    await expect(decryptWorkspaceBackup(tampered, passphrase)).rejects.toMatchObject({
      code: "DECRYPTION_FAILED",
    });
    const future = JSON.stringify({ ...(parsed as Record<string, unknown>), version: "9.0.0" });
    await expect(decryptWorkspaceBackup(future, passphrase)).rejects.toMatchObject({
      code: "UNSUPPORTED_VERSION",
    });
  });

  it("fails closed when a restored snapshot drops a required section", async () => {
    const container = await fixture(
      "encrypted-backup/v1.0.0/workspace.fintbackup",
      buildBackupContainer,
    );
    const passphrase = (
      await fixture("encrypted-backup/v1.0.0/passphrase.txt", () => `${FIXTURE_PASSPHRASE}\n`)
    ).trim();
    const snapshot = await decryptWorkspaceBackup(container, passphrase);
    const broken = { ...snapshot } as Record<string, unknown>;
    delete broken.accounts;
    expect(() => parseSnapshot(new TextEncoder().encode(JSON.stringify(broken)))).toThrow();
  });

  it("every committed fixture matches its frozen digest (immutability lock)", async () => {
    if (GENERATE) return; // In generate mode the digests file is being (re)written.
    const manifest = JSON.parse(await readFile(join(ROOT, "digests.json"), "utf8")) as Record<
      string,
      string
    >;
    expect(Object.keys(manifest).length).toBeGreaterThan(0);
    for (const [relativePath, expected] of Object.entries(manifest)) {
      const content = await readFile(join(ROOT, relativePath));
      expect(digest(content), `${relativePath} digest drifted`).toBe(expected);
    }
  });
});
