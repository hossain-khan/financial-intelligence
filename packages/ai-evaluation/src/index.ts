export { canonicalJson } from "./canonical-json";
export { sha256Hex } from "./digest";
export { CorpusDigestError, assertCorpusDigests } from "./corpus";
export type { EvalCase } from "./corpus";
export { FixtureLintError, lintCase } from "./fixture-linter";
export { computeMetrics } from "./metrics";
export type { MetricSet } from "./metrics";
export type { CaseOutcome, CaseOutcomeKind } from "./outcomes";
export {
  createAbstainingProvider,
  createLeakyProvider,
  createMalformedProvider,
  createNondeterministicProvider,
  createPerfectProvider,
  createSlowProvider,
} from "./fakes/index";
export { classifyOutcome, runEvaluation } from "./runner";
export type { RunnerOptions } from "./runner";
