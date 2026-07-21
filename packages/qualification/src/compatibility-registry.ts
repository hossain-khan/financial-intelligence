/**
 * Machine-readable compatibility registry: the single source of truth for every independently
 * versioned portable format in the app. Each axis records its current version, reader/writer
 * support window, migration/export policy, and the immutable fixture that proves it. An integrity
 * test (`compatibility-registry.test.ts`) imports the live constants from each producing package and
 * fails if any drifts from this registry, so a version bump cannot land without updating the
 * registry — and, for a breaking bump, adding the prior version's reader fixture first.
 *
 * The registry itself is pure data with no cross-package imports; the drift check owns the coupling.
 */

export type CompatibilityAxisId =
  | "indexeddb-schema"
  | "canonical-transaction"
  | "canonical-import"
  | "classification-rule"
  | "workspace"
  | "mapping-preset"
  | "financial-brain"
  | "encrypted-backup-container"
  | "workspace-backup-snapshot"
  | "backup-manifest"
  | "parser-csv"
  | "parser-ofx"
  | "parser-pdf"
  | "pdf-layout-adapter"
  | "mapping-normalizer"
  | "merchant-normalizer"
  | "perf-result";

/** How an older app copes with data written by a newer app. */
export type DowngradePolicy =
  /** Newer data cannot be opened by an older app; recover by exporting/backup from the newer app. */
  | "export-only"
  /** The format is forward-tolerant: unknown optional fields are preserved/ignored. */
  | "preserve-and-ignore"
  /** Not applicable (e.g. an ephemeral non-user artifact). */
  | "not-applicable";

export interface CompatibilityAxis {
  readonly id: CompatibilityAxisId;
  readonly label: string;
  /** The version string/number currently produced. */
  readonly currentVersion: string;
  /**
   * Versions this app build can READ. For a first release this is just the current version; a
   * breaking bump adds the prior version here only once its reader + fixture exist.
   */
  readonly readableVersions: readonly string[];
  /** Versions this app build WRITES (usually just the current version). */
  readonly writableVersions: readonly string[];
  /** Whether a supported read is lossless. */
  readonly lossless: boolean;
  readonly downgradePolicy: DowngradePolicy;
  /** How a user recovers data from an unsupported (too-new) version. */
  readonly unsupportedRecovery: string;
  /** Relative path under test-fixtures/compatibility that proves this axis, or undefined if none. */
  readonly fixture?: string;
  /** Milestone at which the oldest supported version may be dropped, or "none" while pre-1.0. */
  readonly removalMilestone: string;
  readonly notes?: string;
}

export const COMPATIBILITY_REGISTRY_VERSION = "1.0.0";

/**
 * All values reflect the state at Phase 3 close. Every format is at its first released version
 * except the workspace-backup snapshot, which is v2 (manifest-bearing) with no v1 reader by
 * decision (ADR-015). Fail-closed on unknown versions is the universal policy.
 */
