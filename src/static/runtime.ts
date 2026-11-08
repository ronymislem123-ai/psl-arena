/**
 * Lifecycle of the browser edition's database: load sql.js, open the SQLite image
 * stored in IndexedDB (or a fresh one), run the shared migrations, persist after
 * every write and keep several open tabs consistent.
 *
 * Writes are serialised across tabs with the Web Locks API; before a write the tab
 * reloads the database if another tab saved a newer revision, and after a write it
 * announces the new revision on a BroadcastChannel so other tabs reload.
 */
import type { SqlJsStatic } from "sql.js";
import { withBase } from "@/lib/base-path";
import { LEGACY_USER_ID, migrate } from "@/server/db-schema";
import { localConnection, setLocalConnection } from "@/server/db.static";
import { clearImageUrlCache } from "@/server/images.static";
import { bumpDataVersion } from "./data-version";
import { idbGet, idbPutMany, storageAvailable } from "./idb";
import { SqlJsConnection } from "./sqljs-adapter";

/** Tables that only exist in the browser edition. */
export const EDITION_SCHEMA = `
CREATE TABLE IF NOT EXISTS image_blobs (
  id TEXT PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
  data BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS local_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const LOCK_NAME = "psl-arena-db";
const CHANNEL_NAME = "psl-arena-db";

let sqlPromise: Promise<SqlJsStatic> | null = null;
let readyPromise: Promise<void> | null = null;
let loadedRev = 0;
let persistent = true;
let channel: BroadcastChannel | null = null;

function loadSqlJs(): Promise<SqlJsStatic> {
  sqlPromise ??= import("sql.js").then((m) => {
    const init = (m as unknown as { default?: typeof m.default }).default ?? (m as unknown as typeof m.default);
    // In the browser the WASM file is served from /sqljs; under Node (unit tests) sql.js finds it itself.
    return init(typeof window === "undefined" ? undefined : { locateFile: (file: string) => withBase(`/sqljs/${file}`) });
  });
  return sqlPromise;
}

/** Opens raw SQLite bytes (or a new database) with the shared schema and the local user. */
export function prepareConnection(SQL: SqlJsStatic, bytes?: Uint8Array | null): SqlJsConnection {
  const conn = new SqlJsConnection(bytes ? new SQL.Database(bytes) : new SQL.Database());
  migrate(conn);
  conn.exec(EDITION_SCHEMA);
  const now = new Date().toISOString();
  conn.prepare("INSERT OR IGNORE INTO users (id, name, created_at) VALUES (?, ?, ?)").run(LEGACY_USER_ID, "Local", now);
  conn.prepare("INSERT OR IGNORE INTO local_meta (key, value) VALUES ('edition', 'browser')").run();
  conn.prepare("INSERT OR IGNORE INTO local_meta (key, value) VALUES ('created_at', ?)").run(now);
  return conn;
}

/** Serialises callbacks across tabs (Web Locks) or at least within this tab. */
let localQueue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== "undefined" ? (navigator as Navigator & { locks?: LockManager }).locks : undefined;
  if (locks?.request) return locks.request(LOCK_NAME, fn) as Promise<T>;
  const run = localQueue.then(fn, fn);
  localQueue = run.catch(() => undefined);
  return run;
}

async function reloadFromStorage() {
  const SQL = await loadSqlJs();
  const [bytes, rev] = await Promise.all([idbGet<Uint8Array>("db"), idbGet<number>("rev")]);
  const old = localConnection();
  setLocalConnection(prepareConnection(SQL, bytes ?? null));
  old?.close();
  loadedRev = rev ?? 0;
  clearImageUrlCache();
  bumpDataVersion();
}

function listenToOtherTabs() {
  if (channel || typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
  channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (ev: MessageEvent<{ rev?: number }>) => {
    const rev = ev.data?.rev ?? 0;
    if (rev <= loadedRev) return;
    void exclusive(async () => {
      const stored = (await idbGet<number>("rev")) ?? 0;
      if (stored > loadedRev) await reloadFromStorage();
    });
  };
}

/** Loads the database once per page; every data access awaits this first. */
export function ensureLocalDb(): Promise<void> {
  readyPromise ??= (async () => {
    const SQL = await loadSqlJs();
    persistent = await storageAvailable();
    const [bytes, rev] = await Promise.all([idbGet<Uint8Array>("db"), idbGet<number>("rev")]);
    setLocalConnection(prepareConnection(SQL, bytes ?? null));
    loadedRev = rev ?? 0;
    listenToOtherTabs();
  })().catch((e) => {
    readyPromise = null;
    throw e;
  });
  return readyPromise;
}

export function isLocalDbReady(): boolean {
  return localConnection() !== null;
}

/** False when IndexedDB is unavailable: data then lives only until the tab is closed. */
export function isPersistent(): boolean {
  return persistent;
}

async function persist() {
  const conn = localConnection();
  if (!conn) return;
  const bytes = conn.export();
  const rev = loadedRev + 1;
  if (persistent) {
    await idbPutMany({ db: bytes, rev });
    channel?.postMessage({ rev });
  }
  loadedRev = rev;
  bumpDataVersion();
}

/**
 * Runs a (possibly) mutating operation exclusively and saves the database when it
 * changed any row. Mirrors the server, where every request commits to disk.
 */
export async function withWrite<T>(fn: () => Promise<T> | T): Promise<T> {
  await ensureLocalDb();
  return exclusive(async () => {
    const stored = persistent ? ((await idbGet<number>("rev")) ?? 0) : loadedRev;
    if (stored > loadedRev) await reloadFromStorage();
    const conn = localConnection()!;
    const before = conn.totalChanges();
    try {
      return await fn();
    } finally {
      if (localConnection() === conn && conn.totalChanges() !== before) await persist();
    }
  });
}

/** Raw SQLite bytes of the whole local database (backup download). */
export async function exportDatabase(): Promise<Uint8Array> {
  await ensureLocalDb();
  return exclusive(async () => localConnection()!.export());
}

export class BackupError extends Error {}

/** Replaces the local database with a backup made by the browser edition. */
export async function restoreDatabase(bytes: Uint8Array): Promise<void> {
  const header = new TextDecoder().decode(bytes.subarray(0, 15));
  if (header !== "SQLite format 3") throw new BackupError("not-sqlite");
  const SQL = await loadSqlJs();
  let probe: InstanceType<SqlJsStatic["Database"]>;
  try {
    probe = new SQL.Database(bytes);
    const edition = probe.exec("SELECT value FROM local_meta WHERE key = 'edition'");
    if (edition[0]?.values[0]?.[0] !== "browser") throw new BackupError("not-browser-backup");
    probe.close();
  } catch (e) {
    if (e instanceof BackupError) throw e;
    throw new BackupError("not-browser-backup");
  }
  await ensureLocalDb();
  await exclusive(async () => {
    const old = localConnection();
    setLocalConnection(prepareConnection(SQL, bytes));
    old?.close();
    clearImageUrlCache();
    await persist();
  });
}

/** Asks the browser to keep the data even under storage pressure (best effort). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}

export async function storageEstimate(): Promise<{ usage: number; quota: number; persisted: boolean | null } | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) return null;
    const est = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : null;
    return { usage: est.usage ?? 0, quota: est.quota ?? 0, persisted };
  } catch {
    return null;
  }
}
