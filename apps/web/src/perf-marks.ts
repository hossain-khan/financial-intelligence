/**
 * User-visible performance instrumentation. Marks name stable interaction boundaries — never
 * financial values — using the standard `performance.mark`/`measure` API. In normal use the module
 * is effectively free: it only creates marks, and the long-task observer is started lazily by the
 * benchmark reader. A test/benchmark harness reads results through `window.__perf` (installed only
 * when the `?perf=1` flag or a stored opt-in is present), so production carries no reader overhead.
 */

export const PERF_MARKS = {
  appInteractiveStart: "fi:app-interactive:start",
  appInteractiveEnd: "fi:app-interactive:end",
  importPreviewStart: "fi:import-preview:start",
  importPreviewEnd: "fi:import-preview:end",
  importCommitStart: "fi:import-commit:start",
  importCommitEnd: "fi:import-commit:end",
  ledgerRenderStart: "fi:ledger-render:start",
  ledgerRenderEnd: "fi:ledger-render:end",
  ledgerFilterStart: "fi:ledger-filter:start",
  ledgerFilterEnd: "fi:ledger-filter:end",
  dashboardQueryStart: "fi:dashboard-query:start",
  dashboardQueryEnd: "fi:dashboard-query:end",
} as const;

export type PerfMeasureName =
  | "app-interactive"
  | "import-preview"
  | "import-commit"
  | "ledger-render"
  | "ledger-filter"
  | "dashboard-query";

interface PerfReader {
  /** Durations (ms) of every measure with the given name, oldest first. */
  measures(name: PerfMeasureName): number[];
  /** Count of long tasks (>50 ms) observed since the reader was installed. */
  longTasks(): number;
  /** Rendered DOM row count for a bounded-list assertion. */
  domRowCount(): number;
  clear(): void;
}

declare global {
  var __perf: PerfReader | undefined;
}

function supported(): boolean {
  return typeof performance !== "undefined" && typeof performance.mark === "function";
}

/** Record a mark. Safe to call unconditionally; a no-op when the API is unavailable. */
export function mark(name: string): void {
  if (supported()) performance.mark(name);
}

/**
 * Measure between two previously-recorded marks. Returns the duration in ms, or undefined if either
 * mark is missing. Never throws into the calling UI path.
 */
export function measure(
  name: PerfMeasureName,
  startMark: string,
  endMark: string,
): number | undefined {
  if (!supported() || typeof performance.measure !== "function") return undefined;
  try {
    const entry = performance.measure(name, startMark, endMark);
    return entry.duration;
  } catch {
    return undefined;
  }
}

/**
 * Install the benchmark reader on `window.__perf`. Called once at startup only when the benchmark
 * flag is present, so ordinary sessions never start a `PerformanceObserver` or retain samples.
 */
export function installPerfReader(): void {
  if (typeof window === "undefined" || window.__perf !== undefined || !supported()) return;

  let longTaskCount = 0;
  try {
    const observer = new PerformanceObserver((list) => {
      longTaskCount += list.getEntries().length;
    });
    observer.observe({ entryTypes: ["longtask"] });
  } catch {
    // longtask is unsupported in some engines; leave the count at zero and label it as such.
  }

  window.__perf = {
    measures: (name) =>
      performance.getEntriesByName(name, "measure").map((entry) => entry.duration),
    longTasks: () => longTaskCount,
    // Count rows only within the bounded transaction ledger region so unrelated tables (cash-flow
    // summaries) do not inflate the NFR-025 bounded-rendering measure.
    domRowCount: () => {
      const ledger = document.querySelector('[role="region"][aria-label="Transaction ledger"]');
      return (ledger ?? document).querySelectorAll("tbody tr").length;
    },
    clear: () => performance.clearMeasures(),
  };
}

/** Whether the benchmark flag opts this session into the reader. */
export function benchmarkModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).get("perf") === "1";
  } catch {
    return false;
  }
}
