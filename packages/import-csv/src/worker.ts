/// <reference lib="webworker" />

import { createCsvImportWorkerHandler } from "./worker-handler";

const handler = createCsvImportWorkerHandler({
  postMessage: (response) => self.postMessage(response),
});

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  void handler(event.data);
});
