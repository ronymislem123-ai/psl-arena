import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { migrate } from "./db-schema";

export { LEGACY_USER_ID, SCHEMA_VERSION, newId } from "./db-schema";

export function dataDir(): string {
  const dir = resolve(process.cwd(), process.env.PSL_ARENA_DATA_DIR ?? "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

type DB = Database.Database;
declare global {
  var __pslArenaDb: DB | undefined;
}

export function getDb(): DB {
  if (globalThis.__pslArenaDb) return globalThis.__pslArenaDb;
  const file = join(dataDir(), "psl-arena.sqlite");
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  globalThis.__pslArenaDb = db;
  return db;
}

/** Test helper: close and forget the cached connection (e.g. when the data dir changes). */
export function closeDb() {
  globalThis.__pslArenaDb?.close();
  globalThis.__pslArenaDb = undefined;
}
