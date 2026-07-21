/**
 * Deterministic JSON serialization with keys sorted at every level, so the same logical value
 * always produces the same bytes and therefore the same digest regardless of insertion order.
 * Arrays keep their order. Mirrors the approach in `packages/backup/src/manifest.ts` but is kept
 * local so this package has no dependency on the backup package.
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
