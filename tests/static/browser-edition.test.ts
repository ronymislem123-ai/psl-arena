/**
 * The browser edition (GitHub Pages build) under Node: modules resolve like
 * `npm run build:static` (see vitest.config.ts), so these tests run the real route
 * handlers, services and repositories against sql.js instead of better-sqlite3.
 */
import { describe, expect, it, beforeAll } from "vitest";
import initSqlJs from "sql.js";
import { inputFromFixture, loadFixture } from "../unit/helpers";

const db = await import("@/server/db");
const runtime = await import("@/static/runtime");
const backend = await import("@/static/backend");
const images = await import("@/server/images");
const auth = await import("@/server/auth");
const { SqlJsConnection } = await import("@/static/sqljs-adapter");
const cats = await import("@/engine/tournament/categories");

const PNG_1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const CONSENT = { rightsConfirmed: true, adultsConfirmed: true } as const;

async function call<T = Record<string, unknown>>(path: string, method = "GET", body?: unknown) {
  const res = await backend.localFetch(path, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { "Content-Type": "application/json" } });
  const ct = res.headers.get("Content-Type") ?? "";
  const data = ct.includes("json") ? ((await res.json()) as T) : (null as T);
  return { status: res.status, data, headers: res.headers };
}

const count = (table: string) => (db.getDb().prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

beforeAll(async () => {
  await runtime.ensureLocalDb();
});

describe("module resolution", () => {
  it("swaps in the browser data layer and the account-free auth", () => {
    expect(db.dataDir()).toBe("indexeddb");
    expect(auth.requireUserApi(new Request("http://x/"))).toMatchObject({ id: "local" });
    expect(runtime.isPersistent()).toBe(false); // no IndexedDB under Node → in-memory
    expect(count("users")).toBe(1);
    expect(db.getDb().prepare("SELECT value FROM schema_meta WHERE key = 'version'").get()).toEqual({ value: "6" });
  });
});

describe("sql.js adapter", () => {
  it("behaves like better-sqlite3 for get/all/run, nested transactions and blobs; export keeps data and foreign keys", async () => {
    const SQL = await initSqlJs();
    const c = new SqlJsConnection(new SQL.Database());
    c.exec("CREATE TABLE p (id INTEGER PRIMARY KEY); CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT, b BLOB, p INTEGER REFERENCES p(id) ON DELETE CASCADE)");
    expect(c.prepare("INSERT INTO t (v) VALUES (?)").run("a")).toEqual({ changes: 1, lastInsertRowid: 1 });
    expect(c.prepare("SELECT v FROM t WHERE id = ?").get(99)).toBeUndefined();
    expect(c.prepare("SELECT v FROM t WHERE v = ? OR v = ?").all("a", null)).toEqual([{ v: "a" }]);
    const outer = c.transaction(() => {
      c.prepare("INSERT INTO t (v) VALUES (?)").run("b");
      const inner = c.transaction(() => {
        c.prepare("INSERT INTO t (v) VALUES (?)").run("c");
        throw new Error("inner");
      });
      expect(() => inner()).toThrow("inner");
    });
    outer();
    expect(c.prepare("SELECT v FROM t ORDER BY id").all().map((r) => r.v)).toEqual(["a", "b"]);
    expect(() => c.transaction(() => { c.prepare("INSERT INTO t (v) VALUES (?)").run("d"); throw new Error("outer"); })()).toThrow("outer");
    expect(c.prepare("SELECT COUNT(*) AS n FROM t").get()).toEqual({ n: 2 });
    c.prepare("INSERT INTO p (id) VALUES (?)").run(7);
    c.prepare("INSERT INTO t (v, b, p) VALUES (?, ?, ?)").run("blob", new Uint8Array([1, 2, 3]), 7);
    for (let i = 0; i < 300; i++) c.prepare(`SELECT ${i} AS n`).get(); // exceeds the statement cache
    const bytes = c.export();
    expect(c.pragma("foreign_keys")).toEqual([{ foreign_keys: 1 }]);
    const copy = new SqlJsConnection(new SQL.Database(bytes));
    expect(Array.from(copy.prepare("SELECT b FROM t WHERE v = 'blob'").get()!.b as Uint8Array)).toEqual([1, 2, 3]);
    copy.prepare("DELETE FROM p WHERE id = ?").run(7);
    expect(copy.prepare("SELECT COUNT(*) AS n FROM t").get()).toEqual({ n: 2 }); // cascade after reopen
    expect(() => c.prepare("INSERT INTO t (v) VALUES (?)").run({} as unknown as string)).toThrow(/can only bind/);
  });
});

describe("route handlers in the page", () => {
  let analysisId = "";
  let ratingId = "";
  const profileIds: string[] = [];

  it("answers unknown and auth routes with 404, validates bodies like the server", async () => {
    expect((await call("/api/auth/me")).status).toBe(404);
    expect((await call("/api/nope")).status).toBe(404);
    expect((await call("/api/analyses", "PUT", {})).status).toBe(405);
    const bad = await call<{ error: string }>("/api/analyses", "POST", { storeImage: false });
    expect(bad.status).toBe(400);
    expect(bad.data.error).toBe("Invalid request");
  });

  it("lists the built-in scale and the rubric", async () => {
    const scales = await call<{ scales: { builtIn: boolean; tierCount: number }[] }>("/api/scales");
    expect(scales.data.scales[0]).toMatchObject({ builtIn: true, tierCount: 21 });
    const rubric = await call<{ criteria: unknown[] }>("/api/rubric");
    expect(rubric.data.criteria).toHaveLength(41);
  });

  it("creates an analysis with a stored image (blob in SQLite) and rates it", async () => {
    const res = await call<{ analysis: { id: string; imageId: string; profileId: string } }>("/api/analyses", "POST", {
      profileLabel: "Alpha", imageDataUrl: PNG_1x1, storeImage: true, consent: CONSENT, input: inputFromFixture(loadFixture("obama")),
    });
    expect(res.status).toBe(201);
    analysisId = res.data.analysis.id;
    profileIds.push(res.data.analysis.profileId);
    const imageId = res.data.analysis.imageId;
    expect(imageId).toMatch(/^img_/);
    const img = images.readImage("local", imageId)!;
    expect(img.mime).toBe("image/png");
    expect(img.buf.length).toBe(Buffer.from(PNG_1x1.split(",")[1], "base64").length);
    const served = await backend.localFetch(`/api/images/${imageId}`);
    expect(served.status).toBe(200);
    expect(served.headers.get("Content-Type")).toBe("image/png");
    expect(count("image_blobs")).toBe(1);

    const rating = await call<{ rating: { id: string; analysisId: string } }>("/api/ratings", "POST", { analysisId, consent: CONSENT });
    expect(rating.status).toBe(201);
    ratingId = rating.data.rating.id;
    const dl = await call("/api/ratings/" + ratingId + "?download=1");
    expect(dl.headers.get("Content-Disposition")).toContain(`psl-rating-${ratingId}.json`);
    const second = await call<{ rating: { profileId: string } }>("/api/ratings", "POST", { newAnalysis: { profileLabel: "Bravo", storeImage: false, input: inputFromFixture(loadFixture("biden")) }, consent: CONSENT });
    expect(second.status).toBe(201);
    profileIds.push(second.data.rating.profileId);
    const unusable = await call<{ error: string }>("/api/analyses", "POST", { profileLabel: "Bad", storeImage: false, consent: CONSENT, input: inputFromFixture(loadFixture("ai-upper")) });
    expect(unusable.status).toBe(422);
  });

  it("runs a tournament to completion and keeps versions", async () => {
    const created = await call<{ tournament: { id: string; status: string } }>("/api/tournaments", "POST", {
      name: "Browser Cup", config: { ...cats.DEFAULT_TOURNAMENT_CONFIG, format: "knockout" }, participants: profileIds.map((profileId) => ({ profileId })),
    });
    expect(created.status).toBe(201);
    const id = created.data.tournament.id;
    await call(`/api/tournaments/${id}/actions`, "POST", { action: "start" });
    let t = (await call<{ tournament: { status: string }; blocked: boolean }>(`/api/tournaments/${id}/actions`, "POST", { action: "playAll" })).data;
    if (t.tournament.status !== "completed") t = (await call<{ tournament: { status: string }; blocked: boolean }>(`/api/tournaments/${id}/actions`, "POST", { action: "complete" })).data;
    expect(t.tournament.status).toBe("completed");
    const reopened = await call<{ tournament: { version: number } }>(`/api/tournaments/${id}/actions`, "POST", { action: "reopen", note: "edit" });
    expect(reopened.status).toBe(200);
    const versions = await call<{ versions: { version: number }[] }>(`/api/tournaments/${id}/versions`);
    expect(versions.data.versions.length).toBeGreaterThanOrEqual(1);
    const lb = await call<{ participants: unknown[] }>("/api/leaderboards");
    expect(lb.data.participants).toHaveLength(2);
  });

  it("deletes a profile with its image blob, then everything", async () => {
    expect(count("image_blobs")).toBe(1);
    expect((await call(`/api/profiles/${profileIds[0]}`, "DELETE")).data).toEqual({ deleted: true });
    expect(count("image_blobs")).toBe(0);
    expect((await call("/api/data", "DELETE")).data).toEqual({ deleted: true });
    expect(count("face_profiles")).toBe(0);
    expect(count("psl_ratings")).toBe(0);
    expect(count("users")).toBe(1); // the local user stays
  });
});

describe("backup", () => {
  it("round-trips through exportDatabase/restoreDatabase and rejects foreign files", async () => {
    await call("/api/profiles", "POST", { label: "Kept" });
    const bytes = await runtime.exportDatabase();
    await call("/api/data", "DELETE");
    expect(count("face_profiles")).toBe(0);
    await runtime.restoreDatabase(bytes);
    expect((db.getDb().prepare("SELECT label FROM face_profiles").all() as { label: string }[]).map((r) => r.label)).toEqual(["Kept"]);
    await expect(runtime.restoreDatabase(new TextEncoder().encode("not a database at all"))).rejects.toThrow(/not-sqlite/);
    const SQL = await initSqlJs();
    const foreign = new SQL.Database();
    foreign.exec("CREATE TABLE x (y)");
    await expect(runtime.restoreDatabase(foreign.export())).rejects.toThrow(/not-browser-backup/);
  });
});
