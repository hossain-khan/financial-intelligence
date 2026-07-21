/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & {
  readonly __WB_MANIFEST: Array<PrecacheEntry | string>;
};

// Precache only the versioned application shell (JS/CSS/HTML/manifest/icons + lazy chunks and the
// parser/crypto workers) emitted by the build. There is deliberately NO runtime caching: remote AI
// requests, API responses, statement URLs, exports, blob URLs, and query strings are never cached,
// keeping local mode network-free and sensitive data out of Cache Storage (NFR-001, NFR-003).
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Offline navigation falls back to the precached app shell (index.html) so any in-scope route opens
// without a network request instead of a browser network-error page. API/asset paths are excluded
// so they are never answered by the SPA document.
const navigationHandler = createHandlerBoundToURL("index.html");
registerRoute(
  new NavigationRoute(navigationHandler, {
    denylist: [/^\/api\//u, /\/[^/?]+\.[^/?]+$/u],
  }),
);

clientsClaim();

/**
 * Message protocol with the page-side controller:
 * - `SKIP_WAITING` — the user confirmed an update at a safe boundary; take over now.
 * - `GET_VERSION`  — report the build id baked into this worker for Settings/diagnostics.
 * A message may be a bare string (legacy) or `{ type }`.
 */
self.addEventListener("message", (event) => {
  const data = event.data;
  const type = typeof data === "string" ? data : isRecord(data) ? data.type : undefined;
  if (type === "SKIP_WAITING") {
    void self.skipWaiting();
    return;
  }
  if (type === "GET_VERSION") {
    const buildId = typeof __APP_BUILD_ID__ === "string" ? __APP_BUILD_ID__ : "dev";
    event.ports[0]?.postMessage({ type: "VERSION", buildId });
  }
});

function isRecord(value: unknown): value is { readonly type?: unknown } {
  return typeof value === "object" && value !== null;
}