export const COMPATIBILITY_REGISTRY: readonly CompatibilityAxis[] = Object.freeze([
  {
    id: "indexeddb-schema",
    label: "IndexedDB schema (Dexie)",
    currentVersion: "10",
    readableVersions: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    writableVersions: ["10"],
    lossless: true,
    downgradePolicy: "export-only",
    unsupportedRecovery:
      "A database newer than this build fails closed (VERSION_INCOMPATIBLE); open it in the newer app and export a backup.",
    fixture: "indexeddb/v1",
    removalMilestone: "none",
    notes:
      "Additive store/index migrations v1→10; upgrades are journaled and abort-safe. v10 adds the aiProviderProfiles store (#31).",
  },
  {
    id: "canonical-transaction",
    label: "Canonical transaction document",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "preserve-and-ignore",
    unsupportedRecovery: "An unknown schemaVersion is rejected; export from the newer app.",
    fixture: "canonical/transaction-1.0.0",
    removalMilestone: "none",
  },
  {
    id: "canonical-import",
    label: "Canonical statement-import document",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "preserve-and-ignore",
    unsupportedRecovery: "An unknown schemaVersion is rejected; export from the newer app.",
    fixture: "canonical/import-1.0.0",
    removalMilestone: "none",
  },
  {
    id: "classification-rule",
    label: "Classification rule document",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "preserve-and-ignore",
    unsupportedRecovery: "An unknown schemaVersion is rejected; export from the newer app.",
    removalMilestone: "none",
  },
  {
    id: "workspace",
    label: "Workspace document",
    currentVersion: "1",
    readableVersions: ["1"],
    writableVersions: ["1"],
    lossless: true,
    downgradePolicy: "preserve-and-ignore",
    unsupportedRecovery: "An unknown schemaVersion is rejected; export from the newer app.",
    removalMilestone: "none",
  },
  {
    id: "mapping-preset",
    label: "CSV mapping preset (local)",
    currentVersion: "1",
    readableVersions: ["1"],
    writableVersions: ["1"],
    lossless: true,
    downgradePolicy: "preserve-and-ignore",
    unsupportedRecovery: "A preset with an unknown version is ignored; remap the import.",
    removalMilestone: "none",
    notes: "Convenience cache; rebuildable, never the only copy of user data.",
  },
  {
    id: "financial-brain",
    label: "Financial Brain export",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "preserve-and-ignore",
    unsupportedRecovery: "A future-major Brain is rejected at preview; export from the newer app.",
    fixture: "financial-brain/v1.0.0",
    removalMilestone: "none",
  },
  {
    id: "encrypted-backup-container",
    label: "Encrypted backup container",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "export-only",
    unsupportedRecovery: "An unknown container version fails closed (UNSUPPORTED_VERSION).",
    fixture: "encrypted-backup/v1.0.0",
    removalMilestone: "none",
    notes: "Argon2id v19 (19456 KiB, 2 iterations, parallelism 1) + AES-256-GCM, 128-bit tag.",
  },
  {
    id: "workspace-backup-snapshot",
    label: "Workspace backup snapshot",
    currentVersion: "2.0.0",
    readableVersions: ["2.0.0"],
    writableVersions: ["2.0.0"],
    lossless: true,
    downgradePolicy: "export-only",
    unsupportedRecovery: "A non-2.x snapshot fails closed; there is no v1 reader (ADR-015).",
    fixture: "encrypted-backup/v1.0.0",
    removalMilestone: "none",
    notes: "v2 embeds the authenticated per-section manifest; no v1 compatibility path.",
  },
  {
    id: "backup-manifest",
    label: "Backup manifest",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "export-only",
    unsupportedRecovery: "A malformed or unknown manifest version fails the backup.",
    removalMilestone: "none",
    notes: "10 required sections + 2 optional (learningOperations, decisionEvents).",
  },
  {
    id: "parser-csv",
    label: "CSV statement parser",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "preserve-and-ignore",
    unsupportedRecovery: "Provenance records the parser version; stored rows remain explainable.",
    removalMilestone: "none",
    notes: "parserId financial-intelligence/csv.",
  },
  {
    id: "parser-ofx",
    label: "OFX/QFX statement parser",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "preserve-and-ignore",
    unsupportedRecovery: "Provenance records the parser version; stored rows remain explainable.",
    removalMilestone: "none",
    notes: "parserId ofx.",
  },
  {
    id: "parser-pdf",
    label: "PDF statement parser",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "preserve-and-ignore",
    unsupportedRecovery: "Provenance records the parser version; stored rows remain explainable.",
    removalMilestone: "none",
    notes: "parserId pdf.",
  },
  {
    id: "pdf-layout-adapter",
    label: "PDF generic-tabular layout adapter",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "preserve-and-ignore",
    unsupportedRecovery: "Adapter id/version is recorded in provenance for explainability.",
    removalMilestone: "none",
  },
  {
    id: "mapping-normalizer",
    label: "Import column-mapping normalizer",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "preserve-and-ignore",
    unsupportedRecovery: "mappingVersion is stamped into provenance for explainability.",
    removalMilestone: "none",
  },
  {
    id: "merchant-normalizer",
    label: "Merchant description normalizer",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "preserve-and-ignore",
    unsupportedRecovery: "Alias normalizerVersion is recorded so matches remain explainable.",
    removalMilestone: "none",
  },
  {
    id: "perf-result",
    label: "Performance result artifact",
    currentVersion: "1.0.0",
    readableVersions: ["1.0.0"],
    writableVersions: ["1.0.0"],
    lossless: true,
    downgradePolicy: "not-applicable",
    unsupportedRecovery: "An unknown perf-result version is rejected; regenerate the artifact.",
    removalMilestone: "none",
    notes: "Ephemeral CI artifact, not user data.",
  },
]);

export class CompatibilityRegistryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CompatibilityRegistryError";
  }
}

/** Look up a single axis, throwing if the id is unknown. */
export function compatibilityAxis(id: CompatibilityAxisId): CompatibilityAxis {
  const axis = COMPATIBILITY_REGISTRY.find((entry) => entry.id === id);
  if (axis === undefined) throw new CompatibilityRegistryError(`unknown compatibility axis: ${id}`);
  return axis;
}

/**
 * Structural self-check: unique ids, non-empty version windows, current ∈ writable ⊆ readable, and a
 * recovery string for every axis. Throws on the first problem. Kept separate from the live-constant
 * drift check (which lives in the test that can import every package).
 */
export function assertRegistryIntegrity(
  registry: readonly CompatibilityAxis[] = COMPATIBILITY_REGISTRY,
): void {
  const seen = new Set<string>();
  for (const axis of registry) {
    if (seen.has(axis.id)) throw new CompatibilityRegistryError(`duplicate axis id: ${axis.id}`);
    seen.add(axis.id);
    if (axis.readableVersions.length === 0 || axis.writableVersions.length === 0) {
      throw new CompatibilityRegistryError(`${axis.id}: empty version window`);
    }
    if (!axis.readableVersions.includes(axis.currentVersion)) {
      throw new CompatibilityRegistryError(`${axis.id}: current version is not readable`);
    }
    for (const writable of axis.writableVersions) {
      if (!axis.readableVersions.includes(writable)) {
        throw new CompatibilityRegistryError(`${axis.id}: writable ${writable} is not readable`);
      }
    }
    if (axis.unsupportedRecovery.trim().length === 0) {
      throw new CompatibilityRegistryError(`${axis.id}: missing unsupportedRecovery guidance`);
    }
  }
}
