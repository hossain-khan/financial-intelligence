import { describe, expect, it } from "vitest";

import { encryptWorkspaceBackup } from "./encryption";
import {
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_VERSION,
  type WorkspaceBackupSnapshot,
} from "./snapshot";

describe("encrypted backup browser-spike bounds", () => {
  it("records bounded synthetic small, typical, and large timings", async () => {
    const measurements: {
      records: number;
      plaintextBytes: number;
      encryptedBytes: number;
      milliseconds: number;
    }[] = [];
    for (const records of [1, 1_000, 10_000]) {
      const sample = syntheticSnapshot(records);
      const plaintextBytes = new TextEncoder().encode(JSON.stringify(sample)).byteLength;
      const started = performance.now();
      const encrypted = await encryptWorkspaceBackup(sample, "synthetic benchmark passphrase");
      measurements.push({
        records,
        plaintextBytes,
        encryptedBytes: new TextEncoder().encode(encrypted).byteLength,
        milliseconds: Math.round(performance.now() - started),
      });
    }
    console.table(measurements);
    expect(measurements[2]!.encryptedBytes).toBeLessThan(64 * 1024 * 1024);
    expect(measurements.every((measurement) => measurement.milliseconds < 15_000)).toBe(true);
  }, 45_000);
});

function syntheticSnapshot(count: number): Omit<WorkspaceBackupSnapshot, "manifest"> {
  const timestamp = "2026-07-20T12:00:00.000Z";
  const workspaceId = "019829f0-4da4-7ae0-8a9c-383af22d7da1" as never;
  const accountId = "019829f0-4da4-7ae0-8a9c-383af22d7db1" as never;
  const importId = "019829f0-4da4-7ae0-8a9c-383af22d7dc1";
  return {
    format: WORKSPACE_BACKUP_FORMAT,
    version: WORKSPACE_BACKUP_VERSION,
    exportedAt: timestamp,
    databaseVersion: 5,
    workspace: {
      id: workspaceId,
      name: "Synthetic benchmark",
      schemaVersion: 1,
      revision: 1,
      createdAt: timestamp as never,
      updatedAt: timestamp as never,
    },
    accounts: [
      {
        id: accountId,
        workspaceId,
        name: "Synthetic",
        type: "checking",
        currency: "CAD",
        archived: false,
        createdAt: timestamp as never,
        updatedAt: timestamp as never,
      },
    ],
    imports: [
      {
        schemaVersion: "1.0.0",
        id: importId,
        accountId,
        source: {
          fileName: "synthetic.csv",
          mediaType: "text/csv",
          byteSize: count * 80,
          sha256: "0".repeat(64),
          retained: false,
        },
        parser: { id: "synthetic", version: "1.0.0" },
        status: "committed",
        mapping: {},
        counts: {
          sourceRows: count,
          valid: count,
          errors: 0,
          warnings: 0,
          exactDuplicates: 0,
          likelyDuplicates: 0,
          committed: count,
        },
        issues: [],
        committedRevision: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
        committedAt: timestamp,
      },
    ],
    transactions: Array.from({ length: count }, (_, index) => ({
      schemaVersion: "1.0.0" as const,
      id: uuidFor(index),
      accountId,
      importId,
      postedDate: "2026-07-01",
      amount: "-12.34",
      currency: "CAD",
      description: `Synthetic merchant ${index}`,
      tags: [],
      status: "posted" as const,
      reviewState: "unreviewed" as const,
      classifications: {},
      provenance: {
        parserId: "synthetic",
        parserVersion: "1.0.0",
        sourceLocation: `row ${index + 1}`,
        original: {},
        transformations: [],
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
    categories: [],
    merchants: [],
    classificationRules: [],
    transferDecisions: [],
    recurringDecisions: [],
    transactionOperations: [],
    duplicateResolutionEvents: [],
  };
}

function uuidFor(index: number): string {
  return `018f6b80-0d62-7d2c-9a5c-${index.toString(16).padStart(12, "0")}`;
}
