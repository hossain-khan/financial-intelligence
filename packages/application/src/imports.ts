import {
  Money,
  createCommittedImport,
  createTransaction,
  detectDuplicateCandidates,
  incrementWorkspaceRevision,
  parseAccountId,
  parseDateOnly,
  parseImportId,
  parseTransactionId,
  parseUtcTimestamp,
  parseWorkspaceId,
  type AccountId,
  type ImportId,
  type ImportIssue,
  type StatementImport,
  type Transaction,
  type TransactionId,
  type Workspace,
} from "@financial-intelligence/domain";

import { AccountNotFoundError, type AccountRepository } from "./accounts";
import type { DuplicateCandidateRepository } from "./duplicate-review";
import type { ApplicationClock, IdGenerator, WorkspaceRepository } from "./workspaces";

export interface AcceptedImportSource {
  readonly fileName: string;
  readonly mediaType: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly parserId: string;
  readonly parserVersion: string;
  readonly sourceRows: number;
  readonly issues: readonly ImportIssue[];
}

export interface AcceptedCandidate {
  readonly accountId: string;
  readonly postedDate: string;
  readonly transactionDate?: string;
  readonly description: string;
  readonly amount: string;
  readonly currency: string;
  readonly sourceTransactionId?: string;
  readonly status?: "pending" | "posted" | "void";
  readonly provenance: {
    readonly sourceFileSha256: string;
    readonly sourceLocation: string;
    readonly parserId: string;
    readonly parserVersion: string;
    readonly mappingVersion: string;
    readonly original: Readonly<Record<string, string>>;
  };
}

export interface CommitAcceptedImportCommand {
  readonly workspaceId: string;
  readonly accountId: string;
  readonly sources: readonly AcceptedImportSource[];
  readonly candidates: readonly AcceptedCandidate[];
  readonly mapping: Readonly<Record<string, string | number | boolean | null>>;
  readonly signal?: CancellationSignal;
}

export interface CancellationSignal {
  readonly aborted: boolean;
}

export interface TransactionFingerprint {
  readonly transactionId: TransactionId;
  readonly accountId: AccountId;
  readonly importId: ImportId;
  readonly fingerprint: string;
  readonly version: 1;
}

export interface AtomicImportCommitPlan {
  readonly expectedWorkspaceRevision: number;
  readonly workspace: Workspace;
  readonly imports: readonly StatementImport[];
  readonly transactions: readonly Transaction[];
  readonly fingerprints: readonly TransactionFingerprint[];
}

export interface ImportCommitRepository {
  commit(plan: AtomicImportCommitPlan, signal?: CancellationSignal): Promise<void>;
  listImportsByAccount(accountId: AccountId): Promise<readonly StatementImport[]>;
  listTransactionsByAccount(accountId: AccountId): Promise<readonly Transaction[]>;
  listAllTransactions(): Promise<readonly Transaction[]>;
  replaceAllFingerprints(fingerprints: readonly TransactionFingerprint[]): Promise<void>;
  deleteFingerprintsByImport(importId: ImportId): Promise<void>;
}

export interface Sha256Digest {
  digest(value: string): Promise<string>;
}

export interface CommitImportResult {
  readonly imports: readonly StatementImport[];
  readonly transactionCount: number;
  readonly committedRevision: number;
}

export class WorkspaceNotFoundError extends Error {
  public constructor() {
    super("Workspace was not found");
    this.name = "WorkspaceNotFoundError";
  }
}

export class ImportCommitValidationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ImportCommitValidationError";
  }
}

export class ImportCommitCancelledError extends Error {
  public constructor() {
    super("Import commit was cancelled");
    this.name = "ImportCommitCancelledError";
  }
}

export class CommitAcceptedImport {
  public constructor(
    private readonly repository: ImportCommitRepository,
    private readonly accounts: AccountRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
    private readonly digest: Sha256Digest,
    private readonly duplicateCandidates?: DuplicateCandidateRepository,
  ) {}

