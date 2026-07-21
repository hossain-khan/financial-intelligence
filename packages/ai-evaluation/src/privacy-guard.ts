/**
 * Guard that an evaluation artifact carries no sensitive content. A result is restricted to an
 * allow-list of key names holding only rates, counts, timings, digests, timestamps, and short enum
 * identifiers. Any other key — or a value that looks like a monetary amount or free text — is
 * rejected, so a raw request body or transaction description can never enter a result artifact.
 */
const ALLOWED_KEYS = new Set([
  "schemaVersion",
  "generatedAt",
  "profile",
  "metrics",
  "support",
  "corpusDigest",
  "appCommit",
  "taskVersion",
  "promptVersion",
  "minimizerVersion",
  "adapterId",
  "adapterVersion",
  "model",
  "tokenizer",
  "runtime",
  "executionLocation",
  "decodingParams",
  "deviceTier",
  "schemaValidRate",
  "invalidOutputRate",
  "accuracy",
  "abstentionPrecision",
  "abstentionRecall",
  "groundingViolations",
  "privacyViolations",
  "latencyMedianMs",
  "latencyP95Ms",
  "denominators",
  "total",
  "answerable",
  "shouldAbstain",
  "didAbstain",
  "status",
  "reviewer",
  "date",
  "perTaskTier",
  "note",
]);
const IDENTIFIER = /^[a-z0-9]+(?:[.\-_ :][a-z0-9.]+)*$/iu;
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

export function assertNoSensitiveContent(value: unknown, path = "$"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveContent(item, `${path}[${index}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (!ALLOWED_KEYS.has(key)) throw new ArtifactPrivacyError(`disallowed key "${key}"`, path);
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
  const allowed =
    value.length === 0 ||
    /^\d{4}-\d{2}-\d{2}(T.*)?$/u.test(value) || // ISO date/timestamp
    /^[0-9a-f]{7,64}$/iu.test(value) || // commit / digest hex
    (IDENTIFIER.test(value) && value.split(/\s+/u).length <= 3);
  if (!allowed) {
    throw new ArtifactPrivacyError("value is not an allowed identifier/timestamp/digest", path);
  }
}
