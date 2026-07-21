import { Money } from "@financial-intelligence/domain";
import { describe, expect, it } from "vitest";

import { WORKLOAD_TIERS } from "./config";
import { buildWorkloadManifest, generateWorkload, webCryptoDigest } from "./generator";

const digest = (bytes: Uint8Array) => webCryptoDigest(bytes, crypto);
const smoke = { ...WORKLOAD_TIERS.smoke1k, transactionCount: 200, importCount: 4, accountCount: 2 };

describe("generateWorkload", () => {
  it("is deterministic for a given seed (same digest)", async () => {
    const a = await buildWorkloadManifest(generateWorkload(smoke), digest);
    const b = await buildWorkloadManifest(generateWorkload(smoke), digest);
    expect(a.digest).toBe(b.digest);
    expect(a.recordCounts).toEqual(b.recordCounts);
  });

  it("changes the digest when the seed changes", async () => {
    const a = await buildWorkloadManifest(generateWorkload(smoke), digest);
    const b = await buildWorkloadManifest(
      generateWorkload({ ...smoke, seed: smoke.seed + 1 }),
      digest,
    );
    expect(a.digest).not.toBe(b.digest);
  });

  it("produces exactly the requested transaction count across imports", () => {
    const workload = generateWorkload(smoke);
    const total = workload.imports.reduce((sum, item) => sum + item.candidates.length, 0);
    expect(total).toBe(smoke.transactionCount);
    expect(workload.reconciliation.transactionCount).toBe(smoke.transactionCount);
  });

  it("keeps one candidate per source row so the commit invariant holds", () => {
    const workload = generateWorkload(smoke);
    for (const workloadImport of workload.imports) {
      expect(workloadImport.candidates.length).toBe(workloadImport.source.sourceRows);
    }
  });

  it("emits only 2dp amounts in the account currency", () => {
    const workload = generateWorkload(smoke);
    for (const workloadImport of workload.imports) {
      for (const candidate of workloadImport.candidates) {
        expect(candidate.amount).toMatch(/^-?\d+\.\d{2}$/u);
        expect(candidate.currency).toBe(smoke.currency);
      }
    }
  });

  it("reconciles inflow/outflow/net against the generated amounts", () => {
    const workload = generateWorkload(smoke);
    let inflow = Money.zero(smoke.currency);
    let outflow = Money.zero(smoke.currency);
    for (const workloadImport of workload.imports) {
      for (const candidate of workloadImport.candidates) {
        const money = Money.from(candidate.amount, candidate.currency);
        if (money.isInflow()) inflow = inflow.add(money);
        else outflow = outflow.add(money.abs());
      }
    }
    expect(workload.reconciliation.inflowTotal).toBe(inflow.toJSON().amount);
    expect(workload.reconciliation.outflowTotal).toBe(outflow.toJSON().amount);
    expect(workload.reconciliation.netTotal).toBe(inflow.subtract(outflow).toJSON().amount);
  });

  it("uses parser-accepted UUIDs and starter categories", () => {
    const workload = generateWorkload(smoke);
    expect(workload.workspace.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(workload.categories.length).toBeGreaterThan(0);
    expect(workload.accounts).toHaveLength(smoke.accountCount);
  });
});
