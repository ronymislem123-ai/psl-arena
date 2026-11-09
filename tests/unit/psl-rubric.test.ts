import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { AGGREGATION_P, AREA_META, calibrate, calibrationSlope, CALIBRATION_ANCHORS, CATEGORY_WEIGHTS, CRITERIA, CRITERION_BY_ID, DEFAULT_MIN_COVERAGE, DESCRIPTIVE_RATIOS, measureReliability, RUBRIC_AREAS, RUBRIC_VERSION, totalWeight, uncalibrate } from "@/engine/psl/rubric";
import { aggregateHierarchy, frontalMeasures, measureKeys, powerMean, type MeasureMap } from "@/engine/scoring/hierarchy";
import { evidenceOf } from "@/engine/scoring/measurement";
import { pslDecimals, rateFace, ratingSummary } from "@/engine/psl/rating";
import { buildStandardScale, snapshotScale } from "@/engine/psl/scale";
import { RATIO_DEFINITIONS } from "@/engine/ratios/database";
import { analyzeSideView, SIDE_DEFINITIONS } from "@/engine/side-view";
import { inputFromFixture, loadFixture } from "./helpers";
import { PROFILE } from "./side-view.test";

const scale = snapshotScale(buildStandardScale());

describe("rubric definition", () => {
  it("category weights sum to 100 and every active category has criteria", () => {
    expect(RUBRIC_VERSION).toBe("2.2.0");
    expect(totalWeight()).toBe(100);
    expect(RUBRIC_AREAS).toEqual(["eye", "proportions", "bone", "nose", "mouth", "symmetry", "forehead"]);
    for (const a of RUBRIC_AREAS) {
      expect(CATEGORY_WEIGHTS[a], a).toBeGreaterThan(0);
      expect(CRITERIA.some((c) => c.area === a), a).toBe(true);
      expect(AREA_META[a].legacy).toBeFalsy();
    }
    for (const c of CRITERIA) {
      expect(c.weight).toBe(1);
      expect(c.legacy).toBeFalsy();
      expect(RUBRIC_AREAS).toContain(c.area);
      expect(c.definition.length).toBeGreaterThan(10);
      expect(c.limitations.length).toBeGreaterThan(0);
      if (c.method === "visual") expect(Object.keys(c.inputs)).toHaveLength(0);
      else expect(measureKeys(c).length).toBeGreaterThan(0);
    }
  });
  it("assigns every engine quantity to at most one criterion (no double counting)", () => {
    const seen = new Map<string, string>();
    for (const c of CRITERIA) {
      for (const k of measureKeys(c)) {
        expect(seen.has(k), `${k} used by ${seen.get(k)} and ${c.id}`).toBe(false);
        seen.set(k, c.id);
      }
    }
    // every measurable frontal ratio is either scored by exactly one criterion or explicitly descriptive
    const descriptive = new Set(DESCRIPTIVE_RATIOS.map((d) => d.id));
    for (const r of RATIO_DEFINITIONS.filter((r) => r.status !== "incomplete")) {
      expect(seen.has(`r:${r.id}`) !== descriptive.has(r.id), r.id).toBe(true);
      expect(evidenceOf(r.id).status === "contradicted" || evidenceOf(r.id).status === "constructMismatch", r.id).toBe(descriptive.has(r.id));
    }
    for (const d of SIDE_DEFINITIONS.filter((d) => d.range)) expect(seen.has(`p:${d.id}`), d.id).toBe(true);
    expect(seen.get("a:EML")).toBe("eyeMouthLength");
    expect(seen.get("a:FIFTHS")).toBe("facialFifths");
  });
  it("keeps rubric 1.0 ids for stored ratings without scoring them", () => {
    for (const id of ["areaBalance", "verticalBalance", "fwhr", "jawHeightRatio"] as const) {
      expect(CRITERION_BY_ID[id].legacy).toBe(true);
      expect(CRITERIA.some((c) => c.id === id)).toBe(false);
    }
    expect(AREA_META.midface.legacy).toBe(true);
    expect(AREA_META.harmony.legacy).toBe(true);
  });
  it("calibration is linear, monotone, bounded and invertible", () => {
    expect(CALIBRATION_ANCHORS).toEqual([[0, 0], [100, 10]]);
    expect(calibrate(0)).toBe(0);
    expect(calibrate(55)).toBeCloseTo(5.5, 12);
    expect(calibrate(100)).toBe(10);
    expect(calibrate(200)).toBe(10);
    expect(calibrate(-5)).toBe(0);
    for (let i = 0; i <= 100; i += 0.5) expect(uncalibrate(calibrate(i))).toBeCloseTo(i, 9);
    expect(calibrationSlope(10)).toBeCloseTo(0.1, 12);
    expect(calibrationSlope(90)).toBeCloseTo(0.1, 12);
  });
  it("reliability weights follow the documented landmark reliabilities", () => {
    expect(measureReliability(["pupil_R", "pupil_L"])).toBe(1);
    expect(measureReliability(["gonion_R", "zygion_L"])).toBe(0.4);
    expect(measureReliability(["zygion_R", "zygion_L"])).toBe(0.75);
    expect(measureReliability(["trichion", "menton"])).toBe(0.6);
  });
});

