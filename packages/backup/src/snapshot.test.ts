import { describe, expect, it } from "vitest";
import { parseUtcTimestamp, parseWorkspaceId } from "@financial-intelligence/domain";
import {
  BackupValidationError,
  parseSnapshot,
  serializeSnapshot,
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_VERSION,
  type WorkspaceBackupSnapshot,
} from "./snapshot";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");

const validSnapshot: WorkspaceBackupSnapshot = {
  format: WORKSPACE_BACKUP_FORMAT,
  version: WORKSPACE_BACKUP_VERSION,
  exportedAt: NOW,
  databaseVersion: 8,
  workspace: {
    id: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda999"),
    name: "Valid Workspace",
    schemaVersion: 1,
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

function toUint8Array(json: string): Uint8Array {
  return new TextEncoder().encode(json);
}

describe("WorkspaceBackupSnapshot serialization & validation", () => {
  it("serializes and deserializes a valid snapshot", () => {
    const bytes = serializeSnapshot(validSnapshot);
    const restored = parseSnapshot(bytes);
    expect(restored.workspace.name).toBe("Valid Workspace");
  });

  it("reads pre-Phase-2 snapshots by defaulting additive knowledge stores", () => {
    const legacy = { ...validSnapshot } as Record<string, unknown>;
    delete legacy.merchants;
    delete legacy.classificationRules;
    delete legacy.transferDecisions;
    delete legacy.recurringDecisions;
    const restored = parseSnapshot(toUint8Array(JSON.stringify(legacy)));
    expect(restored).toMatchObject({
      merchants: [],
      classificationRules: [],
      transferDecisions: [],
      recurringDecisions: [],
    });
  });

  it("rejects a present but invalid Phase 2 collection", () => {
    const invalid = JSON.stringify({ ...validSnapshot, merchants: "not-an-array" });

    expect(() => parseSnapshot(toUint8Array(invalid))).toThrow(BackupValidationError);
  });

  it("throws BackupValidationError on invalid format or payload", () => {
    expect(() => parseSnapshot(toUint8Array("null"))).toThrow(BackupValidationError);
    expect(() => parseSnapshot(toUint8Array("{}"))).toThrow(BackupValidationError);

    const wrongFormat = JSON.stringify({ ...validSnapshot, format: "invalid-format" });
    expect(() => parseSnapshot(toUint8Array(wrongFormat))).toThrow(BackupValidationError);

    const wrongVersion = JSON.stringify({ ...validSnapshot, version: "99.0.0" });
    expect(() => parseSnapshot(toUint8Array(wrongVersion))).toThrow(BackupValidationError);
  });

  it("throws BackupValidationError on invalid dates or names", () => {
    const badDate = JSON.stringify({ ...validSnapshot, exportedAt: "not-a-date" });
    expect(() => parseSnapshot(toUint8Array(badDate))).toThrow(BackupValidationError);

    const emptyName = JSON.stringify({
      ...validSnapshot,
      workspace: { ...validSnapshot.workspace, name: "" },
    });
    expect(() => parseSnapshot(toUint8Array(emptyName))).toThrow(BackupValidationError);
  });
});
