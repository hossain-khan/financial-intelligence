import { PdfImportError } from "./errors";
import type { LayoutDetection, PdfStatementLayoutAdapter } from "./layout";
import type { PdfTextDocument } from "./model";
import { GenericTabularAdapter } from "./adapters/generic-tabular";

/** Minimum score gap between the winner and the runner-up; a closer race is a tie → unsupported. */
const UNIQUE_MARGIN = 0.1;

export interface AdapterSelection {
  readonly adapter: PdfStatementLayoutAdapter;
  readonly detection: LayoutDetection;
  readonly runnerUp?: LayoutDetection;
}

/**
 * Select the single winning adapter for a document, or throw `UNSUPPORTED_LAYOUT` when selection is
 * not unique and confident. Selection requires: the top score clears the adapter's declared
 * minimum, and it beats the runner-up by at least `UNIQUE_MARGIN`. Ties and low scores never
 * silently pick an adapter.
 */
export function selectAdapter(
  document: PdfTextDocument,
  adapters: readonly PdfStatementLayoutAdapter[] = DEFAULT_ADAPTERS,
): AdapterSelection {
  if (adapters.length === 0) {
    throw new PdfImportError("UNSUPPORTED_LAYOUT", "No PDF layout adapters are registered");
  }

  const scored = adapters
    .map((adapter) => ({ adapter, detection: adapter.detect(document) }))
    .sort((a, b) => b.detection.score - a.detection.score);

  const top = scored[0];
  if (top === undefined || top.detection.score < top.adapter.minimumScore) {
    throw new PdfImportError(
      "UNSUPPORTED_LAYOUT",
      "No layout adapter recognized this statement with sufficient confidence",
    );
  }

  const runnerUp = scored[1];
  if (
    runnerUp !== undefined &&
    runnerUp.detection.score >= runnerUp.adapter.minimumScore &&
    top.detection.score - runnerUp.detection.score < UNIQUE_MARGIN
  ) {
    throw new PdfImportError(
      "UNSUPPORTED_LAYOUT",
      "Statement layout is ambiguous; multiple adapters matched with similar confidence",
    );
  }

  return {
    adapter: top.adapter,
    detection: top.detection,
    ...(runnerUp === undefined ? {} : { runnerUp: runnerUp.detection }),
  };
}

export const DEFAULT_ADAPTERS: readonly PdfStatementLayoutAdapter[] = Object.freeze([
  new GenericTabularAdapter(),
]);
