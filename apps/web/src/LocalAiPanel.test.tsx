// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { CapabilityReport } from "@financial-intelligence/ai-local";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LocalAiPanel } from "./LocalAiPanel";

afterEach(cleanup);

const recommended: CapabilityReport = { tier: "recommended", reasons: [] };
const unsupported: CapabilityReport = { tier: "unsupported", reasons: ["no-webgpu"] };

describe("LocalAiPanel", () => {
  it("renders the capability tier once detected", async () => {
    render(<LocalAiPanel detectCapability={() => Promise.resolve(recommended)} />);
    await waitFor(() => expect(screen.getByText(/Ready for local AI/)).toBeInTheDocument());
  });

  it("always shows the download-size and license disclosure", async () => {
    render(<LocalAiPanel detectCapability={() => Promise.resolve(recommended)} />);
    await waitFor(() => expect(screen.getByText(/Ready for local AI/)).toBeInTheDocument());
    expect(screen.getByText("Download size")).toBeInTheDocument();
    expect(screen.getByText("License")).toBeInTheDocument();
  });

  it("explains rules-only remains available on unsupported devices", async () => {
    render(<LocalAiPanel detectCapability={() => Promise.resolve(unsupported)} />);
    await waitFor(() => expect(screen.getByText(/cannot run local AI/)).toBeInTheDocument());
  });

  it("enables model selection now that a model profile is pinned", async () => {
    render(<LocalAiPanel detectCapability={() => Promise.resolve(recommended)} />);
    const button = await screen.findByRole("button", { name: /Select model files/ });
    expect(button).toBeEnabled();
    expect(screen.queryByText(/unlocks once a model profile is pinned/)).not.toBeInTheDocument();
  });

  it("shows the pinned model repository", async () => {
    render(<LocalAiPanel detectCapability={() => Promise.resolve(recommended)} />);
    await waitFor(() =>
      expect(screen.getByText("onnx-community/gemma-3n-E2B-it-ONNX")).toBeInTheDocument(),
    );
  });
});
