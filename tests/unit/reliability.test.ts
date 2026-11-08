import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { analysisReliability, detectionGrade, RELIABILITY_LEVELS, SIGMA_THRESHOLDS_PSL } from "@/engine/quality/reliability";
import { DESCRIPTIVE_RATIOS } from "@/engine/psl/rubric";
import type { SemanticLandmark } from "@/engine/types";
import { inputFromFixture, loadFixture } from "./helpers";

const RANK = Object.fromEntries(RELIABILITY_LEVELS.map((l, i) => [l, i]));

describe("analysis reliability", () => {
  const good = analyzeFace(inputFromFixture(loadFixture("biden")));
  it("derives the level from the overall σ and lists every rule that applied", () => {
    const rel = analysisReliability(good);
    expect(RELIABILITY_LEVELS).toContain(rel.level);
    expect(rel.level).not.toBe("notEvaluable");
    const s = rel.reasons.find((r) => r.code === "sigma")!;
    expect(s.params!.sigma).toBeCloseTo(good.uncertainty!.overallSigma / 10, 9);
    const base = s.params!.sigma <= SIGMA_THRESHOLDS_PSL.veryHigh ? "veryHigh" : s.params!.sigma <= SIGMA_THRESHOLDS_PSL.high ? "high" : s.params!.sigma <= SIGMA_THRESHOLDS_PSL.moderate ? "moderate" : "low";
    // the final level is the worst of the base level and every cap
    const caps = rel.reasons.filter((r) => r.cap).map((r) => RANK[r.cap!]);
    expect(RANK[rel.level]).toBe(Math.max(RANK[base], ...caps));
    expect(rel.interval95![0]).toBeLessThan(good.scores.overall! / 10);
    expect(rel.interval95![1]).toBeGreaterThan(good.scores.overall! / 10);
  });
  it("reports every ratio, symmetry metric and scored additional measure once, with its use", () => {
    const rel = analysisReliability(good);
    const keys = rel.rows.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const d of DESCRIPTIVE_RATIOS) expect(rel.rows.find((r) => r.id === d.id)!.status).toBe("descriptive");
    expect(rel.rows.find((r) => r.id === "ESR")!.status).toBe("scored");
    expect(rel.rows.find((r) => r.id === "EML")!.status).toBe("scored");
    expect(rel.rows.filter((r) => r.kind === "symmetry")).toHaveLength(good.symmetry.metrics.length);
    const graded = rel.rows.filter((r) => r.detection && r.status !== "unavailable").length;
    expect(rel.counts.A + rel.counts.B + rel.counts.C + rel.counts.D).toBe(graded);
    // jaw ratios carry the documented low reliability
    expect(rel.rows.find((r) => r.id === "BIG")!.reliability).toBe(0.4);
    // yaw-sensitive widths are flagged for a turned head (biden: yaw ≈ 11°)
    expect(rel.rows.find((r) => r.id === "ESR")!.influences).toContain("yaw");
  });
  it("caps the level when the hairline is missing and marks unusable images as not evaluable", () => {
    const noHair = analysisReliability(analyzeFace(inputFromFixture(loadFixture("biden"), { trichion: null })));
    expect(noHair.reasons.some((r) => r.code === "noHairline" && r.cap === "moderate")).toBe(true);
    expect(RANK[noHair.level]).toBeGreaterThanOrEqual(RANK.moderate);
    const bad = analysisReliability(analyzeFace(inputFromFixture(loadFixture("ai-upper"))));
    expect(bad.level).toBe("notEvaluable");
    expect(bad.interval95).toBeNull();
    const noMc = analysisReliability(analyzeFace(inputFromFixture(loadFixture("biden"), { config: { includeReconstructed: true, captureDistance: "unknown", uncertaintySamples: 0, seed: 1 } })));
    expect(noMc.reasons.some((r) => r.code === "noUncertainty")).toBe(true);
    expect(RANK[noMc.level]).toBeGreaterThanOrEqual(RANK.moderate);
  });
  it("grades detection from the weakest landmark; estimated points are at most C", () => {
    const l = (confidence: number, source: SemanticLandmark["source"] = "model") => ({ confidence, source }) as SemanticLandmark;
    expect(detectionGrade([l(0.95), l(0.9)])).toBe("A");
    expect(detectionGrade([l(0.95), l(0.72)])).toBe("B");
    expect(detectionGrade([l(0.95), l(0.6)])).toBe("C");
    expect(detectionGrade([l(0.4)])).toBe("D");
    expect(detectionGrade([l(0.95), l(0.9, "estimated")])).toBe("C");
    expect(detectionGrade([])).toBeNull();
  });
});