  public async execute(command: CommitAcceptedImportCommand): Promise<CommitImportResult> {
    throwIfCancelled(command.signal);
    const workspaceId = parseWorkspaceId(command.workspaceId);
    const accountId = parseAccountId(command.accountId);
    const [workspace, account] = await Promise.all([
      this.workspaces.findById(workspaceId),
      this.accounts.findById(accountId),
    ]);
    if (workspace === undefined) throw new WorkspaceNotFoundError();
    if (account === undefined) throw new AccountNotFoundError();
    if (account.workspaceId !== workspace.id) {
      throw new ImportCommitValidationError("Target account does not belong to the workspace");
    }
    if (account.archived) {
      throw new ImportCommitValidationError(
        "Transactions cannot be imported into an archived account",
      );
    }

    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const nextWorkspace = incrementWorkspaceRevision(workspace, now);
    const sourceByDigest = validateSources(command.sources);
    validateCandidates(command.candidates, sourceByDigest, account.id, account.currency);
    if (command.candidates.length === 0) {
      throw new ImportCommitValidationError("At least one accepted transaction is required");
    }

    const importIdByDigest = new Map<string, ImportId>();
    for (const source of command.sources) {
      importIdByDigest.set(source.sha256, parseImportId(this.ids.generate()));
    }
    const imports = command.sources.map((source) => {
      const importId = importIdByDigest.get(source.sha256);
      if (importId === undefined)
        throw new ImportCommitValidationError("Source import ID is missing");
      const committed = command.candidates.filter(
        (candidate) => candidate.provenance.sourceFileSha256 === source.sha256,
      ).length;
      const warnings = source.issues.filter((issue) => issue.severity === "warning").length;
      return createCommittedImport({
        id: importId,
        accountId: account.id,
        source: {
          fileName: source.fileName,
          mediaType: source.mediaType,
          byteSize: source.byteSize,
          sha256: source.sha256,
        },
        parser: { id: source.parserId, version: source.parserVersion },
        mapping: command.mapping,
        counts: {
          sourceRows: source.sourceRows,
          valid: committed,
          errors: 0,
          warnings,
          exactDuplicates: 0,
          likelyDuplicates: 0,
          committed,
        },
        issues: source.issues,
        committedRevision: nextWorkspace.revision,
        now,
      });
    });

    const transactions: Transaction[] = [];
    const fingerprints: TransactionFingerprint[] = [];
    for (const candidate of command.candidates) {
      throwIfCancelled(command.signal);
      const importId = importIdByDigest.get(candidate.provenance.sourceFileSha256);
      if (importId === undefined)
        throw new ImportCommitValidationError("Candidate source is missing");
      const transaction = createTransaction({
        id: parseTransactionId(this.ids.generate()),
        accountId: account.id,
        importId,
        postedDate: parseDateOnly(candidate.postedDate),
        ...(candidate.transactionDate === undefined
          ? {}
          : { transactionDate: parseDateOnly(candidate.transactionDate) }),
        money: Money.from(candidate.amount, candidate.currency),
        description: candidate.description,
        ...(candidate.sourceTransactionId === undefined
          ? {}
          : { sourceTransactionId: candidate.sourceTransactionId }),
        ...(candidate.status === undefined ? {} : { status: candidate.status }),
        provenance: {
          parserId: candidate.provenance.parserId,
          parserVersion: candidate.provenance.parserVersion,
          sourceLocation: candidate.provenance.sourceLocation,
          original: candidate.provenance.original,
          transformations: [`mapping:${candidate.provenance.mappingVersion}`],
        },
        now,
      });
      transactions.push(transaction);
      fingerprints.push(await fingerprint(transaction, this.digest));
    }
    throwIfCancelled(command.signal);
    let reviewedTransactions = transactions;
    let reviewedImports = imports;
    if (this.duplicateCandidates !== undefined) {
      const [existing, existingFingerprints] = await Promise.all([
        this.duplicateCandidates.listTransactionsByAccount(account.id),
        this.duplicateCandidates.listFingerprintsByAccount(account.id),
      ]);
      const duplicates = detectDuplicateCandidates({
        existing,
        incoming: transactions,
        fingerprints: [
          ...existingFingerprints,
          ...fingerprints.map(({ transactionId, fingerprint: value }) => ({
            transactionId,
            value,
          })),
        ],
      });
      const duplicateIds = new Set(duplicates.map((candidate) => candidate.incomingTransactionId));
      reviewedTransactions = transactions.map((transaction) =>
        duplicateIds.has(transaction.id)
          ? { ...transaction, reviewState: "needsReview" }
          : transaction,
      );
      reviewedImports = imports.map((statementImport) => {
        const importedIds = new Set(
          transactions
            .filter((transaction) => transaction.importId === statementImport.id)
            .map((transaction) => transaction.id),
        );
        const exactDuplicates = duplicates.filter(
          (candidate) =>
            importedIds.has(candidate.incomingTransactionId) && candidate.kind === "exact",
        ).length;
        const likelyDuplicates = duplicates.filter(
          (candidate) =>
            importedIds.has(candidate.incomingTransactionId) && candidate.kind === "likely",
        ).length;
        return {
          ...statementImport,
          counts: { ...statementImport.counts, exactDuplicates, likelyDuplicates },
        };
      });
    }
    const plan: AtomicImportCommitPlan = {
      expectedWorkspaceRevision: workspace.revision,
      workspace: nextWorkspace,
      imports: reviewedImports,
      transactions: reviewedTransactions,
      fingerprints,
    };
    await this.repository.commit(plan, command.signal);
    return {
      imports: reviewedImports,
      transactionCount: reviewedTransactions.length,
      committedRevision: nextWorkspace.revision,
    };
  }
}

