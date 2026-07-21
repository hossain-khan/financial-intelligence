import { FINANCIAL_BRAIN_SCHEMA_VERSION, NORMALIZER_VERSION } from "@financial-intelligence/domain";
import {
  BACKUP_MANIFEST_VERSION,
  ENCRYPTED_BACKUP_VERSION,
  WORKSPACE_BACKUP_VERSION,
} from "@financial-intelligence/backup";
import { MAPPING_VERSION } from "@financial-intelligence/import-core";
import { OfxStatementParser } from "@financial-intelligence/import-ofx";
import { CURRENT_DATABASE_VERSION } from "@financial-intelligence/storage-indexeddb";
import { describe, expect, it } from "vitest";

import {
  assertRegistryIntegrity,
  compatibilityAxis,
  COMPATIBILITY_REGISTRY,
} from "./compatibility-registry";
import { PERF_RESULT_VERSION } from "./result-schema";

describe("compatibility registry", () => {
  it("passes its own structural integrity check", () => {
    expect(() => assertRegistryIntegrity()).not.toThrow();
  });

  it("has a unique id and recovery guidance for every axis", () => {
    const ids = COMPATIBILITY_REGISTRY.map((axis) => axis.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const axis of COMPATIBILITY_REGISTRY) {
      expect(axis.unsupportedRecovery.length).toBeGreaterThan(0);
    }
  });

  // Drift guard: the registry's currentVersion must equal the LIVE constant produced by each
  // package. A version bump that forgets to update the registry (and, for a breaking bump, add the
  // prior reader fixture) fails here — that is the CI gate the issue requires.
  it("matches the live IndexedDB schema version", () => {
    expect(compatibilityAxis("indexeddb-schema").currentVersion).toBe(
      String(CURRENT_DATABASE_VERSION),
    );
  });

  it("matches the live Financial Brain schema version", () => {
    expect(compatibilityAxis("financial-brain").currentVersion).toBe(
      FINANCIAL_BRAIN_SCHEMA_VERSION,
    );
  });

  it("matches the live backup format versions", () => {
    expect(compatibilityAxis("encrypted-backup-container").currentVersion).toBe(
      ENCRYPTED_BACKUP_VERSION,
    );
    expect(compatibilityAxis("workspace-backup-snapshot").currentVersion).toBe(
      WORKSPACE_BACKUP_VERSION,
    );
    expect(compatibilityAxis("backup-manifest").currentVersion).toBe(BACKUP_MANIFEST_VERSION);
  });

  it("matches the live mapping and merchant normalizer versions", () => {
    expect(compatibilityAxis("mapping-normalizer").currentVersion).toBe(MAPPING_VERSION);
    expect(compatibilityAxis("merchant-normalizer").currentVersion).toBe(NORMALIZER_VERSION);
  });

  it("matches the live OFX parser id and version", () => {
    const parser = new OfxStatementParser();
    expect(parser.id).toBe("ofx");
    expect(compatibilityAxis("parser-ofx").currentVersion).toBe(parser.version);
  });

  it("matches the live perf-result version", () => {
    expect(compatibilityAxis("perf-result").currentVersion).toBe(PERF_RESULT_VERSION);
  });

  it("declares no-v1-reader for the workspace backup snapshot (v2 only)", () => {
    const axis = compatibilityAxis("workspace-backup-snapshot");
    expect(axis.readableVersions).toEqual(["2.0.0"]);
    expect(axis.downgradePolicy).toBe("export-only");
  });

  it("links a fixture for each axis that has released bytes to freeze", () => {
    // Every export-only (byte-frozen) axis must reference an immutable fixture.
    for (const axis of COMPATIBILITY_REGISTRY) {
      if (axis.id === "indexeddb-schema" || axis.id.startsWith("encrypted-backup")) {
        expect(axis.fixture, `${axis.id} must link a fixture`).toBeTruthy();
      }
    }
  });
});
