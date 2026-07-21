export function parseOfxAmount(
  value: string,
): { readonly minor: bigint; readonly original: string } | undefined {
  const original = value.trim();
  if (original.length === 0) return undefined;

  let normalized = original.normalize("NFKC");
  const parenthesized = normalized.startsWith("(") && normalized.endsWith(")");
  if (parenthesized) normalized = normalized.slice(1, -1).trim();

  normalized = normalized
    .replace(/\p{Sc}/gu, "")
    .replaceAll("\u00a0", " ")
    .replaceAll(" ", "")
    .trim();

  const explicitNegative = normalized.startsWith("-");
  const unsigned = normalized.replace(/^[+-]/u, "");

  if (unsigned.length === 0) return undefined;
  if (/\p{L}/u.test(unsigned)) return undefined;

  const parts = unsigned.split(".");
  if (parts.length > 2) return undefined;

  const [whole = "", fraction = ""] = parts;
  if (!/^\d+$/u.test(whole)) return undefined;
  if (fraction.length > 0 && !/^\d+$/u.test(fraction)) return undefined;

  let minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2));
  if (parenthesized || explicitNegative) minor = -minor;

  return { minor, original };
}

export function minorToDecimal(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const positive = value < 0n ? -value : value;
  return `${sign}${positive / 100n}.${String(positive % 100n).padStart(2, "0")}`;
}
