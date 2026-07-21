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
    await waitFor(() =>
      expect(screen.getByText(/cannot run local AI/)).toBeInTheDocument(),
    );
  });

  it("keeps model selection disabled until a model profile is pinned", async () => {
    // The shipped profile is PENDING_SPIKE, so selection is intentionally gated.
    render(<LocalAiPanel detectCapability={() => Promise.resolve(recommended)} />);
    const button = await screen.findByRole("button", { name: /Select model files/ });
    expect(button).toBeDisabled();
    expect(screen.getByText(/unlocks once a model profile is pinned/)).toBeInTheDocument();
  });
});
