import { TransformersLocalEngine } from "./transformers-engine";
import { createLocalAiWorkerHandler } from "./worker-handler";

// Worker entry: constructs the real engine and routes protocol messages to the shared handler.
// Runtime-only; validated by the maintainer's spike, excluded from unit coverage.
const handler = createLocalAiWorkerHandler(
  { postMessage: (response) => self.postMessage(response) },
  new TransformersLocalEngine(),
);

self.addEventListener("message", (event: MessageEvent) => {
  void handler(event.data);
});
