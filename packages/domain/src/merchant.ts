import type { AliasId, MerchantId } from "./identifiers";
import type { UtcTimestamp } from "./temporal";

export const NORMALIZER_VERSION = "1.0.0";

export type MatchMode = "exact" | "tokenPrefix" | "contains";

export interface MerchantAlias {
  readonly id: AliasId;
  readonly pattern: string;
  readonly matchMode: MatchMode;
  readonly normalizerVersion: string;
  readonly createdAt: UtcTimestamp;
}

export interface Merchant {
  readonly id: MerchantId;
  readonly name: string;
  readonly aliases: readonly MerchantAlias[];
  readonly websiteDomain?: string;
  readonly redirectToId?: MerchantId;
  readonly archived: boolean;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
}

export interface MerchantAliasMatch {
  readonly merchantId: MerchantId;
  readonly aliasId: AliasId;
  readonly matchMode: MatchMode;
  readonly confidence: number;
}

export interface CreateMerchantAliasInput {
  readonly id: AliasId;
  readonly pattern: string;
  readonly matchMode?: MatchMode;
  readonly normalizerVersion?: string;
  readonly now: UtcTimestamp;
}

export interface CreateMerchantInput {
  readonly id: MerchantId;
  readonly name: string;
  readonly aliases?: readonly MerchantAlias[];
  readonly websiteDomain?: string;
  readonly redirectToId?: MerchantId;
  readonly archived?: boolean;
  readonly now: UtcTimestamp;
}

const WEBSITE_DOMAIN_PATTERN =
  /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

/**
 * Deterministically normalizes a raw statement description into a clean, canonical form.
 * - Applies Unicode NFKC normalization and lowercasing.
 * - Strips common card transaction noise (terminal IDs, store numbers, transaction refs, dates).
 * - Collapses whitespace and punctuation.
 */
