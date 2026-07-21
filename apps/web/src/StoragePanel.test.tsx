// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StoragePanel } from "./StoragePanel";
import type { CacheStoragePort, StorageInventoryDependencies } from "./pwa/storage-inventory";

afterEach(cleanup);

function fakeDeps(): { deps: StorageInventoryDependencies; deleted: string[] } {
  const store = new Map<string, string[]>([
    ["workbox-precache-v2-app", ["https://x/index.html"]],
    ["financial-intelligence-model-gemma", ["https://x/model.bin"]],
  ]);
  const deleted: string[] = [];
  const caches: CacheStoragePort = {
    keys: () => Promise.resolve([...store.keys()]),
    open: (key) =>
      Promise.resolve({
        keys: () => Promise.resolve((store.get(key) ?? []).map((url) => ({ url }))),
        match: () =>
          Promise.resolve({
            headers: { get: (n: string) => (n === "content-length" ? "1024" : null) },
          }),
      }),
    delete: (key) => {
      deleted.push(key);
      store.delete(key);
      return Promise.resolve(true);
    },
  };
  return {
    deps: {
      caches,
      storage: {
        estimate: () => Promise.resolve({ usage: 2048, quota: 1_000_000 }),
        persisted: () => Promise.resolve(false),
        persist: () => Promise.resolve(true),
      },
    },
    deleted,
  };
}

describe("StoragePanel", () => {
  it("shows storage usage as an estimate and lists cache namespaces", async () => {
    const { deps } = fakeDeps();
    render(<StoragePanel storageDeps={deps} />);
    expect(await screen.findByText(/browser estimate/i)).toBeInTheDocument();
    expect(screen.getByText("Application shell")).toBeInTheDocument();
    expect(screen.getByText("AI model files")).toBeInTheDocument();
    // The app shell is protected from clearing.
    expect(screen.getByText(/Kept for offline recovery/i)).toBeInTheDocument();
  });

  it("clears a clearable cache only after explicit confirmation and never the app shell", async () => {
    const { deps, deleted } = fakeDeps();
    render(<StoragePanel storageDeps={deps} />);
    // Wait for inventory to load and reveal the model Clear button.
    const clearButtons = await screen.findAllByRole("button", { name: "Clear" });
    fireEvent.click(clearButtons[0]!);
    const confirm = await screen.findByRole("button", { name: "Confirm clear" });
    fireEvent.click(confirm);
    await waitFor(() => expect(deleted).toContain("financial-intelligence-model-gemma"));
    expect(deleted).not.toContain("workbox-precache-v2-app");
  });

  it("requests durable storage when asked", async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    const { deps } = fakeDeps();
    const depsWithSpy: StorageInventoryDependencies = {
      ...deps,
      storage: { ...deps.storage, persist },
    };
    render(<StoragePanel storageDeps={depsWithSpy} />);
    const button = await screen.findByRole("button", { name: "Request durable storage" });
    fireEvent.click(button);
    await waitFor(() => expect(persist).toHaveBeenCalled());
  });
});
