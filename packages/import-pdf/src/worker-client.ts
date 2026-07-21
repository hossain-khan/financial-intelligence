export function createPdfImportWorker(): Worker {
  return new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "financial-intelligence-pdf-import",
  });
}
