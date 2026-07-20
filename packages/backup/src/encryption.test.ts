import { describe, expect, it } from "vitest";

import {
  EncryptedBackupError,
  encryptWorkspaceBackup,
  previewEncryptedWorkspaceBackup,
} from "./encryption";
import {
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_VERSION,
  parseSnapshot,
  serializeSnapshot,
  type WorkspaceBackupSnapshot,
} from "./snapshot";

const PASSPHRASE = "correct horse battery staple";

describe("encrypted workspace backups", () => {
  it("round trips a snapshot and returns metadata only", async () => {
    const encrypted = await encryptWorkspaceBackup(snapshot(), PASSPHRASE);

    await expect(previewEncryptedWorkspaceBackup(encrypted, PASSPHRASE)).resolves.toEqual({
      workspaceName: "Family budget",
      exportedAt: "2026-07-20T12:00:00.000Z",
      revision: 4,
      counts: {
        accounts: 0,
        imports: 0,
        transactions: 0,
        categories: 0,
        merchants: 0,
        classificationRules: 0,
        transferDecisions: 0,
        recurringDecisions: 0,
        learningOperations: 0,
        decisionEvents: 0,
        transactionOperations: 0,
        duplicateResolutionEvents: 0,
      },
    });
    expect(encrypted).not.toContain("Family budget");
  }, 20_000);

  it.each([
    ["wrong password", (value: Container) => value, "definitely the wrong password"],
    [
      "salt",
      (value: Container) => ({ ...value, kdf: { ...value.kdf, salt: flip(value.kdf.salt) } }),
      PASSPHRASE,
    ],
    [
      "nonce",
      (value: Container) => ({
        ...value,
        cipher: { ...value.cipher, nonce: flip(value.cipher.nonce) },
      }),
      PASSPHRASE,
    ],
    [
      "ciphertext or tag",
      (value: Container) => ({ ...value, ciphertext: flip(value.ciphertext) }),
      PASSPHRASE,
    ],
    [
      "authenticated header",
      (value: Container) => ({ ...value, createdAt: "2026-07-21T00:00:00.000Z" }),
      PASSPHRASE,
    ],
  ])(
    "rejects a modified %s without revealing content",
    async (_name, mutate, passphrase) => {
      const encrypted = await encryptWorkspaceBackup(snapshot(), PASSPHRASE);
      const changed = JSON.stringify(mutate(JSON.parse(encrypted) as Container));

      const failure = await previewEncryptedWorkspaceBackup(changed, passphrase).catch(
        (error: unknown) => error,
      );
      expect(failure).toBeInstanceOf(EncryptedBackupError);
      expect((failure as EncryptedBackupError).code).toBe("DECRYPTION_FAILED");
      expect(String(failure)).not.toContain("Family budget");
    },
    20_000,
  );

  it("rejects truncation and unsupported container versions before decryption", async () => {
    const encrypted = await encryptWorkspaceBackup(snapshot(), PASSPHRASE);
    await expect(
      previewEncryptedWorkspaceBackup(encrypted.slice(0, -10), PASSPHRASE),
    ).rejects.toMatchObject({
      code: "INVALID_CONTAINER",
    });
    const unsupported = { ...(JSON.parse(encrypted) as Container), version: "2.0.0" };
    await expect(
      previewEncryptedWorkspaceBackup(JSON.stringify(unsupported), PASSPHRASE),
    ).rejects.toMatchObject({
      code: "UNSUPPORTED_VERSION",
    });
  }, 20_000);
});

describe("workspace snapshot validation", () => {
  it("round trips valid UTF-8 JSON", () => {
    expect(parseSnapshot(serializeSnapshot(snapshot()))).toEqual(snapshot());
  });

  it("rejects an unsupported payload version", () => {
    const value = { ...snapshot(), version: "2.0.0" };
    expect(() => parseSnapshot(new TextEncoder().encode(JSON.stringify(value)))).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_VERSION" }),
    );
  });
});

interface Container {
  readonly version: string;
  readonly createdAt: string;
  readonly kdf: { readonly salt: string };
  readonly cipher: { readonly nonce: string };
  readonly ciphertext: string;
}

function flip(value: string): string {
  return `${value[0] === "A" ? "B" : "A"}${value.slice(1)}`;
}

function snapshot(): WorkspaceBackupSnapshot {
  return {
    format: WORKSPACE_BACKUP_FORMAT,
    version: WORKSPACE_BACKUP_VERSION,
    exportedAt: "2026-07-20T12:00:00.000Z",
    databaseVersion: 5,
    workspace: {
      id: "019829f0-4da4-7ae0-8a9c-383af22d7da1" as never,
      name: "Family budget",
      schemaVersion: 1,
      revision: 4,
      createdAt: "2026-07-01T00:00:00.000Z" as never,
      updatedAt: "2026-07-20T00:00:00.000Z" as never,
    },
    accounts: [],
    imports: [],
    transactions: [],
    categories: [],
    merchants: [],
    classificationRules: [],
    transferDecisions: [],
    recurringDecisions: [],
    transactionOperations: [],
    duplicateResolutionEvents: [],
  };
}
