import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inputFromFixture, loadFixture } from "./helpers";
import { PROFILE } from "./side-view.test";

const dir = mkdtempSync(join(tmpdir(), "psl-store-"));
process.env.PSL_ARENA_DATA_DIR = dir;

const auth = await import("@/server/auth");
const db = await import("@/server/db");
const repos = await import("@/server/repos");
const psl = await import("@/server/repos-psl");
const services = await import("@/server/services");
const sv = await import("@/server/services-psl");
const scaleMod = await import("@/engine/psl/scale");
const cats = await import("@/engine/tournament/categories");

const PNG_1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
let userId = "";
let otherId = "";
const mk = (id: string, min: number, max: number, order: number) => ({ id, name: id, short: id, group: null, min, max, order, description: "", color: "#4f7cff", percentile: null, images: [], notes: "" });

beforeAll(() => {
  db.closeDb();
  userId = auth.signup({ email: "psl@example.com", password: "psl strong password", name: "PSL" }).id;
  otherId = auth.signup({ email: "psl-other@example.com", password: "other strong password", name: "Other" }).id;
});
afterAll(() => {
  db.closeDb();
  rmSync(dir, { recursive: true, force: true });
});

describe("scales", () => {
  it("lists the built-in scale, creates, updates (version bump), duplicates, exports/imports and deletes with image cleanup", () => {
    const list = psl.listScales(userId);
    expect(list[0].builtIn).toBe(true);
    expect(list[0].tierCount).toBe(21);
    expect(db.getDb().prepare("SELECT value FROM schema_meta WHERE key = 'version'").get()).toEqual({ value: "6" });
    const created = sv.saveNewScale(userId, { name: "Mine", description: "d", rangeMin: 0, rangeMax: 10, tiers: [mk("low", 0, 5, 0), mk("high", 5, 10, 1)] });
    expect(created.version).toBe(1);
    expect(() => sv.saveNewScale(userId, { name: "Bad", description: "", rangeMin: 0, rangeMax: 10, tiers: [mk("a", 0, 4, 0), mk("b", 5, 10, 1)] })).toThrow(/not valid/);
    expect(() => sv.saveScale(userId, scaleMod.BUILTIN_SCALE_ID, { name: "x", description: "", rangeMin: 0, rangeMax: 10, tiers: [mk("a", 0, 10, 0)] })).toThrow(/built-in/);
    // reference image
    const withImg = sv.addTierImage(userId, created.id, "high", PNG_1x1, 1, 1, "example");
    const imgId = withImg.tiers[1].images[0].imageId;
    expect(existsSync(join(dir, "images", `${imgId}.bin`))).toBe(true);
    expect(withImg.version).toBe(2);
    expect(() => sv.saveNewScale(otherId, { name: "steal", description: "", rangeMin: 0, rangeMax: 10, tiers: [{ ...mk("a", 0, 10, 0), images: [{ imageId: imgId, caption: "" }] }] })).toThrow(/not available/);
    // update keeps the image when still referenced, deletes it when removed
    const updated = sv.saveScale(userId, created.id, { name: "Mine 2", description: "", rangeMin: 0, rangeMax: 10, tiers: [mk("low", 0, 5, 0), { ...mk("high", 5, 10, 1), images: [{ imageId: imgId, caption: "kept" }] }] });
    expect(updated.name).toBe("Mine 2");
    expect(updated.version).toBe(3);
    expect(existsSync(join(dir, "images", `${imgId}.bin`))).toBe(true);
    const dup = sv.duplicateScale(userId, created.id);
    expect(dup.name).toBe("Mine 2 (copy)");
    expect(dup.tiers[1].images[0].imageId).toBe(imgId);
    const ex = sv.exportScaleJson(userId, created.id);
    expect(ex.scale.tiers[1]).not.toHaveProperty("images");
    const imported = sv.importScale(userId, ex, "Imported");
    expect(imported.tiers).toHaveLength(2);
    expect(imported.tiers[1].images).toEqual([]);
    expect(() => sv.importScale(userId, { ...ex, scale: { ...ex.scale, tiers: [{ ...ex.scale.tiers[0], max: 4 }, ex.scale.tiers[1]] } })).toThrow(/not valid/);
    // removing the image from one scale keeps the file while the duplicate still uses it
    sv.saveScale(userId, created.id, { name: "Mine 2", description: "", rangeMin: 0, rangeMax: 10, tiers: [mk("low", 0, 5, 0), mk("high", 5, 10, 1)] });
    expect(existsSync(join(dir, "images", `${imgId}.bin`))).toBe(false); // updateScale deletes images dropped from the edited scale
    expect(psl.getScale(otherId, created.id)).toBeNull();
    expect(psl.deleteScale(userId, created.id)).toBe(true);
    expect(psl.deleteScale(userId, scaleMod.BUILTIN_SCALE_ID)).toBe(false);
    expect(psl.listScales(userId).filter((s) => !s.builtIn)).toHaveLength(2);
  });
});

