/// <reference lib="webworker" />

import type { StatementParser } from "@financial-intelligence/import-core";

import { loadHardenedPdfjs } from "./load-pdfjs";
import { PdfStatementParser } from "./parser";
import { createPdfImportWorkerHandler } from "./worker-handler";

const handler = createPdfImportWorkerHandler(
  { postMessage: (response) => self.postMessage(response) },
  async (): Promise<StatementParser> => {
    const pdfjs = await loadHardenedPdfjs();
    return new PdfStatementParser({ pdfjs });
  },
);

self.addEventListener("message", (event: MessageEvent<unknown>) => {
  void handler(event.data);
});
