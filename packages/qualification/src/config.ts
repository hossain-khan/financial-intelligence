/**
 * A named workload tier. `transactionCount` is the headline size; the other counts scale the
 * surrounding workspace so the dataset resembles a real one rather than one giant account.
 */
export interface WorkloadConfig {
  readonly label: string;
  readonly seed: number;
  readonly accountCount: number;
  readonly importCount: number;
  readonly transactionCount: number;
  readonly merchantCount: number;
  readonly ruleCount: number;
  readonly currency: string;
}

/** Version of the generator algorithm. Bump when generated output changes so digests don't clash. */
export const GENERATOR_VERSION = "1.0.0";

/**
 * Standard tiers. PR smoke runs 1k and 10k; 50k is the scheduled/release-candidate workload and the
 * documented path to the NFR 250k bound simply raises `transactionCount` (kept out of PR CI).
 */
export const WORKLOAD_TIERS: Readonly<
  Record<"smoke1k" | "smoke10k" | "release50k", WorkloadConfig>
> = Object.freeze({
  smoke1k: {
    label: "smoke1k",
    seed: 0x5eed_0001,
    accountCount: 3,
    importCount: 6,
    transactionCount: 1_000,
    merchantCount: 40,
    ruleCount: 10,
    currency: "USD",
  },
  smoke10k: {
    label: "smoke10k",
    seed: 0x5eed_0002,
    accountCount: 5,
    importCount: 20,
    transactionCount: 10_000,
    merchantCount: 120,
    ruleCount: 20,
    currency: "USD",
  },
  release50k: {
    label: "release50k",
    seed: 0x5eed_0003,
    accountCount: 8,
    importCount: 60,
    transactionCount: 50_000,
    merchantCount: 300,
    ruleCount: 40,
    currency: "USD",
  },
});