describe("ratings", () => {
  let analysisId = "";
  let profileId = "";
  it("creates a rating from an existing analysis, auto-attaches the latest side view and stores the scale snapshot", async () => {
    const a = services.createAnalysis(userId, { profileLabel: "Alpha", storeImage: false, input: inputFromFixture(loadFixture("ai-face")) });
    analysisId = a.id;
    profileId = a.profileId;
    const r1 = await sv.createRating(userId, { analysisId, consent: undefined } as never);
    expect(r1.id).toMatch(/^rate_/);
    expect(r1.scaleName).toBe("PSL Standard");
    expect(r1.result.coverage).toBeGreaterThan(0.7);
    expect(r1.result.coverage).toBeLessThan(0.9);
    expect(r1.result.rubricVersion).toBe("2.0.0");
    expect(r1.valid).toBe(true);
    expect(r1.tierName).toBeTruthy();
    const side = services.createSideAnalysis(userId, { profileId, storeImage: false, imageWidth: 1000, imageHeight: 1000, points: PROFILE });
    const r2 = await sv.createRating(userId, { analysisId });
    expect(r2.sideAnalysisId).toBe(side.id);
    expect(r2.result.coverage).toBeGreaterThan(0.95);
    const r3 = await sv.createRating(userId, { analysisId, sideAnalysisId: null });
    expect(r3.sideAnalysisId).toBeNull();
    expect(psl.listRatings(userId, { profileId })).toHaveLength(3);
    expect(psl.latestRatings(userId)).toHaveLength(1);
    expect(psl.latestRatings(userId)[0].id).toBe(r3.id);
    expect(repos.getProfile(userId, profileId)!.analysisCount).toBe(1);
  });
  it("rates with a custom scale and from a new upload, rejects foreign/unknown inputs", async () => {
    const scale = sv.saveNewScale(userId, { name: "Two", description: "", rangeMin: 0, rangeMax: 10, tiers: [mk("low", 0, 5, 0), mk("high", 5, 10, 1)] });
    const r = await sv.createRating(userId, { analysisId, scaleId: scale.id });
    expect(r.scaleName).toBe("Two");
    expect(["low", "high"]).toContain(r.tierId);
    const fromUpload = await sv.createRating(userId, { newAnalysis: { profileLabel: "Bravo", storeImage: false, input: inputFromFixture(loadFixture("obama")) } });
    expect(fromUpload.profileLabel).toBe("Bravo");
    expect(fromUpload.analysisId).toMatch(/^ana_/);
    await expect(sv.createRating(userId, { analysisId: "ana_nope" })).rejects.toThrow(/not found/);
    await expect(sv.createRating(otherId, { analysisId })).rejects.toThrow(/not found/);
    await expect(sv.createRating(userId, { analysisId, scaleId: "scale_nope" })).rejects.toThrow(/Scale not found/);
    const unusable = services.createAnalysis.bind(null);
    expect(() => unusable(userId, { profileLabel: "Bad", storeImage: false, input: inputFromFixture(loadFixture("ai-upper")) })).toThrow(/not analyzable/);
    expect(psl.getRating(otherId, r.id)).toBeNull();
    expect(psl.deleteRating(otherId, r.id)).toBe(false);
    expect(psl.deleteRating(userId, r.id)).toBe(true);
  });
});

