import { describe, expect, it } from "vitest";
import { parseUtcTimestamp, parseWorkspaceId } from "@financial-intelligence/domain";

import {
  BACKUP_MANIFEST_VERSION,
  ManifestValidationError,
  REQUIRED_SECTIONS,
  buildManifest,
  canonicalJson,
  verifyManifest,
  webCryptoDigest,
} from "./manifest";
import {
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_VERSION,
  type WorkspaceBackupSnapshot,
} from "./snapshot";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const digest = (bytes: Uint8Array) => webCryptoDigest(bytes, crypto);

function snapshot(): WorkspaceBackupSnapshot {
  return {
    format: WORKSPACE_BACKUP_FORMAT,
    version: WORKSPACE_BACKUP_VERSION,
    exportedAt: NOW,
    databaseVersion: 8,
    workspace: {
      id: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda999"),
      name: "Manifest Workspace",
      schemaVersion: 1,
      revision: 3,
      createdAt: NOW,
      updatedAt: NOW,
    },
    accounts: [
      {
        id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda001" as never,
        workspaceId: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda999"),
        name: "A",
        type: "checking",
        currency: "CAD",
        archived: false,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ],
    imports: [],
    transactions: [],
    categories: [],
    merchants: [],
    classificationRules: [],
    transferDecisions: [],
    recurringDecisions: [],
    transactionOperations: [],
    duplicateResolutionEvents: [],
    manifest: undefined,
  };
}

describe("canonicalJson", () => {
  it("is stable under key reordering", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it("preserves array order", () => {
    expect(canonicalJson([1, 2, 3])).not.toBe(canonicalJson([3, 2, 1]));
  });
});

describe("buildManifest + verifyManifest", () => {
  it("builds a manifest that inventories every section and verifies against its snapshot", async () => {
    const snap = snapshot();
    const manifest = await buildManifest(snap, { buildId: "build-x" }, digest);
    expect(manifest.manifestVersion).toBe(BACKUP_MANIFEST_VERSION);
    expect(manifest.workspaceId).toBe(snap.workspace.id);
    expect(manifest.sections.accounts.recordCount).toBe(1);
    expect(manifest.sections.transactions.recordCount).toBe(0);
    for (const section of REQUIRED_SECTIONS) {
      expect(manifest.sections[section].required).toBe(true);
    }
    await expect(verifyManifest(manifest, { ...snap, manifest }, digest)).resolves.toEqual(
      manifest,
    );
  });

  it("rejects a count mismatch", async () => {
    const snap = snapshot();
    const manifest = await buildManifest(snap, { buildId: "build-x" }, digest);
    const tampered = { ...snap, accounts: [] };
    await expect(verifyManifest(manifest, tampered, digest)).rejects.toMatchObject({
      code: "COUNT_MISMATCH",
    });
  });

  it("rejects a digest mismatch when a record is swapped without changing the count", async () => {
    const snap = snapshot();
    const manifest = await buildManifest(snap, { buildId: "build-x" }, digest);
    const tampered = {
      ...snap,
      accounts: [{ ...snap.accounts[0]!, name: "Renamed" }],
    };
    await expect(verifyManifest(manifest, tampered, digest)).rejects.toMatchObject({
      code: "DIGEST_MISMATCH",
    });
  });

  it("rejects a manifest describing a different workspace", async () => {
    const snap = snapshot();
    const manifest = await buildManifest(snap, { buildId: "build-x" }, digest);
    const otherWorkspace = {
      ...snap,
      workspace: { ...snap.workspace, revision: 99 },
    };
    await expect(verifyManifest(manifest, otherWorkspace, digest)).rejects.toMatchObject({
      code: "WORKSPACE_MISMATCH",
    });
  });

  it("rejects a malformed manifest", async () => {
    await expect(verifyManifest({ nope: true }, snapshot(), digest)).rejects.toBeInstanceOf(
      ManifestValidationError,
    );
  });
});
