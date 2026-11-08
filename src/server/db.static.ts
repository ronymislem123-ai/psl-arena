/**
 * Browser edition of ./db.ts (selected by the static build through the
 * `.static.ts` resolve extension). Same schema and migrations, executed by sql.js
 * in memory. The connection is opened asynchronously by src/static/runtime.ts
 * before any page reads data and handed in via setLocalConnection().
 */
import type Database from "better-sqlite3";
import type { SqlJsConnection } from "@/static/sqljs-adapter";

export { LEGACY_USER_ID, SCHEMA_VERSION, newId } from "./db-schema";

let connection: SqlJsConnection | null = null;

export function setLocalConnection(next: SqlJsConnection | null) {
  connection = next;
}

export function localConnection(): SqlJsConnection | null {
  return connection;
}

/** No data directory in the browser; kept for API parity with ./db.ts. */
export function dataDir(): string {
  return "indexeddb";
}

export function getDb(): Database.Database {
  if (!connection) throw new Error("The local database is not ready yet.");
  return connection as unknown as Database.Database;
}

export function closeDb() {
  connection?.close();
  connection = null;
}
