import { execSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { arch, cpus, platform } from "node:os";
import { dirname } from "node:path";

import type { Page } from "@playwright/test";
import {
  assertNoSensitiveContent,
  validatePerfResult,
  webCryptoDigest,
  type PerfEnvironment,
  type PerfMetric,
  type PerfResult,
  type PerfMode,
} from "@financial-intelligence/qualification";

/** NFR-derived budgets (docs/06-NON-FUNCTIONAL-REQUIREMENTS.md). */
export const BUDGETS = {
  appInteractiveMs: 2_000, // NFR-020 warm shell → interactive
  ledgerFilterMs: 200, // NFR-021 filter/sort
  dashboardQueryMs: 1_000, // NFR-022 dashboard aggregates
  csvRowsPerSecond: 10_000, // NFR-023 CSV throughput
  maxDomRows: 200, // NFR-025 bounded rendering (ledger paginates at 50)
} as const;

const encoder = new TextEncoder();

/** A single measured value read from the in-page benchmark reader. */
export interface PerfMeasureReader {
  measures(name: string): Promise<number[]>;
  longTasks(): Promise<number>;
  domRowCount(): Promise<number>;
}

interface PerfWindow {
  __perf?: {
    measures(name: string): number[];
    longTasks(): number;
    domRowCount(): number;
  };
}

/** Access the `window.__perf` reader installed by `?perf=1`. */
export function perfReader(page: Page): PerfMeasureReader {
  return {
    measures: (name) =>
      page.evaluate(
        (metric) => (globalThis as unknown as PerfWindow).__perf?.measures(metric) ?? [],
        name,
      ),
    longTasks: () =>
      page.evaluate(() => (globalThis as unknown as PerfWindow).__perf?.longTasks() ?? 0),
    domRowCount: () =>
      page.evaluate(() => (globalThis as unknown as PerfWindow).__perf?.domRowCount() ?? 0),
  };
}

/** median and p95 of a non-empty sample set. */
export function summarize(samples: readonly number[]): { median: number; p95: number } {
  if (samples.length === 0) return { median: Number.NaN, p95: Number.NaN };
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (fraction: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(fraction * sorted.length))]!;
  return { median: at(0.5), p95: at(0.95) };
}

/**
 * Build a metric, or return undefined when no samples were captured. A measure that never fired on a
 * given run is honestly omitted rather than reported as a fabricated zero (the issue forbids
 * zero-filling an unavailable measure), which also keeps the result schema-valid (no NaN medians).
 */
export function buildMetric(input: {
  id: string;
  unit: PerfMetric["unit"];
  mode: PerfMode;
  samples: readonly number[];
  threshold: number;
  thresholdKind: PerfMetric["thresholdKind"];
}): PerfMetric | undefined {
  const finiteSamples = input.samples.filter((sample) => Number.isFinite(sample));
  if (finiteSamples.length === 0) return undefined;
  const { median, p95 } = summarize(finiteSamples);
  const pass =
    input.thresholdKind === "max" ? median <= input.threshold : median >= input.threshold;
  return {
    id: input.id,
    unit: input.unit,
    mode: input.mode,
    iterations: finiteSamples.length,
    samples: [...finiteSamples],
    median,
    p95,
    memoryBytes: null,
    threshold: input.threshold,
    thresholdKind: input.thresholdKind,
    pass,
  };
}

function environment(browserVersion: string): PerfEnvironment {
  let commit = "unknown";
  let dirty = false;
  try {
    commit = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    dirty = execSync("git status --porcelain", { encoding: "utf8" }).trim().length > 0;
  } catch {
    // Git metadata is best-effort; a detached/unavailable repo still produces a valid result.
  }
  const cores = cpus().length;
  return {
    commit,
    dirty,
    node: process.version.replace(/^v/u, ""),
    pnpm: process.env.npm_config_user_agent?.match(/pnpm\/([\d.]+)/u)?.[1] ?? "unknown",
    browser: "chromium",
    browserVersion,
    os: `${platform()}-${arch()}`,
    hardwareProfile: `${platform()}-${arch()}-${cores}core`,
  };
}

/** Assemble, validate, privacy-check, and write a bounded perf result artifact. */
export async function writePerfResult(input: {
  outputPath: string;
  workloadLabel: string;
  workloadDigest: string;
  browserVersion: string;
  metrics: readonly PerfMetric[];
}): Promise<PerfResult> {
  const result: PerfResult = {
    schemaVersion: "1.0.0",
    // Timestamp is stamped here (Node side); the browser page never emits it.
    generatedAt: new Date().toISOString(),
    environment: environment(input.browserVersion),
    workloadDigest: input.workloadDigest,
    workloadLabel: input.workloadLabel,
    metrics: input.metrics,
  };
  validatePerfResult(result);
  assertNoSensitiveContent(result);
  await mkdir(dirname(input.outputPath), { recursive: true });
  await writeFile(input.outputPath, JSON.stringify(result, null, 2));
  return result;
}

/** Digest an arbitrary label so a result carries a schema-valid 64-hex workload digest. */
export async function digestLabel(value: string): Promise<string> {
  return webCryptoDigest(encoder.encode(value), globalThis.crypto);
}
