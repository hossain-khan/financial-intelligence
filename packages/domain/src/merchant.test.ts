import { describe, expect, it } from "vitest";

import { parseAliasId, parseMerchantId } from "./identifiers";
import {
  addAliasToMerchant,
  createMerchant,
  createMerchantAlias,
  matchDescriptionToMerchants,
  mergeMerchants,
  normalizeMerchantDescription,
  NORMALIZER_VERSION,
  unmergeMerchant,
} from "./merchant";
import { parseUtcTimestamp } from "./temporal";

const MERCHANT_ID_1 = parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1");
const MERCHANT_ID_2 = parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2");
const ALIAS_ID_1 = parseAliasId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2a1");
const ALIAS_ID_2 = parseAliasId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2a2");
const ALIAS_ID_3 = parseAliasId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2a3");

const NOW = parseUtcTimestamp("2026-07-20T08:00:00Z");

describe("normalizeMerchantDescription", () => {
  it("converts raw descriptions to lowercase and collapses whitespace", () => {
    expect(normalizeMerchantDescription("  TIM  HORTONS  ")).toBe("tim hortons");
  });

  it("normalizes Unicode NFKC characters", () => {
    expect(normalizeMerchantDescription("ＣＡＦＥ ＤＥ ＰＡＲＩＳ")).toBe("cafe de paris");
  });

  it("strips store, terminal, and transaction reference numbers", () => {
    expect(normalizeMerchantDescription("TIM HORTONS #145 OSHAWA ON")).toBe(
      "tim hortons oshawa on",
    );
    expect(normalizeMerchantDescription("WAL-MART STORE #2041")).toBe("wal mart");
    expect(normalizeMerchantDescription("UBER *TRIP 1234 SAN FRANCISCO CA")).toBe(
      "uber trip san francisco ca",
    );
    expect(normalizeMerchantDescription("SHELL OIL 574432100")).toBe("shell oil");
  });

  it("strips processor prefixes and dates", () => {
    expect(normalizeMerchantDescription("SQ *COFFEE SHOP 07/19")).toBe("coffee shop");
    expect(normalizeMerchantDescription("TST* THE LOCAL PUB")).toBe("the local pub");
    expect(normalizeMerchantDescription("PAYPAL *STEAM GAMES 2026-07-19")).toBe("steam games");
  });

  it("returns an empty string for empty or whitespace-only inputs", () => {
    expect(normalizeMerchantDescription("")).toBe("");
    expect(normalizeMerchantDescription("   ")).toBe("");
  });

  it("is strictly deterministic (property test)", () => {
    const testCases = [
      "TIM HORTONS #145 OSHAWA ON",
      "WAL-MART STORE #2041",
      "SQ *COFFEE SHOP 07/19",
      "UBER *TRIP 1234",
      "AMZN Mktp US*MK1234567",
      "  Special & Character $ Store  ",
    ];

    for (const raw of testCases) {
      const first = normalizeMerchantDescription(raw);
      const second = normalizeMerchantDescription(raw);
      expect(first).toBe(second);
      expect(normalizeMerchantDescription(first)).toBe(first);
    }
  });
});

describe("Merchant & MerchantAlias domain entities", () => {
  it("creates a merchant with default tokenPrefix alias matching its name", () => {
    const merchant = createMerchant({
      id: MERCHANT_ID_1,
      name: "Tim Hortons",
      now: NOW,
    });

    expect(merchant.id).toBe(MERCHANT_ID_1);
    expect(merchant.name).toBe("Tim Hortons");
    expect(merchant.archived).toBe(false);
    expect(merchant.aliases).toHaveLength(1);
    expect(merchant.aliases[0]?.pattern).toBe("tim hortons");
    expect(merchant.aliases[0]?.matchMode).toBe("tokenPrefix");
    expect(merchant.aliases[0]?.normalizerVersion).toBe(NORMALIZER_VERSION);
  });

  it("rejects empty names or names exceeding 160 characters", () => {
    expect(() => createMerchant({ id: MERCHANT_ID_1, name: "", now: NOW })).toThrow(TypeError);
    expect(() => createMerchant({ id: MERCHANT_ID_1, name: "   ", now: NOW })).toThrow(TypeError);
    expect(() => createMerchant({ id: MERCHANT_ID_1, name: "a".repeat(161), now: NOW })).toThrow(
      TypeError,
    );
  });

  it("validates optional websiteDomain", () => {
    expect(() =>
      createMerchant({
        id: MERCHANT_ID_1,
        name: "Acme",
        websiteDomain: "invalid-domain",
        now: NOW,
      }),
    ).toThrow(TypeError);

    const valid = createMerchant({
      id: MERCHANT_ID_1,
      name: "Acme",
      websiteDomain: "acme.com",
      now: NOW,
    });
    expect(valid.websiteDomain).toBe("acme.com");
  });

  it("creates and attaches custom aliases", () => {
    let merchant = createMerchant({ id: MERCHANT_ID_1, name: "Uber", now: NOW });
    const uberEatsAlias = createMerchantAlias({
      id: ALIAS_ID_1,
      pattern: "uber eats",
      matchMode: "exact",
      now: NOW,
    });

    merchant = addAliasToMerchant(merchant, uberEatsAlias, NOW);
    expect(merchant.aliases).toHaveLength(2);
    expect(merchant.aliases[1]?.pattern).toBe("uber eats");

    // Adding duplicate alias is no-op
    const updated = addAliasToMerchant(merchant, uberEatsAlias, NOW);
    expect(updated).toBe(merchant);
  });
});

