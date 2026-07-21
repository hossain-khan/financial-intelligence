import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { Button } from "./Button";
import {
  canPromptInstall,
  isProbablyInstalled,
  promptInstall,
  subscribeToInstallAffordance,
} from "./pwa/install";
import {
  clearCacheNamespace,
  readStorageInventory,
  requestPersistentStorage,
  type CacheNamespaceReport,
  type StorageInventory,
  type StorageInventoryDependencies,
} from "./pwa/storage-inventory";
import type { CacheCategory } from "./pwa/cache-namespaces";

export interface StoragePanelProperties {
  /** Injectable for tests; defaults to real browser Cache Storage / StorageManager. */
  readonly storageDeps?: StorageInventoryDependencies;
}

/**
 * Settings surface for offline storage: usage/quota estimate (labelled an estimate), durable-
 * persistence status and request, and a per-namespace cache inventory with a targeted clear that
 * never touches IndexedDB, exports, or canonical workspaces.
 */
export function StoragePanel({ storageDeps }: StoragePanelProperties) {
  const [inventory, setInventory] = useState<StorageInventory>();
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [pendingClear, setPendingClear] = useState<CacheCategory>();

  const refresh = useCallback(async () => {
    try {
      setInventory(await readStorageInventory(storageDeps));
    } catch {
      setStatus("Storage details could not be read in this browser. Your data was not changed.");
    }
  }, [storageDeps]);

  useEffect(() => {
    let active = true;
    readStorageInventory(storageDeps)
      .then((result) => {
        if (active) setInventory(result);
      })
      .catch(() => {
        if (active) {
          setStatus(
            "Storage details could not be read in this browser. Your data was not changed.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, [storageDeps]);

  const onRequestPersistence = async () => {
    setBusy(true);
    try {
      const granted = await requestPersistentStorage(storageDeps);
      setStatus(
        granted === undefined
          ? "This browser does not support a durable-storage request."
          : granted
            ? "Durable storage granted. The browser is less likely to evict your data."
            : "The browser declined durable storage. Your data is still stored, but may be evicted under pressure.",
      );
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onConfirmClear = async (category: CacheCategory) => {
    setBusy(true);
    setPendingClear(undefined);
    try {
      const removed = await clearCacheNamespace(category, storageDeps);
      setStatus(
        `Cleared ${removed.length} cache${removed.length === 1 ? "" : "s"}. Your financial data and exports were not affected.`,
      );
      await refresh();
    } catch {
      setStatus("That cache could not be cleared. Your data was not changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="storage-panel-group" aria-labelledby="storage-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Offline and storage</p>
          <h2 id="storage-heading">Storage and installation</h2>
        </div>
      </div>

      <InstallAffordance />

      <StorageEstimate
        inventory={inventory}
        busy={busy}
        onRequestPersistence={onRequestPersistence}
      />

      <div className="cache-inventory" aria-label="Cache inventory">
        <h3>Caches on this device</h3>
        <p className="privacy-copy">
          These are disposable app caches. Your financial data lives in a separate database and is
          never cleared here — remove a workspace from its account settings instead.
        </p>
        {inventory === undefined ? (
          <p role="status">Reading storage…</p>
        ) : (
          <ul className="cache-list">
            {inventory.namespaces.map((namespace) => (
              <CacheRow
                key={namespace.category}
                report={namespace}
                busy={busy}
                pendingClear={pendingClear}
                onRequestClear={setPendingClear}
                onCancelClear={() => setPendingClear(undefined)}
                onConfirmClear={onConfirmClear}
              />
            ))}
          </ul>
        )}
      </div>

      {status !== undefined && (
        <p className="backup-status" role="status">
          {status}
        </p>
      )}
    </section>
  );
}

function StorageEstimate({
  inventory,
  busy,
  onRequestPersistence,
}: {
  readonly inventory: StorageInventory | undefined;
  readonly busy: boolean;
  readonly onRequestPersistence: () => void;
}) {
  const estimate = inventory?.estimate;
  return (
    <div className="storage-estimate">
      <h3>Space used</h3>
      {estimate === undefined ? (
        <p role="status">Reading storage…</p>
      ) : !estimate.available ? (
        <p>This browser does not report storage usage. Your data is still stored locally.</p>
      ) : (
        <dl className="settings-list">
          <div>
            <dt>Estimated usage</dt>
            <dd>
              {formatBytes(estimate.usageBytes)}
              {estimate.quotaBytes !== undefined
                ? ` of ${formatBytes(estimate.quotaBytes)}`
                : ""}{" "}
              <span className="field-help">(browser estimate)</span>
            </dd>
          </div>
          <div>
            <dt>Durable storage</dt>
            <dd>
              {estimate.persisted === undefined
                ? "Unknown in this browser"
                : estimate.persisted
                  ? "Granted"
                  : "Not granted"}
            </dd>
          </div>
        </dl>
      )}
      {estimate?.canRequestPersistence === true && (
        <Button className="secondary-button" isDisabled={busy} onClick={onRequestPersistence}>
          Request durable storage
        </Button>
      )}
    </div>
  );
}

function CacheRow({
  report,
  busy,
  pendingClear,
  onRequestClear,
  onCancelClear,
  onConfirmClear,
}: {
  readonly report: CacheNamespaceReport;
  readonly busy: boolean;
  readonly pendingClear: CacheCategory | undefined;
  readonly onRequestClear: (category: CacheCategory) => void;
  readonly onCancelClear: () => void;
  readonly onConfirmClear: (category: CacheCategory) => void;
}) {
  const bytesLabel = `${report.bytesAreApproximate ? "≈" : ""}${formatBytes(report.approximateBytes)}`;
  return (
    <li className="cache-row">
      <div className="cache-summary">
        <div>
          <strong>{report.label}</strong>
          <span>{report.description}</span>
        </div>
        <span className="storage-chip">
          {report.itemCount} item{report.itemCount === 1 ? "" : "s"} · {bytesLabel}
        </span>
      </div>
      {report.clearable ? (
        pendingClear === report.category ? (
          <div className="delete-confirmation" role="alert">
            <p>
              Clear {report.label.toLowerCase()}? This removes {report.itemCount} cached item
              {report.itemCount === 1 ? "" : "s"} ({bytesLabel}). Financial data is not affected.
            </p>
            <Button
              className="danger-button"
              isDisabled={busy}
              onClick={() => onConfirmClear(report.category)}
            >
              Confirm clear
            </Button>
            <Button onClick={onCancelClear}>Cancel</Button>
          </div>
        ) : (
          <Button
            className="secondary-button"
            isDisabled={busy || report.itemCount === 0}
            onClick={() => onRequestClear(report.category)}
          >
            Clear
          </Button>
        )
      ) : (
        <span className="field-help">Kept for offline recovery; refreshed on update.</span>
      )}
    </li>
  );
}

function InstallAffordance() {
  const canInstall = useSyncExternalStore(
    subscribeToInstallAffordance,
    canPromptInstall,
    canPromptInstall,
  );
  const [status, setStatus] = useState<string>();

  if (isProbablyInstalled()) {
    return (
      <div className="install-affordance">
        <h3>Installation</h3>
        <p>This app is installed and runs offline from your device.</p>
      </div>
    );
  }

  return (
    <div className="install-affordance">
      <h3>Install this app</h3>
      {canInstall ? (
        <>
          <p>Install to launch it like a native app and keep it available offline.</p>
          <Button
            className="secondary-button"
            onClick={() => {
              void promptInstall().then((outcome) =>
                setStatus(
                  outcome === "accepted"
                    ? "Installation started."
                    : outcome === "dismissed"
                      ? "Installation dismissed. You can install later from Settings."
                      : "Installation is not available right now.",
                ),
              );
            }}
          >
            Install app
          </Button>
          {status !== undefined && (
            <p className="field-help" role="status">
              {status}
            </p>
          )}
        </>
      ) : (
        <p className="field-help">
          Your browser installs this app from its own menu. In Safari on iPhone or iPad, use Share →
          “Add to Home Screen”. In desktop Chrome or Edge, use the install icon in the address bar.
        </p>
      )}
    </div>
  );
}

function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes)) return "unknown";
  if (bytes === 0) return "0 bytes";
  const units = ["bytes", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}
