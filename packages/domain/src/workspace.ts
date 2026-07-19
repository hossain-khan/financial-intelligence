import type { WorkspaceId } from "./identifiers";
import type { UtcTimestamp } from "./temporal";

export interface Workspace {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly createdAt: UtcTimestamp;
  readonly updatedAt: UtcTimestamp;
}

export interface CreateWorkspaceInput {
  readonly id: WorkspaceId;
  readonly name: string;
  readonly now: UtcTimestamp;
}

export function createWorkspace(input: CreateWorkspaceInput): Workspace {
  const name = input.name.trim();

  if (name.length === 0 || name.length > 120) {
    throw new RangeError("Workspace name must contain between 1 and 120 characters");
  }

  return {
    id: input.id,
    name,
    schemaVersion: 1,
    revision: 1,
    createdAt: input.now,
    updatedAt: input.now,
  };
}
