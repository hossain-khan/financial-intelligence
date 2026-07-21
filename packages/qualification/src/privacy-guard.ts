/**
 * Guard that a perf artifact carries no sensitive fixture content. Even synthetic transaction
 * descriptions, amounts, and account labels must never leave the machine in a CI artifact, so a
 * result is restricted to an allow-list of key names carrying only timings, counts, digests, and
 * enum metadata. Anything else — or a value that looks like a monetary amount or a free-text
 * description — is rejected.
 */
const ALLOWED_KEYS = new Set([
  "schemaVersion",
  "generatedAt",
  "environment",
  "commit",
  "dirty",
  "node",
  "pnpm",
  "browser",
  "browserVersion",
  "os",
  "hardwareProfile",
  "workloadDigest",
  "workloadLabel",
  "metrics",
  "id",
  "unit",
  "mode",
  "iterations",
  "samples",
  "median",
  "p95",
  "memoryBytes",
  "threshold",
  "thresholdKind",
  "pass",
]);

/** Metric ids and workload labels are dotted/kebab identifiers, never data. */
const IDENTIFIER = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/iu;
/** A bare decimal that looks like a monetary amount (e.g. "-12.34") must not appear as a string. */
const MONEY_LIKE = /^-?\d+\.\d{2}$/u;

export class ArtifactPrivacyError extends Error {
  public constructor(
    message: string,
    public readonly path: string,
  ) {
    super(`${message} (at ${path})`);
    this.name = "ArtifactPrivacyError";
  }
}

/**
 * Throw if a perf artifact contains a key outside the allow-list or a string value that looks like a
 * transaction description or monetary amount. Numbers, booleans, digests, and identifier strings on
 * allow-listed keys are permitted.
 */
export function assertNoSensitiveContent(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveContent(item, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (!ALLOWED_KEYS.has(key)) {
        throw new ArtifactPrivacyError(`disallowed key "${key}"`, path);
      }
      assertNoSensitiveContent(child, `${path}.${key}`);
    }
    return;
  }
  if (typeof value === "string") assertSafeString(value, path);
}

function assertSafeString(value: string, path: string): void {
  if (MONEY_LIKE.test(value.trim())) {
    throw new ArtifactPrivacyError("value resembles a monetary amount", path);
  }
  // Timestamps, digests, and version strings are allowed; free text with spaces is not, because a
  // transaction description would land here. Identifier-like tokens (metric ids, labels) are fine.
  const allowed =
    IDENTIFIER.test(value) ||
    /^\d{4}-\d{2}-\d{2}T/u.test(value) || // ISO timestamp
    /^[0-9a-f]{7,64}$/iu.test(value) || // commit / digest hex
    value.length === 0;
  if (!allowed) {
    throw new ArtifactPrivacyError("value is not an allowed identifier/timestamp/digest", path);
  }
}
