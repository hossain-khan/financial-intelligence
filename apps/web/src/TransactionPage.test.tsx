// @vitest-environment jsdom

import { analyzeCashFlow } from "@financial-intelligence/analysis";
import {
  Money,
  createAccount,
  createStarterCategories,
  createTransaction,
  createWorkspace,
  duplicateEvidenceSignature,
  parseAccountId,
  parseDateOnly,
  parseImportId,
  parseTransactionId,
  parseUtcTimestamp,
  parseWorkspaceId,
  type DuplicateCandidate,
  type Transaction,
} from "@financial-intelligence/domain";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApplicationServices } from "./infrastructure";
import { TransactionPage } from "./TransactionPage";

afterEach(cleanup);

describe("TransactionPage", () => {
  it("renders a keyboard-operable ledger, provenance, categories, and manual edits", async () => {
    const transaction = fixtureTransaction();
    const services = fixtureServices([transaction]);
    render(<TransactionPage services={services} />);

    expect(await screen.findByRole("heading", { name: "Ledger" })).toBeInTheDocument();
    await waitFor(() => {
      expect(services.queryTransactionLedger.execute).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole("region", { name: "Transaction ledger" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cash-flow summary" })).toBeInTheDocument();
    expect(screen.getAllByText("CAD 4.25").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Coffee shop").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Source details"));
    expect(screen.getByText("line:2")).toBeInTheDocument();
    expect(screen.getByText(/raw coffee/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Load edit history" }));
    expect(await screen.findByText("No manual edits have been recorded.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("From date"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(screen.getByLabelText("To date"), {
      target: { value: "2026-07-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reset shared filters" }));
    expect(screen.getByLabelText("From date")).toHaveValue("");
    expect(screen.getByLabelText("To date")).toHaveValue("");
    fireEvent.click(screen.getAllByText("View 1 transaction(s)")[0]!);
    expect(
      screen.getAllByText(
        "These are the exact canonical records contributing to the selected fact.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("list", { name: /2026-07 CAD cash flow/u })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Category for Coffee shop" }), {
      target: { value: createStarterCategories(NOW)[2]!.id },
    });
    await waitFor(() => {
      expect(services.applyBulkTransactionEdit.execute).toHaveBeenCalledWith([transaction.id], {
        category: createStarterCategories(NOW)[2]!.id,
      });
    });
  });

  it("previews reversible bulk changes and exposes every duplicate decision", async () => {
    const existing = fixtureTransaction();
    const incoming = fixtureTransaction({
      id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f5",
      importId: "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f6",
      createdAt: "2026-07-20T17:00:00.000Z",
    });
    const candidate: DuplicateCandidate = {
      id: `${existing.id}:${incoming.id}`,
      existingTransactionId: existing.id,
      incomingTransactionId: incoming.id,
      kind: "exact",
      score: 10_000,
      evidence: [{ code: "source-transaction-id", weight: 10_000, detail: "Same source ID" }],
    };
    const services = fixtureServices([existing, incoming], [candidate]);
    render(<TransactionPage services={services} />);

    expect(await screen.findByText("Same source ID")).toBeInTheDocument();
    for (const label of ["Keep existing", "Keep new", "Keep both", "Link manually"]) {
      expect(screen.getByRole("button", { name: label })).toBeEnabled();
    }
    fireEvent.click(screen.getByRole("button", { name: "Keep both" }));
    await waitFor(() => {
      expect(services.resolveDuplicate.execute).toHaveBeenCalledWith({
        candidateId: candidate.id,
        evidenceSignature: duplicateEvidenceSignature(candidate),
        action: "keep-both",
      });
    });

    fireEvent.click(screen.getAllByRole("checkbox", { name: "Select Coffee shop" })[0]!);
    fireEvent.change(screen.getByLabelText("Set review state"), { target: { value: "reviewed" } });
    fireEvent.click(screen.getByRole("button", { name: "Preview affected count" }));
    expect(await screen.findByText("This will change 1 transaction.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply bulk change" }));
    await waitFor(() => {
      expect(services.applyBulkTransactionEdit.execute).toHaveBeenCalledWith([existing.id], {
        reviewState: "reviewed",
      });
    });
  });
});

const NOW = parseUtcTimestamp("2026-07-19T17:00:00.000Z");
const WORKSPACE_ID = parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1");
const ACCOUNT_ID = parseAccountId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2");

function fixtureTransaction(
  override: { readonly id?: string; readonly importId?: string; readonly createdAt?: string } = {},
): Transaction {
  return createTransaction({
    id: parseTransactionId(override.id ?? "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f4"),
    accountId: ACCOUNT_ID,
    importId: parseImportId(override.importId ?? "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3"),
    postedDate: parseDateOnly("2026-07-19"),
    money: Money.from("-4.25", "CAD"),
    description: "Coffee shop",
    sourceTransactionId: "source-1",
    provenance: {
      parserId: "csv",
      parserVersion: "1",
      sourceLocation: "line:2",
      original: { description: "raw coffee", amount: "4.25" },
      transformations: ["mapping:1"],
    },
    now: parseUtcTimestamp(override.createdAt ?? NOW),
  });
}

function fixtureServices(
  transactions: readonly Transaction[],
  candidates: readonly DuplicateCandidate[] = [],
): ApplicationServices {
  const workspace = createWorkspace({ id: WORKSPACE_ID, name: "Household", now: NOW });
  const account = createAccount({
    id: ACCOUNT_ID,
    workspaceId: WORKSPACE_ID,
    name: "Everyday",
    type: "checking",
    currency: "CAD",
    now: NOW,
  });
  const operation = {
    id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda2fa",
    kind: "manual-transaction-edit",
    changes: [
      { transactionId: transactions[0]!.id, before: transactions[0]!, after: transactions[0]! },
    ],
    createdAt: NOW,
  } as const;
  const starterCategories = createStarterCategories(NOW);
  return {
    listWorkspaces: { execute: vi.fn(async () => [workspace]) },
    listAccounts: { execute: vi.fn(async () => [account]) },
    listCategories: { execute: vi.fn(async () => starterCategories) },
    queryCashFlowSummary: {
      execute: vi.fn(async (filter) =>
        analyzeCashFlow({
          transactions,
          categories: starterCategories,
          filter,
          asOfDate: "2026-07-19",
        }),
      ),
    },
    exportFilteredTransactions: {
      execute: vi.fn(async () => ({
        mediaType: "text/csv;charset=utf-8" as const,
        fileName: "financial-intelligence-transactions-2026-07-19.csv",
        content: "transaction_id\r\n",
        rowCount: transactions.length,
        filterSummary: "All dates",
      })),
    },
    queryTransactionLedger: {
      execute: vi.fn(async () => ({
        items: transactions,
        total: transactions.length,
        offset: 0,
        limit: 50,
      })),
    },
    listTransactionEditHistory: { execute: vi.fn(async () => []) },
    listTransactions: { execute: vi.fn(async () => transactions) },
    findDuplicateCandidates: { execute: vi.fn(async () => candidates) },
    listDuplicateResolutions: { execute: vi.fn(async () => new Map()) },
    resolveDuplicate: { execute: vi.fn(async () => ({ id: "decision" })) },
    undoDuplicateResolution: { execute: vi.fn() },
    previewBulkTransactionEdit: {
      execute: vi.fn(async (ids: readonly string[]) => ({
        selectedCount: ids.length,
        affectedCount: ids.length,
        unchangedCount: 0,
        missingCount: 0,
      })),
    },
    applyBulkTransactionEdit: { execute: vi.fn(async () => operation) },
    undoBulkTransactionEdit: { execute: vi.fn() },
    renameCategory: { execute: vi.fn() },
    setCategoryArchived: { execute: vi.fn() },
  } as unknown as ApplicationServices;
}
