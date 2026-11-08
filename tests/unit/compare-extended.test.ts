import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { compareAnalyses } from "@/engine/psl/compare";
import { rateFace } from "@/engine/psl/rating";
import { buildStandardScale, snapshotScale } from "@/engine/psl/scale";
import { ACHIEVEMENT_TARGETS, computeAchievements, type AwardLike } from "@/engine/tournament/achievements";
import { DEFAULT_CATEGORIES, DEFAULT_TOURNAMENT_CONFIG } from "@/engine/tournament/categories";
import { compareTournamentVersions, type TournamentLike } from "@/engine/tournament/compare";
import { computeResults, initialState, step } from "@/engine/tournament/engine";
import type { ParticipantData } from "@/engine/tournament/types";
import { inputFromFixture, loadFixture } from "./helpers";

const ai = analyzeFace(inputFromFixture(loadFixture("ai-face")));
const obama = analyzeFace(inputFromFixture(loadFixture("obama")));
const noHair = analyzeFace(inputFromFixture(loadFixture("ai-face"), { trichion: null }));
const item = (id: string, result: typeof ai, createdAt = "2026-01-01") => ({ id, label: id, createdAt, result });

describe("compareAnalyses", () => {
  it("compares identical analyses with zero deltas, 42 ratio rows and no warnings", () => {
    const c = compareAnalyses([item("a", ai), item("b", ai)]);
    expect(c.ratios).toHaveLength(42);
    expect(c.categories).toHaveLength(7);
    expect(c.scores.map((s) => s.id)).toEqual(["overall", "proportion", "harmony", "structure", "symmetry"]);
    expect(c.warnings).toEqual([]);
    expect(c.comparable).toBe(true);
    expect(c.ratios.every((r) => r.indexDeltas.every((d) => d === 0 || d === null))).toBe(true);
    expect(c.commonRatios).toBe(ai.ratios.filter((r) => r.availability === "available").length);
    expect(c.gains).toEqual([]);
    expect(c.symmetryMetrics.length).toBeGreaterThan(5);
    expect(() => compareAnalyses([item("a", ai)])).toThrow(/two/);
  });
  it("reports value and index deltas, gains/losses and quality/hairline/coverage warnings", () => {
    const c = compareAnalyses([item("a", obama), item("b", ai), item("c", noHair)]);
    const esr = c.ratios.find((r) => r.id === "ESR")!;
    const va = obama.ratios.find((r) => r.id === "ESR")!.value!;
    const vb = ai.ratios.find((r) => r.id === "ESR")!.value!;
    expect(esr.values[0]).toBe(va);
    expect(esr.valueDeltas[1]).toBeCloseTo(vb - va, 9);
    expect(esr.indexDeltas[0]).toBe(0);
    const thirds = c.ratios.find((r) => r.id === "FT_U")!;
    expect(thirds.values[2]).toBeNull();
    expect(thirds.common).toBe(false);
    expect(thirds.availability[2]).toBe("unavailable");
    const codes = c.warnings.map((w) => w.code);
    expect(codes).toContain("hairlineDiffers");
    expect(codes).toContain("coverageDiffers");
    for (const g of c.gains) expect(g.indexDeltas[2]!).toBeGreaterThan(1);
    for (const l of c.losses) expect(l.indexDeltas[2]!).toBeLessThan(-1);
    expect(c.items[2].hairline).toBe(false);
    expect(c.items[0].evaluable).toBe(obama.coverage.evaluable);
  });
  it("flags engine, config and unusable differences", () => {
    const unusable = analyzeFace(inputFromFixture(loadFixture("ai-upper")));
    const other = { ...ai, engineVersion: "0.9.0", config: { ...ai.config, includeReconstructed: false, captureDistance: "selfie" as const } };
    const c = compareAnalyses([item("a", ai), item("b", other), item("c", unusable)]);
    const codes = c.warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(["engineVersion", "configDiffers", "captureDistanceDiffers", "unusable"]));
    expect(c.comparable).toBe(false);
    expect(c.items[2].analyzable).toBe(false);
  });
});

