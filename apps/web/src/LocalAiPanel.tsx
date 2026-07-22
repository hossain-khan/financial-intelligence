import type { CapabilityReport, DownloadProgress } from "@financial-intelligence/ai-local";
import { useEffect, useRef, useState } from "react";

import { Button } from "./Button";
import {
  LOCAL_AI_PROFILE,
  downloadPinnedModel,
  readLocalAiCapability,
  readModelState,
  readyCacheName,
  sideloadModelFiles,
  type ModelState,
  type SideloadOutcome,
} from "./local-ai";

export interface LocalAiPanelProperties {
  /** Injectable for tests; default to the real browser paths. */
  readonly detectCapability?: () => Promise<CapabilityReport>;
  readonly readModelState?: () => Promise<ModelState>;
  readonly download?: (
    onProgress?: (progress: DownloadProgress) => void,
    signal?: AbortSignal,
  ) => Promise<SideloadOutcome>;
  readonly sideload?: (files: readonly File[]) => Promise<SideloadOutcome>;
  readonly removeModel?: () => Promise<void>;
}

const TIER_LABEL: Record<CapabilityReport["tier"], string> = {
  recommended: "Ready for local AI",
  constrained: "Limited: local AI may be slow or run out of memory",
  unsupported: "Not available on this device (rules-only mode is unaffected)",
};

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "size published after the model is pinned";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value < 10 && unit > 0 ? 1 : 0)} ${units[unit]}`;
}

async function defaultRemoveModel(): Promise<void> {
  await caches.delete(readyCacheName(LOCAL_AI_PROFILE.profileId));
}

/**
 * Settings surface for the optional browser-local AI provider. One click downloads the pinned model
 * (streamed, digest-verified, cached) with visible progress; a returning user sees it is already
 * cached and ready. Everything stays on-device — the only network access is the explicit download.
 * A collapsed "Advanced" section keeps the manual file-load path for offline/air-gapped users.
 */
export function LocalAiPanel(props: LocalAiPanelProperties) {
  const detect = props.detectCapability ?? readLocalAiCapability;
  const getState = props.readModelState ?? readModelState;
  const runDownload = props.download ?? downloadPinnedModel;
  const runSideload = props.sideload ?? sideloadModelFiles;
  const remove = props.removeModel ?? defaultRemoveModel;

  const [capability, setCapability] = useState<CapabilityReport>();
  const [modelState, setModelState] = useState<ModelState>();
  const [progress, setProgress] = useState<DownloadProgress>();
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | undefined>(undefined);
  const sideloadInputRef = useRef<HTMLInputElement>(null);
  const pinned = LOCAL_AI_PROFILE.modelRepo !== "PENDING_SPIKE";

  useEffect(() => {
    let active = true;
    Promise.all([detect(), getState()])
      .then(([report, state]) => {
        if (!active) return;
        setCapability(report);
        setModelState(state);
      })
      .catch(() => {
        if (active) setStatus("Local AI could not be checked in this browser.");
      });
    return () => {
      active = false;
    };
  }, [detect, getState]);

  const onDownload = async () => {
    setBusy(true);
    setStatus(undefined);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const outcome = await runDownload((p) => setProgress(p), controller.signal);
      if (outcome.ready) {
        setModelState("ready");
        setStatus("Model downloaded and ready. Categorization suggestions run on your device.");
      } else {
        setStatus(downloadErrorMessage(outcome.error));
        setModelState(await getState());
      }
    } finally {
      setBusy(false);
      setProgress(undefined);
      abortRef.current = undefined;
    }
  };

  const onCancel = () => abortRef.current?.abort();

  const onRemove = async () => {
    setBusy(true);
    try {
      await remove();
      setModelState("not-downloaded");
      setStatus("Local model removed. Your financial data was not affected.");
    } finally {
      setBusy(false);
    }
  };

  const onSideload = async (files: FileList | null) => {
    if (files === null || files.length === 0) return;
    setBusy(true);
    setStatus("Verifying selected model files…");
    try {
      const outcome = await runSideload([...files]);
      setModelState(outcome.ready ? "ready" : await getState());
      setStatus(
        outcome.ready
          ? "Model verified and stored locally."
          : downloadErrorMessage(outcome.error),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="local-ai-panel" aria-labelledby="local-ai-heading">
      <h3 id="local-ai-heading">Local AI (optional)</h3>
      <p>
        Runs an optional model entirely on your device to assist categorization. The only time it
        uses the network is the one-time model download you start below.
      </p>

      {capability === undefined ? (
        <p role="status">Checking device capability…</p>
      ) : (
        <p role="status" className={`capability-tier tier-${capability.tier}`}>
          {TIER_LABEL[capability.tier]}
        </p>
      )}

      <dl className="settings-list">
        <div>
          <dt>Model</dt>
          <dd>{pinned ? LOCAL_AI_PROFILE.modelRepo : "Not yet pinned"}</dd>
        </div>
        <div>
          <dt>Download size</dt>
          <dd>{formatBytes(LOCAL_AI_PROFILE.totalByteSize)}</dd>
        </div>
        <div>
          <dt>License</dt>
          <dd>{pinned ? LOCAL_AI_PROFILE.license : "published with the pinned model"}</dd>
        </div>
      </dl>

      {capability?.tier === "unsupported" ? (
        <p className="field-help">
          This device cannot run local AI. The app remains fully usable with deterministic rules.
        </p>
      ) : (
        <div className="local-ai-actions">
          {modelState === "ready" ? (
            <div>
              <p role="status">✓ Model ready on this device ({formatBytes(LOCAL_AI_PROFILE.totalByteSize)}).</p>
              <Button className="secondary-button" isDisabled={busy} onClick={() => void onRemove()}>
                Remove model
              </Button>
            </div>
          ) : busy && progress !== undefined ? (
            <DownloadProgressView progress={progress} onCancel={onCancel} />
          ) : (
            <>
              <Button
                className="secondary-button"
                isDisabled={busy || !pinned}
                onClick={() => void onDownload()}
              >
                {modelState === "incomplete" ? "Resume download" : "Download model"} ·{" "}
                {formatBytes(LOCAL_AI_PROFILE.totalByteSize)}
              </Button>
              {!pinned && <p className="field-help">Available once a model profile is pinned.</p>}
            </>
          )}

          <details className="local-ai-advanced">
            <summary>Advanced: load from files</summary>
            <p className="field-help">
              Already downloaded the model files yourself? Select them to load without a network
              download.
            </p>
            <input
              ref={sideloadInputRef}
              type="file"
              multiple
              className="visually-hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => void onSideload(event.target.files)}
            />
            <Button
              className="secondary-button"
              isDisabled={busy || !pinned}
              onClick={() => sideloadInputRef.current?.click()}
            >
              Select model files
            </Button>
          </details>
        </div>
      )}

      {status !== undefined && (
        <p role="status" className="local-ai-status">
          {status}
        </p>
      )}
    </section>
  );
}

function DownloadProgressView({
  progress,
  onCancel,
}: {
  readonly progress: DownloadProgress;
  readonly onCancel: () => void;
}) {
  const overallPercent =
    progress.overallTotal > 0
      ? Math.min(100, Math.round((progress.overallBytes / progress.overallTotal) * 100))
      : 0;
  return (
    <div className="local-ai-progress">
      <p role="status">Downloading {progress.file}…</p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={overallPercent}
        aria-valuetext={`${overallPercent}% of the model downloaded`}
      >
        <span className="progress-fill" style={{ inlineSize: `${overallPercent}%` }} />
      </div>
      <p className="field-help">{overallPercent}% overall</p>
      <Button className="secondary-button" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function downloadErrorMessage(error: string | undefined): string {
  const detail = error ?? "";
  if (/network|reach|failed \(/iu.test(detail)) {
    return "Couldn't reach the model host. Check your connection and try again — the app still works with rules.";
  }
  if (/digest|mismatch/iu.test(detail)) {
    return "A downloaded file didn't match the expected version. Try again.";
  }
  if (/too.large|exceeds/iu.test(detail)) {
    return "A downloaded file was larger than expected and was rejected.";
  }
  if (/cancel/iu.test(detail)) {
    return "Download cancelled.";
  }
  return "The model could not be prepared. Your financial data was not affected.";
}
