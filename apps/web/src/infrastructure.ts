import {
  CreateAccount,
  CreateWorkspace,
  CommitAcceptedImport,
  ListAccounts,
  ListImportHistory,
  ListTransactions,
  ListWorkspaces,
  RenameAccount,
  RequestAccountDeletion,
  SetAccountArchived,
} from "@financial-intelligence/application";
import {
  FinancialDatabase,
  IndexedDbAccountRepository,
  IndexedDbImportCommitRepository,
  IndexedDbWorkspaceRepository,
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
}

const database = new FinancialDatabase();
const workspaceRepository = new IndexedDbWorkspaceRepository(database);
const accountRepository = new IndexedDbAccountRepository(database);
const importRepository = new IndexedDbImportCommitRepository(database);
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
  ),
  listImportHistory: new ListImportHistory(importRepository),
  listTransactions: new ListTransactions(importRepository),
};