export class ListImportHistory {
  public constructor(private readonly repository: ImportCommitRepository) {}

  public execute(accountId: string): Promise<readonly StatementImport[]> {
    return this.repository.listImportsByAccount(parseAccountId(accountId));
  }
}

export class ListTransactions {
  public constructor(private readonly repository: ImportCommitRepository) {}

  public execute(accountId: string): Promise<readonly Transaction[]> {
    return this.repository.listTransactionsByAccount(parseAccountId(accountId));
  }
}

export class RebuildTransactionFingerprints {
  public constructor(
    private readonly repository: ImportCommitRepository,
    private readonly digest: Sha256Digest,
  ) {}

  public async execute(): Promise<number> {
    const transactions = await this.repository.listAllTransactions();
    const fingerprints = await Promise.all(
      transactions.map((transaction) => fingerprint(transaction, this.digest)),
    );
    await this.repository.replaceAllFingerprints(fingerprints);
    return fingerprints.length;
  }
}

export function createFingerprintBasis(transaction: Transaction): string {
  const money = transaction.money.toJSON();
  return [
    "transaction-fingerprint-v1",
    transaction.accountId,
    transaction.postedDate,
    money.amount,
    money.currency,
    transaction.description.normalize("NFKC").toLocaleLowerCase("en-US"),
  ].join("\u0000");
}

async function fingerprint(
  transaction: Transaction,
  digest: Sha256Digest,
): Promise<TransactionFingerprint> {
  const value = await digest.digest(createFingerprintBasis(transaction));
  if (!/^[0-9a-f]{64}$/u.test(value)) {
    throw new ImportCommitValidationError("Fingerprint digest must be lowercase SHA-256");
  }
  return {
    transactionId: transaction.id,
    accountId: transaction.accountId,
    importId: transaction.importId,
    fingerprint: value,
    version: 1,
  };
}

function validateSources(
  sources: readonly AcceptedImportSource[],
): ReadonlyMap<string, AcceptedImportSource> {
  if (sources.length === 0)
    throw new ImportCommitValidationError("At least one source is required");
  const byDigest = new Map<string, AcceptedImportSource>();
  for (const source of sources) {
    if (byDigest.has(source.sha256)) {
      throw new ImportCommitValidationError(
        "The same source file cannot appear twice in one commit",
      );
    }
    if (source.issues.some((issue) => issue.severity === "error")) {
      throw new ImportCommitValidationError("Accepted sources cannot contain error-level issues");
    }
    byDigest.set(source.sha256, source);
  }
  return byDigest;
}

function validateCandidates(
  candidates: readonly AcceptedCandidate[],
  sources: ReadonlyMap<string, AcceptedImportSource>,
  accountId: AccountId,
  currency: string,
): void {
  const sourceIds = new Set<string>();
  const countBySource = new Map<string, number>();
  for (const candidate of candidates) {
    if (candidate.accountId !== accountId) {
      throw new ImportCommitValidationError("Candidate account does not match the target account");
    }
    if (candidate.currency !== currency) {
      throw new ImportCommitValidationError("Candidate currency does not match the target account");
    }
    const source = sources.get(candidate.provenance.sourceFileSha256);
    if (source === undefined)
      throw new ImportCommitValidationError("Candidate source is not selected");
    if (
      candidate.provenance.parserId !== source.parserId ||
      candidate.provenance.parserVersion !== source.parserVersion
    ) {
      throw new ImportCommitValidationError(
        "Candidate parser provenance does not match its source",
      );
    }
    countBySource.set(source.sha256, (countBySource.get(source.sha256) ?? 0) + 1);
    if (candidate.sourceTransactionId !== undefined) {
      if (sourceIds.has(candidate.sourceTransactionId)) {
        throw new ImportCommitValidationError(
          "Duplicate source transaction ID in accepted candidates",
        );
      }
      sourceIds.add(candidate.sourceTransactionId);
    }
  }
  for (const source of sources.values()) {
    if ((countBySource.get(source.sha256) ?? 0) !== source.sourceRows) {
      throw new ImportCommitValidationError(
        "Every source row must produce exactly one accepted candidate before commit",
      );
    }
  }
}

function throwIfCancelled(signal: CancellationSignal | undefined): void {
  if (signal?.aborted === true) throw new ImportCommitCancelledError();
}
