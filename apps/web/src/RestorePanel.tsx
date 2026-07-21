import type { WorkspaceBackupSnapshot } from "@financial-intelligence/backup";
import type { RestoreMode, RestorePlan } from "@financial-intelligence/application";
import { useState, type FormEvent } from "react";

import { Button } from "./Button";
import type { ApplicationServices } from "./infrastructure";
import { withProtectedOperation } from "./pwa/protected-operations";

export interface RestorePanelProperties {
  readonly services: Pick<ApplicationServices, "planWorkspaceRestore" | "applyWorkspaceRestore">;
  /** Called after a successful restore so the rest of the app can refresh. */
  readonly onRestored?: () => void;
}

const REPLACE_CONFIRMATION = "REPLACE";

/**
 * Restore a workspace from an encrypted backup. Decrypt + validate produces a metadata-only plan
 * (never transaction descriptions or amounts); the user then chooses restore-as-new, replace, or a
 * conflict-free merge, confirms, and the write happens as one atomic operation. Replace requires a
 * typed confirmation and shows how many records it removes.
 */
export function RestorePanel({ services, onRestored }: RestorePanelProperties) {
  const [file, setFile] = useState<File>();
  const [passphrase, setPassphrase] = useState("");
  const [plan, setPlan] = useState<RestorePlan>();
  const [snapshot, setSnapshot] = useState<WorkspaceBackupSnapshot>();
  const [mode, setMode] = useState<RestoreMode>("restore-as-new");
  const [replaceConfirm, setReplaceConfirm] = useState("");
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setPlan(undefined);
    setSnapshot(undefined);
    setReplaceConfirm("");
  };

  const inspect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    reset();
    if (file === undefined || passphrase.length < 12) {
      setStatus("Choose a backup file and enter its passphrase (at least 12 characters).");
      return;
    }
    setBusy(true);
    setStatus("Decrypting and validating in a temporary space…");
    try {
      const content = await file.text();
      const result = await services.planWorkspaceRestore.execute(content, passphrase);
      setPlan(result.plan);
      setSnapshot(result.snapshot);
      setMode(result.plan.workspaceExistsLocally ? "merge" : "restore-as-new");
      setStatus("Backup verified. Choose how to restore it. Nothing has changed yet.");
    } catch (error) {
      setStatus(restoreErrorMessage(error));
    } finally {
      setBusy(false);
      setPassphrase("");
    }
  };

  const apply = async () => {
    if (plan === undefined || snapshot === undefined) return;
    if (mode === "replace" && replaceConfirm !== REPLACE_CONFIRMATION) {
      setStatus(`Type ${REPLACE_CONFIRMATION} to confirm replacing the existing workspace.`);
      return;
    }
    if (mode === "merge" && plan.mergeConflicts.length > 0) {
      setStatus("This backup conflicts with existing records and cannot be merged safely.");
      return;
    }
    setBusy(true);
    setStatus("Restoring…");
    try {
      const result = await withProtectedOperation("restore", () =>
        services.applyWorkspaceRestore.execute(snapshot, mode),
      );
      setStatus(
        `Restored ${result.recordsWritten} record${result.recordsWritten === 1 ? "" : "s"} at local revision ${result.committedRevision}. Your original data is safe.`,
      );
      reset();
      onRestored?.();
    } catch (error) {
      setStatus(`${restoreErrorMessage(error)} Your existing workspace was not changed.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="backup-panel" aria-labelledby="restore-heading">
      <h2 id="restore-heading">Restore from backup</h2>
      <p>
        Decrypts and validates before writing. There is no passphrase recovery — keep your original
        data until the restored workspace is verified.
      </p>
      <form onSubmit={(event) => void inspect(event)}>
        <input
          type="text"
          name="username"
          autoComplete="username"
          value="fi-restore"
          readOnly
          hidden
        />
        <label htmlFor="restore-file">Backup file to restore</label>
        <input
          id="restore-file"
          type="file"
          accept=".fintbackup,application/vnd.financial-intelligence.encrypted-backup+json"
          onChange={(event) => setFile(event.target.files?.[0])}
          disabled={busy}
        />
        <label htmlFor="restore-passphrase">Backup passphrase</label>
        <input
          id="restore-passphrase"
          type="password"
          autoComplete="current-password"
          minLength={12}
          value={passphrase}
          onChange={(event) => setPassphrase(event.target.value)}
          disabled={busy}
        />
        <Button type="submit" isDisabled={busy}>
          Verify and plan restore
        </Button>
      </form>

      {plan !== undefined && (
        <div className="restore-plan" aria-label="Restore plan">
          <dl className="backup-preview">
            <div>
              <dt>Workspace</dt>
              <dd>{plan.preview.workspaceName}</dd>
            </div>
            <div>
              <dt>Revision</dt>
              <dd>{plan.preview.revision}</dd>
            </div>
            <div>
              <dt>Transactions</dt>
              <dd>{plan.preview.counts.transactions}</dd>
            </div>
            <div>
              <dt>Accounts</dt>
              <dd>{plan.preview.counts.accounts}</dd>
            </div>
            <div>
              <dt>Already on this device</dt>
              <dd>{plan.workspaceExistsLocally ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt>Estimated size</dt>
              <dd>{formatBytes(plan.estimatedBytes)}</dd>
            </div>
          </dl>

          <fieldset className="restore-modes">
            <legend>Restore mode</legend>
            <label>
              <input
                type="radio"
                name="restore-mode"
                value="restore-as-new"
                checked={mode === "restore-as-new"}
                disabled={busy || plan.workspaceExistsLocally}
                onChange={() => setMode("restore-as-new")}
              />
              Restore as new workspace
              {plan.workspaceExistsLocally ? " (unavailable — this workspace already exists)" : ""}
            </label>
            <label>
              <input
                type="radio"
                name="restore-mode"
                value="merge"
                checked={mode === "merge"}
                disabled={busy || !plan.workspaceExistsLocally}
                onChange={() => setMode("merge")}
              />
              Merge into existing workspace (conflict-free only)
            </label>
            <label>
              <input
                type="radio"
                name="restore-mode"
                value="replace"
                checked={mode === "replace"}
                disabled={busy || !plan.workspaceExistsLocally}
                onChange={() => setMode("replace")}
              />
              Replace existing workspace
            </label>
          </fieldset>

          {mode === "merge" && plan.mergeConflicts.length > 0 && (
            <p className="error-message" role="alert">
              {plan.mergeConflicts.length} record
              {plan.mergeConflicts.length === 1 ? "" : "s"} conflict with your existing data. Merge
              only supports conflict-free backups; choose replace or restore as new instead.
            </p>
          )}

          {mode === "replace" && (
            <div className="restore-replace-confirm">
              <p className="error-message" role="alert">
                Replace removes the existing workspace’s accounts, transactions, imports, and
                learned decisions, then writes the backup in one atomic step. If it is interrupted,
                the original is kept.
              </p>
              <label htmlFor="replace-confirm">Type {REPLACE_CONFIRMATION} to confirm</label>
              <input
                id="replace-confirm"
                type="text"
                autoComplete="off"
                value={replaceConfirm}
                onChange={(event) => setReplaceConfirm(event.target.value)}
                disabled={busy}
              />
            </div>
          )}

          <div className="preview-actions">
            <Button
              isDisabled={busy || (mode === "merge" && plan.mergeConflicts.length > 0)}
              onClick={() => void apply()}
            >
              {busy ? "Restoring…" : "Restore now"}
            </Button>
            <Button className="secondary-button" isDisabled={busy} onClick={reset}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {status !== undefined && (
        <p className="backup-status" role="status">
          {status}
        </p>
      )}
    </section>
  );
}

function restoreErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code: unknown }).code)
      : "";
  switch (code) {
    case "DECRYPTION_FAILED":
      return "The backup could not be verified. The passphrase or file may be incorrect.";
    case "WORKSPACE_EXISTS":
      return "That workspace already exists on this device; choose merge or replace.";
    case "WORKSPACE_MISSING":
      return "There is no existing workspace to replace; choose restore as new.";
    case "MERGE_CONFLICT":
      return "The backup conflicts with existing records and cannot be merged safely.";
    case "QUOTA_INSUFFICIENT":
      return "There is not enough local storage to restore this backup safely.";
    default:
      return "The backup could not be restored.";
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "unknown";
  const units = ["bytes", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}
