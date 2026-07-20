import { describe, expect, it } from "vitest";

import { createAccount } from "./account";
import { parseAccountId, parseImportId, parseTransactionId, parseWorkspaceId } from "./identifiers";
import { Money } from "./money";
import { parseDateOnly, parseUtcTimestamp } from "./temporal";
import { createTransaction } from "./transaction";
import { calculateTransferSignature, findTransferProposals } from "./transfer-matching";

const NOW = parseUtcTimestamp("2026-07-20T10:00:00Z");
const WORKSPACE_ID = parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda999");
const ACCOUNT_CHECKING = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda111");
const ACCOUNT_SAVINGS = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda222");
const IMPORT_ID = parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda333");

const checking = createAccount({
  id: ACCOUNT_CHECKING,
  workspaceId: WORKSPACE_ID,
  name: "Everyday Checking",
  type: "checking",
  currency: "CAD",
  now: NOW,
});

const savings = createAccount({
  id: ACCOUNT_SAVINGS,
  workspaceId: WORKSPACE_ID,
  name: "High Interest Savings",
  type: "savings",
  currency: "CAD",
  now: NOW,
});

describe("transfer-matching domain module", () => {
  it("computes deterministic signature regardless of order", () => {
    const sig1 = calculateTransferSignature("tx-1", "tx-2");
    const sig2 = calculateTransferSignature("tx-2", "tx-1");
    expect(sig1).toBe(sig2);
    expect(sig1).toBe("tx-1:tx-2");
  });

  it("matches exact opposite transfers between distinct accounts within 0-3 days", () => {
    const txOut = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda001"),
      accountId: ACCOUNT_CHECKING,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("-500.00", "CAD"),
      description: "ONLINE TRANSFER TO SAVINGS",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "1",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const txIn = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda002"),
      accountId: ACCOUNT_SAVINGS,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-21"),
      money: Money.from("500.00", "CAD"),
      description: "ONLINE TRANSFER FROM CHECKING",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "2",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const proposals = findTransferProposals([txOut, txIn], [checking, savings]);
    expect(proposals).toHaveLength(1);
    expect(proposals[0]?.outflowTransaction.id).toBe(txOut.id);
    expect(proposals[0]?.inflowTransaction.id).toBe(txIn.id);
    expect(proposals[0]?.isAmbiguous).toBe(false);
  });

  it("flags ambiguous proposals when multiple transactions compete", () => {
    const txOut1 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda001"),
      accountId: ACCOUNT_CHECKING,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("-100.00", "CAD"),
      description: "TRANSFER 1",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "1",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const txOut2 = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda002"),
      accountId: ACCOUNT_CHECKING,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("-100.00", "CAD"),
      description: "TRANSFER 2",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "2",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const txIn = createTransaction({
      id: parseTransactionId("018f6b80-0d62-7d2c-9a5c-7f5f59cda003"),
      accountId: ACCOUNT_SAVINGS,
      importId: IMPORT_ID,
      postedDate: parseDateOnly("2026-07-20"),
      money: Money.from("100.00", "CAD"),
      description: "DEPOSIT",
      provenance: {
        parserId: "csv",
        parserVersion: "1.0.0",
        sourceLocation: "3",
        original: {},
        transformations: [],
      },
      now: NOW,
    });

    const proposals = findTransferProposals([txOut1, txOut2, txIn], [checking, savings]);
    expect(proposals).toHaveLength(2);
    expect(proposals[0]?.isAmbiguous).toBe(true);
    expect(proposals[1]?.isAmbiguous).toBe(true);
  });
});
