import type { Workspace } from "@financial-intelligence/domain";
import Dexie from "dexie";

import type { DatabaseMigration } from "./migrations";

export const VERSION_ONE_MIGRATION: DatabaseMigration = {
  version: 1,
  description: "Create the canonical workspace store",
  stores: { workspaces: "&id, createdAt, updatedAt" },
};

export async function createVersionOneFixture(
  name: string,
  workspaces: readonly Workspace[],
): Promise<void> {
  const database = new Dexie(name);
  database.version(1).stores(VERSION_ONE_MIGRATION.stores);
  await database.open();
  await database.table<Workspace>("workspaces").bulkPut([...workspaces]);
  database.close();
}

export async function openUncoordinatedConnection(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
