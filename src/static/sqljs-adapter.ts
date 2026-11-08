/**
 * A synchronous better-sqlite3-compatible facade over sql.js (SQLite compiled to
 * WebAssembly). It implements exactly the subset the repositories use:
 * prepare(sql).get/all/run with positional parameters, exec, pragma and
 * transaction (nested via savepoints). Compiled statements are cached per SQL
 * text (LRU) because sql.js statements live in WASM memory and must be freed.
 */
import type { BindParams, Database as SqlJsDatabase, SqlValue, Statement as SqlJsStatement } from "sql.js";

const STATEMENT_CACHE_SIZE = 256;

function normalize(params: unknown[]): SqlValue[] {
  const flat = params.length === 1 && Array.isArray(params[0]) ? (params[0] as unknown[]) : params;
  return flat.map((p) => {
    if (p === null || p === undefined) return null;
    if (typeof p === "number" || typeof p === "string") return p;
    if (typeof p === "bigint") return Number(p);
    if (typeof p === "boolean") return p ? 1 : 0;
    if (p instanceof Uint8Array) return p;
    throw new TypeError("SQLite can only bind numbers, strings, bigints, byte arrays and null.");
  });
}

export interface RunResult {
  changes: number;
  lastInsertRowid: number;
}

export class StatementAdapter {
  constructor(private readonly conn: SqlJsConnection, readonly source: string) {}

  private use<T>(params: unknown[], fn: (stmt: SqlJsStatement) => T): T {
    const stmt = this.conn.compiled(this.source);
    try {
      stmt.bind(normalize(params) as BindParams);
      return fn(stmt);
    } finally {
      stmt.reset();
    }
  }

  get(...params: unknown[]): Record<string, SqlValue> | undefined {
    return this.use(params, (s) => (s.step() ? s.getAsObject() : undefined));
  }

  all(...params: unknown[]): Record<string, SqlValue>[] {
    return this.use(params, (s) => {
      const rows: Record<string, SqlValue>[] = [];
      while (s.step()) rows.push(s.getAsObject());
      return rows;
    });
  }

  run(...params: unknown[]): RunResult {
    return this.use(params, (s) => {
      while (s.step()) {
        /* drain (e.g. RETURNING clauses) */
      }
      return { changes: this.conn.raw.getRowsModified(), lastInsertRowid: this.conn.lastInsertRowid() };
    });
  }
}

export class SqlJsConnection {
  private readonly cache = new Map<string, SqlJsStatement>();
  private depth = 0;

  constructor(public raw: SqlJsDatabase) {
    this.applyPragmas();
  }

  private applyPragmas() {
    this.raw.exec("PRAGMA foreign_keys = ON");
  }

  /** Cached compiled statement for `sql` (least recently used ones are freed). */
  compiled(sql: string): SqlJsStatement {
    const hit = this.cache.get(sql);
    if (hit) {
      this.cache.delete(sql);
      this.cache.set(sql, hit);
      return hit;
    }
    const stmt = this.raw.prepare(sql);
    this.cache.set(sql, stmt);
    if (this.cache.size > STATEMENT_CACHE_SIZE) {
      const oldest = this.cache.keys().next().value as string;
      this.cache.get(oldest)?.free();
      this.cache.delete(oldest);
    }
    return stmt;
  }

  prepare(sql: string): StatementAdapter {
    return new StatementAdapter(this, sql);
  }

  exec(sql: string): this {
    this.raw.exec(sql);
    return this;
  }

  pragma(source: string): unknown[] {
    const res = this.raw.exec(`PRAGMA ${source}`);
    return res.length ? res[0].values.map((row) => Object.fromEntries(res[0].columns.map((c, i) => [c, row[i]]))) : [];
  }

  lastInsertRowid(): number {
    const res = this.raw.exec("SELECT last_insert_rowid()");
    return Number(res[0]?.values[0]?.[0] ?? 0);
  }

  /** Rows changed since the connection was (re)opened; used to detect writes. */
  totalChanges(): number {
    const res = this.raw.exec("SELECT total_changes()");
    return Number(res[0]?.values[0]?.[0] ?? 0);
  }

  get inTransaction(): boolean {
    return this.depth > 0;
  }

  transaction<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
    return (...args: A): R => {
      const level = this.depth;
      this.raw.exec(level === 0 ? "BEGIN" : `SAVEPOINT sp${level}`);
      this.depth++;
      try {
        const result = fn(...args);
        this.depth--;
        this.raw.exec(level === 0 ? "COMMIT" : `RELEASE sp${level}`);
        return result;
      } catch (e) {
        this.depth--;
        if (level === 0) this.raw.exec("ROLLBACK");
        else this.raw.exec(`ROLLBACK TO sp${level}; RELEASE sp${level}`);
        throw e;
      }
    };
  }

  freeStatements() {
    for (const s of this.cache.values()) s.free();
    this.cache.clear();
  }

  /**
   * Serialises the whole database. sql.js closes and reopens the connection for
   * this, which frees every prepared statement and resets pragmas, so the cache is
   * dropped first and foreign keys are switched back on afterwards.
   */
  export(): Uint8Array {
    if (this.depth > 0) throw new Error("Cannot export inside a transaction.");
    this.freeStatements();
    const bytes = this.raw.export();
    this.applyPragmas();
    return bytes;
  }

  close() {
    this.freeStatements();
    this.raw.close();
  }
}
