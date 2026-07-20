import type { UtcTimestamp } from "@financial-intelligence/domain";

export type LearningStore =
  "transactions" | "categories" | "merchants" | "classificationRules" | "recurringDecisions";

export interface LearningOperationChange {
  readonly store: LearningStore;
  readonly id: string;
  readonly before?: unknown;
  readonly after: unknown;
}

export interface LearningOperation {
  readonly id: string;
  readonly kind: "brain-import" | "review-correction";
  readonly inputDigest: string;
  readonly expectedRevision: string;
  readonly changes: readonly LearningOperationChange[];
  readonly createdAt: UtcTimestamp;
  readonly undoneAt?: UtcTimestamp;
}

export interface AtomicLearningRepository {
  revision(): Promise<string>;
  apply(operation: LearningOperation): Promise<void>;
  undo(operationId: string, undoneAt: UtcTimestamp): Promise<void>;
  list(): Promise<readonly LearningOperation[]>;
}

export class UndoLearningOperationUseCase {
  public constructor(
    private readonly repository: AtomicLearningRepository,
    private readonly clock: { now(): Date },
  ) {}

  public async execute(operationId: string): Promise<void> {
    await this.repository.undo(operationId, this.clock.now().toISOString() as UtcTimestamp);
  }
}

export class ListLearningOperationsUseCase {
  public constructor(private readonly repository: AtomicLearningRepository) {}

  public execute(): Promise<readonly LearningOperation[]> {
    return this.repository.list();
  }
}
