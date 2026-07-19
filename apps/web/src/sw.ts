/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute, type PrecacheEntry } from "workbox-precaching";

declare const self: ServiceWorkerGlobalScope & {
  readonly __WB_MANIFEST: Array<PrecacheEntry | string>;
};

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
clientsClaim();

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    void self.skipWaiting();
  }
});
