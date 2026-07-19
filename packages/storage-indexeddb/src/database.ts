import type { WorkspaceRepository } from "@financial-intelligence/application";
import type { Workspace } from "@financial-intelligence/domain";
import Dexie, { type EntityTable } from "dexie";

type WorkspaceRecord = Workspace;

export class FinancialDatabase extends Dexie {
  public workspaces!: EntityTable<WorkspaceRecord, "id">;

  public constructor(name = "financial-intelligence") {
    super(name);

    this.version(1).stores({
      workspaces: "&id, createdAt, updatedAt",
    });
  }
}

export class IndexedDbWorkspaceRepository implements WorkspaceRepository {
  public constructor(private readonly database: FinancialDatabase) {}

  public async list(): Promise<readonly Workspace[]> {
    return this.database.workspaces.orderBy("createdAt").toArray();
  }

  public async save(workspace: Workspace): Promise<void> {
    await this.database.transaction("rw", this.database.workspaces, async () => {
      await this.database.workspaces.put(workspace);
    });
  }
}
