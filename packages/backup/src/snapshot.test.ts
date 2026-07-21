import { describe, expect, it } from "vitest";
import { parseUtcTimestamp, parseWorkspaceId } from "@financial-intelligence/domain";
import {
  BackupValidationError,
  buildSnapshotWithManifest,
  parseSnapshot,
  serializeSnapshot,
  verifySnapshotManifest,
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_VERSION,
  type WorkspaceBackupSnapshot,
} from "./snapshot";
import { webCryptoDigest } from "./manifest";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const digest = (bytes: Uint8Array) => webCryptoDigest(bytes, crypto);

const baseSnapshot = {
  format: WORKSPACE_BACKUP_FORMAT as typeof WORKSPACE_BACKUP_FORMAT,
  version: WORKSPACE_BACKUP_VERSION as typeof WORKSPACE_BACKUP_VERSION,
  exportedAt: NOW,
  databaseVersion: 8,
  workspace: {
    id: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda999"),
    name: "Valid Workspace",
    schemaVersion: 1 as const,
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
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

async function validSnapshot(): Promise<WorkspaceBackupSnapshot> {
  return buildSnapshotWithManifest(baseSnapshot, { buildId: "test" }, digest);
}

function toUint8Array(json: string): Uint8Array {
  return new TextEncoder().encode(json);
}

describe("WorkspaceBackupSnapshot serialization & validation", () => {
  it("serializes and deserializes a valid v2 snapshot with a manifest", async () => {
    const snapshot = await validSnapshot();
    const bytes = serializeSnapshot(snapshot);
    const restored = parseSnapshot(bytes);
    expect(restored.workspace.name).toBe("Valid Workspace");
    await expect(verifySnapshotManifest(restored, digest)).resolves.toBeUndefined();
  });

  it("rejects a snapshot with no manifest", async () => {
    const withoutManifest = JSON.stringify({ ...baseSnapshot, manifest: undefined });
    expect(() => parseSnapshot(toUint8Array(withoutManifest))).toThrow(BackupValidationError);
  });

  it("detects a tampered section whose digest no longer matches the manifest", async () => {
    const snapshot = await validSnapshot();
    const tampered = {
      ...snapshot,
      merchants: [{ id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda001", name: "Injected" }],
    } as unknown as WorkspaceBackupSnapshot;
    await expect(verifySnapshotManifest(tampered, digest)).rejects.toThrow();
  });

  it("rejects a present but invalid Phase 2 collection", async () => {
    const snapshot = await validSnapshot();
    const invalid = JSON.stringify({ ...snapshot, merchants: "not-an-array" });
    expect(() => parseSnapshot(toUint8Array(invalid))).toThrow(BackupValidationError);
  });

  it("throws BackupValidationError on invalid format or payload", async () => {
    const snapshot = await validSnapshot();
    expect(() => parseSnapshot(toUint8Array("null"))).toThrow(BackupValidationError);
    expect(() => parseSnapshot(toUint8Array("{}"))).toThrow(BackupValidationError);

    const wrongFormat = JSON.stringify({ ...snapshot, format: "invalid-format" });
    expect(() => parseSnapshot(toUint8Array(wrongFormat))).toThrow(BackupValidationError);

    const wrongVersion = JSON.stringify({ ...snapshot, version: "99.0.0" });
    expect(() => parseSnapshot(toUint8Array(wrongVersion))).toThrow(BackupValidationError);
  });

  it("throws BackupValidationError on invalid dates or names", async () => {
    const snapshot = await validSnapshot();
    const badDate = JSON.stringify({ ...snapshot, exportedAt: "not-a-date" });
    expect(() => parseSnapshot(toUint8Array(badDate))).toThrow(BackupValidationError);

    const emptyName = JSON.stringify({
      ...snapshot,
      workspace: { ...snapshot.workspace, name: "" },
    });
    expect(() => parseSnapshot(toUint8Array(emptyName))).toThrow(BackupValidationError);
  });
});
