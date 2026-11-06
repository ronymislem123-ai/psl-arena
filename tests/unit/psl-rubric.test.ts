import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { calibrate, calibrationSlope, CALIBRATION_ANCHORS, CRITERIA, CRITERION_BY_ID, DEFAULT_MIN_COVERAGE, RUBRIC_AREAS, totalWeight } from "@/engine/psl/rubric";
import { rateFace, ratingSummary } from "@/engine/psl/rating";
import { buildStandardScale, snapshotScale } from "@/engine/psl/scale";
import { RATIO_DEFINITIONS } from "@/engine/ratios/database";
import { analyzeSideView, SIDE_DEFINITIONS } from "@/engine/side-view";
import { inputFromFixture, loadFixture } from "./helpers";
import { PROFILE } from "./side-view.test";

const scale = snapshotScale(buildStandardScale());

describe("rubric definition", () => {
  it("weights sum to 100 and every area is represented", () => {
    expect(totalWeight()).toBe(100);
    for (const a of RUBRIC_AREAS) expect(CRITERIA.some((c) => c.area === a), a).toBe(true);
    for (const c of CRITERIA) {
      expect(c.weight).toBeGreaterThan(0);
      expect(c.definition.length).toBeGreaterThan(10);
      expect(c.limitations.length).toBeGreaterThan(0);
      if (c.method === "visual") expect(Object.keys(c.inputs)).toHaveLength(0);
      else expect(c.inputs.derived || (c.inputs.ratios?.length ?? 0) + (c.inputs.symmetry?.length ?? 0) + (c.inputs.side?.length ?? 0) + (c.inputs.additional?.length ?? 0)).toBeTruthy();
    }
  });
  it("uses every engine quantity in at most one criterion (no double counting)", () => {
    const seen = new Map<string, string>();
    for (const c of CRITERIA) {
      for (const k of [...(c.inputs.ratios ?? []).map((r) => `ratio:${r}`), ...(c.inputs.symmetry ?? []).map((s) => `sym:${s}`), ...(c.inputs.side ?? []).map((s) => `side:${s}`), ...(c.inputs.additional ?? []).map((s) => `add:${s}`)]) {
        expect(seen.has(k), `${k} used by ${seen.get(k)} and ${c.id}`).toBe(false);
        seen.set(k, c.id);
      }
    }
    // every scorable frontal ratio and every scored side measurement is covered
    const scorable = RATIO_DEFINITIONS.filter((r) => r.status !== "incomplete").map((r) => r.id);
    for (const id of scorable) expect(seen.has(`ratio:${id}`), id).toBe(true);
    for (const d of SIDE_DEFINITIONS.filter((d) => d.range)) expect(seen.has(`side:${d.id}`), d.id).toBe(true);
  });
  it("calibration is monotone and bounded", () => {
    expect(calibrate(0)).toBe(0.5);
    expect(calibrate(100)).toBe(9.0);
    expect(calibrate(200)).toBe(9.0);
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = calibrate(i);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    for (const [x, y] of CALIBRATION_ANCHORS) expect(calibrate(x)).toBeCloseTo(y, 9);
    expect(calibrationSlope(10)).toBeCloseTo((2.5 - 0.5) / 30, 9);
  });
});