describe("non-compensatory aggregation", () => {
  const all = (x: number): MeasureMap => {
    const m: MeasureMap = new Map();
    for (const c of CRITERIA) for (const k of measureKeys(c)) if (!k.startsWith("v:") && !k.startsWith("p:")) m.set(k, { index: x, confidence: 1, reliability: 1, weight: 1, source: "frontal" });
    return m;
  };
  it("returns the common value when every measure agrees", () => {
    for (const x of [0, 12.5, 50, 87, 100]) expect(aggregateHierarchy(all(x)).overall).toBeCloseTo(x, 9);
  });
  it("is monotone in every measure", () => {
    const base = all(60);
    const h0 = aggregateHierarchy(base).overall!;
    for (const k of base.keys()) {
      const up = new Map(base);
      up.set(k, { ...base.get(k)!, index: 90 });
      expect(aggregateHierarchy(up).overall!, k).toBeGreaterThan(h0);
    }
  });
  it("never exceeds the arithmetic mean and penalises unbalanced profiles", () => {
    // one excellent category (eyes = 100) cannot offset weak others (40) one-to-one
    const m = all(40);
    for (const c of CRITERIA.filter((c) => c.area === "eye")) for (const k of measureKeys(c)) if (m.has(k)) m.set(k, { ...m.get(k)!, index: 100 });
    const h = aggregateHierarchy(m);
    expect(h.overallArithmetic!).toBeCloseTo(0.25 * 100 + 0.75 * 40, 6);
    expect(h.overall!).toBeLessThan(h.overallArithmetic!);
    expect(h.compensationPenalty!).toBeGreaterThan(2);
    // balanced face with the same arithmetic mean scores higher than the unbalanced one
    expect(aggregateHierarchy(all(h.overallArithmetic!)).overall!).toBeGreaterThan(h.overall!);
  });
  it("power mean: p = 1 is the arithmetic mean, smaller p is stricter", () => {
    const items = [{ x: 90, w: 1 }, { x: 30, w: 1 }];
    expect(powerMean(items, 1)).toBeCloseTo(60, 12);
    expect(powerMean(items, AGGREGATION_P)!).toBeLessThan(60);
    expect(powerMean(items, 0.25)!).toBeLessThan(powerMean(items, 0.5)!);
    expect(powerMean([], 0.5)).toBeNull();
  });
});

