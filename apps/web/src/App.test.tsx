// @vitest-environment jsdom

import {
  AccountValidationError,
  createAccount,
  createWorkspace,
  parseAccountId,
  parseUtcTimestamp,
  parseWorkspaceId,
  type Account,
  type Workspace,
} from "@financial-intelligence/domain";
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OverviewPage } from "./App";
import type { ApplicationServices } from "./infrastructure";

afterEach(cleanup);

describe("OverviewPage", () => {
  it("explains the empty local workspace state", async () => {
    const services = {
      listWorkspaces: { execute: async () => [] as readonly Workspace[] },
      createWorkspace: { execute: async () => Promise.reject(new Error("not used")) },
    } as unknown as ApplicationServices;

    render(<OverviewPage services={services} />);

    expect(await screen.findByText("No workspace exists on this device yet.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create workspace" })).toBeEnabled();
  });

  it("explains local storage responsibility and renders active and archived account states", async () => {
    const accounts = [
      fixtureAccount(),
      fixtureAccount({
        archived: true,
        id: "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f3",
        name: "Old card",
      }),
    ];
    render(<OverviewPage services={servicesFor(accounts)} />);

    expect(
      await screen.findByText("No bank login or full account number is used."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Active accounts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Archived accounts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.getByText(/Browser data can be cleared/)).toBeInTheDocument();
  });

  it("associates application validation failures with the account field", async () => {
    const services = servicesFor([]);
    vi.mocked(services.createAccount.execute).mockRejectedValueOnce(
      new AccountValidationError("currency", "Enter an uppercase ISO 4217 currency code"),
    );
    render(<OverviewPage services={services} />);
    const addButton = await screen.findByRole("button", { name: "Add account" });
    const currency = screen.getByRole("textbox", { name: "Currency" });
    fireEvent.change(currency, { target: { value: "cad" } });
    fireEvent.submit(addButton.closest("form")!);

    expect(
      await screen.findByText("Enter an uppercase ISO 4217 currency code"),
    ).toBeInTheDocument();
    expect(currency).toHaveAttribute("aria-invalid", "true");
  });

  it("submits rename and archive controls without pointer-only interactions", async () => {
    const services = servicesFor([fixtureAccount()]);
    render(<OverviewPage services={services} />);
    const renameInput = await screen.findByRole("textbox", { name: "Rename Everyday" });
    fireEvent.change(renameInput, { target: { value: "Household bills" } });
    fireEvent.submit(renameInput.closest("form")!);
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(services.renameAccount.execute).toHaveBeenCalledWith(
        "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2",
        "Household bills",
      );
      expect(services.setAccountArchived.execute).toHaveBeenCalledWith(
        "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2",
        true,
      );
    });
  });
});

function fixtureWorkspace(): Workspace {
  return createWorkspace({
    id: parseWorkspaceId("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1"),
    name: "Household",
    now: parseUtcTimestamp("2026-07-19T16:00:00.000Z"),
  });
}

function fixtureAccount(
  override: { readonly archived?: boolean; readonly id?: string; readonly name?: string } = {},
): Account {
  const account = createAccount({
    id: parseAccountId(override.id ?? "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f2"),
    workspaceId: fixtureWorkspace().id,
    name: override.name ?? "Everyday",
    type: "checking",
    currency: "CAD",
    now: parseUtcTimestamp("2026-07-19T16:00:00.000Z"),
  });
  return override.archived ? { ...account, archived: true } : account;
}

function servicesFor(accounts: readonly Account[]): ApplicationServices {
  return {
    listWorkspaces: { execute: vi.fn(async () => [fixtureWorkspace()]) },
    createWorkspace: { execute: vi.fn() },
    listAccounts: { execute: vi.fn(async () => accounts) },
    createAccount: { execute: vi.fn() },
    renameAccount: { execute: vi.fn(async () => accounts[0]) },
    setAccountArchived: { execute: vi.fn(async () => accounts[0]) },
    requestAccountDeletion: { execute: vi.fn() },
  } as unknown as ApplicationServices;
}
