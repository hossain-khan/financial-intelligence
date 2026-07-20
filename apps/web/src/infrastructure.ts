import {
  AddMerchantAliasUseCase,
  ApplyBulkTransactionEdit,
  ApplyReviewCorrectionUseCase,
  CreateAccount,
  CreateMerchantUseCase,
  CreateRuleUseCase,
  CreateWorkspace,
  CommitAcceptedImport,
  CreateEncryptedWorkspaceBackup,
  FindDuplicateCandidates,
  ExportFilteredTransactions,
  ListAccounts,
  ListCategories,
  ListDuplicateResolutions,
  ListImportHistory,
  ListMerchants,
  ListRules,
  ListTransactionEditHistory,
  ListTransactions,
  ListWorkspaces,
  PreviewBulkTransactionEdit,
  PreviewEncryptedWorkspaceBackup,
  PreviewRuleImpactUseCase,
  QueryReviewQueue,
  QueryTransactionLedger,
  QueryCashFlowSummary,
  RenameAccount,
  RenameCategory,
  ResolveDuplicate,
  RequestAccountDeletion,
  SetAccountArchived,
  SetCategoryArchived,
  ApplyFinancialBrainImportUseCase,
  ConfirmRecurringProposalUseCase,
  ConfirmTransferProposalUseCase,
  DismissRecurringProposalUseCase,
  EditRecurringDecisionUseCase,
  ExportFinancialBrainUseCase,
  FindRecurringProposalsUseCase,
  FindTransferProposalsUseCase,
  MuteRecurringProposalUseCase,
  MergeRecurringDecisionsUseCase,
  ReconcileRecurringDecisionsUseCase,
  SplitRecurringDecisionUseCase,
  PreviewFinancialBrainImportUseCase,
  QueryMerchantRankingUseCase,
  QueryDashboardUseCase,
  QueryMoneyFlowUseCase,
  QueryRecurringSummaryUseCase,
  QuerySavingsRateUseCase,
  RejectTransferProposalUseCase,
  UndoBulkTransactionEdit,
  UndoTransferDecisionUseCase,
  UndoRecurringDecisionUseCase,
  UndoDuplicateResolution,
  UnlinkTransferUseCase,
  UndoLearningOperationUseCase,
} from "@financial-intelligence/application";
import { validateFinancialBrain } from "@financial-intelligence/schemas";
import {
  FinancialDatabase,
  IndexedDbAccountRepository,
  IndexedDbAtomicLearningRepository,
  IndexedDbCategoryRepository,
  IndexedDbDuplicateResolutionRepository,
  IndexedDbDashboardSnapshotRepository,
  IndexedDbImportCommitRepository,
  IndexedDbMerchantRepository,
  IndexedDbRecurringDecisionRepository,
  IndexedDbRuleRepository,
  IndexedDbTransactionLedgerRepository,
  IndexedDbTransferDecisionRepository,
  IndexedDbWorkspaceRepository,
  IndexedDbWorkspaceBackupRepository,
} from "@financial-intelligence/storage-indexeddb";

export interface ApplicationServices {
  readonly createWorkspace: CreateWorkspace;
  readonly listWorkspaces: ListWorkspaces;
  readonly createAccount: CreateAccount;
  readonly listAccounts: ListAccounts;
  readonly renameAccount: RenameAccount;
  readonly setAccountArchived: SetAccountArchived;
  readonly requestAccountDeletion: RequestAccountDeletion;
  readonly commitAcceptedImport: CommitAcceptedImport;
  readonly listImportHistory: ListImportHistory;
  readonly listTransactions: ListTransactions;
  readonly listCategories: ListCategories;
  readonly renameCategory: RenameCategory;
  readonly setCategoryArchived: SetCategoryArchived;
  readonly queryTransactionLedger: QueryTransactionLedger;
  readonly queryCashFlowSummary: QueryCashFlowSummary;
  readonly exportFilteredTransactions: ExportFilteredTransactions;
  readonly listTransactionEditHistory: ListTransactionEditHistory;
  readonly previewBulkTransactionEdit: PreviewBulkTransactionEdit;
  readonly applyBulkTransactionEdit: ApplyBulkTransactionEdit;
  readonly undoBulkTransactionEdit: UndoBulkTransactionEdit;
  readonly findDuplicateCandidates: FindDuplicateCandidates;
  readonly resolveDuplicate: ResolveDuplicate;
  readonly undoDuplicateResolution: UndoDuplicateResolution;
  readonly listDuplicateResolutions: ListDuplicateResolutions;
  readonly createEncryptedWorkspaceBackup: CreateEncryptedWorkspaceBackup;
  readonly previewEncryptedWorkspaceBackup: PreviewEncryptedWorkspaceBackup;

