import type { PdfjsModule } from "./pdfjs";

/**
 * Load the pdfjs-dist legacy build and force it into main-thread ("fake worker") mode. We are
 * already inside our own dedicated Web Worker; PDF.js spawning a *second* nested worker would add a
 * network-fetched worker script and defeat the isolation. Assigning `globalThis.pdfjsWorker` makes
 * PDF.js find its `WorkerMessageHandler` in-scope and run synchronously in this thread, so it never
 * calls `new Worker(...)` and never fetches a worker URL.
 *
 * The legacy build is used because the modern build touches browser globals at module-eval time in
 * a way that also breaks Node test environments; the legacy build runs in both.
 */
export async function loadHardenedPdfjs(): Promise<PdfjsModule> {
  const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = workerModule;
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfjsModule;
  return pdfjs;
}
