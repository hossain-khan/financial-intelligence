/** Constructs the module worker that holds the transformers.js engine. */
export function createLocalAiWorker(): Worker {
  return new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
    name: "financial-intelligence-ai-local",
  });
}