  // Merchant, Rule & Review Queue services
  readonly listMerchants: ListMerchants;
  readonly createMerchantUseCase: CreateMerchantUseCase;
  readonly addMerchantAliasUseCase: AddMerchantAliasUseCase;
  readonly listRules: ListRules;
  readonly createRuleUseCase: CreateRuleUseCase;
  readonly previewRuleImpactUseCase: PreviewRuleImpactUseCase;
  readonly queryReviewQueue: QueryReviewQueue;
  readonly applyReviewCorrectionUseCase: ApplyReviewCorrectionUseCase;
  readonly exportFinancialBrainUseCase: ExportFinancialBrainUseCase;
  readonly previewFinancialBrainImportUseCase: PreviewFinancialBrainImportUseCase;
  readonly applyFinancialBrainImportUseCase: ApplyFinancialBrainImportUseCase;
  readonly undoLearningOperationUseCase: UndoLearningOperationUseCase;

  // Transfer proposal services
  readonly findTransferProposalsUseCase: FindTransferProposalsUseCase;
  readonly confirmTransferProposalUseCase: ConfirmTransferProposalUseCase;
  readonly rejectTransferProposalUseCase: RejectTransferProposalUseCase;
  readonly unlinkTransferUseCase: UnlinkTransferUseCase;
  readonly undoTransferDecisionUseCase: UndoTransferDecisionUseCase;

  // Recurring series proposal services
  readonly findRecurringProposalsUseCase: FindRecurringProposalsUseCase;
  readonly confirmRecurringProposalUseCase: ConfirmRecurringProposalUseCase;
  readonly dismissRecurringProposalUseCase: DismissRecurringProposalUseCase;
  readonly muteRecurringProposalUseCase: MuteRecurringProposalUseCase;
  readonly editRecurringDecisionUseCase: EditRecurringDecisionUseCase;
  readonly mergeRecurringDecisionsUseCase: MergeRecurringDecisionsUseCase;
  readonly splitRecurringDecisionUseCase: SplitRecurringDecisionUseCase;
  readonly reconcileRecurringDecisionsUseCase: ReconcileRecurringDecisionsUseCase;
  readonly undoRecurringDecisionUseCase: UndoRecurringDecisionUseCase;

  // Dashboard query services
  readonly queryMerchantRankingUseCase: QueryMerchantRankingUseCase;
  readonly querySavingsRateUseCase: QuerySavingsRateUseCase;
  readonly queryRecurringSummaryUseCase: QueryRecurringSummaryUseCase;
  readonly queryMoneyFlowUseCase: QueryMoneyFlowUseCase;
  readonly queryDashboardUseCase: QueryDashboardUseCase;
}

const database = new FinancialDatabase();
const workspaceRepository = new IndexedDbWorkspaceRepository(database);
const accountRepository = new IndexedDbAccountRepository(database);
const importRepository = new IndexedDbImportCommitRepository(database);
const categoryRepository = new IndexedDbCategoryRepository(database);
const ledgerRepository = new IndexedDbTransactionLedgerRepository(database);
const merchantRepository = new IndexedDbMerchantRepository(database);
const ruleRepository = new IndexedDbRuleRepository(database);
const duplicateResolutionRepository = new IndexedDbDuplicateResolutionRepository(database);
const backupRepository = new IndexedDbWorkspaceBackupRepository(database);
const transferDecisionRepository = new IndexedDbTransferDecisionRepository(database);
const recurringDecisionRepository = new IndexedDbRecurringDecisionRepository(database);
const dashboardSnapshotRepository = new IndexedDbDashboardSnapshotRepository(database);
const atomicLearningRepository = new IndexedDbAtomicLearningRepository(database);
const clock = { now: () => new Date() };
const ids = { generate: () => crypto.randomUUID() };
const digest = {
  digest: async (value: string) => {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  },
};

