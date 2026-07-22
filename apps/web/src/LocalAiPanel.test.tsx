// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type { CapabilityReport } from "@financial-intelligence/ai-local";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LocalAiPanel } from "./LocalAiPanel";

afterEach(cleanup);

const recommended: CapabilityReport = { tier: "recommended", reasons: [] };
const unsupported: CapabilityReport = { tier: "unsupported", reasons: ["no-webgpu"] };

describe("LocalAiPanel", () => {
  it("renders the capability tier once detected", async () => {
    render(
      <LocalAiPanel
        detectCapability={() => Promise.resolve(recommended)}
        readModelState={() => Promise.resolve("not-downloaded")}
      />,
    );
    await waitFor(() => expect(screen.getByText(/Ready for local AI/)).toBeInTheDocument());
  });

  it("shows a Download button when the model is not cached", async () => {
    render(
      <LocalAiPanel
        detectCapability={() => Promise.resolve(recommended)}
        readModelState={() => Promise.resolve("not-downloaded")}
      />,
    );
    const button = await screen.findByRole("button", { name: /Download model/i });
    expect(button).toBeEnabled();
  });

  it("shows a ready indicator (and no download) when the model is already cached", async () => {
    render(
      <LocalAiPanel
        detectCapability={() => Promise.resolve(recommended)}
        readModelState={() => Promise.resolve("ready")}
      />,
    );
    await waitFor(() => expect(screen.getByText(/ready on this device/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Download model/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Remove model/i })).toBeInTheDocument();
  });

  it("offers Resume when a prior download was interrupted", async () => {
    render(
      <LocalAiPanel
        detectCapability={() => Promise.resolve(recommended)}
        readModelState={() => Promise.resolve("incomplete")}
      />,
    );
    expect(await screen.findByRole("button", { name: /Resume download/i })).toBeInTheDocument();
  });

  it("downloads and shows the ready state on success", async () => {
    render(
      <LocalAiPanel
        detectCapability={() => Promise.resolve(recommended)}
        readModelState={() => Promise.resolve("not-downloaded")}
        download={() => Promise.resolve({ ready: true })}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Download model/i }));
    await waitFor(() => expect(screen.getByText(/downloaded and ready/i)).toBeInTheDocument());
  });

  it("shows a plain-language error when the download fails", async () => {
    render(
      <LocalAiPanel
        detectCapability={() => Promise.resolve(recommended)}
        readModelState={() => Promise.resolve("not-downloaded")}
        download={() =>
          Promise.resolve({ ready: false, error: "Download failed (503) for config.json." })
        }
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /Download model/i }));
    await waitFor(() =>
      expect(screen.getByText(/Couldn't reach the model host/i)).toBeInTheDocument(),
    );
  });

  it("explains rules-only remains available on unsupported devices", async () => {
    render(
      <LocalAiPanel
        detectCapability={() => Promise.resolve(unsupported)}
        readModelState={() => Promise.resolve("not-downloaded")}
      />,
    );
    await waitFor(() => expect(screen.getByText(/cannot run local AI/)).toBeInTheDocument());
  });

  it("keeps the manual file load available under Advanced", async () => {
    render(
      <LocalAiPanel
        detectCapability={() => Promise.resolve(recommended)}
        readModelState={() => Promise.resolve("not-downloaded")}
      />,
    );
    expect(await screen.findByText(/Advanced: load from files/i)).toBeInTheDocument();
  });
});
