// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  canPromptInstall,
  initInstallAffordance,
  promptInstall,
  subscribeToInstallAffordance,
  type BeforeInstallPromptEvent,
} from "./install";

function dispatchBeforeInstallPrompt(): {
  prompt: ReturnType<typeof vi.fn>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
} {
  const prompt = vi.fn(() => Promise.resolve());
  const userChoice = Promise.resolve({ outcome: "accepted" as const });
  const event = Object.assign(new Event("beforeinstallprompt"), {
    prompt,
    userChoice,
    preventDefault: vi.fn(),
  }) as unknown as BeforeInstallPromptEvent;
  window.dispatchEvent(event);
  return { prompt, userChoice };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("install affordance", () => {
  it("captures a deferred prompt and reports it can install", () => {
    initInstallAffordance();
    expect(canPromptInstall()).toBe(false);
    dispatchBeforeInstallPrompt();
    expect(canPromptInstall()).toBe(true);
  });

  it("notifies subscribers when a prompt becomes available", () => {
    initInstallAffordance();
    const listener = vi.fn();
    const unsubscribe = subscribeToInstallAffordance(listener);
    dispatchBeforeInstallPrompt();
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  it("triggers the native prompt and returns the outcome, then clears availability", async () => {
    initInstallAffordance();
    const { prompt } = dispatchBeforeInstallPrompt();
    const outcome = await promptInstall();
    expect(prompt).toHaveBeenCalledOnce();
    expect(outcome).toBe("accepted");
    expect(canPromptInstall()).toBe(false);
  });

  it("returns unavailable when no prompt was captured", async () => {
    expect(await promptInstall()).toBe("unavailable");
  });
});
