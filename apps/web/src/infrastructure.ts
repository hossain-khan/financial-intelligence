import {
  ApplyBulkTransactionEdit,
  CreateAccount,
  CreateWorkspace,
  CommitAcceptedImport,
  CreateEncryptedWorkspaceBackup,
  FindDuplicateCandidates,
  ExportFilteredTransactions,
  ListAccounts,
  ListCategories,
  ListDuplicateResolutions,
  ListImportHistory,
  ListTransactionEditHistory,
  ListTransactions,
  ListWorkspaces,
  PreviewBulkTransactionEdit,
  PreviewEncryptedWorkspaceBackup,
  QueryTransactionLedger,
  QueryCashFlowSummary,
  RenameAccount,
  RenameCategory,
  ResolveDuplicate,
  RequestAccountDeletion,
  SetAccountArchived,
  SetCategoryArchived,
  UndoBulkTransactionEdit,
  UndoDuplicateResolution,
} from "@financial-intelligence/application";
import {
  FinancialDatabase,
  IndexedDbAccountRepository,
  IndexedDbCategoryRepository,
  IndexedDbDuplicateResolutionRepository,
  IndexedDbImportCommitRepository,
  IndexedDbTransactionLedgerRepository,
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
}

const database = new FinancialDatabase();
const workspaceRepository = new IndexedDbWorkspaceRepository(database);
const accountRepository = new IndexedDbAccountRepository(database);
const importRepository = new IndexedDbImportCommitRepository(database);
const categoryRepository = new IndexedDbCategoryRepository(database);
const ledgerRepository = new IndexedDbTransactionLedgerRepository(database);
const duplicateResolutionRepository = new IndexedDbDuplicateResolutionRepository(database);
const backupRepository = new IndexedDbWorkspaceBackupRepository(database);
const clock = { now: () => new Date() };
const ids = { generate: () => crypto.randomUUID() };
const digest = {
  digest: async (value: string) => {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  },
};

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
  applyBulkTransactionEdit: new ApplyBulkTransactionEdit(ledgerRepository, clock, ids),
  undoBulkTransactionEdit: new UndoBulkTransactionEdit(ledgerRepository, clock),
  findDuplicateCandidates: new FindDuplicateCandidates(ledgerRepository),
  resolveDuplicate: new ResolveDuplicate(duplicateResolutionRepository, clock, ids),
  undoDuplicateResolution: new UndoDuplicateResolution(duplicateResolutionRepository, clock, ids),
  listDuplicateResolutions: new ListDuplicateResolutions(duplicateResolutionRepository),
  createEncryptedWorkspaceBackup: new CreateEncryptedWorkspaceBackup(backupRepository, clock),
  previewEncryptedWorkspaceBackup: new PreviewEncryptedWorkspaceBackup(),
};