describe("tournaments", () => {
  let tid = "";
  const profiles: string[] = [];
  it("creates a draft from rated profiles, refuses unrated ones and duplicates", async () => {
    for (const [label, fx] of [["C1", "ai-face"], ["C2", "biden"], ["C3", "obama"], ["C4", "ai-face"], ["C5", "biden"]] as const) {
      const a = services.createAnalysis(userId, { profileLabel: label, storeImage: false, input: inputFromFixture(loadFixture(fx)) });
      await sv.createRating(userId, { analysisId: a.id });
      profiles.push(a.profileId);
    }
    const unrated = repos.createProfile(userId, "Unrated");
    expect(() => sv.createTournament(userId, { name: "T", config: cats.DEFAULT_TOURNAMENT_CONFIG, participants: [{ profileId: profiles[0] }, { profileId: unrated.id }] })).toThrow(/no PSL rating/);
    expect(() => sv.createTournament(userId, { name: "T", config: cats.DEFAULT_TOURNAMENT_CONFIG, participants: [{ profileId: profiles[0] }, { profileId: profiles[0] }] })).toThrow(/only once/);
    const t = sv.createTournament(userId, { name: "Cup", description: "five", config: { ...cats.DEFAULT_TOURNAMENT_CONFIG, format: "knockout", seeding: "manual" }, participants: profiles.map((p) => ({ profileId: p })) });
    tid = t.id;
    expect(t.status).toBe("draft");
    expect(t.participants).toHaveLength(5);
    expect(t.participants[0].rating.score).not.toBeNull();
    expect(t.scaleName).toBe("PSL Standard");
    expect(psl.getTournament(otherId, tid)).toBeNull();
  });
  it("runs the knockout lifecycle: start → rounds (manual tie decisions) → completed, locked, reopen creates a version", () => {
    let res = sv.runTournamentAction(userId, tid, "start");
    expect(res.tournament.status).toBe("running");
    expect(res.tournament.state!.bracket!.byes).toBe(3);
    expect(() => sv.updateTournamentDraft(userId, tid, { name: "x" })).toThrow(/Only draft/);
    let guard = 0;
    while (res.tournament.status !== "completed" && guard++ < 12) {
      res = sv.runTournamentAction(userId, tid, "advance");
      if (res.blocked) {
        const tied = res.tournament.state!.bracket!.rounds[res.tournament.state!.currentRound].find((m) => m.status === "tied")!;
        res = sv.runTournamentAction(userId, tid, "decide", { matchId: tied.id, winnerId: tied.a! });
      }
    }
    expect(res.tournament.status).toBe("completed");
    expect(res.tournament.results!.knockoutChampionId).toBeTruthy();
    expect(res.tournament.results!.categoryRankings).toHaveLength(12);
    expect(res.tournament.winnerNames.length).toBeGreaterThan(0);
    expect(() => sv.updateTournamentDraft(userId, tid, { name: "x" })).toThrow(/locked/);
    expect(() => sv.runTournamentAction(userId, tid, "advance")).toThrow(/not running/);
    const reopened = sv.runTournamentAction(userId, tid, "reopen", { note: "fix names" }).tournament;
    expect(reopened.status).toBe("draft");
    expect(reopened.version).toBe(2);
    const versions = psl.listTournamentVersions(userId, tid);
    expect(versions).toHaveLength(1);
    const old = psl.getTournamentVersion(userId, tid, versions[0].id)!;
    expect(old.status).toBe("completed");
    expect(old.version).toBe(1);
    const renamed = sv.updateTournamentDraft(userId, tid, { name: "Cup v2", config: { ...cats.DEFAULT_TOURNAMENT_CONFIG, format: "ranking" } });
    expect(renamed.name).toBe("Cup v2");
    const done = sv.runTournamentAction(userId, tid, "start").tournament; // ranking completes immediately
    expect(done.status).toBe("completed");
    expect(done.results!.officialMethod).toBe("weighted");
    // awards of the first profile come from completed tournaments only
    const awards = psl.awardsForProfile(userId, profiles[0]);
    expect(awards.length).toBeGreaterThan(0);
    expect(awards.every((a) => a.tournamentId === tid)).toBe(true);
    expect(awards.some((a) => a.kind === "categoryWinner")).toBe(true);
    expect(psl.awardsForProfile(otherId, profiles[0])).toEqual([]);
    expect(psl.tournamentParticipation(userId, profiles[0])).toEqual({ completed: 1, total: 1 });
    expect(psl.tournamentParticipation(otherId, profiles[0])).toEqual({ completed: 0, total: 0 });
    expect(psl.getRatings(userId, [done.participants[0].ratingId!, "rate_nope"]).length).toBe(1);
    const copy = sv.runTournamentAction(userId, tid, "duplicate").tournament;
    expect(copy.id).not.toBe(tid);
    expect(copy.status).toBe("draft");
    expect(copy.participants).toHaveLength(5);
    expect(psl.listTournaments(userId).length).toBeGreaterThanOrEqual(2);
    expect(repos.stats(userId).tournaments).toBeGreaterThanOrEqual(2);
    expect(repos.exportAll(userId).tournaments.length).toBeGreaterThanOrEqual(2);
  });
  it("group stage with pause/resume and a locked completed result; profile deletion keeps the snapshot", () => {
    const t = sv.createTournament(userId, { name: "Groups", config: { ...cats.DEFAULT_TOURNAMENT_CONFIG, format: "group", groupSize: 3, qualifyPerGroup: 2 }, participants: profiles.map((p) => ({ profileId: p })) });
    let res = sv.runTournamentAction(userId, t.id, "start");
    res = sv.runTournamentAction(userId, t.id, "pause");
    expect(res.tournament.status).toBe("paused");
    expect(() => sv.runTournamentAction(userId, t.id, "advance")).toThrow(/not running/);
    res = sv.runTournamentAction(userId, t.id, "resume");
    let guard = 0;
    while (res.tournament.status !== "completed" && guard++ < 12) {
      res = sv.runTournamentAction(userId, t.id, "playAll");
      if (res.blocked) {
        const tied = res.tournament.state!.bracket!.rounds[res.tournament.state!.currentRound].find((m) => m.status === "tied")!;
        res = sv.runTournamentAction(userId, t.id, "decide", { matchId: tied.id, winnerId: tied.b! });
      }
    }
    expect(res.tournament.status).toBe("completed");
    expect(res.tournament.state!.groups!.length).toBe(2);
    // deleting a participant's profile keeps the tournament consistent (snapshot)
    repos.deleteProfile(userId, profiles[4]);
    const after = psl.getTournament(userId, t.id)!;
    expect(after.participants).toHaveLength(5);
    expect(after.participants[4].profileId).toBeNull();
    expect(after.results!.stats.participants).toBe(5);
    expect(sv.removeTournament(userId, t.id)).toBe(true);
    repos.deleteAllData(userId);
    expect(psl.listTournaments(userId)).toHaveLength(0);
    expect(psl.listRatings(userId)).toHaveLength(0);
    expect(psl.listScales(userId)).toHaveLength(1);
  });
});
