import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PROFILE } from "./side-view.test";

// Isolated data directory for the database-backed tests.
const dir = mkdtempSync(join(tmpdir(), "psl-side-"));
process.env.PSL_ARENA_DATA_DIR = dir;

const auth = await import("@/server/auth");
const db = await import("@/server/db");
const repos = await import("@/server/repos");
const services = await import("@/server/services");

const PNG_1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
let userId = "";
let otherId = "";

beforeAll(() => {
  db.closeDb();
  userId = auth.signup({ email: "side@example.com", password: "side strong password", name: "Side" }).id;
  otherId = auth.signup({ email: "other@example.com", password: "other strong password", name: "Other" }).id;
});
afterAll(() => {
  db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("side-view persistence", () => {
  it("creates a profile, stores the encrypted photo and the measurements", () => {
    const rec = services.createSideAnalysis(userId, { profileLabel: "Sideways", imageDataUrl: PNG_1x1, storeImage: true, imageWidth: 1000, imageHeight: 1000, points: PROFILE });
    expect(rec.id).toMatch(/^side_/);
    expect(rec.profileLabel).toBe("Sideways");
    expect(rec.facing).toBe("right");
    expect(rec.analyzable).toBe(true);
    expect(rec.scoredCount).toBe(13);
    expect(rec.score).toBeCloseTo(rec.result.score!, 6);
    expect(rec.imageId).toBeTruthy();
    expect(existsSync(join(dir, "images", `${rec.imageId}.bin`))).toBe(true);
    expect(rec.points).toEqual(PROFILE);
    const rows = db.getDb().prepare("SELECT COUNT(*) AS n FROM side_measurements WHERE analysis_id = ?").get(rec.id) as { n: number };
    expect(rows.n).toBe(16);
    expect(db.getDb().prepare("SELECT value FROM schema_meta WHERE key = 'version'").get()).toEqual({ value: "6" });

    const profile = repos.getProfile(userId, rec.profileId)!;
    expect(profile.sideAnalysisCount).toBe(1);
    expect(profile.latestSideId).toBe(rec.id);
    expect(profile.latestSideScore).toBeCloseTo(rec.score!, 6);
    expect(profile.analysisCount).toBe(0); // frontal analyses are separate
    expect(repos.stats(userId).sideAnalyses).toBe(1);
    expect(repos.exportAll(userId).sideAnalyses).toHaveLength(1);
  });

  it("attaches to an existing profile and lists per profile", () => {
    const first = repos.listSideAnalyses(userId)[0];
    const rec = services.createSideAnalysis(userId, { profileId: first.profileId, storeImage: false, imageWidth: 1000, imageHeight: 1000, points: PROFILE });
    expect(rec.profileId).toBe(first.profileId);
    expect(rec.imageId).toBeNull();
    expect(repos.listSideAnalyses(userId, { profileId: first.profileId })).toHaveLength(2);
    expect(repos.listSideAnalyses(userId)).toHaveLength(2);
  });

  it("rejects unusable placements and out-of-image points", () => {
    expect(() => services.createSideAnalysis(userId, { storeImage: false, imageWidth: 1000, imageHeight: 1000, points: { ...PROFILE, subnasale: { x: 516, y: 350 } } })).toThrow(/not usable/);
    expect(() => services.createSideAnalysis(userId, { storeImage: false, imageWidth: 400, imageHeight: 400, points: PROFILE })).toThrow(/outside the image/);
    expect(() => services.createSideAnalysis(userId, { profileId: "prof_nope", storeImage: false, imageWidth: 1000, imageHeight: 1000, points: PROFILE })).toThrow(/Profile not found/);
    expect(repos.listSideAnalyses(userId)).toHaveLength(2); // nothing persisted
  });

  it("isolates accounts", () => {
    const mine = repos.listSideAnalyses(userId)[0];
    expect(repos.getSideAnalysis(otherId, mine.id)).toBeNull();
    expect(repos.deleteSideAnalysis(otherId, mine.id)).toBe(false);
    expect(repos.listSideAnalyses(otherId)).toHaveLength(0);
  });

  it("deletes with image cleanup and cascades from the profile", () => {
    const list = repos.listSideAnalyses(userId);
    const withImage = list.find((a) => a.imageId)!;
    const file = join(dir, "images", `${withImage.imageId}.bin`);
    expect(existsSync(file)).toBe(true);
    expect(repos.deleteSideAnalysis(userId, withImage.id)).toBe(true);
    expect(existsSync(file)).toBe(false);
    expect(repos.getSideAnalysis(userId, withImage.id)).toBeNull();
    expect(repos.listSideAnalyses(userId)).toHaveLength(1);
    const remaining = repos.listSideAnalyses(userId)[0];
    expect(repos.deleteProfile(userId, remaining.profileId)).toBe(true);
    expect(repos.listSideAnalyses(userId)).toHaveLength(0);
    expect((db.getDb().prepare("SELECT COUNT(*) AS n FROM side_measurements").get() as { n: number }).n).toBe(0);
  });

  it("is wiped by delete-all", () => {
    services.createSideAnalysis(userId, { profileLabel: "Wipe", storeImage: false, imageWidth: 1000, imageHeight: 1000, points: PROFILE });
    expect(repos.stats(userId).sideAnalyses).toBe(1);
    repos.deleteAllData(userId);
    expect(repos.stats(userId).sideAnalyses).toBe(0);
  });
});
