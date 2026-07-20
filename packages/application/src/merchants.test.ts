import { describe, expect, it } from "vitest";
import type { Merchant, MerchantId } from "@financial-intelligence/domain";

import {
  AddMerchantAliasUseCase,
  CreateMerchantUseCase,
  ListMerchants,
  MergeMerchantsUseCase,
  ResolveMerchantForDescription,
  UnmergeMerchantUseCase,
  type MerchantRepository,
} from "./merchants";

class InMemoryMerchantRepository implements MerchantRepository {
  private readonly merchants = new Map<string, Merchant>();

  public async list(): Promise<readonly Merchant[]> {
    return Array.from(this.merchants.values());
  }

  public async findById(id: MerchantId): Promise<Merchant | undefined> {
    return this.merchants.get(id);
  }

  public async save(merchant: Merchant): Promise<void> {
    this.merchants.set(merchant.id, merchant);
  }

  public async saveMany(merchants: readonly Merchant[]): Promise<void> {
    for (const m of merchants) {
      this.merchants.set(m.id, m);
    }
  }
}

const mockClock = {
  now: () => new Date("2026-07-20T08:00:00Z"),
};

let counter = 1;
const mockIds = {
  generate: () => `018f6b80-0d62-7d2c-9a5c-7f5f59cda2f${counter++}`,
};

describe("Merchant application use cases", () => {
  it("creates, lists, and resolves merchants", async () => {
    const repository = new InMemoryMerchantRepository();
    const createUseCase = new CreateMerchantUseCase(repository, mockClock, mockIds);
    const listUseCase = new ListMerchants(repository);
    const resolveUseCase = new ResolveMerchantForDescription(repository);

    const created = await createUseCase.execute({
      name: "Tim Hortons",
      websiteDomain: "timhortons.ca",
    });

    expect(created.name).toBe("Tim Hortons");
    expect(created.websiteDomain).toBe("timhortons.ca");

    const merchants = await listUseCase.execute();
    expect(merchants).toHaveLength(1);

    const matches = await resolveUseCase.execute("TIM HORTONS #1234");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.merchantId).toBe(created.id);
  });

  it("adds an alias to an existing merchant", async () => {
    const repository = new InMemoryMerchantRepository();
    const createUseCase = new CreateMerchantUseCase(repository, mockClock, mockIds);
    const addAliasUseCase = new AddMerchantAliasUseCase(repository, mockClock, mockIds);
    const resolveUseCase = new ResolveMerchantForDescription(repository);

    const merchant = await createUseCase.execute({ name: "Uber" });
    await addAliasUseCase.execute({
      merchantId: merchant.id,
      pattern: "uber eats",
      matchMode: "exact",
    });

    const matches = await resolveUseCase.execute("UBER EATS");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.merchantId).toBe(merchant.id);
  });

  it("merges and unmerges merchants", async () => {
    const repository = new InMemoryMerchantRepository();
    const createUseCase = new CreateMerchantUseCase(repository, mockClock, mockIds);
    const mergeUseCase = new MergeMerchantsUseCase(repository, mockClock);
    const unmergeUseCase = new UnmergeMerchantUseCase(repository, mockClock);
    const resolveUseCase = new ResolveMerchantForDescription(repository);

    const source = await createUseCase.execute({ name: "Tim Hortons Cafe" });
    const target = await createUseCase.execute({ name: "Tim Hortons" });

    const { source: mergedSource, target: updatedTarget } = await mergeUseCase.execute({
      sourceMerchantId: source.id,
      targetMerchantId: target.id,
    });

    expect(mergedSource.redirectToId).toBe(target.id);
    expect(mergedSource.archived).toBe(true);
    expect(updatedTarget.aliases.length).toBeGreaterThan(0);

    // Source is redirected/archived, so matching for source name returns target merchant
    const matches = await resolveUseCase.execute("Tim Hortons Cafe");
    expect(matches).toHaveLength(1);
    expect(matches[0]?.merchantId).toBe(target.id);

    // Unmerge source
    const unmerged = await unmergeUseCase.execute(source.id);
    expect(unmerged.redirectToId).toBeUndefined();
    expect(unmerged.archived).toBe(false);
  });
});
