import { describe, expect, it, vi } from "vitest";
import type { AtomicLearningRepository, LearningOperation } from "./learning-operations";
import { ListLearningOperationsUseCase, UndoLearningOperationUseCase } from "./learning-operations";

describe("learning operation use cases", () => {
  it("lists operations and timestamps undo requests", async () => {
    const operations = [{ id: "operation-1" }] as LearningOperation[];
    const repository = {
      list: vi.fn(async () => operations),
      undo: vi.fn(async () => undefined),
    } as unknown as AtomicLearningRepository;
    const list = new ListLearningOperationsUseCase(repository);
    const undo = new UndoLearningOperationUseCase(repository, {
      now: () => new Date("2026-07-20T12:34:56Z"),
    });

    await expect(list.execute()).resolves.toBe(operations);
    await undo.execute("operation-1");
    expect(repository.undo).toHaveBeenCalledWith("operation-1", "2026-07-20T12:34:56.000Z");
  });
});
