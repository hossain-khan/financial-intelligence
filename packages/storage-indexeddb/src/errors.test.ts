import { describe, expect, it } from "vitest";

import { normalizeStorageError, StorageError } from "./errors";

describe("normalizeStorageError", () => {
  it.each([
    ["VersionError", "VERSION_INCOMPATIBLE"],
    ["QuotaExceededError", "QUOTA_EXCEEDED"],
    ["UpgradeError", "MIGRATION_FAILED"],
    ["AbortError", "MIGRATION_FAILED"],
    ["UnknownError", "STORAGE_FAILURE"],
  ] as const)("maps %s to %s", (name, code) => {
    const error = new Error("synthetic");
    error.name = name;

    expect(normalizeStorageError(error)).toMatchObject({ code, name: "StorageError" });
  });

  it("preserves an already normalized error", () => {
    const error = new StorageError("UPGRADE_BLOCKED");

    expect(normalizeStorageError(error)).toBe(error);
  });
});