const applyBulkTransactionEdit = new ApplyBulkTransactionEdit(ledgerRepository, clock, ids);
const createRuleUseCase = new CreateRuleUseCase(ruleRepository, clock, ids);
const addMerchantAliasUseCase = new AddMerchantAliasUseCase(merchantRepository, clock, ids);

export const applicationServices: ApplicationServices = {
  createWorkspace: new CreateWorkspace(workspaceRepository, clock, ids),
  listWorkspaces: new ListWorkspaces(workspaceRepository),
  createAccount: new CreateAccount(accountRepository, clock, ids),
  listAccounts: new ListAccounts(accountRepository),
  renameAccount: new RenameAccount(accountRepository, clock),
  setAccountArchived: new SetAccountArchived(accountRepository, clock),
  requestAccountDeletion: new RequestAccountDeletion(accountRepository),
  commitAcceptedImport: new CommitAcceptedImport(
    importRepository,
    accountRepository,
    workspaceRepository,
    clock,
    ids,
    digest,
    ledgerRepository,
    ruleRepository,
    merchantRepository,
  ),
  listImportHistory: new ListImportHistory(importRepository),
  listTransactions: new ListTransactions(importRepository),
  listCategories: new ListCategories(categoryRepository, clock),
  renameCategory: new RenameCategory(categoryRepository, clock),
  setCategoryArchived: new SetCategoryArchived(categoryRepository, clock),
  queryTransactionLedger: new QueryTransactionLedger(ledgerRepository),
  queryCashFlowSummary: new QueryCashFlowSummary(ledgerRepository, categoryRepository, clock),
  exportFilteredTransactions: new ExportFilteredTransactions(
    ledgerRepository,
    accountRepository,
    categoryRepository,
    clock,
  ),
  listTransactionEditHistory: new ListTransactionEditHistory(ledgerRepository),
  previewBulkTransactionEdit: new PreviewBulkTransactionEdit(ledgerRepository),
  applyBulkTransactionEdit,
  undoBulkTransactionEdit: new UndoBulkTransactionEdit(ledgerRepository, clock),
  findDuplicateCandidates: new FindDuplicateCandidates(ledgerRepository),
  resolveDuplicate: new ResolveDuplicate(duplicateResolutionRepository, clock, ids),
  undoDuplicateResolution: new UndoDuplicateResolution(duplicateResolutionRepository, clock, ids),
  listDuplicateResolutions: new ListDuplicateResolutions(duplicateResolutionRepository),
  createEncryptedWorkspaceBackup: new CreateEncryptedWorkspaceBackup(backupRepository, clock),
  previewEncryptedWorkspaceBackup: new PreviewEncryptedWorkspaceBackup(),

  listMerchants: new ListMerchants(merchantRepository),
  createMerchantUseCase: new CreateMerchantUseCase(merchantRepository, clock, ids),
  addMerchantAliasUseCase,
  listRules: new ListRules(ruleRepository),
  createRuleUseCase,
  previewRuleImpactUseCase: new PreviewRuleImpactUseCase(ruleRepository),
  queryReviewQueue: new QueryReviewQueue(
    ledgerRepository,
    ruleRepository,
    merchantRepository,
    accountRepository,
  ),
  applyReviewCorrectionUseCase: new ApplyReviewCorrectionUseCase(
    applyBulkTransactionEdit,
    createRuleUseCase,
    addMerchantAliasUseCase,
    atomicLearningRepository,
    ledgerRepository,
    ruleRepository,
    merchantRepository,
    clock,
    ids,
  ),
  exportFinancialBrainUseCase: new ExportFinancialBrainUseCase(
    categoryRepository,
    merchantRepository,
    ruleRepository,
    clock,
    ids,
    recurringDecisionRepository,
    validateFinancialBrain,
  ),
  previewFinancialBrainImportUseCase: new PreviewFinancialBrainImportUseCase(
    categoryRepository,
    merchantRepository,
    ruleRepository,
    validateFinancialBrain,
    recurringDecisionRepository,
    atomicLearningRepository,
    digest,
  ),
  applyFinancialBrainImportUseCase: new ApplyFinancialBrainImportUseCase(
    categoryRepository,
    merchantRepository,
    ruleRepository,
    ids,
    validateFinancialBrain,
    recurringDecisionRepository,
    atomicLearningRepository,
    digest,
    clock,
  ),
  undoLearningOperationUseCase: new UndoLearningOperationUseCase(atomicLearningRepository, clock),
  findTransferProposalsUseCase: new FindTransferProposalsUseCase(
    ledgerRepository,
    accountRepository,
    transferDecisionRepository,
  ),
  confirmTransferProposalUseCase: new ConfirmTransferProposalUseCase(
    transferDecisionRepository,
    clock,
    ids,
    ledgerRepository,
  ),
  rejectTransferProposalUseCase: new RejectTransferProposalUseCase(
    transferDecisionRepository,
    clock,
    ids,
  ),
  unlinkTransferUseCase: new UnlinkTransferUseCase(transferDecisionRepository, clock, ids),
  undoTransferDecisionUseCase: new UndoTransferDecisionUseCase(
    transferDecisionRepository,
    clock,
    ids,
  ),
  findRecurringProposalsUseCase: new FindRecurringProposalsUseCase(
    ledgerRepository,
    recurringDecisionRepository,
    transferDecisionRepository,
  ),
  confirmRecurringProposalUseCase: new ConfirmRecurringProposalUseCase(
    recurringDecisionRepository,
    clock,
    ids,
  ),
  dismissRecurringProposalUseCase: new DismissRecurringProposalUseCase(
    recurringDecisionRepository,
    clock,
    ids,
  ),
  muteRecurringProposalUseCase: new MuteRecurringProposalUseCase(
    recurringDecisionRepository,
    clock,
    ids,
  ),
  editRecurringDecisionUseCase: new EditRecurringDecisionUseCase(
    recurringDecisionRepository,
    clock,
    ids,
  ),
  mergeRecurringDecisionsUseCase: new MergeRecurringDecisionsUseCase(
    recurringDecisionRepository,
    clock,
    ids,
  ),
  splitRecurringDecisionUseCase: new SplitRecurringDecisionUseCase(
    recurringDecisionRepository,
    clock,
    ids,
  ),
  reconcileRecurringDecisionsUseCase: new ReconcileRecurringDecisionsUseCase(
    ledgerRepository,
    recurringDecisionRepository,
    clock,
    ids,
  ),
  undoRecurringDecisionUseCase: new UndoRecurringDecisionUseCase(
    recurringDecisionRepository,
    clock,
    ids,
  ),
  queryMerchantRankingUseCase: new QueryMerchantRankingUseCase(
    ledgerRepository,
    merchantRepository,
    transferDecisionRepository,
  ),
  querySavingsRateUseCase: new QuerySavingsRateUseCase(
    ledgerRepository,
    categoryRepository,
    transferDecisionRepository,
  ),
  queryRecurringSummaryUseCase: new QueryRecurringSummaryUseCase(
    new FindRecurringProposalsUseCase(
      ledgerRepository,
      recurringDecisionRepository,
      transferDecisionRepository,
    ),
    recurringDecisionRepository,
  ),
  queryMoneyFlowUseCase: new QueryMoneyFlowUseCase(
    ledgerRepository,
    categoryRepository,
    transferDecisionRepository,
  ),
  queryDashboardUseCase: new QueryDashboardUseCase(dashboardSnapshotRepository, clock),
};
