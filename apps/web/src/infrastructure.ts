import {
  CreateAccount,
  CreateWorkspace,
  ListAccounts,
  ListWorkspaces,
  RenameAccount,
  RequestAccountDeletion,
  SetAccountArchived,
} from "@financial-intelligence/application";
import {
  FinancialDatabase,
  IndexedDbAccountRepository,
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
}

const database = new FinancialDatabase();
const workspaceRepository = new IndexedDbWorkspaceRepository(database);
const accountRepository = new IndexedDbAccountRepository(database);
const clock = { now: () => new Date() };
const ids = { generate: () => crypto.randomUUID() };

export const applicationServices: ApplicationServices = {
  createWorkspace: new CreateWorkspace(workspaceRepository, clock, ids),
  listWorkspaces: new ListWorkspaces(workspaceRepository),
  createAccount: new CreateAccount(accountRepository, clock, ids),
  listAccounts: new ListAccounts(accountRepository),
  renameAccount: new RenameAccount(accountRepository, clock),
  setAccountArchived: new SetAccountArchived(accountRepository, clock),
  requestAccountDeletion: new RequestAccountDeletion(accountRepository),
};
