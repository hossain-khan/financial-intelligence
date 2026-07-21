// @vitest-environment jsdom

import type { RestorePlan } from "@financial-intelligence/application";
import type { WorkspaceBackupSnapshot } from "@financial-intelligence/backup";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RestorePanel } from "./RestorePanel";
import type { ApplicationServices } from "./infrastructure";

afterEach(cleanup);

function plan(overrides: Partial<RestorePlan> = {}): RestorePlan {
  return {
    preview: {
      workspaceName: "Restored household",
      exportedAt: "2026-07-20T10:00:00.000Z",
      revision: 2,
      counts: {
        accounts: 1,
        imports: 0,
        transactions: 3,
        categories: 0,
        merchants: 0,
        classificationRules: 0,
        transferDecisions: 0,
        recurringDecisions: 0,
        learningOperations: 0,
        decisionEvents: 0,
        transactionOperations: 0,
        duplicateResolutionEvents: 0,
      },
    },
    workspaceId: "018f6b80-0d62-7d2c-9a5c-7f5f59cda999",
    workspaceExistsLocally: false,
    mergeConflicts: [],
    estimatedBytes: 2048,
    ...overrides,
  };
}

const snapshot = { workspace: { id: "w" } } as unknown as WorkspaceBackupSnapshot;

function makeServices(overrides: {
  plan?: RestorePlan;
  planError?: unknown;
  apply?: () => Promise<unknown>;
}) {
  const planExecute = vi.fn(async () => {
    if (overrides.planError) throw overrides.planError;
    return { plan: overrides.plan ?? plan(), snapshot };
  });
  const applyExecute = vi.fn(
    overrides.apply ??
      (async () => ({
        mode: "restore-as-new",
        workspaceId: "w",
        committedRevision: 2,
        recordsWritten: 4,
      })),
  );
  const services = {
    planWorkspaceRestore: { execute: planExecute },
    applyWorkspaceRestore: { execute: applyExecute },
  } as unknown as ApplicationServices;
  return { services, planExecute, applyExecute };
}

async function selectBackup() {
  const file = new File(["{}"], "backup.fintbackup");
  fireEvent.change(screen.getByLabelText("Backup file to restore"), { target: { files: [file] } });
  fireEvent.change(screen.getByLabelText("Backup passphrase"), {
    target: { value: "correct horse battery staple" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify and plan restore" }));
}

describe("RestorePanel", () => {
  it("shows a metadata-only plan and restores as new", async () => {
    const { services, applyExecute } = makeServices({});
    render(<RestorePanel services={services} />);
    await selectBackup();

    expect(await screen.findByLabelText("Restore plan")).toHaveTextContent("Restored household");
    fireEvent.click(screen.getByRole("button", { name: "Restore now" }));
    await waitFor(() => expect(applyExecute).toHaveBeenCalledWith(snapshot, "restore-as-new"));
    expect(await screen.findByText(/Your original data is safe/)).toBeInTheDocument();
  });

  it("requires typed confirmation before replacing", async () => {
    const { services, applyExecute } = makeServices({
      plan: plan({ workspaceExistsLocally: true }),
    });
    render(<RestorePanel services={services} />);
    await selectBackup();
    await screen.findByLabelText("Restore plan");

    fireEvent.click(screen.getByLabelText(/Replace existing workspace/));
    fireEvent.click(screen.getByRole("button", { name: "Restore now" }));
    // Without the typed confirmation the apply must not run.
    expect(applyExecute).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(/Type REPLACE to confirm/);

    fireEvent.change(screen.getByLabelText("Type REPLACE to confirm"), {
      target: { value: "REPLACE" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Restore now" }));
    await waitFor(() => expect(applyExecute).toHaveBeenCalledWith(snapshot, "replace"));
  });

  it("blocks a conflicting merge", async () => {
    const { services, applyExecute } = makeServices({
      plan: plan({
        workspaceExistsLocally: true,
        mergeConflicts: [{ section: "accounts", id: "a", reason: "divergent-record" }],
      }),
    });
    render(<RestorePanel services={services} />);
    await selectBackup();
    await screen.findByLabelText("Restore plan");
    // Merge is the default for an existing workspace; the conflict warning is shown and apply blocked.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/conflict/i);
    expect(screen.getByRole("button", { name: "Restore now" })).toBeDisabled();
    expect(applyExecute).not.toHaveBeenCalled();
  });

  it("surfaces a wrong-passphrase failure", async () => {
    const { services } = makeServices({ planError: { code: "DECRYPTION_FAILED" } });
    render(<RestorePanel services={services} />);
    await selectBackup();
    expect(await screen.findByText(/could not be verified/)).toBeInTheDocument();
  });
});
