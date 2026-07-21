import { registerSW } from "virtual:pwa-register";

import { createBroadcastPort } from "./broadcast";
import { PwaController, type ServiceWorkerRegistrationPort } from "./lifecycle";

/** Build identifier injected at build time; falls back to a dev marker. */
const BUILD_ID: string =
  typeof __APP_BUILD_ID__ === "string" && __APP_BUILD_ID__.length > 0 ? __APP_BUILD_ID__ : "dev";

/**
 * Adapt `vite-plugin-pwa`'s `registerSW` to the controller's port. `registerSW` returns an
 * `updateServiceWorker(reload)` function; we call it with `reload: false` so the worker takes over
 * without vite-plugin-pwa reloading the page — the controller owns the single, coordinated reload.
 */
function createRegistrationPort(): ServiceWorkerRegistrationPort {
  let updateServiceWorker: ((reload?: boolean) => Promise<void>) | undefined;
  const supported = typeof navigator !== "undefined" && "serviceWorker" in navigator;

  return {
    supported,
    register(callbacks) {
      updateServiceWorker = registerSW({
        immediate: true,
        onNeedRefresh: callbacks.onNeedRefresh,
        onOfflineReady: callbacks.onOfflineReady,
        onRegisterError: callbacks.onRegisterError,
      });
    },
    async activate() {
      await updateServiceWorker?.(false);
    },
  };
}

let controller: PwaController | undefined;

/** Create and start the singleton PWA controller. Safe to call once at app startup. */
export function registerApplicationServiceWorker(): PwaController {
  if (controller !== undefined) return controller;
  controller = new PwaController({
    registration: createRegistrationPort(),
    broadcast: createBroadcastPort(),
    buildId: BUILD_ID,
    reload: () => {
      if (typeof location !== "undefined") location.reload();
    },
  });
  controller.start();
  return controller;
}

/** Access the controller for React subscription. Returns undefined before registration. */
export function getPwaController(): PwaController | undefined {
  return controller;
}
