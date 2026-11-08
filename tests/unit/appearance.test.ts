import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { computeAppearance, JAW, MALAR, measureImageAppearance, SUBMALAR, type LuminanceSampler } from "@/engine/appearance";
import { rateFace, SELF_ASSESSMENT_WEIGHTING } from "@/engine/psl/rating";
import { buildStandardScale, snapshotScale } from "@/engine/psl/scale";
import type { Point } from "@/engine/types";
import { analysisInputSchema, createRatingSchema } from "@/server/schemas";
import { alignMesh } from "@/engine/landmarks/mesh-map";
import { inputFromFixture, loadFixture } from "./helpers";

const scale = snapshotScale(buildStandardScale());
const fixture = loadFixture("ai-face");
const input = inputFromFixture(fixture);
const mesh: Point[] = input.mesh;

/** Convex hull (monotone chain) of the mesh, counter-clockwise. */
function hull(pts: Point[]): Point[] {
  const p = [...pts].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower: Point[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Point[] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}
const H = hull(mesh.slice(0, 468));
/** signed distance to the face hull: positive inside */
function inside(x: number, y: number) {
  let d = Infinity;
  for (let i = 0; i < H.length; i++) {
    const a = H[i];
    const b = H[(i + 1) % H.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    d = Math.min(d, ((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)) / len);
  }
  return d;
}
const centroid = (ids: readonly number[]) => ({ x: ids.reduce((s, i) => s + mesh[i].x, 0) / ids.length, y: ids.reduce((s, i) => s + mesh[i].y, 0) / ids.length });
const ipd = Math.hypot(mesh[468].x - mesh[473].x, mesh[468].y - mesh[473].y);

/** Synthetic photo: face (with a soft vertical gradient) on a dark background, optional lit cheekbones. */
function image({ edgeWidth, malarLight }: { edgeWidth: number; malarLight: number }): LuminanceSampler {
  const lit = [centroid(MALAR.R), centroid(MALAR.L)];
  return (x, y) => {
    if (x < 0 || y < 0 || x >= fixture.width || y >= fixture.height) return null;
    const t = 1 / (1 + Math.exp(-inside(x, y) / edgeWidth));
    let face = 150 + 0.15 * (y - mesh[1].y);
    for (const c of lit) face += malarLight * Math.exp(-((x - c.x) ** 2 + (y - c.y) ** 2) / (2 * (0.18 * ipd) ** 2));
    return 30 + (face - 30) * t;
  };
}

describe("appearance measures (visual criteria: measured, shown, not scored)", () => {
  it("uses symmetric mesh regions and computes all six measures on a real mesh", () => {
    for (const [r, l] of [[JAW.R, JAW.L], [MALAR.R, MALAR.L], [SUBMALAR.R, SUBMALAR.L]] as const) {
      expect(r.length).toBe(l.length);
      const cr = centroid(r);
      const cl = centroid(l);
      expect(Math.sign(cr.x - mesh[1].x)).toBe(-Math.sign(cl.x - mesh[1].x));
    }
    const a = analyzeFace({ ...input, appearanceImage: { jawEdgeContrast: 1.5, malarContrast: 0.4 } });
    const m = Object.fromEntries(a.appearance!.map((x) => [x.id, x]));
    expect(m.EYE_LID_BALANCE.value).toBeGreaterThan(30);
    expect(m.EYE_LID_BALANCE.value).toBeLessThan(90);
    expect(m.EYE_LID_APEX.value).toBeGreaterThan(20);
    expect(m.EYE_LID_APEX.value).toBeLessThan(80);
    expect(m.LIP_BOW.value).toBeGreaterThan(0);
    expect(m.LIP_FULLNESS.value).toBeGreaterThan(5);
    expect(m.LIP_FULLNESS.value).toBeLessThan(60);
    expect(m.JAW_EDGE).toMatchObject({ value: 1.5, basis: "image", criterion: "jawlineDefinition" });
    expect(m.MALAR_SHADE).toMatchObject({ value: 0.4, criterion: "cheekboneProjection" });
  });

  it("never invents values: no pixels → image measures null; closed eyes → eye measures null", () => {
    const m = computeAppearance(alignMesh(mesh).aligned, null, { eyesOpen: false });
    expect(m.find((x) => x.id === "JAW_EDGE")!.value).toBeNull();
    expect(m.find((x) => x.id === "MALAR_SHADE")!.value).toBeNull();
    expect(m.find((x) => x.id === "EYE_LID_BALANCE")!.value).toBeNull();
    expect(computeAppearance(undefined).every((x) => x.value == null)).toBe(true);
  });

  it("jaw edge contrast is higher for a sharp face border than for a blurred one", () => {
    const sharp = measureImageAppearance(mesh, image({ edgeWidth: 0.3, malarLight: 0 }));
    const soft = measureImageAppearance(mesh, image({ edgeWidth: 0.25 * ipd, malarLight: 0 }));
    expect(sharp.jawEdgeContrast).not.toBeNull();
    expect(soft.jawEdgeContrast).not.toBeNull();
    expect(sharp.jawEdgeContrast!).toBeGreaterThan(soft.jawEdgeContrast! * 1.3);
  });

  it("malar contrast is positive for lit cheekbones and near zero for a flat face", () => {
    const lit = measureImageAppearance(mesh, image({ edgeWidth: 0.3, malarLight: 60 }));
    const flat = measureImageAppearance(mesh, image({ edgeWidth: 0.3, malarLight: 0 }));
    expect(lit.malarContrast!).toBeGreaterThan(0.3);
    expect(Math.abs(flat.malarContrast!)).toBeLessThan(lit.malarContrast! / 2);
  });

  it("returns null for a uniform image (no luminance spread) instead of a value", () => {
    expect(measureImageAppearance(mesh, () => 128)).toEqual({ jawEdgeContrast: null, malarContrast: null });
  });

  it("appearance measures never change the score", () => {
    const a = rateFace({ frontal: analyzeFace({ ...input, appearanceImage: { jawEdgeContrast: 3, malarContrast: 2 } }), scale });
    const b = rateFace({ frontal: analyzeFace({ ...input, appearanceImage: { jawEdgeContrast: 0.1, malarContrast: -1 } }), scale });
    expect(a.score).toBe(b.score);
    expect(a.appearance?.find((m) => m.id === "JAW_EDGE")?.value).toBe(3);
    expect(a.criteria.find((c) => c.id === "jawlineDefinition")!.assessable).toBe(false);
  });
});

describe("self-assessment of the visual criteria", () => {
  const frontal = analyzeFace(input);

  it("fills only the visual criteria, labelled, with half confidence/reliability and unchanged coverage", () => {
    const base = rateFace({ frontal, scale });
    const r = rateFace({ frontal, scale, selfAssessment: { eyeShape: 7, jawlineDefinition: 4.5, scleralShow: 10 } as never });
    const eye = r.criteria.find((c) => c.id === "eyeShape")!;
    expect(eye.assessable).toBe(true);
    expect(eye.source).toBe("self-assessment");
    expect(eye.score).toBeCloseTo(7, 9);
    expect(r.criteria.find((c) => c.id === "lipShape")!.assessable).toBe(false);
    // measured criteria are never overwritten by a self-assessment
    expect(r.criteria.find((c) => c.id === "scleralShow")!.source).toBe("frontal");
    expect(r.coverage).toBeCloseTo(base.coverage, 12);
    expect(r.warningCodes).toContain("selfAssessment");
    expect(eye.usedInputs).toContain("self-assessment");
    expect(eye.confidence).toBeLessThanOrEqual(0.5);
    expect(r.selfAssessment).toEqual({ eyeShape: 7, jawlineDefinition: 4.5 });
    expect(SELF_ASSESSMENT_WEIGHTING).toEqual({ confidence: 0.5, reliability: 0.5 });
    // the "no vision model" warning stays only while a visual criterion is still not assessable
    expect(r.warningCodes).toContain("noVisualProvider");
    const all = rateFace({ frontal, scale, selfAssessment: { eyeShape: 5, lipShape: 5, cheekboneProjection: 5, jawlineDefinition: 5 } });
    expect(all.warningCodes).not.toContain("noVisualProvider");
  });

  it("weighs less than a vision-model score of the same value", () => {
    const visual = { providerId: "t", modelVersion: "0", assessedAt: "2026-01-01", assessments: { eyeShape: { score: 10, confidence: 1 } } };
    const base = rateFace({ frontal, scale }).score!;
    const viaModel = rateFace({ frontal, scale, visual }).score!;
    const viaSelf = rateFace({ frontal, scale, selfAssessment: { eyeShape: 10 } }).score!;
    expect(Math.abs(viaSelf - base)).toBeLessThan(Math.abs(viaModel - base));
  });

  it("the vision model takes precedence over the self-assessment", () => {
    const visual = { providerId: "t", modelVersion: "0", assessedAt: "2026-01-01", assessments: { eyeShape: { score: 3, confidence: 0.8 } } };
    const r = rateFace({ frontal, scale, visual, selfAssessment: { eyeShape: 9, lipShape: 6 } });
    expect(r.criteria.find((c) => c.id === "eyeShape")).toMatchObject({ source: "visual-model", score: 3 });
    expect(r.criteria.find((c) => c.id === "lipShape")!.source).toBe("self-assessment");
  });

  it("clamps out-of-range values and the API schema rejects them", () => {
    expect(rateFace({ frontal, scale, selfAssessment: { eyeShape: 14 } }).criteria.find((c) => c.id === "eyeShape")!.score).toBe(10);
    const ok = { consent: { rightsConfirmed: true, adultsConfirmed: true }, analysisId: "a" };
    expect(createRatingSchema.safeParse({ ...ok, selfAssessment: { eyeShape: 5 } }).success).toBe(true);
    expect(createRatingSchema.safeParse({ ...ok, selfAssessment: { eyeShape: 11 } }).success).toBe(false);
    expect(createRatingSchema.safeParse({ ...ok, selfAssessment: { scleralShow: 5 } }).success).toBe(false);
    expect(analysisInputSchema.safeParse({ ...input, appearanceImage: { jawEdgeContrast: 1, malarContrast: null } }).success).toBe(true);
  });
});
