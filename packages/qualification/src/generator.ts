import {
  Money,
  createAccount,
  createClassificationRule,
  createMerchant,
  createStarterCategories,
  createWorkspace,
  parseAccountId,
  parseDateOnly,
  parseUtcTimestamp,
  parseWorkspaceId,
  type Account,
  type Category,
  type ClassificationRule,
  type Merchant,
  type Workspace,
} from "@financial-intelligence/domain";

import { canonicalJson } from "./canonical-json";
import { GENERATOR_VERSION, type WorkloadConfig } from "./config";
import { SeededRng, SeededUuidFactory } from "./rng";

/**
 * A candidate row in the shape `CommitAcceptedImport` accepts. Declared locally (rather than
 * importing from `application`) so the generator stays free of the application layer; the fields
 * match `AcceptedCandidate` structurally.
 */
export interface WorkloadCandidate {
  readonly accountId: string;
  readonly postedDate: string;
  readonly description: string;
  readonly amount: string;
  readonly currency: string;
  readonly sourceTransactionId: string;
  readonly provenance: {
    readonly sourceFileSha256: string;
    readonly sourceLocation: string;
    readonly parserId: string;
    readonly parserVersion: string;
    readonly mappingVersion: string;
    readonly original: Readonly<Record<string, string>>;
  };
}

/** One import's worth of candidates plus the source descriptor they reconcile against. */
export interface WorkloadImport {
  readonly accountId: string;
  readonly source: {
    readonly fileName: string;
    readonly mediaType: string;
    readonly byteSize: number;
    readonly sha256: string;
    readonly parserId: string;
    readonly parserVersion: string;
    readonly sourceRows: number;
    readonly issues: readonly never[];
  };
  readonly candidates: readonly WorkloadCandidate[];
}

export interface WorkloadReconciliation {
  readonly accountCount: number;
  readonly importCount: number;
  readonly transactionCount: number;
  readonly merchantCount: number;
  readonly ruleCount: number;
  readonly categoryCount: number;
  /** Signed decimal-string totals across all transactions. */
  readonly inflowTotal: string;
  readonly outflowTotal: string;
  readonly netTotal: string;
}

export interface GeneratedWorkload {
  readonly config: WorkloadConfig;
  readonly workspace: Workspace;
  readonly accounts: readonly Account[];
  readonly categories: readonly Category[];
  readonly merchants: readonly Merchant[];
  readonly classificationRules: readonly ClassificationRule[];
  /** Grouped by import so a caller can drive `CommitAcceptedImport` one import at a time. */
  readonly imports: readonly WorkloadImport[];
  readonly reconciliation: WorkloadReconciliation;
}

const FIXED_NOW = "2026-01-01T00:00:00.000Z";
const MERCHANT_WORDS = [
  "Coffee",
  "Grocery",
  "Transit",
  "Utility",
  "Pharmacy",
  "Bookstore",
  "Hardware",
  "Bakery",
  "Cinema",
  "Fitness",
];

/**
 * Generate a deterministic, reconciled synthetic workspace. Amounts are always exactly two decimal
 * places so they satisfy both `Money.from` and the import candidate validator. Every transaction is
 * one candidate under exactly one import, so the `sourceRows === candidate count` commit invariant
 * holds per import. All values are synthetic; nothing derives from a real statement.
 */
export function generateWorkload(config: WorkloadConfig): GeneratedWorkload {
  const rng = new SeededRng(config.seed);
  const uuid = new SeededUuidFactory(rng);
  const now = parseUtcTimestamp(FIXED_NOW);

  const workspace = createWorkspace({
    id: parseWorkspaceId(uuid.next()),
    name: `Qualification ${config.label}`,
    now,
  });

  const accounts = Array.from({ length: config.accountCount }, (_, index) =>
    createAccount({
      id: parseAccountId(uuid.next()),
      workspaceId: workspace.id,
      name: `Account ${index + 1}`,
      type: "checking",
      currency: config.currency,
      now,
    }),
  );

  const categories = createStarterCategories(now);
  const merchants = Array.from({ length: config.merchantCount }, (_, index) =>
    createMerchant({
      id: uuid.next() as never,
      name: `${rng.pick(MERCHANT_WORDS)} ${index + 1}`,
      now,
    }),
  );
  const classificationRules = Array.from({ length: config.ruleCount }, (_, index) =>
    createClassificationRule({
      id: uuid.next() as never,
      name: `Rule ${index + 1}`,
      conditions: [
        { field: "normalizedDescription", operator: "contains", value: rng.pick(MERCHANT_WORDS) },
      ],
      actions: [{ type: "addTag", value: `tag-${index + 1}` }],
      now,
    }),
  );

  const imports = distributeImports(config, accounts, merchants, rng, uuid);
  const reconciliation = reconcile(config, categories.length, imports);

  return {
    config,
    workspace,
    accounts,
    categories,
    merchants,
    classificationRules,
    imports,
    reconciliation,
  };
}

