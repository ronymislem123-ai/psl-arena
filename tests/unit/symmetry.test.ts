import { describe, expect, it } from "vitest";
import { computeSymmetry } from "@/engine/scoring/symmetry";
import type { LandmarkMap, QualityReport, SemanticLandmark, SemanticLandmarkId } from "@/engine/types";

const q = (yaw = 0): QualityReport => ({
  level: "good", score: 0.95, metrics: [], issues: [], pose: { yaw, pitch: 0, roll: 0 },
  expression: { smile: 0, jawOpen: 0, blink: 0, browRaise: 0, browDown: 0, pucker: 0, squint: 0, neutrality: 1, level: "good" },
  captureDistance: "standard", faceCount: 1, faceWidthPx: 400, analyzable: true,
});

function lm(id: SemanticLandmarkId, x: number, y: number): SemanticLandmark {
  return { id, label: id, region: "eye", side: "mid", source: "model", precision: "high", raw: { x, y }, aligned: { x, y }, confidence: 1 };
}

function symmetricMap(dx = 0): LandmarkMap {
  const m: LandmarkMap = {};
  const pair = (r: SemanticLandmarkId, l: SemanticLandmarkId, x: number, y: number, dy = 0) => {
    m[r] = lm(r, -x, y);
    m[l] = lm(l, x + dx, y + dy);
  };
  pair("pupil_R", "pupil_L", 50, 0);
  pair("endocanthion_R", "endocanthion_L", 27, 3);
  pair("exocanthion_R", "exocanthion_L", 68, 2);
  pair("palpebrale_sup_R", "palpebrale_sup_L", 50, -5);
  pair("palpebrale_inf_R", "palpebrale_inf_L", 50, 6);
  pair("brow_apex_R", "brow_apex_L", 62, -28);
  pair("brow_medial_R", "brow_medial_L", 20, -18);
  pair("brow_lateral_R", "brow_lateral_L", 85, -14);
  pair("cheilion_R", "cheilion_L", 40, 100);
  pair("alare_R", "alare_L", 18, 60);
  pair("gonion_R", "gonion_L", 95, 120);
  pair("zygion_R", "zygion_L", 110, 20);
  pair("chin_corner_R", "chin_corner_L", 36, 185);
  m.pronasale = lm("pronasale", 0, 66);
  m.nasion = lm("nasion", 0, -4);
  m.subnasale = lm("subnasale", 0, 74);
  m.labrale_sup = lm("labrale_sup", 0, 94);
  m.menton = lm("menton", 0, 197);
  return m;
}

describe("symmetry", () => {
  it("scores a perfectly mirrored face at 100", () => {
    const r = computeSymmetry(symmetricMap(), q());
    expect(r.score).toBeCloseTo(100, 5);
    expect(r.metrics.length).toBeGreaterThan(10);
  });
  it("penalises an asymmetric mouth and jaw", () => {
    const m = symmetricMap();
    m.cheilion_L = lm("cheilion_L", 40, 108); // left corner 8px lower
    m.gonion_L = lm("gonion_L", 108, 120); // wider left jaw
    const r = computeSymmetry(m, q());
    expect(r.score!).toBeLessThan(97);
    expect(r.metrics.find((x) => x.id === "mouthCornerHeight")!.score).toBeLessThan(90);
  });
  it("lowers confidence with yaw", () => {
    expect(computeSymmetry(symmetricMap(), q(15)).confidence).toBeLessThan(computeSymmetry(symmetricMap(), q(0)).confidence);
  });
});
