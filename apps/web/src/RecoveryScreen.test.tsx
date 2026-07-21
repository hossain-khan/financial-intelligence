// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import type { ApplicationServices } from "./infrastructure";
import { RecoveryScreen } from "./RecoveryScreen";

afterEach(cleanup);

const services = {
  listWorkspaces: { execute: vi.fn(async () => []) },
  listAccounts: { execute: vi.fn(async () => []) },
} as unknown as ApplicationServices;

describe("App startup health gate", () => {
  it("renders the app when the database opens", async () => {
    render(<App services={services} checkHealth={async () => ({ ok: true })} />);
    expect(
      await screen.findByRole("heading", { name: /Understand your cash flow/i }),
    ).toBeVisible();
  });

  it("renders the recovery screen when the database cannot open, without clearing data", async () => {
    render(
      <App
        services={services}
        checkHealth={async () => ({
          ok: false,
          code: "VERSION_INCOMPATIBLE",
          message: "The local database could not be opened. Your data has not been changed.",
        })}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: /couldn’t open your local data/i }),
    ).toBeVisible();
    expect(screen.getByText(/VERSION_INCOMPATIBLE/)).toBeInTheDocument();
    // The ledger UI must not render behind a failed open.
    expect(screen.queryByRole("heading", { name: /Understand your cash flow/i })).toBeNull();
  });

  it("retries the health check when the user asks", async () => {
    const checkHealth = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: "OPEN_FAILED", message: "Failed." })
      .mockResolvedValueOnce({ ok: true });
    render(<App services={services} checkHealth={checkHealth} />);
    const retry = await screen.findByRole("button", { name: "Try again" });
    fireEvent.click(retry);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /Understand your cash flow/i })).toBeVisible(),
    );
    expect(checkHealth).toHaveBeenCalledTimes(2);
  });
});

describe("RecoveryScreen", () => {
  it("exposes retry and diagnostic export actions", () => {
    render(
      <RecoveryScreen
        code="OPEN_FAILED"
        message="Could not open."
        onRetry={() => {}}
        isRetrying={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Export diagnostic" })).toBeEnabled();
  });
});