export function normalizeMerchantDescription(rawDescription: string): string {
  if (!rawDescription || !rawDescription.trim()) {
    return "";
  }

  let text = rawDescription.normalize("NFKC").toLowerCase();

  // Strip leading card processor prefixes like SQ *, TST*, PAYPAL *, SP *, VCG*
  text = text.replace(/^(?:sq\s*\*|tst\s*\*|paypal\s*\*|sp\s*\*|vcg\s*\*|pos\s+|db\s+)/gi, "");

  // Remove store/terminal/ref number patterns: #1234, store 123, term 456, store #45, loc 12
  text = text.replace(
    /(?:#\s*\d+|store\s*#?\s*\d+|term(?:inal)?\s*#?\s*\d+|loc(?:ation)?\s*#?\s*\d+|ref\s*#?\s*\d+)/gi,
    " ",
  );

  // Remove standalone date formats like MM/DD, YYYY-MM-DD
  text = text.replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b/g, " ");

  // Remove standalone numbers or reference codes containing digits (4+ chars long)
  text = text.replace(/\b(?=[a-z0-9]{4,}\b)[a-z0-9]*\d[a-z0-9]*\b/gi, " ");

  // Replace all non-alphanumeric characters (except spaces) with space
  text = text.replace(/[^a-z0-9\s]/g, " ");

  // Collapse multiple spaces into one single space and trim
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Creates a new validated MerchantAlias.
 */
export function createMerchantAlias(input: CreateMerchantAliasInput): MerchantAlias {
  const normalizedPattern = normalizeMerchantDescription(input.pattern);
  if (!normalizedPattern) {
    throw new TypeError("Merchant alias pattern cannot be empty after normalization");
  }
  if (normalizedPattern.length > 240) {
    throw new TypeError("Merchant alias pattern cannot exceed 240 characters");
  }

  return {
    id: input.id,
    pattern: normalizedPattern,
    matchMode: input.matchMode ?? "exact",
    normalizerVersion: input.normalizerVersion ?? NORMALIZER_VERSION,
    createdAt: input.now,
  };
}

/**
 * Creates a new validated Merchant entity.
 */
export function createMerchant(input: CreateMerchantInput): Merchant {
  const trimmedName = input.name.trim();
  if (!trimmedName) {
    throw new TypeError("Merchant name cannot be empty");
  }
  if (trimmedName.length > 160) {
    throw new TypeError("Merchant name cannot exceed 160 characters");
  }

  if (input.websiteDomain !== undefined) {
    if (!WEBSITE_DOMAIN_PATTERN.test(input.websiteDomain)) {
      throw new TypeError("Invalid website domain format");
    }
  }

  // Automatically ensure the merchant's name is included as an exact/prefix alias if none exist
  let aliases = input.aliases ?? [];
  if (aliases.length === 0) {
    const defaultAlias = createMerchantAlias({
      id: input.id as unknown as AliasId,
      pattern: trimmedName,
      matchMode: "tokenPrefix",
      now: input.now,
    });
    aliases = [defaultAlias];
  }

  return {
    id: input.id,
    name: trimmedName,
    aliases,
    ...(input.websiteDomain === undefined ? {} : { websiteDomain: input.websiteDomain }),
    ...(input.redirectToId === undefined ? {} : { redirectToId: input.redirectToId }),
    archived: input.archived ?? false,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/**
 * Adds an alias to a Merchant, returning a new updated Merchant instance.
 */
export function addAliasToMerchant(
  merchant: Merchant,
  alias: MerchantAlias,
  updatedAt: UtcTimestamp,
): Merchant {
  // Check if an alias with the same normalized pattern & match mode already exists
  const exists = merchant.aliases.some(
    (a) => a.pattern === alias.pattern && a.matchMode === alias.matchMode,
  );
  if (exists) {
    return merchant;
  }

  return {
    ...merchant,
    aliases: [...merchant.aliases, alias],
    updatedAt,
  };
}

/**
 * Matches a raw description against a collection of active merchants and their aliases.
 */
export function matchDescriptionToMerchants(
  rawDescription: string,
  merchants: readonly Merchant[],
): readonly MerchantAliasMatch[] {
  const normalizedRaw = normalizeMerchantDescription(rawDescription);
  if (!normalizedRaw) {
    return [];
  }

  const matches: MerchantAliasMatch[] = [];

  for (const merchant of merchants) {
    // Skip archived or redirected merchants
    if (merchant.archived || merchant.redirectToId !== undefined) {
      continue;
    }

    for (const alias of merchant.aliases) {
      let isMatch = false;

      if (alias.matchMode === "exact") {
        isMatch = normalizedRaw === alias.pattern;
      } else if (alias.matchMode === "tokenPrefix") {
        isMatch = normalizedRaw === alias.pattern || normalizedRaw.startsWith(alias.pattern + " ");
      } else if (alias.matchMode === "contains") {
        isMatch = normalizedRaw.includes(alias.pattern);
      }

      if (isMatch) {
        matches.push({
          merchantId: merchant.id,
          aliasId: alias.id,
          matchMode: alias.matchMode,
          confidence: 1.0,
        });
        // One match per merchant is sufficient for ranking
        break;
      }
    }
  }

  return matches;
}

/**
 * Merges a source merchant into a target merchant.
 * - Redirects source merchant to target merchant ID and archives source.
 * - Transfers unique aliases from source to target.
 */
export function mergeMerchants(
  source: Merchant,
  target: Merchant,
  mergedAt: UtcTimestamp,
): { source: Merchant; target: Merchant } {
  if (source.id === target.id) {
    throw new TypeError("Cannot merge a merchant into itself");
  }

  // Combine aliases without duplicates
  let updatedTarget = target;
  for (const alias of source.aliases) {
    updatedTarget = addAliasToMerchant(updatedTarget, alias, mergedAt);
  }

  const updatedSource: Merchant = {
    ...source,
    redirectToId: target.id,
    archived: true,
    updatedAt: mergedAt,
  };

  return {
    source: updatedSource,
    target: updatedTarget,
  };
}

/**
 * Unmerges a previously redirected merchant.
 */
export function unmergeMerchant(source: Merchant, unmergedAt: UtcTimestamp): Merchant {
  if (source.redirectToId === undefined) {
    throw new TypeError("Merchant is not redirected");
  }

  const { redirectToId: _, ...rest } = source;

  return {
    ...rest,
    archived: false,
    updatedAt: unmergedAt,
  };
}
