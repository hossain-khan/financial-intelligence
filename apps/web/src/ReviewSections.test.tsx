// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Account, RecurringProposal, TransferProposal } from "@financial-intelligence/domain";

import { RecurringReviewSection } from "./RecurringReviewSection";
import { TransferReviewSection } from "./TransferReviewSection";

afterEach(cleanup);

const recurring = {
  id: "recurring-1",
  name: "Video Service",
  cadence: "monthly",
  currency: "CAD",
  memberTransactions: [{}, {}, {}],
  lastSeenDate: "2026-07-01",
  nextExpectedDate: "2026-08-01",
  amountStats: { min: "10.00", max: "12.00", median: "11.00", isVariable: true },
} as unknown as RecurringProposal;

const transfer = {
  id: "transfer-1",
  outflowTransaction: {
    accountId: "account-1",
    postedDate: "2026-07-01",
    description: "Transfer out",
    money: { toString: () => "CAD -100.00" },
  },
  inflowTransaction: {
    accountId: "missing-account",
    postedDate: "2026-07-02",
    description: "Transfer in",
    money: { toString: () => "CAD 100.00" },
  },
  evidence: [
    { code: "amount-match", detail: "Amounts match" },
    { code: "ambiguous-candidate-count", detail: "Another match exists" },
  ],
} as unknown as TransferProposal;

const accounts = [{ id: "account-1", name: "Chequing" }] as unknown as Account[];

describe("RecurringReviewSection", () => {
  it("renders nothing without proposals", () => {
    const { container } = render(
      <RecurringReviewSection
        proposals={[]}
        onConfirm={vi.fn()}
        onDismiss={vi.fn()}
        onMute={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("handles confirming, dismissing, and muting proposals", async () => {
    const onConfirm = vi.fn(async () => undefined);
    const onDismiss = vi.fn(async () => undefined);
    const onMute = vi.fn(async () => undefined);
    render(
      <RecurringReviewSection
        proposals={[recurring]}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
        onMute={onMute}
      />,
    );
    expect(screen.getByText("CAD 10.00 – 12.00")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirm recurring series/ }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(recurring));
    expect(screen.getByText(/confirmed/, { selector: ".sr-only" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Dismiss recurring proposal/ }));
    await waitFor(() => expect(onDismiss).toHaveBeenCalledWith(recurring));
    expect(screen.getByText(/dismissed/, { selector: ".sr-only" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mute recurring proposal/ }));
    await waitFor(() => expect(onMute).toHaveBeenCalledWith(recurring));
    expect(screen.getByText(/muted/, { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("reports action failures and renders fixed recurring amounts", async () => {
    const fixed = { ...recurring, amountStats: { ...recurring.amountStats, isVariable: false } };
    render(
      <RecurringReviewSection
        proposals={[fixed]}
        onConfirm={vi.fn(async () => Promise.reject(new Error("confirm failed")))}
        onDismiss={vi.fn(async () => Promise.reject(new Error("dismiss failed")))}
        onMute={vi.fn(async () => Promise.reject(new Error("mute failed")))}
      />,
    );
    expect(screen.getByText("CAD 11.00")).toBeInTheDocument();
    for (const [name, message] of [
      [/Confirm recurring series/, "confirm failed"],
      [/Dismiss recurring proposal/, "dismiss failed"],
      [/Mute recurring proposal/, "mute failed"],
    ] as const) {
      fireEvent.click(screen.getByRole("button", { name }));
      expect(
        await screen.findByText(new RegExp(message), { selector: ".sr-only" }),
      ).toBeInTheDocument();
    }
  });
});

describe("TransferReviewSection", () => {
  it("renders nothing without proposals", () => {
    const { container } = render(
      <TransferReviewSection proposals={[]} accounts={[]} onConfirm={vi.fn()} onReject={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows evidence and handles confirm and reject", async () => {
    const onConfirm = vi.fn(async () => undefined);
    const onReject = vi.fn(async () => undefined);
    render(
      <TransferReviewSection
        proposals={[transfer]}
        accounts={accounts}
        onConfirm={onConfirm}
        onReject={onReject}
      />,
    );
    expect(screen.getByText(/Outflow \(Chequing\)/)).toBeInTheDocument();
    expect(screen.getByText(/Inflow \(missing-account\)/)).toBeInTheDocument();
    expect(screen.getByTitle("Another match exists")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirm transfer proposal/ }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith(transfer));
    expect(
      screen.getByText(/successfully confirmed/, { selector: ".sr-only" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reject transfer proposal/ }));
    await waitFor(() => expect(onReject).toHaveBeenCalledWith(transfer));
    expect(screen.getByText(/rejected/, { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("reports confirm and reject failures", async () => {
    render(
      <TransferReviewSection
        proposals={[transfer]}
        accounts={accounts}
        onConfirm={vi.fn(async () => Promise.reject(new Error("confirm failed")))}
        onReject={vi.fn(async () => Promise.reject(new Error("reject failed")))}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Confirm transfer proposal/ }));
    expect(await screen.findByText(/confirm failed/, { selector: ".sr-only" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reject transfer proposal/ }));
    expect(await screen.findByText(/reject failed/, { selector: ".sr-only" })).toBeInTheDocument();
  });
});
