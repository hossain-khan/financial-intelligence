import type { Workspace } from "@financial-intelligence/domain";
import { describe, expect, it } from "vitest";

import { CreateWorkspace, type WorkspaceRepository } from "./workspaces";

class MemoryWorkspaceRepository implements WorkspaceRepository {
  readonly workspaces: Workspace[] = [];

  public async list(): Promise<readonly Workspace[]> {
    return this.workspaces;
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
      { generate: () => "workspace-1" },
    );

    const result = await useCase.execute("My household");

    expect(result.id).toBe("workspace-1");
    expect(repository.workspaces).toEqual([result]);
  });
});
