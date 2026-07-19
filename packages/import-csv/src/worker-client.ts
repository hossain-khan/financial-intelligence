export function createCsvImportWorker(): Worker {
  return new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "financial-intelligence-csv-import",
  });
}
