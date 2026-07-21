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
import type { ParsedOfxSource } from "./ofx-import";

afterEach(cleanup);

const WORKSPACE_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1";
const ACCOUNT_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2";

function ofxSource(): ParsedOfxSource {
  return {
    metadata: {
      fileName: "statement.ofx",
      mediaType: "application/x-ofx",
      byteSize: 200,
      sha256: "b".repeat(64),
    },
    result: {
      parserId: "ofx",
      parserVersion: "1.0.0",
      rows: [
        {
          sourceLocation: "statement:1/transaction:1",
          fields: {
            posted_date: "2024-01-15",
            amount: "-42.50",
            description: "COFFEE",
            currency: "CAD",
            fitid: "A1",
          },
        },
      ],
      issues: [
        {
          code: "UNSUPPORTED_SECTION",
          severity: "warning",
          sourceLocation: "section:INVSTMTMSGSRSV1",
          message: "The “INVSTMTMSGSRSV1” section is not supported and was ignored.",
        },
      ],
      detectedMetadata: {
        dialect: "ofx-sgml",
        currency: "CAD",
        statementCount: 1,
        transactionCount: 1,
        accountType: "CHECKING",
        maskedAccountHint: "••••4567",
      },
    },
  };
}

function renderPage() {
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
  const commitExecute = vi.fn(async (_command: unknown) => ({
    imports: [
      createCommittedImport({
        id: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3"),
        accountId: account.id,
        source: {
          fileName: "statement.ofx",
          mediaType: "application/x-ofx",
          byteSize: 200,
          sha256: "b".repeat(64),
        },
        parser: { id: "ofx", version: "1.0.0" },
        mapping: { format: "ofx" },
        counts: {
          sourceRows: 1,
          valid: 1,
          errors: 0,
          warnings: 1,
          exactDuplicates: 0,
          likelyDuplicates: 0,
          committed: 1,
        },
        issues: [],
        committedRevision: 2,
        now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
      }),
    ],
    transactionCount: 1,
    committedRevision: 2,
  }));
  const services = {
    listWorkspaces: { execute: vi.fn(async () => [workspace]) },
    listAccounts: { execute: vi.fn(async () => [account]) },
    commitAcceptedImport: { execute: commitExecute },
    listImportHistory: { execute: vi.fn(async () => []) },
    listTransactions: { execute: vi.fn(async () => []) },
  } as unknown as ApplicationServices;
  render(
    <ImportPage
      services={services}
      parseFiles={async () => []}
      parseOfx={async () => ofxSource()}
      detectFormat={async () => "ofx"}
      presetStorage={{ getItem: () => null, setItem: () => undefined }}
      now={() => "2026-07-19T20:00:00.000Z"}
    />,
  );
  return { commitExecute };
}

describe("ImportPage OFX flow", () => {
  it("parses, auto-matches the single same-currency account, previews, and commits", async () => {
    const { commitExecute } = renderPage();
    const picker = await screen.findByLabelText("Select CSV files, or a single OFX/QFX statement");
    fireEvent.change(picker, {
      target: { files: [new File(["OFXHEADER:100"], "statement.ofx")] },
    });

    expect(await screen.findByText(/Parsed OFX statement/)).toBeInTheDocument();
    expect(screen.getAllByText("OFX 1.x (SGML)").length).toBeGreaterThan(0);
    expect(screen.getByText("••••4567")).toBeInTheDocument();
    // Unsupported section stays visible.
    expect(screen.getAllByText(/INVSTMTMSGSRSV1/).length).toBeGreaterThan(0);

    // Single CAD account was auto-selected, so the preview is ready.
    const confirm = await screen.findByRole("button", { name: "Commit accepted transactions" });
    expect(confirm).toBeEnabled();
    expect(screen.getByText("CAD 42.50")).toBeInTheDocument();

    fireEvent.click(confirm);
    expect(await screen.findByText(/Committed 1 transaction atomically/)).toBeInTheDocument();
    expect(commitExecute).toHaveBeenCalledOnce();
    const command = commitExecute.mock.calls[0]?.[0] as { candidates: unknown[] };
    expect(command.candidates).toHaveLength(1);
    expect(JSON.stringify(command)).not.toContain("bytes");
  });
});
