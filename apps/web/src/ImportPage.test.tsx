// @vitest-environment jsdom

import {
  createAccount,
  createCommittedImport,
  createWorkspace,
  parseAccountId,
  parseImportId,
  parseUtcTimestamp,
  parseWorkspaceId,
} from "@financial-intelligence/domain";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApplicationServices } from "./infrastructure";
import { ImportPage } from "./ImportPage";
import type { StatementSourceBase } from "./statement-import";

afterEach(cleanup);

describe("ImportPage", () => {
  it("requires explicit confirmation then commits atomically and shows import history", async () => {
    const parseFiles = vi.fn(async () => [validSource()]);
    const { commitExecute } = renderPage(parseFiles);

    const picker = await screen.findByLabelText("Select one or more bounded statement files");
    expect(picker).toHaveAttribute("multiple");
    fireEvent.change(picker, {
      target: { files: [new File(["safe"], "statement.csv", { type: "text/csv" })] },
    });

    expect(await screen.findByText(/Parsed 1 source file containing 2 rows/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Posted date column" })).toHaveValue(
      "Transfer date",
    );
    expect(screen.getByRole("combobox", { name: "Description column" })).toHaveValue("Description");
    expect(screen.getByRole("combobox", { name: "Amount column" })).toHaveValue("Amount");
    expect(screen.getByText(/explicitly confirm date and amount direction/)).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Target account" }), {
      target: { value: ACCOUNT_ID },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Date format (must be confirmed)" }), {
      target: { value: "YYYY-MM-DD" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "What does a positive amount mean?" }), {
      target: { value: "inflow" },
    });

    const confirm = await screen.findByRole("button", { name: "Commit accepted transactions" });
    expect(confirm).toBeEnabled();
    expect(screen.getAllByText("CAD 100.00").length).toBeGreaterThan(0);
    expect(screen.getByText("CAD 4.25")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Transaction mapping preview" })).toHaveAttribute(
      "tabindex",
      "0",
    );

    fireEvent.click(confirm);
    expect(await screen.findByText(/Committed 2 transactions atomically/)).toBeInTheDocument();
    expect(screen.getByText("2 transactions")).toBeInTheDocument();
    expect(commitExecute).toHaveBeenCalledOnce();
    expect(JSON.stringify(commitExecute.mock.calls[0]?.[0])).not.toContain("bytes");
  });

  it("does not start a canonical commit when the parser worker fails", async () => {
    const { commitExecute } = renderPage(async () => {
      throw new Error("Synthetic worker failure");
    });
    const picker = await screen.findByLabelText("Select one or more bounded statement files");
    fireEvent.change(picker, { target: { files: [new File(["safe"], "statement.csv")] } });
    expect(await screen.findByText("Synthetic worker failure")).toHaveAttribute("role", "alert");
    expect(commitExecute).not.toHaveBeenCalled();
  });

  it("announces row errors with source, field, safe correction, and keeps confirmation disabled", async () => {
    const invalid = validSource({
      "Transfer date": "07/19/2026",
      Description: "",
      Amount: "not money",
      Balance: "$0.00",
    });
    renderPage(async () => [invalid]);
    const picker = await screen.findByLabelText("Select one or more bounded statement files");
    fireEvent.change(picker, { target: { files: [new File(["safe"], "statement.csv")] } });
    await screen.findByText(/Parsed 1 source file/);
    fireEvent.change(screen.getByRole("combobox", { name: "Target account" }), {
      target: { value: ACCOUNT_ID },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Date format (must be confirmed)" }), {
      target: { value: "YYYY-MM-DD" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "What does a positive amount mean?" }), {
      target: { value: "inflow" },
    });

    expect(await screen.findByText(/line:2 · postedDate/)).toBeInTheDocument();
    expect(screen.getAllByText(/Correction:/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Commit accepted transactions" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Download sanitized error report" })).toBeEnabled();
    expect(document.body.textContent).not.toContain("not money");
  });
});

const WORKSPACE_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1";
const ACCOUNT_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2";

function renderPage(
  parseFiles: (files: readonly File[]) => Promise<readonly StatementSourceBase[]>,
) {
  const workspace = createWorkspace({
    id: parseWorkspaceId(WORKSPACE_ID),
    name: "Household",
    now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
  });
  const account = createAccount({
    id: parseAccountId(ACCOUNT_ID),
    workspaceId: workspace.id,
    name: "Everyday",
    type: "checking",
    currency: "CAD",
    now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
  });
  const entries = new Map<string, string>();
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
  };
  const commitExecute = vi.fn(async (_command: unknown) => ({
    imports: [historyImport(account)],
    transactionCount: 2,
    committedRevision: 2,
  }));
  const services = {
    listWorkspaces: { execute: vi.fn(async () => [workspace]) },
    listAccounts: { execute: vi.fn(async () => [account]) },
    commitAcceptedImport: {
      execute: commitExecute,
    },
    listImportHistory: {
      execute: vi
        .fn<() => Promise<readonly ReturnType<typeof historyImport>[]>>()
        .mockResolvedValueOnce([])
        .mockResolvedValue([historyImport(account)]),
    },
    listTransactions: { execute: vi.fn(async () => []) },
  } as unknown as ApplicationServices;
  render(
    <ImportPage
      services={services}
      parseFiles={parseFiles}
      presetStorage={storage}
      now={() => "2026-07-19T20:00:00.000Z"}
    />,
  );
  return { commitExecute };
}

function historyImport(account: ReturnType<typeof createAccount>) {
  return createCommittedImport({
    id: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3"),
    accountId: account.id,
    source: {
      fileName: "statement.csv",
      mediaType: "text/csv",
      byteSize: 100,
      sha256: "a".repeat(64),
    },
    parser: { id: "financial-intelligence/csv", version: "1.0.0" },
    mapping: { dateFormat: "YYYY-MM-DD" },
    counts: {
      sourceRows: 2,
      valid: 2,
      errors: 0,
      warnings: 0,
      exactDuplicates: 0,
      likelyDuplicates: 0,
      committed: 2,
    },
    issues: [],
    committedRevision: 2,
    now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
  });
}

function validSource(firstRow?: Record<string, string>): StatementSourceBase {
  return {
    metadata: {
      fileName: "statement.csv",
      mediaType: "text/csv",
      byteSize: 100,
      sha256: "a".repeat(64),
    },
    parserId: "financial-intelligence/csv",
    parserVersion: "1.0.0",
    rows: [
      {
        sourceLocation: "line:2",
        fields: firstRow ?? {
          "Transfer date": "2026-07-18",
          Description: "Coffee",
          Amount: "-$4.25",
          Balance: "$1000.00",
        },
      },
      {
        sourceLocation: "line:3",
        fields: {
          "Transfer date": "2026-07-19",
          Description: "Payroll",
          Amount: "$100.00",
          Balance: "$1100.00",
        },
      },
    ],
    issues: [],
    detectedMetadata: undefined,
  };
}
