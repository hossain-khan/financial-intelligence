import { useSyncExternalStore } from "react";

import { getPwaController } from "./register";
import type { PwaController, PwaStatus } from "./lifecycle";

const UNSUPPORTED: PwaStatus = {
  state: "failed",
  updateDeferred: false,
  blockingOperations: [],
  buildId: "dev",
  supported: false,
  message: "This browser does not support offline mode; the app still works online.",
};

const noopSubscribe = (): (() => void) => () => undefined;

/**
 * Subscribe a component to the live PWA lifecycle status. Falls back to a static unsupported status
 * when the controller has not been created (e.g. in tests that do not register a worker), so the UI
 * always has a defined status to render.
 */
export function usePwaStatus(controllerOverride?: PwaController): PwaStatus {
  const controller = controllerOverride ?? getPwaController();
  return useSyncExternalStore(
    controller?.subscribe ?? noopSubscribe,
    controller?.getStatus ?? (() => UNSUPPORTED),
    controller?.getStatus ?? (() => UNSUPPORTED),
  );
}
