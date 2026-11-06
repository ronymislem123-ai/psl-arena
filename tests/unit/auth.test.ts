import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Isolated data directory for the database-backed tests.
const dir = mkdtempSync(join(tmpdir(), "psl-auth-"));
process.env.PSL_ARENA_DATA_DIR = dir;

const auth = await import("@/server/auth");
const db = await import("@/server/db");
const repos = await import("@/server/repos");

beforeAll(() => {
  db.closeDb();
});
afterAll(() => {
  db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("passwords", () => {
  it("hashes with a random salt and verifies in constant time", () => {
    const a = auth.hashPassword("correct horse battery");
    const b = auth.hashPassword("correct horse battery");
    expect(a.hash).not.toBe(b.hash); // different salts
    expect(auth.verifyPassword("correct horse battery", a.hash, a.salt)).toBe(true);
    expect(auth.verifyPassword("wrong password!", a.hash, a.salt)).toBe(false);
  });
  it("enforces the password policy and e-mail format", () => {
    expect(auth.validatePassword("short")).toMatch(/at least 10/);
    expect(auth.validatePassword("long enough password")).toBeNull();
    expect(auth.normalizeEmail("  Alice@Example.COM ")).toBe("alice@example.com");
    expect(() => auth.normalizeEmail("not-an-email")).toThrow();
  });
});

describe("schema migration", () => {
  it("upgrades a v1 database (single local user, no auth columns) in place", async () => {
    db.closeDb();
    const v1dir = mkdtempSync(join(tmpdir(), "psl-v1-"));
    const Database = (await import("better-sqlite3")).default;
    const raw = new Database(join(v1dir, "psl-arena.sqlite"));
    raw.exec("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL)");
    raw.prepare("INSERT INTO users (id, name, created_at) VALUES ('local', 'Local user', '2025-01-01T00:00:00Z')").run();
    raw.close();
    process.env.PSL_ARENA_DATA_DIR = v1dir;
    const d = db.getDb();
    const cols = (d.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map((c) => c.name);
    expect(cols).toEqual(expect.arrayContaining(["email", "password_hash", "password_salt", "last_login_at"]));
    expect(d.prepare("SELECT COUNT(*) AS n FROM sessions").get()).toEqual({ n: 0 });
    expect(d.prepare("SELECT value FROM schema_meta WHERE key = 'version'").get()).toEqual({ value: db.SCHEMA_VERSION });
    expect(auth.countAccounts()).toBe(0); // the legacy row has no e-mail and is not an account
    db.closeDb();
    rmSync(v1dir, { recursive: true, force: true });
    process.env.PSL_ARENA_DATA_DIR = dir;
  });
});

describe("accounts and sessions", () => {
  it("adopts legacy local data on the first sign-up", () => {
    const d = db.getDb();
    d.prepare("INSERT INTO users (id, name, created_at) VALUES (?, ?, ?)").run(db.LEGACY_USER_ID, "Local user", new Date().toISOString());
    repos.createProfile(db.LEGACY_USER_ID, "Legacy profile");
    expect(auth.countAccounts()).toBe(0);
    const user = auth.signup({ email: "first@example.com", password: "a strong password" });
    expect(auth.countAccounts()).toBe(1);
    expect(repos.listProfiles(user.id).map((p) => p.label)).toEqual(["Legacy profile"]);
    expect(d.prepare("SELECT COUNT(*) AS n FROM users WHERE id = ?").get(db.LEGACY_USER_ID)).toEqual({ n: 0 });
  });

  it("rejects duplicate e-mails and wrong passwords with a generic error", () => {
    expect(() => auth.signup({ email: "first@example.com", password: "another strong pw" })).toThrow(/already exists/);
    expect(() => auth.login({ email: "first@example.com", password: "nope nope nope" })).toThrow(/incorrect/);
    expect(() => auth.login({ email: "unknown@example.com", password: "nope nope nope" })).toThrow(/incorrect/);
    const u = auth.login({ email: "FIRST@example.com", password: "a strong password" });
    expect(u.email).toBe("first@example.com");
  });

  it("isolates data between accounts", () => {
    const second = auth.signup({ email: "second@example.com", password: "second strong pw" });
    const first = auth.login({ email: "first@example.com", password: "a strong password" });
    const p = repos.createProfile(second.id, "Second's profile");
    expect(repos.getProfile(first.id, p.id)).toBeNull();
    expect(repos.listProfiles(first.id).map((x) => x.label)).toEqual(["Legacy profile"]);
    expect(repos.deleteProfile(first.id, p.id)).toBe(false);
    expect(repos.getProfile(second.id, p.id)).not.toBeNull();
  });

  it("creates, finds, expires and destroys sessions", () => {
    const first = auth.login({ email: "first@example.com", password: "a strong password" });
    const { token } = auth.createSession(first.id, "vitest");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(auth.findSession(token)?.id).toBe(first.id);
    expect(auth.findSession("0".repeat(64))).toBeNull();
    expect(auth.findSession("garbage")).toBeNull();
    // only the hash is stored
    const stored = db.getDb().prepare("SELECT id FROM sessions WHERE user_id = ?").all(first.id) as { id: string }[];
    expect(stored.some((s) => s.id === token)).toBe(false);
    auth.destroySession(token);
    expect(auth.findSession(token)).toBeNull();
    // expiry
    const { token: t2 } = auth.createSession(first.id);
    db.getDb().prepare("UPDATE sessions SET expires_at = ? WHERE user_id = ?").run(new Date(Date.now() - 1000).toISOString(), first.id);
    expect(auth.findSession(t2)).toBeNull();
  });

  it("changes the password and signs other devices out", () => {
    const first = auth.login({ email: "first@example.com", password: "a strong password" });
    const keep = auth.createSession(first.id).token;
    const other = auth.createSession(first.id).token;
    expect(() => auth.changePassword(first.id, "wrong current pw", "new strong password")).toThrow(/current password/);
    auth.changePassword(first.id, "a strong password", "new strong password");
    auth.destroyOtherSessions(first.id, keep);
    expect(auth.findSession(keep)).not.toBeNull();
    expect(auth.findSession(other)).toBeNull();
    expect(auth.login({ email: "first@example.com", password: "new strong password" }).id).toBe(first.id);
  });

  it("rate-limits repeated failures per client and e-mail", () => {
    for (let i = 0; i < 10; i++) expect(() => auth.login({ email: "second@example.com", password: "bad bad bad bad" }, "10.0.0.9")).toThrow(/incorrect/);
    expect(() => auth.login({ email: "second@example.com", password: "second strong pw" }, "10.0.0.9")).toThrow(/Too many/);
    // other clients are unaffected
    expect(auth.login({ email: "second@example.com", password: "second strong pw" }, "10.0.0.10").email).toBe("second@example.com");
  });

  it("deletes an account with all of its data", () => {
    const second = auth.login({ email: "second@example.com", password: "second strong pw" }, "10.0.0.10");
    expect(() => auth.deleteAccount(second.id, "wrong")).toThrow(/incorrect/);
    auth.deleteAccount(second.id, "second strong pw");
    expect(db.getDb().prepare("SELECT COUNT(*) AS n FROM face_profiles WHERE user_id = ?").get(second.id)).toEqual({ n: 0 });
    expect(() => auth.login({ email: "second@example.com", password: "second strong pw" }, "10.0.0.11")).toThrow(/incorrect/);
  });

  it("validates cross-site mutation requests", () => {
    const req = new Request("http://localhost/api/profiles", { method: "POST", headers: { "sec-fetch-site": "cross-site", cookie: "psl_session=abc" } });
    expect(() => auth.requireUserApi(req)).toThrow(/Cross-site/);
    const anon = new Request("http://localhost/api/profiles", { method: "GET" });
    expect(() => auth.requireUserApi(anon)).toThrow(/Sign in/);
  });
});