describe("rating engine on real fixtures", () => {
  const frontal = analyzeFace(inputFromFixture(loadFixture("ai-face")));
  const side = analyzeSideView(PROFILE);

  it("rates a frontal analysis with documented coverage and a tier on the scale", () => {
    const r = rateFace({ frontal, scale });
    expect(r.rubricVersion).toBe("2.2.0");
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThan(0);
    expect(r.score!).toBeLessThan(10);
    expect(r.tier).not.toBeNull();
    expect(r.tier!.min).toBeLessThanOrEqual(r.score!);
    expect(r.score!).toBeLessThan(r.tier!.max + 1e-9);
    // coverage = category-weighted share of the non-visual criteria; profile criteria are missing
    const h = aggregateHierarchy(frontalMeasures(frontal.ratios, frontal.symmetry, frontal.additional));
    expect(r.coverage).toBeCloseTo(h.coverage, 12);
    expect(r.coverage).toBeGreaterThan(DEFAULT_MIN_COVERAGE);
    expect(r.coverage).toBeLessThan(0.9);
    expect(r.valid).toBe(true);
    expect(r.provisional).toBe(false);
    expect(r.minCoverage).toBe(DEFAULT_MIN_COVERAGE);
    const sum = ratingSummary(r);
    expect(sum.total).toBe(CRITERIA.length);
    expect(r.notAssessable.filter((n) => n.code === "requiresProfile").length).toBeGreaterThanOrEqual(7);
    // rubric 2.1: two former visual criteria are measured; four remain visual-model only
    expect(r.notAssessable.filter((n) => n.code === "visualNotConfigured")).toHaveLength(4);
    expect(r.warningCodes).toContain("noProfile");
    expect(r.warningCodes).toContain("noVisualProvider");
    // overall = calibrated weighted power mean of the category indices
    const cats = r.areas.filter((a) => a.index != null);
    const pm = Math.pow(cats.reduce((s, a) => s + a.weight * Math.pow(a.index!, AGGREGATION_P), 0) / cats.reduce((s, a) => s + a.weight, 0), 1 / AGGREGATION_P);
    expect(r.aggregation!.overallIndex).toBeCloseTo(pm, 9);
    expect(r.score).toBeCloseTo(calibrate(pm), 9);
    expect(r.aggregation!.compensationPenalty!).toBeGreaterThanOrEqual(0);
    // the frontal analysis reports the same model
    expect(frontal.scores.overall).toBeCloseTo(pm, 9);
    expect(frontal.scores.rubric!.version).toBe("2.2.0");
    // Monte-Carlo σ through the whole aggregation, and the precision it justifies
    expect(r.aggregation!.mcSamples).toBe(frontal.config.uncertaintySamples);
    expect(r.scoreSigma!).toBeGreaterThan(0);
    expect(r.scoreSigma!).toBeLessThan(2);
    expect(r.displayDecimals).toBe(pslDecimals(r.scoreSigma));
    expect(r.tierUncertainty!).toBeGreaterThanOrEqual(0);
    expect(r.tierUncertainty!).toBeLessThanOrEqual(1);
    for (const a of r.areas.filter((a) => a.score != null)) expect(a.sigma!).toBeGreaterThanOrEqual(0);
    // descriptive (unscored) measures are reported with their reason
    expect(r.descriptive!.map((d) => d.id)).toEqual(DESCRIPTIVE_RATIOS.map((d) => d.id));
    expect(r.criteria.some((c) => c.usedInputs.includes("FWHR") || c.usedInputs.includes("JWHR"))).toBe(false);
  });

  it("adds the profile criteria when a side-view analysis is supplied", () => {
    const base = rateFace({ frontal, scale });
    const r = rateFace({ frontal, side, scale });
    expect(r.coverage).toBeGreaterThan(base.coverage + 0.1);
    expect(r.coverage).toBeLessThanOrEqual(1);
    expect(r.criteria.find((c) => c.id === "gonialAngle")!.assessable).toBe(true);
    expect(r.criteria.find((c) => c.id === "gonialAngle")!.source).toBe("profile");
    expect(r.criteria.find((c) => c.id === "lipChinVertical")!.source).toBe("mixed");
    expect(r.quality.sideUsed).toBe(true);
    expect(r.warningCodes).not.toContain("noProfile");
    // an unusable side view contributes nothing
    const bad = analyzeSideView({ ...PROFILE, subnasale: { x: 516, y: 350 } });
    expect(rateFace({ frontal, side: bad, scale }).coverage).toBeCloseTo(base.coverage, 12);
  });

  it("becomes provisional below the minimum coverage and respects the configurable threshold", () => {
    const noHair = analyzeFace(inputFromFixture(loadFixture("ai-face"), { trichion: null }));
    const r = rateFace({ frontal: noHair, scale });
    const base = rateFace({ frontal, scale });
    expect(r.coverage).toBeLessThan(base.coverage);
    expect(r.criteria.find((c) => c.id === "eyeMouthLength")!.assessable).toBe(false);
    const strictNoHair = rateFace({ frontal: noHair, scale, minCoverage: 0.78 });
    expect(strictNoHair.provisional).toBe(true);
    expect(strictNoHair.valid).toBe(false);
    expect(strictNoHair.score).not.toBeNull();
    expect(strictNoHair.warningCodes).toContain("lowCoverage");
    const strict = rateFace({ frontal, scale, minCoverage: 0.9 });
    expect(strict.provisional).toBe(true);
    const strictSide = rateFace({ frontal, side, scale, minCoverage: 0.9 });
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
    const visual = { providerId: "test", modelVersion: "0", assessedAt: "2026-01-01", assessments: { eyeShape: { score: 8, confidence: 0.6 }, lipShape: { score: 2.5, confidence: 0.9 } } };
    const r = rateFace({ frontal, visual, scale });
    const u = r.criteria.find((c) => c.id === "eyeShape")!;
    expect(u.assessable).toBe(true);
    expect(u.source).toBe("visual-model");
    expect(u.score).toBeCloseTo(8, 9);
    // visual criteria never change the coverage of the geometric rubric
    expect(r.coverage).toBeCloseTo(rateFace({ frontal, scale }).coverage, 12);
    expect(r.quality.visualUsed).toBe(true);
    expect(rateFace({ frontal, visual: { ...visual, assessments: { eyeShape: { score: 14, confidence: 1 } } }, scale }).criteria.find((c) => c.id === "eyeShape")!.score).toBe(10);
    // measured eyelid criteria are not taken from a model
    expect(r.criteria.find((c) => c.id === "scleralShow")!.source).toBe("frontal");
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
