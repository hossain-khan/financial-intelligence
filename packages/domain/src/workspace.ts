export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly schemaVersion: 1;
  readonly revision: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateWorkspaceInput {
  readonly id: string;
  readonly name: string;
  readonly now: string;
}

export function createWorkspace(input: CreateWorkspaceInput): Workspace {
  const name = input.name.trim();

  if (name.length === 0 || name.length > 120) {
    throw new RangeError("Workspace name must contain between 1 and 120 characters");
  }

  if (input.id.length === 0) {
    throw new TypeError("Workspace ID is required");
  }

  if (Number.isNaN(Date.parse(input.now))) {
    throw new TypeError("Workspace timestamp must be an RFC 3339 date-time");
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
