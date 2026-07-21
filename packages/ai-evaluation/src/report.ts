import type { EvalResult } from "./result-schema";

/** Render a human-readable Markdown summary of an evaluation result. */
export function renderMarkdownSummary(result: EvalResult): string {
  const { profile: p, metrics: m, support: s } = result;
  return [
    `# AI evaluation summary`,
    ``,
    `- Generated: ${result.generatedAt}`,
    `- Model: ${p.model} (adapter ${p.adapterId}@${p.adapterVersion}, ${p.runtime}, ${p.executionLocation})`,
    `- Corpus digest: ${p.corpusDigest}`,
    `- Device tier: ${p.deviceTier}`,
    `- Support: ${s.status} (reviewer ${s.reviewer}, ${s.date})`,
    ``,
    `| Metric | Value |`,
    `| --- | --- |`,
    `| Schema-valid rate | ${m.schemaValidRate} |`,
    `| Invalid-output rate | ${m.invalidOutputRate} |`,
    `| Accuracy | ${m.accuracy} |`,
    `| Abstention precision | ${m.abstentionPrecision} |`,
    `| Abstention recall | ${m.abstentionRecall} |`,
    `| Grounding violations | ${m.groundingViolations} |`,
    `| Privacy violations | ${m.privacyViolations} |`,
    `| Latency p95 (ms) | ${m.latencyP95Ms} |`,
    ``,
  ].join("\n");
}