describe("matchDescriptionToMerchants", () => {
  const timHortons = createMerchant({
    id: MERCHANT_ID_1,
    name: "Tim Hortons",
    aliases: [
      createMerchantAlias({
        id: ALIAS_ID_1,
        pattern: "tim hortons",
        matchMode: "tokenPrefix",
        now: NOW,
      }),
      createMerchantAlias({ id: ALIAS_ID_2, pattern: "tims", matchMode: "exact", now: NOW }),
    ],
    now: NOW,
  });

  const uber = createMerchant({
    id: MERCHANT_ID_2,
    name: "Uber",
    aliases: [
      createMerchantAlias({
        id: ALIAS_ID_3,
        pattern: "uber trip",
        matchMode: "contains",
        now: NOW,
      }),
    ],
    now: NOW,
  });

  const merchants = [timHortons, uber];

  it("matches tokenPrefix alias", () => {
    const matches = matchDescriptionToMerchants("TIM HORTONS #145 OSHAWA", merchants);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.merchantId).toBe(MERCHANT_ID_1);
    expect(matches[0]?.matchMode).toBe("tokenPrefix");
  });

  it("matches exact alias", () => {
    const matches = matchDescriptionToMerchants("TIMS", merchants);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.merchantId).toBe(MERCHANT_ID_1);
    expect(matches[0]?.matchMode).toBe("exact");
  });

  it("matches contains alias", () => {
    const matches = matchDescriptionToMerchants("PAYMENT TO UBER TRIP SAN FRANCISCO", merchants);
    expect(matches).toHaveLength(1);
    expect(matches[0]?.merchantId).toBe(MERCHANT_ID_2);
    expect(matches[0]?.matchMode).toBe("contains");
  });

  it("ignores archived and redirected merchants", () => {
    const archivedMerchant = createMerchant({
      id: MERCHANT_ID_1,
      name: "Archived Store",
      archived: true,
      now: NOW,
    });
    expect(matchDescriptionToMerchants("Archived Store", [archivedMerchant])).toHaveLength(0);
  });
});

describe("mergeMerchants & unmergeMerchant", () => {
  it("merges source merchant into target merchant, redirecting source and transferring aliases", () => {
    const source = createMerchant({
      id: MERCHANT_ID_1,
      name: "Tim Hortons Cafe",
      aliases: [
        createMerchantAlias({
          id: ALIAS_ID_1,
          pattern: "tim hortons cafe",
          matchMode: "exact",
          now: NOW,
        }),
      ],
      now: NOW,
    });

    const target = createMerchant({
      id: MERCHANT_ID_2,
      name: "Tim Hortons",
      aliases: [
        createMerchantAlias({
          id: ALIAS_ID_2,
          pattern: "tim hortons",
          matchMode: "tokenPrefix",
          now: NOW,
        }),
      ],
      now: NOW,
    });

    const { source: mergedSource, target: mergedTarget } = mergeMerchants(source, target, NOW);

    expect(mergedSource.redirectToId).toBe(target.id);
    expect(mergedSource.archived).toBe(true);

    expect(mergedTarget.aliases).toHaveLength(2);
    expect(mergedTarget.aliases.some((a) => a.pattern === "tim hortons cafe")).toBe(true);
  });

  it("rejects merging a merchant into itself", () => {
    const merchant = createMerchant({ id: MERCHANT_ID_1, name: "Store", now: NOW });
    expect(() => mergeMerchants(merchant, merchant, NOW)).toThrow(TypeError);
  });

  it("unmerges a redirected merchant", () => {
    const source = createMerchant({
      id: MERCHANT_ID_1,
      name: "Tim Hortons Cafe",
      redirectToId: MERCHANT_ID_2,
      archived: true,
      now: NOW,
    });

    const unmerged = unmergeMerchant(source, NOW);
    expect(unmerged.redirectToId).toBeUndefined();
    expect(unmerged.archived).toBe(false);
  });
});
