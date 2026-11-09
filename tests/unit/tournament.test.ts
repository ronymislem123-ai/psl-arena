import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { rateFace, type RatingResult } from "@/engine/psl/rating";
import { buildStandardScale, snapshotScale } from "@/engine/psl/scale";
import { DEFAULT_CATEGORIES, DEFAULT_TOURNAMENT_CONFIG, normalizeWeights } from "@/engine/tournament/categories";
import { allCategoryScores, buildBracket, buildGroups, categoryRankings, compareParticipants, computeResults, initialState, overallRanking, resolveTiedMatch, roundName, step, weightedOverall } from "@/engine/tournament/engine";
import type { ParticipantData, TournamentConfig } from "@/engine/tournament/types";
import { inputFromFixture, loadFixture } from "./helpers";

const scale = snapshotScale(buildStandardScale());
const base = {
  obama: analyzeFace(inputFromFixture(loadFixture("obama"))),
  biden: analyzeFace(inputFromFixture(loadFixture("biden"))),
  ai: analyzeFace(inputFromFixture(loadFixture("ai-face"))),
};
const R = {
  obama: rateFace({ frontal: base.obama, scale }),
  biden: rateFace({ frontal: base.biden, scale }),
  // p1/p7 carry a (labelled) self-assessment of the eye shape, p4/p8 do not: a category of that criterion is decidable only between them
  ai: rateFace({ frontal: base.ai, selfAssessment: { eyeShape: 8 }, scale }),
  aiNoSide: rateFace({ frontal: base.ai, scale }),
};
const P = (id: string, rating: RatingResult, seed = 1): ParticipantData => ({ id, name: id, imageId: null, rating, seed });
const cfg = (patch: Partial<TournamentConfig> = {}): TournamentConfig => ({ ...DEFAULT_TOURNAMENT_CONFIG, categories: DEFAULT_CATEGORIES, ...patch });
/** eight participants built from three distinct ratings (duplicates ⇒ guaranteed ties) */
const eight = [P("p1", R.ai, 1), P("p2", R.obama, 2), P("p3", R.biden, 3), P("p4", R.aiNoSide, 4), P("p5", R.obama, 5), P("p6", R.biden, 6), P("p7", R.ai, 7), P("p8", R.aiNoSide, 8)];
const five = eight.slice(0, 5);

describe("categories and weights", () => {
  it("ships 12 built-in categories mapped to rubric criteria and normalises weights", () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(12);
    // rubric 3.0: front profile only — no profile category, every criterion is a frontal one
    expect(DEFAULT_CATEGORIES.map((c) => c.id)).not.toContain("profile");
    expect(DEFAULT_CATEGORIES.map((c) => c.name)).toContain("Best Lower Third");
    const w = normalizeWeights(DEFAULT_CATEGORIES);
    expect([...w.values()].reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    // by default only the overall face counts, so no criterion is weighted twice
    expect(w.get("overallFace")).toBeCloseTo(1, 9);
    expect(w.get("harmony")).toBe(0);
    expect(DEFAULT_CATEGORIES.filter((c) => c.area).map((c) => c.area)).toEqual(["eye", "harmonySymmetry", "midfaceFront", "lowerThird", "nose"]);
    // sums under or over 100 % are normalised the same way
    const under = normalizeWeights([{ id: "a", name: "a", criteria: [], weight: 30 }, { id: "b", name: "b", criteria: [], weight: 30 }]);
    expect(under.get("a")).toBeCloseTo(0.5, 9);
    const over = normalizeWeights([{ id: "a", name: "a", criteria: [], weight: 150 }, { id: "b", name: "b", criteria: [], weight: 50 }]);
    expect(over.get("a")).toBeCloseTo(0.75, 9);
    const zero = normalizeWeights([{ id: "a", name: "a", criteria: [], weight: 0 }, { id: "b", name: "b", criteria: [], weight: 0 }]);
    expect(zero.get("a")).toBeCloseTo(0.5, 9);
  });

  it("scores categories from the shared rating; a category whose criteria are missing is not assessable", () => {
    const scores = allCategoryScores([P("a", R.obama), P("b", R.ai)], cfg());
    for (const s of scores) expect(s.reasonCode).not.toBe("requiresProfile");
    const overall = scores.find((s) => s.participantId === "a" && s.categoryId === "overallFace")!;
    expect(overall.score).toBe(R.obama.score);
    const jaw = scores.find((s) => s.participantId === "a" && s.categoryId === "jawline")!;
    expect(jaw.assessable).toBe(true);
    expect(jaw.coverage).toBeLessThan(1); // jawlineDefinition (visual) and neckWidth (manual neck points) missing
  });
});

