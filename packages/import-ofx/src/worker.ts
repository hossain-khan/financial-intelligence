/// <reference lib="webworker" />

import { createOfxImportWorkerHandler } from "./worker-handler";

const handler = createOfxImportWorkerHandler({
  postMessage: (response) => self.postMessage(response),
});

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  void handler(event.data);
});
