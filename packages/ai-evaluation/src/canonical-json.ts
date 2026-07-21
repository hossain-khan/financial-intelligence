/**
 * Deterministic JSON serialization with keys sorted at every level, so the same logical value
 * always produces the same bytes and therefore the same digest regardless of insertion order.
 * Arrays keep their order. Copied local so this package depends only on ai-core/domain/schemas.
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