describe("category winners and overall ranking", () => {
  it("gives every category its own winner, allows multiple wins and shared ranks, and never forces a winner", () => {
    const c = cfg();
    const scores = allCategoryScores(eight, c);
    const rankings = categoryRankings(scores, c);
    expect(rankings).toHaveLength(12);
    for (const r of rankings) {
      if (!r.decidable) continue;
      const top = r.entries.filter((e) => e.rank === 1);
      expect(r.winners.sort()).toEqual(top.map((e) => e.participantId).sort());
      // duplicates of the same rating share the win
      if (r.winners.includes("p1")) expect(r.winners).toContain("p7");
      if (r.winners.includes("p2")) expect(r.winners).toContain("p5");
      expect(r.tied).toBe(r.winners.length > 1);
    }
    const c2 = { ...c, categories: [...c.categories, { id: "eyeShapeOnly", name: "Eye shape", criteria: [{ id: "eyeShape" as const, weight: 1 }], weight: 0 }] };
    const shape = categoryRankings(allCategoryScores(eight, c2), c2).find((r) => r.categoryId === "eyeShapeOnly")!;
    expect(shape.decidable).toBe(true); // only p1 and p7 have the criterion
    expect(shape.winners.sort()).toEqual(["p1", "p7"]);
    expect(shape.entries.filter((e) => e.rank === null).length).toBe(6);
    const onlyOne = categoryRankings(allCategoryScores([P("a", R.ai), P("b", R.obama)], c2), c2).find((r) => r.categoryId === "eyeShapeOnly")!;
    expect(onlyOne.decidable).toBe(false);
    expect(onlyOne.winners).toEqual([]);
  });

  it("weighted overall uses normalised category weights and documented tie-breakers; identical ratings share rank 1", () => {
    const c = cfg();
    const scores = allCategoryScores(eight, c);
    const overall = weightedOverall(eight, scores, c);
    expect(overall.get("p1")!.score).toBeCloseTo(overall.get("p7")!.score!, 9);
    const ranking = overallRanking(eight, scores, categoryRankings(scores, c), c);
    const top = ranking.entries.filter((e) => e.rank === 1).map((e) => e.participantId);
    expect(top.length).toBeGreaterThanOrEqual(2); // duplicate ratings cannot be separated
    expect(ranking.winnerIds).toEqual(top);
    expect(ranking.entries.map((e) => e.rank)).toEqual([...ranking.entries.map((e) => e.rank)].sort((a, b) => (a ?? 99) - (b ?? 99)));
    // category winners are independent of the weights
    const heavy = cfg({ categories: DEFAULT_CATEGORIES.map((x) => ({ ...x, weight: x.id === "eyeArea" ? 100 : 0 })) });
    expect(categoryRankings(allCategoryScores(eight, heavy), heavy).map((r) => r.winners)).toEqual(categoryRankings(scores, c).map((r) => r.winners));
  });

  it("comparisons are symmetric (no left/right bias)", () => {
    const c = cfg();
    const scores = allCategoryScores(eight, c);
    const overall = weightedOverall(eight, scores, c);
    for (const a of eight) for (const b of eight) {
      const ab = compareParticipants(a.id, b.id, eight, scores, overall, c);
      const ba = compareParticipants(b.id, a.id, eight, scores, overall, c);
      expect(ab.winner).toBe(ba.winner);
      expect(ab.decidedBy).toBe(ba.decidedBy);
      expect(ab.margin).toBeCloseTo(ba.margin, 9);
    }
    const t = compareParticipants("p1", "p7", eight, scores, overall, c);
    expect(t.winner).toBeNull();
    expect(t.decidedBy).toBe("tied");
    // tie-breaker 1: identical criteria (same weighted score) but a different overall face score
    const lowerFace: RatingResult = { ...R.ai, score: R.ai.score! - 0.8 };
    const pair = [P("x", R.ai), P("y", lowerFace)];
    const noOverall = cfg({ categories: DEFAULT_CATEGORIES.map((x) => ({ ...x, weight: x.id === "overallFace" ? 0 : 1 })) });
    const ps = allCategoryScores(pair, noOverall);
    const po = weightedOverall(pair, ps, noOverall);
    const tb1 = compareParticipants("x", "y", pair, ps, po, noOverall);
    expect(tb1.decidedBy).toBe("tb1_overallFace");
    expect(tb1.winner).toBe("x");
    // tie-breaker 3: identical scores, better data completeness wins
    const lessCoverage: RatingResult = { ...R.ai, coverage: R.ai.coverage - 0.2 };
    const pair3 = [P("x", R.ai), P("y", lessCoverage)];
    const ps3 = allCategoryScores(pair3, c);
    const tb3 = compareParticipants("y", "x", pair3, ps3, weightedOverall(pair3, ps3, c), c);
    expect(tb3.decidedBy).toBe("tb3_coverage");
    expect(tb3.winner).toBe("x");
  });
});

