import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { compareRatings, progressSeries, type CompareItem } from "@/engine/psl/compare";
import { rateFace, type RatingResult } from "@/engine/psl/rating";
import { CRITERIA } from "@/engine/psl/rubric";
import { buildStandardScale, snapshotScale } from "@/engine/psl/scale";
import { inputFromFixture, loadFixture, loadVerifiedInput } from "./helpers";

const scale = snapshotScale(buildStandardScale());
// engine 3.1: verified inputs (detection passes) → ratings that passed the quality control
const frontal = analyzeFace(loadVerifiedInput("portrait-a"));
const other = analyzeFace(loadVerifiedInput("portrait-b"));
const base = rateFace({ frontal, scale });
// a stored rating of the old method (rubric 2.x, front + profile): only the flag and score matter here
const withSide: RatingResult = { ...base, rubricVersion: base.rubricVersion, score: base.score! + 0.3, coverage: base.coverage - 0.2, quality: { ...base.quality, sideUsed: true } };
// an analysis without detection passes and without hairline: lower coverage, quality control only limited → provisional
const noHair = rateFace({ frontal: analyzeFace(inputFromFixture(loadFixture("obama"), { trichion: null })), scale });
const otherRating = rateFace({ frontal: other, scale });
const item = (id: string, result: RatingResult, createdAt: string, label = id): CompareItem => ({ id, label, createdAt, result });

describe("compareRatings", () => {
  it("needs two ratings and reports identical ratings with zero deltas and no warnings", () => {
    expect(() => compareRatings([item("a", base, "2026-01-01")])).toThrow(/two/);
    const c = compareRatings([item("a", base, "2026-01-01"), item("b", base, "2026-01-02")]);
    expect(c.comparable).toBe(true);
    expect(c.warnings).toEqual([]);
    expect(c.scoreDeltas).toEqual([0, 0]);
    expect(c.criteria).toHaveLength(CRITERIA.length);
    expect(c.criteria.every((r) => r.deltas.every((d) => d === 0 || d === null))).toBe(true);
    expect(c.gains).toEqual([]);
    expect(c.losses).toEqual([]);
    expect(c.commonCriteria).toBe(base.criteria.filter((x) => x.assessable).length);
    expect(c.areas).toHaveLength(7);
  });

  it("computes deltas against the reference column and lists gains/losses of the last item", () => {
    const c = compareRatings([item("a", otherRating, "2026-01-01"), item("b", base, "2026-01-02")]);
    expect(c.scoreDeltas[0]).toBe(0);
    expect(c.scoreDeltas[1]).toBeCloseTo(base.score! - otherRating.score!, 9);
    const row = c.criteria.find((r) => r.id === "canthalTilt")!;
    const a = otherRating.criteria.find((x) => x.id === "canthalTilt")!.score!;
    const b = base.criteria.find((x) => x.id === "canthalTilt")!.score!;
    expect(row.values).toEqual([a, b]);
    expect(row.deltas[1]).toBeCloseTo(b - a, 9);
    expect(row.spread).toBeCloseTo(Math.abs(b - a), 9);
    for (const g of c.gains) expect(g.deltas[1]!).toBeGreaterThan(0.05);
    for (const l of c.losses) expect(l.deltas[1]!).toBeLessThan(-0.05);
    expect(c.gains.length + c.losses.length).toBeGreaterThan(0);
    const sorted = [...c.gains].map((g) => g.deltas[1]!);
    expect(sorted).toEqual([...sorted].sort((x, y) => y - x));
  });

  it("flags coverage, profile-view and provisional differences", () => {
    const c = compareRatings([item("a", base, "2026-01-01"), item("b", withSide, "2026-01-02"), item("c", noHair, "2026-01-03")]);
    const codes = c.warnings.map((w) => w.code);
    expect(codes).toContain("coverageDiffers");
    expect(codes).toContain("sideViewDiffers");
    expect(codes).toContain("provisional");
    expect(c.comparable).toBe(true);
    expect(c.commonCriteria).toBeLessThan(base.criteria.filter((x) => x.assessable).length);
  });

  it("marks different rubric/engine/scale versions and unusable ratings", () => {
    const old: RatingResult = { ...base, rubricVersion: "0.9.0", engineVersion: "0.9.0", scale: { ...base.scale, scaleId: "scale_other", name: "Other", version: 3 } };
    const dead: RatingResult = { ...base, score: null, tier: null, valid: false, criteria: base.criteria.map((x) => ({ ...x, assessable: false, score: null })) };
    const c = compareRatings([item("a", base, "2026-01-01"), item("b", old, "2026-01-02"), item("c", dead, "2026-01-03")]);
    const codes = c.warnings.map((w) => w.code);
    expect(codes).toEqual(expect.arrayContaining(["rubricVersion", "engineVersion", "scaleDiffers", "invalid"]));
    expect(c.comparable).toBe(false);
    expect(c.scoreDeltas[2]).toBeNull();
    expect(c.items[1].scaleName).toBe("Other");
  });
});

describe("progressSeries", () => {
  it("orders chronologically and reports totals, steps and the biggest criterion changes", () => {
    const s = progressSeries([item("c", withSide, "2026-03-01T00:00:00.000Z"), item("a", otherRating, "2026-01-01T00:00:00.000Z"), item("b", base, "2026-02-01T00:00:00.000Z")]);
    expect(s.points.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(s.first).toBe(otherRating.score);
    expect(s.latest).toBe(withSide.score);
    expect(s.best).toBe(Math.max(otherRating.score!, base.score!, withSide.score!));
    expect(s.totalDelta).toBeCloseTo(withSide.score! - otherRating.score!, 9);
    expect(s.steps).toHaveLength(2);
    expect(s.steps[0].days).toBeCloseTo(31, 6);
    expect(s.steps[0].comparable).toBe(true);
    expect(s.steps[0].scoreDelta).toBeCloseTo(base.score! - otherRating.score!, 9);
    expect(s.steps[0].biggestChanges.length).toBeLessThanOrEqual(3);
    const d = s.steps[0].biggestChanges.map((x) => Math.abs(x.delta));
    expect(d).toEqual([...d].sort((x, y) => y - x));
    expect(s.meanStep).toBeGreaterThan(0);
  });
  it("refuses deltas across rubric versions and handles a single rating", () => {
    const old: RatingResult = { ...base, rubricVersion: "0.9.0" };
    const s = progressSeries([item("a", old, "2026-01-01"), item("b", base, "2026-02-01")]);
    expect(s.totalDelta).toBeNull();
    expect(s.steps[0].comparable).toBe(false);
    expect(s.steps[0].scoreDelta).toBeNull();
    const one = progressSeries([item("a", base, "2026-01-01")]);
    expect(one.steps).toEqual([]);
    expect(one.totalDelta).toBeNull();
    expect(one.latest).toBe(base.score);
  });
});
