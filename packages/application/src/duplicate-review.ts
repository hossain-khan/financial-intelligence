import {
  DuplicateResolutionConflictError,
  activeDuplicateDecisions,
  detectDuplicateCandidates,
  parseAccountId,
  parseUtcTimestamp,
  type AccountId,
  type DuplicateCandidate,
  type DuplicateDecision,
  type DuplicateDecisionUndo,
  type DuplicateFingerprint,
  type DuplicateResolutionAction,
  type DuplicateResolutionEvent,
  type Transaction,
} from "@financial-intelligence/domain";
import type { ApplicationClock, IdGenerator } from "./workspaces";

export interface DuplicateCandidateRepository {
  listTransactionsByAccount(accountId: AccountId): Promise<readonly Transaction[]>;
  listFingerprintsByAccount(accountId: AccountId): Promise<readonly DuplicateFingerprint[]>;
}

export class FindDuplicateCandidates {
  public constructor(private readonly repository: DuplicateCandidateRepository) {}

  public async execute(
    accountIdValue: string,
    incoming: readonly Transaction[],
  ): Promise<readonly DuplicateCandidate[]> {
    const accountId = parseAccountId(accountIdValue);
    if (incoming.some((transaction) => transaction.accountId !== accountId)) {
      throw new DuplicateResolutionConflictError(
        "Every incoming transaction must belong to the reviewed account",
      );
    }
    const [stored, fingerprints] = await Promise.all([
      this.repository.listTransactionsByAccount(accountId),
      this.repository.listFingerprintsByAccount(accountId),
    ]);
    const incomingIds = new Set(incoming.map((transaction) => transaction.id));
    const existing = stored.filter((transaction) => !incomingIds.has(transaction.id));
    const candidates = [...detectDuplicateCandidates({ existing, incoming, fingerprints })];
    candidates.push(
      ...detectDuplicateCandidates({ existing: incoming, incoming, fingerprints }).filter(
        (candidate) =>
          candidate.existingTransactionId.localeCompare(candidate.incomingTransactionId) < 0,
      ),
    );
    return candidates;
  }
}

export interface DuplicateResolutionJournal {
  readonly version: number;
  readonly events: readonly DuplicateResolutionEvent[];
}

export interface DuplicateResolutionRepository {
  load(): Promise<DuplicateResolutionJournal>;
  append(
    expectedVersion: number,
    event: DuplicateResolutionEvent,
  ): Promise<DuplicateResolutionJournal>;
}

export interface ResolveDuplicateCommand {
  readonly candidateId: string;
  readonly evidenceSignature: string;
  readonly action: DuplicateResolutionAction;
}

export class ResolveDuplicate {
  public constructor(
    private readonly repository: DuplicateResolutionRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(command: ResolveDuplicateCommand): Promise<DuplicateDecision> {
    if (command.candidateId.trim().length === 0) {
      throw new DuplicateResolutionConflictError("Duplicate candidate ID is required");
    }
    if (
      !(["keep-existing", "keep-new", "keep-both", "manual-link"] as const).includes(command.action)
    ) {
      throw new DuplicateResolutionConflictError("Duplicate resolution action is invalid");
    }
    if (command.evidenceSignature.trim().length === 0) {
      throw new DuplicateResolutionConflictError("Duplicate evidence signature is required");
    }
    const journal = await this.repository.load();
    if (activeDuplicateDecisions(journal.events).has(command.candidateId)) {
      throw new DuplicateResolutionConflictError("Duplicate candidate already has a decision");
    }
    const event: DuplicateDecision = {
      type: "decision",
      id: this.ids.generate(),
      candidateId: command.candidateId,
      evidenceSignature: command.evidenceSignature,
      action: command.action,
      occurredAt: parseUtcTimestamp(this.clock.now().toISOString()),
    };
    await this.repository.append(journal.version, event);
    return event;
  }
}

export class UndoDuplicateResolution {
  public constructor(
    private readonly repository: DuplicateResolutionRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(decisionId: string): Promise<DuplicateDecisionUndo> {
    const journal = await this.repository.load();
    const decision = [...activeDuplicateDecisions(journal.events).values()].find(
      (value) => value.id === decisionId,
    );
    if (decision === undefined) {
      throw new DuplicateResolutionConflictError("Only an active decision can be undone");
    }
    const event: DuplicateDecisionUndo = {
      type: "undo",
      id: this.ids.generate(),
      decisionId,
      occurredAt: parseUtcTimestamp(this.clock.now().toISOString()),
    };
    await this.repository.append(journal.version, event);
    return event;
  }
}

export class ListDuplicateResolutions {
  public constructor(private readonly repository: DuplicateResolutionRepository) {}

  public async execute(): Promise<ReadonlyMap<string, DuplicateDecision>> {
    return activeDuplicateDecisions((await this.repository.load()).events);
  }
}
