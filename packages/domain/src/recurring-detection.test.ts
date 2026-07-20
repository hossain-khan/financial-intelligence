import { describe, expect, it } from "vitest";

import { parseAccountId, parseImportId, parseTransactionId } from "./identifiers";
import { Money } from "./money";
import { parseDateOnly, parseUtcTimestamp } from "./temporal";
import { createTransaction } from "./transaction";
import { calculateRecurringSignature, findRecurringProposals } from "./recurring-detection";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda111");
const IMPORT_ID = parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda333");

describe("recurring-detection domain module", () => {
  it("computes deterministic recurring signature", () => {
    const sig1 = calculateRecurringSignature("NETFLIX", "CAD", "monthly");
    const sig2 = calculateRecurringSignature("netflix", "cad", "monthly");
    expect(sig1).toBe(sig2);
    expect(sig1).toBe("netflix:CAD:monthly");
  });

  it("detects monthly recurring subscription from 3 monthly payments", () => {
    const tx1 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda001"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-05-15"),
      money: Money.from("-16.99", "CAD"),
      description: "NETFLIX.COM TORONTO ON",
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
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda002"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-06-15"),
      money: Money.from("-16.99", "CAD"),
      description: "NETFLIX.COM TORONTO ON",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "2",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const tx3 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda003"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-15"),
      money: Money.from("-16.99", "CAD"),
      description: "NETFLIX.COM TORONTO ON",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "3",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const proposals = findRecurringProposals([tx1, tx2, tx3]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.cadence).toBe("monthly");
    expect(proposals[0]?.amountStats.median).toBe("16.99");
    expect(proposals[0]?.nextExpectedDate).toBe("2026-08-14");
  });

  it("excludes transactions provided in excludedTransactionIds set", () => {
    const tx1 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda001"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-05-15"),
      money: Money.from("-500.00", "CAD"),
      description: "TRANSFER TO SAVINGS",
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
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda002"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-06-15"),
      money: Money.from("-500.00", "CAD"),
      description: "TRANSFER TO SAVINGS",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "2",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const tx3 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda003"),
      accountId: ACCOUNT_ID,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-15"),
      money: Money.from("-500.00", "CAD"),
      description: "TRANSFER TO SAVINGS",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "3",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const proposals = findRecurringProposals([tx1, tx2, tx3], {
      excludedTransactionIds: new Set([tx1.id, tx2.id, tx3.id]),
    });
    expect(proposals).toHaveLength(0);
  });
});