describe("achievements", () => {
  const award = (tournamentId: string, kind: AwardLike["kind"], categoryId: string | null = null, shared = false, count = 1): AwardLike => ({ tournamentId, kind, categoryId, categoryName: categoryId, shared, count });
  it("computes stats and thresholds from awards", () => {
    const awards: AwardLike[] = [
      award("t1", "categoryWinner", "jawline"), award("t1", "categoryWinner", "eyeArea", true), award("t1", "categoryWinner", "symmetry"), award("t1", "multiCategory", null, false, 3), award("t1", "overallWinner"),
      award("t2", "categoryWinner", "jawline"), award("t2", "overallWinner"), award("t2", "champion"),
      award("t3", "categoryWinner", "jawline"), award("t3", "overallWinner"),
    ];
    const { stats, achievements } = computeAchievements(awards, 4);
    expect(stats.tournamentsEntered).toBe(4);
    expect(stats.tournamentsWithAward).toBe(3);
    expect(stats.overallWins).toBe(3);
    expect(stats.championships).toBe(1);
    expect(stats.categoryWins).toBe(5);
    expect(stats.sharedCategoryWins).toBe(1);
    expect(stats.distinctCategories).toBe(3);
    expect(stats.mostWonCategory).toEqual({ id: "jawline", name: "jawline", count: 3 });
    const byId = Object.fromEntries(achievements.map((a) => [a.id, a]));
    expect(byId.firstWin.earned).toBe(true);
    expect(byId.hatTrick.earned).toBe(true);
    expect(byId.champion.earned).toBe(true);
    expect(byId.serialWinner.earned).toBe(true);
    expect(byId.specialist.earned).toBe(true);
    expect(byId.specialist.params?.category).toBe("jawline");
    expect(byId.allRounder.earned).toBe(false);
    expect(byId.allRounder.progress).toBe(3);
    expect(byId.veteran.earned).toBe(false);
    expect(byId.veteran.progress).toBe(4);
    for (const a of achievements) expect(a.target).toBe(ACHIEVEMENT_TARGETS[a.id]);
  });
  it("handles no awards", () => {
    const { stats, achievements } = computeAchievements([], 0);
    expect(stats.mostWonCategory).toBeNull();
    expect(achievements.every((a) => !a.earned && a.progress === 0)).toBe(true);
  });
});

describe("compareTournamentVersions", () => {
  const scale = snapshotScale(buildStandardScale());
  const P = (id: string, name: string, r: ReturnType<typeof rateFace>): ParticipantData => ({ id, name, imageId: null, rating: r, seed: 1 });
  const mk = (version: number, participants: ParticipantData[], config = { ...DEFAULT_TOURNAMENT_CONFIG, categories: DEFAULT_CATEGORIES }, run = true): TournamentLike => {
    const state = step(initialState(participants, config, "t0"), participants, config, "t1").state;
    return { version, status: run ? "completed" : "draft", completedAt: run ? "t1" : null, config, participants: participants.map((p) => ({ id: p.id, displayName: p.name })), results: run ? computeResults(participants, config, state, "t2") : null };
  };
  const rA = rateFace({ frontal: ai, scale });
  const rB = rateFace({ frontal: obama, scale });
  it("reports participant, config and result changes between versions", () => {
    const v1 = mk(1, [P("p1", "Alpha", rA), P("p2", "Bravo", rB)]);
    const cfg2 = { ...DEFAULT_TOURNAMENT_CONFIG, format: "category" as const, categories: DEFAULT_CATEGORIES.filter((c) => c.id !== "profile").map((c) => ({ ...c, weight: c.id === "eyeArea" ? 50 : c.weight })) };
    const v2 = mk(2, [P("q1", "Alpha", rA), P("q2", "Bravo", rB), P("q3", "Charlie", rB)], cfg2);
    const d = compareTournamentVersions(v1, v2);
    expect(d.a.version).toBe(1);
    expect(d.b.participants).toBe(3);
    expect(d.participants.added).toEqual(["Charlie"]);
    expect(d.participants.removed).toEqual([]);
    expect(d.participants.unchanged).toBe(2);
    expect(d.config.formatChanged).toEqual(["ranking", "category"]);
    expect(d.config.categoriesRemoved).toEqual(["Best Profile"]);
    expect(d.config.weightChanges).toEqual([{ id: "eyeArea", name: "Best Eye Area", a: 0, b: 50 }]);
    expect(d.results).not.toBeNull();
    expect(d.results!.categories.length).toBe(12);
    expect(d.results!.ranking.find((r) => r.name === "Charlie")!.a).toBeNull();
    expect(d.results!.ranking.find((r) => r.name === "Alpha")!.a).toBe(1);
    expect(typeof d.results!.overallWinners.changed).toBe("boolean");
  });
  it("has no result diff when a version is a draft, and no changes for identical versions", () => {
    const v1 = mk(1, [P("p1", "Alpha", rA), P("p2", "Bravo", rB)]);
    const draft = mk(2, [P("p1", "Alpha", rA), P("p2", "Bravo", rB)], undefined, false);
    expect(compareTournamentVersions(v1, draft).results).toBeNull();
    const same = compareTournamentVersions(v1, { ...v1, version: 2 });
    expect(same.results!.changedCategories).toBe(0);
    expect(same.results!.overallWinners.changed).toBe(false);
    expect(same.participants.added).toEqual([]);
    expect(same.config.weightChanges).toEqual([]);
  });
});
