import type { Workspace, WorkspaceId } from "@financial-intelligence/domain";
import { describe, expect, it } from "vitest";

import { CreateWorkspace, type WorkspaceRepository } from "./workspaces";

class MemoryWorkspaceRepository implements WorkspaceRepository {
  readonly workspaces: Workspace[] = [];

  public async list(): Promise<readonly Workspace[]> {
    return this.workspaces;
  }

  public async findById(id: WorkspaceId): Promise<Workspace | undefined> {
    return this.workspaces.find((workspace) => workspace.id === id);
  }

  public async save(workspace: Workspace): Promise<void> {
    this.workspaces.push(workspace);
  }
}

describe("CreateWorkspace", () => {
  it("creates and persists a workspace through the repository port", async () => {
    const repository = new MemoryWorkspaceRepository();
    const useCase = new CreateWorkspace(
      repository,
      { now: () => new Date("2026-07-19T16:00:00.000Z") },
      { generate: () => "018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1" },
    );

    const result = await useCase.execute("My household");

    expect(result.id).toBe("018f6b80-0d62-7d2c-9a5c-7f5f59cda2f1");
    expect(repository.workspaces).toEqual([result]);
  });
});
