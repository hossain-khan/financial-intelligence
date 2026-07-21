import { readFile } from "node:fs/promises";
import { argv, exit } from "node:process";

/**
 * Validate a performance-result artifact and, when a baseline is supplied, compare only compatible
 * environment profiles. This mirrors the pure logic in
 * `packages/qualification/src/result-schema.ts` but runs as a standalone Node script so CI can
 * inspect an uploaded artifact without a bundler. A mismatched environment/workload is reported as
 * a new baseline, never a regression. The script is informational by default: it prints actionable
 * detail and exits non-zero only when `--fail-on-regression` is passed (kept off in PR CI while
 * variance is understood).
 */

const PERF_RESULT_VERSION = "1.0.0";
const HEX64 = /^[0-9a-f]{64}$/u;

function fail(message) {
  console.error(`perf-result: ${message}`);
  exit(1);
}

function validate(result, label) {
  if (typeof result !== "object" || result === null) fail(`${label}: not an object`);
  if (result.schemaVersion !== PERF_RESULT_VERSION) {
    fail(`${label}: unsupported schemaVersion ${result.schemaVersion}`);
  }
  if (typeof result.workloadDigest !== "string" || !HEX64.test(result.workloadDigest)) {
    fail(`${label}: workloadDigest must be 64-hex`);
  }
  if (!Array.isArray(result.metrics) || result.metrics.length === 0) {
    fail(`${label}: metrics must be a non-empty array`);
  }
  for (const metric of result.metrics) {
    for (const key of ["id", "unit", "mode", "median", "threshold", "thresholdKind"]) {
      if (metric[key] === undefined) fail(`${label}: metric missing ${key}`);
    }
  }
}

function profileMismatch(a, b) {
  if (a.workloadDigest !== b.workloadDigest) return "workload digest differs";
  if (a.workloadLabel !== b.workloadLabel) return "workload label differs";
  for (const key of ["browser", "os", "hardwareProfile", "node", "pnpm"]) {
    if (a.environment?.[key] !== b.environment?.[key]) return `environment.${key} differs`;
  }
  return undefined;
}

function regressions(baseline, current) {
  const byId = new Map(baseline.metrics.map((metric) => [metric.id, metric]));
  return current.metrics
    .filter((metric) => {
      if (!byId.has(metric.id)) return false;
      return metric.thresholdKind === "max"
        ? metric.median > metric.threshold
        : metric.median < metric.threshold;
    })
    .map((metric) => ({
      id: metric.id,
      baseline: byId.get(metric.id).median,
      current: metric.median,
      threshold: metric.threshold,
      unit: metric.unit,
    }));
}

async function main() {
  const args = argv.slice(2);
  const failOnRegression = args.includes("--fail-on-regression");
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const currentPath = positional[0];
  const baselinePath = positional[1];
  if (currentPath === undefined) {
    fail("usage: check-perf-result <result.json> [baseline.json] [--fail-on-regression]");
  }

  const current = JSON.parse(await readFile(currentPath, "utf8"));
  validate(current, "result");
  console.log(
    `perf-result: ${currentPath} valid (${current.metrics.length} metrics, workload ${current.workloadLabel}).`,
  );
  for (const metric of current.metrics) {
    const verdict = metric.pass ? "ok" : "OVER BUDGET";
    console.log(
      `  ${metric.id}: median=${metric.median} ${metric.unit} threshold=${metric.threshold} (${metric.thresholdKind}) [${verdict}]`,
    );
  }

  if (baselinePath === undefined) return;
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  validate(baseline, "baseline");
  const mismatch = profileMismatch(baseline, current);
  if (mismatch !== undefined) {
    console.log(`perf-result: baseline not comparable (${mismatch}); treating as a new baseline.`);
    return;
  }
  const found = regressions(baseline, current);
  if (found.length === 0) {
    console.log("perf-result: no regressions against the comparable baseline.");
    return;
  }
  for (const item of found) {
    console.error(
      `perf-result REGRESSION ${item.id}: current=${item.current}${item.unit} baseline=${item.baseline}${item.unit} threshold=${item.threshold}${item.unit}. ` +
        `Reproduce: PERF_ROWS=<n> pnpm exec playwright test --project=perf`,
    );
  }
  if (failOnRegression) exit(1);
  console.log("perf-result: regressions are informational (pass --fail-on-regression to enforce).");
}

await main();
