export type StorageErrorCode =
  | "UPGRADE_BLOCKED"
  | "VERSION_INCOMPATIBLE"
  | "MIGRATION_FAILED"
  | "QUOTA_EXCEEDED"
  | "CONCURRENT_MODIFICATION"
  | "DUPLICATE_SOURCE_ID"
  | "STORAGE_FAILURE";

const ERROR_MESSAGES: Readonly<Record<StorageErrorCode, string>> = {
  UPGRADE_BLOCKED:
    "A newer version of Financial Intelligence is waiting to upgrade local data. Close other tabs and retry.",
  VERSION_INCOMPATIBLE:
    "This local database was created by a newer incompatible version of Financial Intelligence.",
  MIGRATION_FAILED:
    "Financial Intelligence could not upgrade local data. Existing committed data was not reset.",
  QUOTA_EXCEEDED:
    "Browser storage is full or unavailable. Free storage or export data before retrying.",
  CONCURRENT_MODIFICATION:
    "Local data changed before this import could commit. Review the latest data and retry.",
  DUPLICATE_SOURCE_ID:
    "A transaction with the same source identifier already exists in this account.",
  STORAGE_FAILURE: "Financial Intelligence could not access local browser storage.",
};

export class StorageError extends Error {
  public constructor(
    public readonly code: StorageErrorCode,
    options?: ErrorOptions,
  ) {
    super(ERROR_MESSAGES[code], options);
    this.name = "StorageError";
  }
}

export function normalizeStorageError(error: unknown): StorageError {
  if (error instanceof StorageError) {
    return error;
  }

  const name = getErrorName(error);

  if (name === "VersionError") {
    return new StorageError("VERSION_INCOMPATIBLE", { cause: error });
  }

  if (name === "QuotaExceededError") {
    return new StorageError("QUOTA_EXCEEDED", { cause: error });
  }

  if (name === "UpgradeError" || name === "AbortError") {
    return new StorageError("MIGRATION_FAILED", { cause: error });
  }

  return new StorageError("STORAGE_FAILURE", { cause: error });
}

function getErrorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return undefined;
  }

  return typeof error.name === "string" ? error.name : undefined;
}
