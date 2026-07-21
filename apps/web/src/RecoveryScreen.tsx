import { Button } from "./Button";

export interface RecoveryScreenProperties {
  readonly code: string;
  readonly message: string;
  readonly onRetry: () => void;
  readonly isRetrying: boolean;
}

/**
 * Shown when the local database cannot be opened or migrated at startup. It never clears storage or
 * reloads in a loop; it preserves all data and offers the user a retry, a diagnostic export (code +
 * build only — no financial data), and guidance toward Settings backup/restore.
 */
export function RecoveryScreen({ code, message, onRetry, isRetrying }: RecoveryScreenProperties) {
  const exportDiagnostic = () => {
    const report = {
      kind: "financial-intelligence-startup-diagnostic",
      code,
      buildId: typeof __APP_BUILD_ID__ === "string" ? __APP_BUILD_ID__ : "dev",
      userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "financial-intelligence-diagnostic.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="recovery-screen" role="alert" aria-labelledby="recovery-title">
      <div className="recovery-panel">
        <p className="eyebrow">Local storage</p>
        <h1 id="recovery-title">We couldn’t open your local data</h1>
        <p>{message}</p>
        <p className="recovery-detail">
          Nothing has been deleted. Reference code: <code>{code}</code>
        </p>
        <div className="recovery-actions">
          <Button onClick={onRetry} isDisabled={isRetrying}>
            {isRetrying ? "Retrying…" : "Try again"}
          </Button>
          <Button className="secondary-button" onClick={exportDiagnostic}>
            Export diagnostic
          </Button>
        </div>
        <p className="recovery-guidance">
          If this keeps happening, close other tabs of this app and retry. You can restore from an
          encrypted backup once the app opens. The diagnostic file contains only an error code,
          build id, and browser version — never your financial data.
        </p>
      </div>
    </div>
  );
}
