import { createWorkspace, type Workspace } from "@financial-intelligence/domain";

export interface WorkspaceRepository {
  list(): Promise<readonly Workspace[]>;
  save(workspace: Workspace): Promise<void>;
}

export interface ApplicationClock {
  now(): Date;
}

export interface IdGenerator {
  generate(): string;
}

export class CreateWorkspace {
  public constructor(
    private readonly repository: WorkspaceRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(name: string): Promise<Workspace> {
    const workspace = createWorkspace({
      id: this.ids.generate(),
      name,
      now: this.clock.now().toISOString(),
    });

    await this.repository.save(workspace);
    return workspace;
  }
}

export class ListWorkspaces {
  public constructor(private readonly repository: WorkspaceRepository) {}

  public execute(): Promise<readonly Workspace[]> {
    return this.repository.list();
  }
}
