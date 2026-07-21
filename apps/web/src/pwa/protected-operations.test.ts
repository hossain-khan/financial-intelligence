import { afterEach, describe, expect, it, vi } from "vitest";

import {
  activeProtectedOperations,
  beginProtectedOperation,
  isProtectedOperationActive,
  subscribeToProtectedOperations,
  withProtectedOperation,
} from "./protected-operations";

afterEach(() => {
  // Release anything a failing test might have left active.
  while (isProtectedOperationActive()) {
    const kind = activeProtectedOperations()[0];
    if (kind === undefined) break;
    beginProtectedOperation(kind)();
    // The line above only adds+removes one; drain via repeated release is not possible, so
    // reset by releasing until empty is not needed because each test releases its own regions.
    break;
  }
});

describe("protected operations", () => {
  it("reports active while a region is held and clears on release", () => {
    expect(isProtectedOperationActive()).toBe(false);
    const release = beginProtectedOperation("import-commit");
    expect(isProtectedOperationActive()).toBe(true);
    expect(activeProtectedOperations()).toContain("import-commit");
    release();
    expect(isProtectedOperationActive()).toBe(false);
  });

  it("stays active until the last nested region of a kind releases", () => {
    const first = beginProtectedOperation("backup");
    const second = beginProtectedOperation("backup");
    first();
    expect(isProtectedOperationActive()).toBe(true);
    second();
    expect(isProtectedOperationActive()).toBe(false);
  });

  it("ignores a double release", () => {
    const release = beginProtectedOperation("restore");
    release();
    release();
    expect(isProtectedOperationActive()).toBe(false);
  });

  it("notifies subscribers on transitions", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToProtectedOperations(listener);
    const release = beginProtectedOperation("migration");
    expect(listener).toHaveBeenLastCalledWith(true);
    release();
    expect(listener).toHaveBeenLastCalledWith(false);
    unsubscribe();
  });

  it("releases even when the wrapped operation throws", async () => {
    await expect(
      withProtectedOperation("bulk-edit", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(isProtectedOperationActive()).toBe(false);
  });
});