describe("knockout brackets", () => {
  it("builds brackets with byes for non-power-of-two sizes", () => {
    for (const n of [4, 5, 6, 7, 8, 12, 16, 17, 32, 64]) {
      const ids = Array.from({ length: n }, (_, i) => `x${i + 1}`);
      const b = buildBracket(ids);
      const size = 2 ** Math.ceil(Math.log2(n));
      expect(b.size).toBe(size);
      expect(b.byes).toBe(size - n);
      expect(b.rounds[0].filter((m) => m.status === "bye")).toHaveLength(size - n);
      expect(b.rounds).toHaveLength(Math.log2(size));
      const placed = b.rounds[0].flatMap((m) => [m.a, m.b]).filter(Boolean);
      expect(new Set(placed).size).toBe(n);
      if (size > n) expect(b.rounds[0][0].a).toBe("x1"); // top seed gets the first bye
    }
    expect(roundName(0, 3)).toBe("quarterfinal");
    expect(roundName(2, 3)).toBe("final");
  });

  it("plays a 5-participant knockout round by round, blocks on ties and accepts manual decisions", () => {
    const c = cfg({ format: "knockout", seeding: "manual" });
    let state = initialState(five, c, "2026-01-01T00:00:00.000Z");
    expect(state.bracket!.size).toBe(8);
    expect(state.bracket!.byes).toBe(3);
    let res = step(state, five, c, "2026-01-01T00:01:00.000Z");
    state = res.state;
    expect(state.currentRound).toBe(1);
    // round 0 had one real match (p4 vs p5) ⇒ decided or tied
    const real = state.bracket!.rounds[0].filter((m) => m.status !== "bye");
    expect(real).toHaveLength(1);
    let guard = 0;
    while (!res.done && guard++ < 10) {
      res = step(state, five, c, "2026-01-01T00:02:00.000Z");
      state = res.state;
      if (res.blocked) {
        const tied = state.bracket!.rounds[state.currentRound].find((m) => m.status === "tied")!;
        expect(tied.a && tied.b).toBeTruthy();
        state = resolveTiedMatch(state, tied.id, tied.a!);
        expect(state.bracket!.rounds[state.currentRound].find((m) => m.id === tied.id)!.status).toBe("manual");
      }
    }
    expect(res.done).toBe(true);
    expect(state.phase).toBe("done");
    expect(state.bracket!.championId).toBeTruthy();
    const results = computeResults(five, c, state, "2026-01-01T00:03:00.000Z");
    expect(results.knockoutChampionId).toBe(state.bracket!.championId);
    expect(results.officialMethod).toBe("weighted");
    expect(results.stats.matches).toBe(4); // 8-slot bracket: 7 matches minus 3 byes
    expect(results.stats.participants).toBe(5);
    const ko = computeResults(five, cfg({ format: "knockout", winnerMethod: "knockout" }), state, "2026-01-01T00:03:00.000Z");
    expect(ko.officialWinnerIds).toEqual([state.bracket!.championId]);
  });

  it("random seeding is deterministic for a seed and the swap of two participants does not change who wins", () => {
    const c = cfg({ format: "knockout", seeding: "random", randomSeed: 7 });
    const a = initialState(eight, c, "t");
    const b = initialState(eight, c, "t");
    expect(a.bracket!.rounds[0].map((m) => [m.a, m.b])).toEqual(b.bracket!.rounds[0].map((m) => [m.a, m.b]));
    const swapped = [...eight];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    const r1 = computeResults(eight, cfg(), initialState(eight, cfg(), "t"), "t");
    const r2 = computeResults(swapped, cfg(), initialState(swapped, cfg(), "t"), "t");
    expect(r1.overallWinnerIds.sort()).toEqual(r2.overallWinnerIds.sort());
    expect(r1.categoryRankings.map((x) => x.winners.sort())).toEqual(r2.categoryRankings.map((x) => x.winners.sort()));
  });
});