function distributeImports(
  config: WorkloadConfig,
  accounts: readonly Account[],
  merchants: readonly Merchant[],
  rng: SeededRng,
  uuid: SeededUuidFactory,
): readonly WorkloadImport[] {
  // Spread the transaction budget across imports as evenly as possible; the remainder lands on the
  // last import so the totals reconcile exactly.
  const perImport = Math.floor(config.transactionCount / config.importCount);
  const remainder = config.transactionCount - perImport * config.importCount;
  const imports: WorkloadImport[] = [];
  let globalIndex = 0;

  for (let importIndex = 0; importIndex < config.importCount; importIndex += 1) {
    const account = accounts[importIndex % accounts.length];
    if (account === undefined) throw new Error("workload requires at least one account");
    const rows = perImport + (importIndex === config.importCount - 1 ? remainder : 0);
    const sha256 = hex64(uuid.next());
    const candidates: WorkloadCandidate[] = [];
    for (let row = 0; row < rows; row += 1) {
      candidates.push(
        buildCandidate(account, config.currency, merchants, globalIndex, sha256, row, rng),
      );
      globalIndex += 1;
    }
    imports.push({
      accountId: account.id,
      source: {
        fileName: `synthetic-${importIndex + 1}.csv`,
        mediaType: "text/csv",
        byteSize: rows * 80,
        sha256,
        parserId: "qualification",
        parserVersion: GENERATOR_VERSION,
        sourceRows: rows,
        issues: [],
      },
      candidates,
    });
  }
  return imports;
}

function buildCandidate(
  account: Account,
  currency: string,
  merchants: readonly Merchant[],
  globalIndex: number,
  sha256: string,
  row: number,
  rng: SeededRng,
): WorkloadCandidate {
  // Every ~7th row is an inflow so the ledger has both directions; amounts are bounded and 2dp.
  const isInflow = globalIndex % 7 === 0;
  const cents = rng.nextInt(1, 500_00);
  const amount = `${isInflow ? "" : "-"}${(cents / 100).toFixed(2)}`;
  const merchant = merchants.length > 0 ? rng.pick(merchants).name : "Merchant";
  const day = (globalIndex % 28) + 1;
  const month = ((globalIndex >> 5) % 12) + 1;
  const postedDate = `2025-${pad2(month)}-${pad2(day)}`;
  parseDateOnly(postedDate); // Fail fast if the synthetic date is ever invalid.
  const description = `${merchant} #${globalIndex + 1}`;
  return {
    accountId: account.id,
    postedDate,
    description,
    amount,
    currency,
    sourceTransactionId: `${sha256.slice(0, 8)}-${row}`,
    provenance: {
      sourceFileSha256: sha256,
      sourceLocation: `line:${row + 1}`,
      parserId: "qualification",
      parserVersion: GENERATOR_VERSION,
      mappingVersion: "1.0.0",
      original: { amount, description, postedDate },
    },
  };
}

function reconcile(
  config: WorkloadConfig,
  categoryCount: number,
  imports: readonly WorkloadImport[],
): WorkloadReconciliation {
  let inflow = Money.zero(config.currency);
  let outflow = Money.zero(config.currency);
  let transactionCount = 0;
  for (const workloadImport of imports) {
    for (const candidate of workloadImport.candidates) {
      transactionCount += 1;
      const money = Money.from(candidate.amount, candidate.currency);
      if (money.isInflow()) inflow = inflow.add(money);
      else outflow = outflow.add(money.abs());
    }
  }
  return {
    accountCount: config.accountCount,
    importCount: config.importCount,
    transactionCount,
    merchantCount: config.merchantCount,
    ruleCount: config.ruleCount,
    categoryCount,
    inflowTotal: inflow.toJSON().amount,
    outflowTotal: outflow.toJSON().amount,
    netTotal: inflow.subtract(outflow).toJSON().amount,
  };
}

export interface WorkloadManifest {
  readonly generatorVersion: string;
  readonly config: WorkloadConfig;
  readonly recordCounts: {
    readonly accounts: number;
    readonly imports: number;
    readonly transactions: number;
    readonly merchants: number;
    readonly classificationRules: number;
    readonly categories: number;
  };
  readonly byteSize: number;
  readonly digest: string;
  readonly expectedTotals: {
    readonly inflow: string;
    readonly outflow: string;
    readonly net: string;
  };
}

/** A digest function so the pure package does not bind to a specific crypto global. */
export type DigestFunction = (bytes: Uint8Array) => Promise<string>;

/**
 * Build a manifest describing a generated workload: counts, byte size, a content digest over the
 * canonical JSON of the imports, and the reconciled totals. Comparing this digest across runs proves
 * the data did not change; recording it in a perf result stops a data change from masquerading as a
 * performance change.
 */
export async function buildWorkloadManifest(
  workload: GeneratedWorkload,
  digest: DigestFunction,
): Promise<WorkloadManifest> {
  const canonical = canonicalJson(workload.imports);
  const bytes = new TextEncoder().encode(canonical);
  return {
    generatorVersion: GENERATOR_VERSION,
    config: workload.config,
    recordCounts: {
      accounts: workload.accounts.length,
      imports: workload.imports.length,
      transactions: workload.reconciliation.transactionCount,
      merchants: workload.merchants.length,
      classificationRules: workload.classificationRules.length,
      categories: workload.categories.length,
    },
    byteSize: bytes.byteLength,
    digest: await digest(bytes),
    expectedTotals: {
      inflow: workload.reconciliation.inflowTotal,
      outflow: workload.reconciliation.outflowTotal,
      net: workload.reconciliation.netTotal,
    },
  };
}

/** Web Crypto SHA-256 → lowercase hex, for callers that have a `Crypto` instance. */
export async function webCryptoDigest(bytes: Uint8Array, cryptoProvider: Crypto): Promise<string> {
  const hash = await cryptoProvider.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hex64(uuid: string): string {
  const stripped = uuid.replaceAll("-", "");
  return (stripped + stripped).slice(0, 64);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
