// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatPage } from "./ChatPage";

afterEach(cleanup);

beforeEach(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe("ChatPage", () => {
  it("shows loading state initially while checking model readiness", () => {
    const isModelReady = vi.fn().mockImplementation(() => new Promise(() => {}));
    render(<ChatPage isModelReady={isModelReady} />);
    expect(screen.getByRole("status")).toHaveTextContent("Checking local AI model status");
  });

  it("renders LocalAiPanel when local AI model is not ready", async () => {
    const isModelReady = vi.fn().mockResolvedValue(false);
    render(<ChatPage isModelReady={isModelReady} />);

    await waitFor(() => {
      expect(screen.getByText("Local AI Financial Assistant")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /To use the local AI Chat, the browser-local model must first be downloaded/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Local AI (optional)" })).toBeInTheDocument();
  });

  it("renders chat interface with disclaimer when model is ready", async () => {
    const isModelReady = vi.fn().mockResolvedValue(true);
    render(<ChatPage isModelReady={isModelReady} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Financial Assistant" })).toBeInTheDocument();
    });

    expect(screen.getByText(/Privacy First/i)).toBeInTheDocument();
    expect(
      screen.getByText(/This local AI assistant helps analyze cash flows/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Ask a question about your cash flow or spending rules…"),
    ).toBeInTheDocument();
  });

  it("sends user message and displays assistant response", async () => {
    const isModelReady = vi.fn().mockResolvedValue(true);
    const executePrompt = vi.fn().mockResolvedValue("Categorization rules apply automatically.");

    render(<ChatPage isModelReady={isModelReady} executePrompt={executePrompt} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Financial Assistant" })).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(
      "Ask a question about your cash flow or spending rules…",
    );
    const sendButton = screen.getByRole("button", { name: "Send" });

    fireEvent.change(input, { target: { value: "How do rules work?" } });
    fireEvent.click(sendButton);

    expect(screen.getByText("How do rules work?")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Categorization rules apply automatically.")).toBeInTheDocument();
    });

    expect(executePrompt).toHaveBeenCalledWith("How do rules work?");
  });

  it("sends message when clicking a starter topic chip", async () => {
    const isModelReady = vi.fn().mockResolvedValue(true);
    const executePrompt = vi.fn().mockResolvedValue("Cash flow is calculated from net transfers.");

    render(<ChatPage isModelReady={isModelReady} executePrompt={executePrompt} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Financial Assistant" })).toBeInTheDocument();
    });

    const chip = screen.getByRole("button", { name: "How do I analyze my cash flow this month?" });
    fireEvent.click(chip);

    await waitFor(() => {
      expect(screen.getAllByText("How do I analyze my cash flow this month?")).toHaveLength(2);
      expect(screen.getByText("Cash flow is calculated from net transfers.")).toBeInTheDocument();
    });
  });

  it("clears conversation history when Clear button is clicked", async () => {
    const isModelReady = vi.fn().mockResolvedValue(true);
    const executePrompt = vi.fn().mockResolvedValue("Test reply");

    render(<ChatPage isModelReady={isModelReady} executePrompt={executePrompt} />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Financial Assistant" })).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText(
      "Ask a question about your cash flow or spending rules…",
    );
    fireEvent.change(input, { target: { value: "Test question" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("Test question")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Clear conversation" }));

    expect(screen.queryByText("Test question")).not.toBeInTheDocument();
  });
});
