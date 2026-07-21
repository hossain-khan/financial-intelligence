/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Build identifier injected by Vite `define` at build time (see apps/web/vite.config.ts). Declared
// as a global so both the app and the service worker can report the running build.
declare const __APP_BUILD_ID__: string;
