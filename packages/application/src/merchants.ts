import {
  addAliasToMerchant,
  createMerchant,
  createMerchantAlias,
  matchDescriptionToMerchants,
  mergeMerchants as mergeMerchantEntities,
  parseAliasId,
  parseMerchantId,
  parseUtcTimestamp,
  unmergeMerchant as unmergeMerchantEntity,
  type MatchMode,
  type Merchant,
  type MerchantAliasMatch,
  type MerchantId,
} from "@financial-intelligence/domain";

import type { ApplicationClock, IdGenerator } from "./workspaces";

export interface MerchantRepository {
  list(): Promise<readonly Merchant[]>;
  findById(id: MerchantId): Promise<Merchant | undefined>;
  save(merchant: Merchant): Promise<void>;
  saveMany(merchants: readonly Merchant[]): Promise<void>;
}

export class ListMerchants {
  public constructor(private readonly repository: MerchantRepository) {}

  public async execute(): Promise<readonly Merchant[]> {
    const merchants = await this.repository.list();
    return [...merchants].sort((left, right) => left.name.localeCompare(right.name));
  }
}

export class CreateMerchantUseCase {
  public constructor(
    private readonly repository: MerchantRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(input: {
    id?: string;
    name: string;
    websiteDomain?: string;
    aliases?: readonly { pattern: string; matchMode?: MatchMode }[];
  }): Promise<Merchant> {
    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const merchantId = input.id ? parseMerchantId(input.id) : parseMerchantId(this.ids.generate());

    const customAliases = input.aliases?.map((a) =>
      createMerchantAlias({
        id: parseAliasId(this.ids.generate()),
        pattern: a.pattern,
        ...(a.matchMode === undefined ? {} : { matchMode: a.matchMode }),
        now,
      }),
    );

    const merchant = createMerchant({
      id: merchantId,
      name: input.name,
      ...(input.websiteDomain === undefined ? {} : { websiteDomain: input.websiteDomain }),
      ...(customAliases === undefined ? {} : { aliases: customAliases }),
      now,
    });

    await this.repository.save(merchant);
    return merchant;
  }
}

export class AddMerchantAliasUseCase {
  public constructor(
    private readonly repository: MerchantRepository,
    private readonly clock: ApplicationClock,
    private readonly ids: IdGenerator,
  ) {}

  public async execute(input: {
    merchantId: string;
    pattern: string;
    matchMode?: MatchMode;
  }): Promise<Merchant> {
    const id = parseMerchantId(input.merchantId);
    const existing = await this.repository.findById(id);
    if (existing === undefined) {
      throw new Error(`Merchant with id ${input.merchantId} was not found`);
    }

    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const alias = createMerchantAlias({
      id: parseAliasId(this.ids.generate()),
      pattern: input.pattern,
      ...(input.matchMode === undefined ? {} : { matchMode: input.matchMode }),
      now,
    });

    const updated = addAliasToMerchant(existing, alias, now);
    await this.repository.save(updated);
    return updated;
  }
}

export class ResolveMerchantForDescription {
  public constructor(private readonly repository: MerchantRepository) {}

  public async execute(rawDescription: string): Promise<readonly MerchantAliasMatch[]> {
    const merchants = await this.repository.list();
    return matchDescriptionToMerchants(rawDescription, merchants);
  }
}

export class MergeMerchantsUseCase {
  public constructor(
    private readonly repository: MerchantRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(input: {
    sourceMerchantId: string;
    targetMerchantId: string;
  }): Promise<{ source: Merchant; target: Merchant }> {
    const sourceId = parseMerchantId(input.sourceMerchantId);
    const targetId = parseMerchantId(input.targetMerchantId);

    const source = await this.repository.findById(sourceId);
    if (source === undefined) {
      throw new Error(`Source merchant ${input.sourceMerchantId} was not found`);
    }

    const target = await this.repository.findById(targetId);
    if (target === undefined) {
      throw new Error(`Target merchant ${input.targetMerchantId} was not found`);
    }

    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const { source: updatedSource, target: updatedTarget } = mergeMerchantEntities(
      source,
      target,
      now,
    );

    await this.repository.saveMany([updatedSource, updatedTarget]);
    return { source: updatedSource, target: updatedTarget };
  }
}

export class UnmergeMerchantUseCase {
  public constructor(
    private readonly repository: MerchantRepository,
    private readonly clock: ApplicationClock,
  ) {}

  public async execute(merchantId: string): Promise<Merchant> {
    const id = parseMerchantId(merchantId);
    const existing = await this.repository.findById(id);
    if (existing === undefined) {
      throw new Error(`Merchant ${merchantId} was not found`);
    }

    const now = parseUtcTimestamp(this.clock.now().toISOString());
    const unmerged = unmergeMerchantEntity(existing, now);
    await this.repository.save(unmerged);
    return unmerged;
  }
}
