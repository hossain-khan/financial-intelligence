import { CreateWorkspace, ListWorkspaces } from "@financial-intelligence/application";
import {
  FinancialDatabase,
  IndexedDbWorkspaceRepository,
} from "@financial-intelligence/storage-indexeddb";

export interface ApplicationServices {
  readonly createWorkspace: CreateWorkspace;
  readonly listWorkspaces: ListWorkspaces;
}

const database = new FinancialDatabase();
const workspaceRepository = new IndexedDbWorkspaceRepository(database);

export const applicationServices: ApplicationServices = {
  createWorkspace: new CreateWorkspace(
    workspaceRepository,
    { now: () => new Date() },
    { generate: () => crypto.randomUUID() },
  ),
  listWorkspaces: new ListWorkspaces(workspaceRepository),
};
