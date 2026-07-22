// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiSuggestionsSection } from "./AiSuggestionsSection";
import type { AiSuggestionsController, SuggestionView } from "./ai-suggestions";
import type { ApplicationServices } from "./infrastructure";

afterEach(cleanup);

const categoryView: SuggestionView = {
  id: "sug-cat",
  transactionId: "tx-1",
  kind: "category",
  proposedLabel: "Dining",
  categoryId: "cat-dining",
  confidence: 0.91,
  rationale: "Description resembles a restaurant.",
  evidenceCodes: ["model_category_candidate"],
  provenance: "Gemma 3n · on-device",
};

const merchantView: SuggestionView = {
  id: "sug-merch",
  transactionId: "tx-2",
  kind: "merchant",
  proposedLabel: "Coffee Co",
  merchantLabel: "Coffee Co",
  confidence: 0.8,
  rationale: "",
  evidenceCodes: [],
  provenance: "Gemma 3n · on-device",
};

/** A hand-rolled controller stub; the section only calls these four methods. */
function fakeController(
  over: Partial<Record<keyof AiSuggestionsController, unknown>> = {},
): AiSuggestionsController {
  const pending: SuggestionView[] = [];
  return {
    isReady: () => Promise.resolve(true),
    suggest: vi.fn(async () => {
      pending.push(categoryView, merchantView);
      return { created: 2, abstained: 0 };
    }),
    listPending: () => Promise.resolve([...pending]),
    accept: vi.fn(() => Promise.resolve()),
    reject: vi.fn(() => Promise.resolve()),
    ...over,
  } as unknown as AiSuggestionsController;
}

// The section reads services only when it builds its own controller; tests inject one instead.
const services = {} as ApplicationServices;

describe("AiSuggestionsSection", () => {
  it("shows a rules-only message and no Suggest button when no model is ready", async () => {
    const controller = fakeController({ isReady: () => Promise.resolve(false) });
    render(<AiSuggestionsSection services={services} controller={controller} />);
    await waitFor(() => expect(screen.getByText(/No local model is ready/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Suggest categories/i })).not.toBeInTheDocument();
  });

  it("renders suggestion rows with provenance after Suggest is clicked", async () => {
    const controller = fakeController();
    render(<AiSuggestionsSection services={services} controller={controller} />);
    fireEvent.click(await screen.findByRole("button", { name: /Suggest categories/i }));

    await waitFor(() => expect(screen.getByText("Dining")).toBeInTheDocument());
    expect(screen.getAllByText(/on-device/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/91% confidence/i)).toBeInTheDocument();
  });

  it("accepts a category suggestion, calling the use case and removing the row", async () => {
    const controller = fakeController();
    const onApplied = vi.fn();
    render(
      <AiSuggestionsSection services={services} controller={controller} onApplied={onApplied} />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Suggest categories/i }));
    await screen.findByText("Dining");

    fireEvent.click(screen.getByRole("button", { name: /Accept suggestion: Dining/i }));
    await waitFor(() => expect(controller.accept).toHaveBeenCalledWith("sug-cat"));
    await waitFor(() => expect(screen.queryByText("Dining")).not.toBeInTheDocument());
    expect(onApplied).toHaveBeenCalled();
  });

  it("rejects a suggestion, calling the use case and removing the row", async () => {
    const controller = fakeController();
    render(<AiSuggestionsSection services={services} controller={controller} />);
    fireEvent.click(await screen.findByRole("button", { name: /Suggest categories/i }));
    await screen.findByText("Dining");

    fireEvent.click(screen.getByRole("button", { name: /Reject suggestion: Dining/i }));
    await waitFor(() => expect(controller.reject).toHaveBeenCalledWith("sug-cat"));
    await waitFor(() => expect(screen.queryByText("Dining")).not.toBeInTheDocument());
  });

  it("does not offer a direct Accept for a merchant suggestion (resolved from the review queue)", async () => {
    const controller = fakeController();
    render(<AiSuggestionsSection services={services} controller={controller} />);
    fireEvent.click(await screen.findByRole("button", { name: /Suggest categories/i }));
    await screen.findByText("Coffee Co");

    const acceptMerchant = screen.getByRole("button", { name: /Accept suggestion: Coffee Co/i });
    expect(acceptMerchant).toBeDisabled();
  });
});
