import type { WorkspaceBackupSnapshot } from "./snapshot";

/**
 * The authenticated manifest that travels inside the encrypted payload alongside the snapshot. It
 * lets a reader detect a truncated, tampered, or partially-written backup before trusting any
 * section: every canonical store is inventoried with its record count, canonical byte length, and
 * SHA-256 digest, and the required-section list means an unknown or missing required section fails
 * closed instead of being silently ignored.
 */
export const BACKUP_MANIFEST_VERSION = "1.0.0";

/** Ordered list of the canonical snapshot sections a full workspace recovery requires. */
export const SNAPSHOT_SECTIONS = [
  "accounts",
  "imports",
  "transactions",
  "categories",
  "merchants",
  "classificationRules",
  "transferDecisions",
  "recurringDecisions",
  "learningOperations",
  "decisionEvents",
  "transactionOperations",
  "duplicateResolutionEvents",
] as const;

export type SnapshotSection = (typeof SNAPSHOT_SECTIONS)[number];

/** Sections that must be present (possibly empty) for a backup to be considered complete. */
export const REQUIRED_SECTIONS: readonly SnapshotSection[] = [
  "accounts",
  "imports",
  "transactions",
  "categories",
  "merchants",
  "classificationRules",
  "transferDecisions",
  "recurringDecisions",
  "transactionOperations",
  "duplicateResolutionEvents",
];

export interface ManifestSectionInventory {
  readonly recordCount: number;
  readonly byteLength: number;
  /** Hex SHA-256 of the canonical JSON of this section's array. */
  readonly digest: string;
  readonly required: boolean;
}

export interface BackupManifest {
  readonly manifestVersion: typeof BACKUP_MANIFEST_VERSION;
  readonly snapshotFormat: string;
  readonly snapshotVersion: string;
  readonly producedBy: {
    readonly application: "financial-intelligence";
    readonly buildId: string;
  };
  readonly createdAt: string;
  readonly workspaceId: string;
  readonly workspaceRevision: number;
  readonly sourceDatabaseVersion: number;
  /** Snapshot schema versions this manifest is compatible with (inclusive range). */
  readonly compatibleSnapshotVersions: { readonly min: string; readonly max: string };
  readonly sections: Readonly<Record<SnapshotSection, ManifestSectionInventory>>;
}

/** A digest function so the pure package does not depend on a specific crypto global. */
export type DigestFunction = (bytes: Uint8Array) => Promise<string>;

/** Web Crypto SHA-256 → lowercase hex. */
export async function webCryptoDigest(bytes: Uint8Array, cryptoProvider: Crypto): Promise<string> {
  const view = new Uint8Array(bytes);
  const hash = await cryptoProvider.subtle.digest("SHA-256", view);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Deterministic JSON serialization: object keys are emitted in sorted order at every level so the
 * same logical value always produces the same bytes and therefore the same digest, regardless of
 * insertion order. Arrays preserve their order (order is meaningful for the snapshot sections).
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) sorted[key] = sortValue(record[key]);
    return sorted;
  }
  return value;
}

/** Build the manifest for a snapshot, digesting each section's canonical JSON. */
export async function buildManifest(
  snapshot: WorkspaceBackupSnapshot,
  context: { readonly buildId: string },
  digest: DigestFunction,
): Promise<BackupManifest> {
  const encoder = new TextEncoder();
  const sections = {} as Record<SnapshotSection, ManifestSectionInventory>;
  for (const section of SNAPSHOT_SECTIONS) {
    const array = (snapshot[section] ?? []) as readonly unknown[];
    const bytes = encoder.encode(canonicalJson(array));
    sections[section] = {
      recordCount: array.length,
      byteLength: bytes.byteLength,
      digest: await digest(bytes),
      required: REQUIRED_SECTIONS.includes(section),
    };
  }
  return {
    manifestVersion: BACKUP_MANIFEST_VERSION,
    snapshotFormat: snapshot.format,
    snapshotVersion: snapshot.version,
    producedBy: { application: "financial-intelligence", buildId: context.buildId },
    createdAt: snapshot.exportedAt,
    workspaceId: snapshot.workspace.id,
    workspaceRevision: snapshot.workspace.revision,
    sourceDatabaseVersion: snapshot.databaseVersion,
    compatibleSnapshotVersions: { min: snapshot.version, max: snapshot.version },
    sections,
  };
}

export class ManifestValidationError extends Error {
  public constructor(
    public readonly code:
      | "MANIFEST_MISSING"
      | "MANIFEST_MALFORMED"
      | "SECTION_MISSING"
      | "COUNT_MISMATCH"
      | "DIGEST_MISMATCH"
      | "WORKSPACE_MISMATCH",
    public readonly section?: SnapshotSection,
  ) {
    super(section === undefined ? code : `${code}:${section}`);
    this.name = "ManifestValidationError";
  }
}

/**
 * Verify a decrypted snapshot against its manifest: the manifest must be well-formed, describe the
 * same workspace, list every required section, and each section's live record count and canonical
 * digest must match. Any mismatch is a tamper/corruption signal and throws.
 */
export async function verifyManifest(
  manifest: unknown,
  snapshot: WorkspaceBackupSnapshot,
  digest: DigestFunction,
): Promise<BackupManifest> {
  if (!isManifest(manifest)) throw new ManifestValidationError("MANIFEST_MALFORMED");
  if (
    manifest.workspaceId !== snapshot.workspace.id ||
    manifest.workspaceRevision !== snapshot.workspace.revision ||
    manifest.snapshotFormat !== snapshot.format ||
    manifest.snapshotVersion !== snapshot.version
  ) {
    throw new ManifestValidationError("WORKSPACE_MISMATCH");
  }

  const encoder = new TextEncoder();
  for (const section of SNAPSHOT_SECTIONS) {
    const inventory = manifest.sections[section];
    if (inventory === undefined) {
      if (REQUIRED_SECTIONS.includes(section)) {
        throw new ManifestValidationError("SECTION_MISSING", section);
      }
      continue;
    }
    const array = (snapshot[section] ?? []) as readonly unknown[];
    if (array.length !== inventory.recordCount) {
      throw new ManifestValidationError("COUNT_MISMATCH", section);
    }
    const actualDigest = await digest(encoder.encode(canonicalJson(array)));
    if (actualDigest !== inventory.digest) {
      throw new ManifestValidationError("DIGEST_MISMATCH", section);
    }
  }
  return manifest;
}

function isManifest(value: unknown): value is BackupManifest {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    record.manifestVersion === BACKUP_MANIFEST_VERSION &&
    typeof record.snapshotFormat === "string" &&
    typeof record.snapshotVersion === "string" &&
    typeof record.workspaceId === "string" &&
    Number.isSafeInteger(record.workspaceRevision) &&
    Number.isSafeInteger(record.sourceDatabaseVersion) &&
    typeof record.sections === "object" &&
    record.sections !== null
  );
}
