import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { applicationServices, cleanupAbandonedRestoreStaging } from "./infrastructure";
import { benchmarkModeEnabled, installPerfReader, mark, measure, PERF_MARKS } from "./perf-marks";
import { initInstallAffordance } from "./pwa/install";
import { registerApplicationServiceWorker } from "./pwa/register";
import "./styles.css";

const root = document.querySelector<HTMLDivElement>("#root");

if (root === null) {
  throw new Error("Application root was not found");
}

// Install the benchmark reader before render only when explicitly opted in via ?perf=1, so ordinary
// sessions carry no observer or sample-retention overhead.
if (benchmarkModeEnabled()) installPerfReader();
mark(PERF_MARKS.appInteractiveStart);

createRoot(root).render(
  <StrictMode>
    <App services={applicationServices} />
  </StrictMode>,
);

// A microtask after the initial render commits marks the app as interactive for the startup measure.
queueMicrotask(() => {
  mark(PERF_MARKS.appInteractiveEnd);
  measure("app-interactive", PERF_MARKS.appInteractiveStart, PERF_MARKS.appInteractiveEnd);
});

initInstallAffordance();
registerApplicationServiceWorker();
void cleanupAbandonedRestoreStaging();
