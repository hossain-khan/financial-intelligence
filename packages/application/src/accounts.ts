import {
  changeAccountCurrency,
  createAccount,
  parseAccountId,
  parseUtcTimestamp,
  parseWorkspaceId,
  renameAccount,
  setAccountArchived,
  type Account,
  type AccountId,
  type WorkspaceId,
} from "@financial-intelligence/domain";

import type { ApplicationClock, IdGenerator } from "./workspaces";

export interface AccountRepository {
  listByWorkspace(workspaceId: WorkspaceId): Promise<readonly Account[]>;
  findById(id: AccountId): Promise<Account | undefined>;
  save(account: Account): Promise<void>;
  hasReferences(id: AccountId): Promise<boolean>;
  deleteIfUnreferenced(id: AccountId): Promise<boolean>;
}

export class AccountNotFoundError extends Error {
  public constructor() {
    super("Account was not found");
    this.name = "AccountNotFoundError";
  }
}

export class AccountDeletionBlockedError extends Error {
  public constructor() {
    super("Account cannot be deleted while records still reference it. Archive it instead.");
    this.name = "AccountDeletionBlockedError";
  }
}

export interface CreateAccountCommand {
  readonly workspaceId: string;
  readonly name: string;
  readonly type: string;
  readonly institutionLabel?: string;
  readonly maskedIdentifier?: string;
  readonly currency: string;
}

export class CreateAccount {
  public constructor(
    private readonly repository: AccountRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(command: CreateAccountCommand): Promise<Account> {
    const account = createAccount({
      id: parseAccountId(this.ids.generate()),
      workspaceId: parseWorkspaceId(command.workspaceId),
      name: command.name,
      type: command.type,
      ...(command.institutionLabel === undefined
        ? {}
        : { institutionLabel: command.institutionLabel }),
      ...(command.maskedIdentifier === undefined
        ? {}
        : { maskedIdentifier: command.maskedIdentifier }),
      currency: command.currency,
      now: now(this.clock),
    });
    await this.repository.save(account);
    return account;
  }
}

export class ListAccounts {
  public constructor(private readonly repository: AccountRepository) {}

  public execute(workspaceId: string): Promise<readonly Account[]> {
    return this.repository.listByWorkspace(parseWorkspaceId(workspaceId));
  }
}

export class RenameAccount {
  public constructor(
    private readonly repository: AccountRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(accountId: string, name: string): Promise<Account> {
    const account = await requireAccount(this.repository, parseAccountId(accountId));
    const updated = renameAccount(account, name, now(this.clock));
    await this.repository.save(updated);
    return updated;
  }
}

export class SetAccountArchived {
  public constructor(
    private readonly repository: AccountRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(accountId: string, archived: boolean): Promise<Account> {
    const account = await requireAccount(this.repository, parseAccountId(accountId));
    const updated = setAccountArchived(account, archived, now(this.clock));
    await this.repository.save(updated);
    return updated;
  }
}

export class ChangeAccountCurrency {
  public constructor(
    private readonly repository: AccountRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(accountId: string, currency: string): Promise<Account> {
    const id = parseAccountId(accountId);
    const account = await requireAccount(this.repository, id);
    const updated = changeAccountCurrency(
      account,
      currency,
      await this.repository.hasReferences(id),
      now(this.clock),
    );
    await this.repository.save(updated);
    return updated;
  }
}

export class RequestAccountDeletion {
  public constructor(private readonly repository: AccountRepository) {}

  public async execute(accountId: string): Promise<void> {
    const id = parseAccountId(accountId);
    await requireAccount(this.repository, id);
    if (!(await this.repository.deleteIfUnreferenced(id))) {
      throw new AccountDeletionBlockedError();
    }
  }
}

async function requireAccount(repository: AccountRepository, id: AccountId): Promise<Account> {
  const account = await repository.findById(id);
  if (account === undefined) {
    throw new AccountNotFoundError();
  }
  return account;
}

function now(clock: ApplicationClock) {
  return parseUtcTimestamp(clock.now().toISOString());
}
