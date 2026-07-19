import { afterEach, describe, expect, it, vi } from "vitest";

import { createCsvImportWorker } from "./worker-client";

afterEach(() => vi.unstubAllGlobals());

describe("createCsvImportWorker", () => {
  it("creates a named module worker instead of parsing on the main thread", () => {
    const WorkerMock = vi.fn(function WorkerConstructor(
      this: { url?: URL; options?: WorkerOptions },
      url: URL,
      options?: WorkerOptions,
    ) {
      this.url = url;
      if (options !== undefined) this.options = options;
    });
    vi.stubGlobal("Worker", WorkerMock);

    const worker = createCsvImportWorker() as unknown as {
      readonly url: URL;
      readonly options: WorkerOptions;
    };

    expect(worker.url.pathname.endsWith("/worker.ts")).toBe(true);
    expect(worker.options).toEqual({
      type: "module",
      name: "financial-intelligence-csv-import",
    });
  });
});