describe("group stage and ranking formats", () => {
  it("splits 7 participants into balanced groups, plays round-robin and qualifies to a finals bracket", () => {
    const seven = eight.slice(0, 7);
    const groups = buildGroups(seven.map((p) => p.id), 4);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.participantIds.length).sort()).toEqual([3, 4]);
    expect(groups.reduce((s, g) => s + g.fixtures.length, 0)).toBe(3 + 6); // n(n−1)/2 each
    const c = cfg({ format: "group", groupSize: 4, qualifyPerGroup: 2 });
    let state = initialState(seven, c, "t0");
    expect(state.phase).toBe("groups");
    let res = step(state, seven, c, "t1");
    state = res.state;
    expect(state.phase).toBe("knockout");
    for (const g of state.groups!) {
      expect(g.table.reduce((s, r) => s + r.played, 0)).toBe(g.fixtures.length * 2);
      expect(g.qualified).toHaveLength(2);
      expect(g.table[0].points).toBeGreaterThanOrEqual(g.table[g.table.length - 1].points);
    }
    expect(state.bracket!.size).toBe(4);
    let guard = 0;
    while (!res.done && guard++ < 10) {
      res = step(state, seven, c, "t2");
      state = res.state;
      if (res.blocked) {
        const tied = state.bracket!.rounds[state.currentRound].find((m) => m.status === "tied")!;
        state = resolveTiedMatch(state, tied.id, tied.b!);
      }
    }
    expect(state.phase).toBe("done");
    const results = computeResults(seven, c, state, "t3");
    expect(results.stats.matches).toBe(9 + 3);
    expect(results.knockoutChampionId).toBeTruthy();
  });

  it("ranking and category formats complete in one step and keep category winners independent of the overall", () => {
    const c = cfg({ format: "category" });
    const res = step(initialState(eight, c, "t0"), eight, c, "t1");
    expect(res.done).toBe(true);
    const results = computeResults(eight, c, res.state, "t2");
    expect(results.overall.filter((e) => e.rank === 1).length).toBeGreaterThanOrEqual(1);
    expect(results.stats.decidableCategories).toBeGreaterThan(0);
    expect(results.stats.mostCategoryWins.length).toBeGreaterThan(0);
    expect(results.stats.highestSingleScore).not.toBeNull();
    const winners = new Set(results.categoryRankings.flatMap((r) => r.winners));
    for (const e of results.overall) if (e.categoryWins.length) expect(winners.has(e.participantId)).toBe(true);
  });
});
