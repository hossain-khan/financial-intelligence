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
import type { ParsedPdfSource } from "./pdf-import";

afterEach(cleanup);

const WORKSPACE_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1";
const ACCOUNT_ID = "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2";
const LABEL = "Select CSV files, or a single OFX/QFX or PDF statement";

function pdfSource(): ParsedPdfSource {
  return {
    metadata: {
      fileName: "statement.pdf",
      mediaType: "application/pdf",
      byteSize: 500,
      sha256: "d".repeat(64),
    },
    result: {
      parserId: "pdf",
      parserVersion: "1.0.0",
      rows: [
        {
          sourceLocation: "page:1/items:3-5",
          fields: { postedDate: "2026-01-15", description: "RENT PAYMENT", amount: "-1000.00" },
        },
      ],
      issues: [],
      detectedMetadata: {
        adapterId: "generic-tabular",
        pageCount: 1,
        columnMode: "signed-amount",
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
    currency: "USD",
    now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
  });
  const commitExecute = vi.fn(async (_command: unknown) => ({
    imports: [
      createCommittedImport({
        id: parseImportId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3"),
        accountId: account.id,
        source: {
          fileName: "statement.pdf",
          mediaType: "application/pdf",
          byteSize: 500,
          sha256: "d".repeat(64),
        },
        parser: { id: "pdf", version: "1.0.0" },
        mapping: { format: "pdf" },
        counts: {
          sourceRows: 1,
          valid: 1,
          errors: 0,
          warnings: 0,
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
      parsePdf={async () => pdfSource()}
      detectFormat={async () => "pdf"}
      presetStorage={{ getItem: () => null, setItem: () => undefined }}
      now={() => "2026-07-19T20:00:00.000Z"}
    />,
  );
  return { commitExecute };
}

describe("ImportPage PDF flow", () => {
  it("parses, auto-selects the single account, previews provenance, and commits", async () => {
    const { commitExecute } = renderPage();
    const picker = await screen.findByLabelText(LABEL);
    fireEvent.change(picker, { target: { files: [new File(["%PDF-1.4"], "statement.pdf")] } });

    expect(await screen.findByText(/Parsed PDF statement/)).toBeInTheDocument();
    expect(screen.getAllByText("generic-tabular").length).toBeGreaterThan(0);

    const confirm = await screen.findByRole("button", { name: "Commit accepted transactions" });
    expect(confirm).toBeEnabled();
    expect(screen.getByText("USD -1000.00")).toBeInTheDocument();

    fireEvent.click(confirm);
    expect(await screen.findByText(/Committed 1 transaction atomically/)).toBeInTheDocument();
    expect(commitExecute).toHaveBeenCalledOnce();
    const command = commitExecute.mock.calls[0]?.[0] as {
      candidates: { provenance: { sourceLocation: string; parserId: string } }[];
      mapping: Record<string, string>;
    };
    expect(command.candidates[0]?.provenance.sourceLocation).toBe("page:1/items:3-5");
    expect(command.candidates[0]?.provenance.parserId).toBe("pdf");
    expect(command.mapping.format).toBe("pdf");
    expect(JSON.stringify(command)).not.toContain("bytes");
  });

  it("shows unsupported guidance when detection rejects the file", async () => {
    const services = {
      listWorkspaces: {
        execute: vi.fn(async () => [
          createWorkspace({
            id: parseWorkspaceId(WORKSPACE_ID),
            name: "Household",
            now: parseUtcTimestamp("2026-07-19T20:00:00.000Z"),
          }),
        ]),
      },
      listAccounts: { execute: vi.fn(async () => []) },
      commitAcceptedImport: { execute: vi.fn() },
      listImportHistory: { execute: vi.fn(async () => []) },
      listTransactions: { execute: vi.fn(async () => []) },
    } as unknown as ApplicationServices;
    render(
      <ImportPage
        services={services}
        parseFiles={async () => []}
        parsePdf={async () => {
          throw new Error(
            "This PDF has no selectable text (it looks scanned or image-only). Export a CSV or OFX statement, or a text-based PDF.",
          );
        }}
        detectFormat={async () => "pdf"}
        presetStorage={{ getItem: () => null, setItem: () => undefined }}
      />,
    );
    const picker = await screen.findByLabelText(LABEL);
    fireEvent.change(picker, { target: { files: [new File(["%PDF-1.4"], "scan.pdf")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/scanned or image-only/u);
  });
});
