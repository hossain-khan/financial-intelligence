import { describe, expect, it } from "vitest";

import { PdfImportError } from "./errors";
import type { LayoutDetection, PdfLayoutResult, PdfStatementLayoutAdapter } from "./layout";
import type { PdfTextDocument } from "./model";
import { selectAdapter } from "./registry";

const emptyDocument: PdfTextDocument = { pageCount: 0, pages: [], textCharacterCount: 0 };
const emptyResult: PdfLayoutResult = { rows: [], issues: [], detectedMetadata: {} };

function adapter(id: string, score: number, minimumScore = 0.5): PdfStatementLayoutAdapter {
  return {
    id,
    version: "1.0.0",
    minimumScore,
    detect: (): LayoutDetection => ({ adapterId: id, score, reason: "test" }),
    extract: () => emptyResult,
  };
}

describe("selectAdapter", () => {
  it("selects the unique confident winner", () => {
    const selection = selectAdapter(emptyDocument, [adapter("a", 0.9), adapter("b", 0.3)]);
    expect(selection.adapter.id).toBe("a");
    expect(selection.runnerUp?.adapterId).toBe("b");
  });

  it("rejects when the top score is below the adapter minimum", () => {
    expect(() => selectAdapter(emptyDocument, [adapter("a", 0.4)])).toThrow(PdfImportError);
  });

  it("rejects a tie between two confident adapters", () => {
    expect(() => selectAdapter(emptyDocument, [adapter("a", 0.82), adapter("b", 0.8)])).toThrow(
      /ambiguous/iu,
    );
  });

  it("rejects when there are no adapters", () => {
    expect(() => selectAdapter(emptyDocument, [])).toThrow(PdfImportError);
  });

  it("allows a winner that clears the runner-up by the required margin", () => {
    const selection = selectAdapter(emptyDocument, [adapter("a", 0.95), adapter("b", 0.6)]);
    expect(selection.adapter.id).toBe("a");
  });
});
