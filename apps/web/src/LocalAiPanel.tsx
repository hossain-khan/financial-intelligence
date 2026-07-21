import type { CapabilityReport } from "@financial-intelligence/ai-local";
import { useEffect, useRef, useState } from "react";

import { Button } from "./Button";
import {
  LOCAL_AI_PROFILE,
  readLocalAiCapability,
  sideloadModelFiles,
  type SideloadOutcome,
} from "./local-ai";

export interface LocalAiPanelProperties {
  /** Injectable for tests; default to the real browser capability + sideload paths. */
  readonly detectCapability?: () => Promise<CapabilityReport>;
  readonly sideload?: (files: readonly File[]) => Promise<SideloadOutcome>;
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

/**
 * Settings surface for the optional browser-local AI provider: capability tier, the pinned model's
 * size + license disclosure shown before any action, a local-file model sideload with verification
 * status, and a ready/failed indicator. No model download begins without the user selecting files;
 * everything stays local (no network).
 */
export function LocalAiPanel({ detectCapability, sideload }: LocalAiPanelProperties) {
  const [capability, setCapability] = useState<CapabilityReport>();
  const [status, setStatus] = useState<string>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const detect = detectCapability ?? readLocalAiCapability;
  const runSideload = sideload ?? sideloadModelFiles;
  const pinned = LOCAL_AI_PROFILE.modelRepo !== "PENDING_SPIKE";

  useEffect(() => {
    let active = true;
    detect()
      .then((report) => {
        if (active) setCapability(report);
      })
      .catch(() => {
        if (active) setStatus("Local AI capability could not be checked in this browser.");
      });
    return () => {
      active = false;
    };
  }, [detect]);

  const onFilesSelected = async (files: FileList | null) => {
    if (files === null || files.length === 0) return;
    setBusy(true);
    setStatus("Verifying selected model files…");
    try {
      const outcome = await runSideload([...files]);
      setReady(outcome.ready);
      setStatus(
        outcome.ready
          ? "Model verified and stored locally. It runs on your device with no network."
          : `Model files were not accepted: ${outcome.error ?? "verification failed"}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="local-ai-panel" aria-labelledby="local-ai-heading">
      <h3 id="local-ai-heading">Local AI (optional)</h3>
      <p>
        Runs an optional model entirely on your device to assist categorization. Nothing is sent to a
        network; you supply the model files yourself.
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
          <dd>{pinned ? LOCAL_AI_PROFILE.modelRepo : "Not yet pinned (pending benchmark)"}</dd>
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
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="visually-hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => void onFilesSelected(event.target.files)}
          />
          <Button
            className="secondary-button"
            isDisabled={busy || !pinned}
            onClick={() => inputRef.current?.click()}
          >
            Select model files
          </Button>
          {!pinned && (
            <p className="field-help">
              Model selection unlocks once a model profile is pinned in a future update.
            </p>
          )}
        </>
      )}

      {ready && <p className="field-help">A local model is ready on this device.</p>}
      {status !== undefined && (
        <p role="status" className="local-ai-status">
          {status}
        </p>
      )}
    </section>
  );
}
