import { describe, expect, it } from "vitest";

import {
  createMerchant,
  createTransaction,
  Money,
  parseAccountId,
  parseImportId,
  parseMerchantId,
  parseTransactionId,
  parseUtcTimestamp,
  parseDateOnly,
} from "@financial-intelligence/domain";

import { analyzeMerchantRanking } from "./merchant-ranking";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda111");
const IMPORT_ID = parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda333");

describe("merchant-ranking analysis", () => {
  it("groups transactions by matched merchant and includes unresolved bucket", () => {
    const merchantNetflix = createMerchant({
      id: parseMerchantId("018f6b80-0d62-7d2c-9a5c-7f5f59cda001"),
      name: "Netflix",
      now: NOW,
    });

    const tx1 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda010"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-06-15"),
      money: Money.from("-16.99", "CAD"),
      description: "NETFLIX TORONTO ON",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "1",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const tx2 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda011"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-15"),
      money: Money.from("-16.99", "CAD"),
      description: "NETFLIX TORONTO ON",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "2",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const txUnmatched = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda012"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-16"),
      money: Money.from("-45.00", "CAD"),
      description: "CORNER STORE GAS",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "3",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const report = analyzeMerchantRanking({
      transactions: [tx1, tx2, txUnmatched],
      merchants: [merchantNetflix],
    });

    expect(report.currencies).toHaveLength(1);
    const cad = report.currencies[0]!;

    expect(cad.totalSpending).toBe("78.98");
    expect(cad.unresolvedSpending).toBe("45");
    expect(cad.unresolvedCount).toBe(1);
    expect(cad.rows).toHaveLength(2);

    // Sorted by total spending desc -> Unresolved (45) first, then Netflix (33.98)
    expect(cad.rows[0]?.merchantName).toBe("Unresolved Merchants");
    expect(cad.rows[0]?.totalSpending).toBe("45");

    expect(cad.rows[1]?.merchantName).toBe("Netflix");
    expect(cad.rows[1]?.totalSpending).toBe("33.98");
    expect(cad.rows[1]?.transactionCount).toBe(2);
    expect(cad.rows[1]?.monthlyTrend).toEqual([
      { month: "2026-06", spending: "16.99" },
      { month: "2026-07", spending: "16.99" },
    ]);
  });
});