describe("rating engine on real fixtures", () => {
  const frontal = analyzeFace(inputFromFixture(loadFixture("ai-face")));
  const side = analyzeSideView(PROFILE);

  it("rates a frontal analysis with documented coverage and a tier on the scale", () => {
    const r = rateFace({ frontal, scale });
    expect(r.rubricVersion).toBe("1.0.0");
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThan(0);
    expect(r.score!).toBeLessThan(10);
    expect(r.tier).not.toBeNull();
    expect(r.tier!.min).toBeLessThanOrEqual(r.score!);
    expect(r.score!).toBeLessThan(r.tier!.max + 1e-9);
    expect(r.coverage).toBeCloseTo(0.72, 2); // all geometric frontal criteria (visual 8 % + profile 20 % missing)
    expect(r.valid).toBe(true);
    expect(r.provisional).toBe(false);
    expect(r.minCoverage).toBe(DEFAULT_MIN_COVERAGE);
    const sum = ratingSummary(r);
    expect(sum.total).toBe(CRITERIA.length);
    expect(r.notAssessable.filter((n) => n.code === "requiresProfile").length).toBeGreaterThanOrEqual(9);
    expect(r.notAssessable.filter((n) => n.code === "requiresVisualProvider")).toHaveLength(6);
    expect(r.warningCodes).toContain("noProfile");
    expect(r.warningCodes).toContain("noVisualProvider");
    // overall = weighted mean of assessable criterion scores
    const ass = r.criteria.filter((c) => c.assessable);
    const expected = ass.reduce((s, c) => s + c.weight * c.score!, 0) / ass.reduce((s, c) => s + c.weight, 0);
    expect(r.score).toBeCloseTo(expected, 9);
    expect(r.scoreSigma).toBeGreaterThan(0);
  });

  it("adds the profile criteria when a side-view analysis is supplied", () => {
    const r = rateFace({ frontal, side, scale });
    expect(r.coverage).toBeCloseTo(0.92, 2);
    expect(r.criteria.find((c) => c.id === "gonialAngle")!.assessable).toBe(true);
    expect(r.criteria.find((c) => c.id === "gonialAngle")!.source).toBe("profile");
    expect(r.quality.sideUsed).toBe(true);
    expect(r.warningCodes).not.toContain("noProfile");
    // an unusable side view contributes nothing
    const bad = analyzeSideView({ ...PROFILE, subnasale: { x: 516, y: 350 } });
    expect(rateFace({ frontal, side: bad, scale }).coverage).toBeCloseTo(0.72, 2);
  });

  it("becomes provisional below the minimum coverage and respects the configurable threshold", () => {
    const noHair = analyzeFace(inputFromFixture(loadFixture("ai-face"), { trichion: null }));
    const r = rateFace({ frontal: noHair, scale });
    expect(r.coverage).toBeLessThan(DEFAULT_MIN_COVERAGE);
    expect(r.provisional).toBe(true);
    expect(r.valid).toBe(false);
    expect(r.score).not.toBeNull();
    expect(r.warningCodes).toContain("lowCoverage");
    const strict = rateFace({ frontal, scale, minCoverage: 0.8 });
    expect(strict.provisional).toBe(true);
    const strictSide = rateFace({ frontal, side, scale, minCoverage: 0.8 });
    expect(strictSide.valid).toBe(true);
  });

  it("never scores an unusable frontal image", () => {
    const r = rateFace({ frontal: analyzeFace(inputFromFixture(loadFixture("ai-upper"))), scale });
    expect(r.score).toBeNull();
    expect(r.tier).toBeNull();
    expect(r.valid).toBe(false);
    expect(r.criteria.every((c) => !c.assessable)).toBe(true);
    expect(r.warningCodes).toContain("frontalUnusable");
  });

  it("uses visual assessments only when supplied and keeps them separate", () => {
    const visual = { providerId: "test", modelVersion: "0", assessedAt: "2026-01-01", assessments: { upperLidExposure: { score: 8, confidence: 0.6 }, scleralShow: { score: 2.5, confidence: 0.9 } } };
    const r = rateFace({ frontal, visual, scale });
    const u = r.criteria.find((c) => c.id === "upperLidExposure")!;
    expect(u.assessable).toBe(true);
    expect(u.source).toBe("visual-model");
    expect(u.score).toBe(8);
    expect(r.coverage).toBeCloseTo(0.75, 2);
    expect(rateFace({ frontal, visual: { ...visual, assessments: { upperLidExposure: { score: 14, confidence: 1 } } }, scale }).criteria.find((c) => c.id === "upperLidExposure")!.score).toBe(10);
  });

  it("is deterministic and strengths/lower-rated come from the criterion scores", () => {
    const a = rateFace({ frontal, side, scale });
    const b = rateFace({ frontal, side, scale });
    expect(a.score).toBe(b.score);
    expect(a.criteria.map((c) => c.score)).toEqual(b.criteria.map((c) => c.score));
    for (const s of a.strengths) expect(s.score).toBeGreaterThanOrEqual(6.5);
    for (const l of a.lowerRated) expect(l.score).toBeLessThan(5);
    for (const c of a.criteria) if (c.assessable) expect(CRITERION_BY_ID[c.id].area).toBe(c.area);
  });
});
