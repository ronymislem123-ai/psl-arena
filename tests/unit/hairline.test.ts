import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { checkHairline, hairlineCoveredThreshold, upperThirdShare } from "@/engine/hairline-check";
import { rateFace } from "@/engine/psl/rating";
import { buildStandardScale, snapshotScale } from "@/engine/psl/scale";
import { inputFromFixture, loadFixture } from "./helpers";

const scale = snapshotScale(buildStandardScale());
const base = inputFromFixture(loadFixture("ai-face"));
const mesh = base.mesh;
const ipd = Math.hypot(mesh[468].x - mesh[473].x, mesh[468].y - mesh[473].y);
/** hairline point on the midline, d IPD above the mesh top */
const above = (d: number) => {
  const top = mesh[10];
  const me = mesh[152];
  const len = Math.hypot(top.x - me.x, top.y - me.y);
  return { x: top.x + ((top.x - me.x) / len) * d * ipd, y: top.y + ((top.y - me.y) / len) * d * ipd };
};
const HAIR_CRITERIA = ["foreheadHeight", "facialThirds", "eyeMouthLength"];

describe("hairline plausibility (hair over the forehead)", () => {
  it("threshold = reference centre − 3 between-person SD (≈ 23 %)", () => {
    expect(hairlineCoveredThreshold()).toBeGreaterThan(21);
    expect(hairlineCoveredThreshold()).toBeLessThan(25);
  });

  it("a natural hairline passes, a transition at the mesh top (fringe) does not", () => {
    const natural = upperThirdShare(mesh, above(0.6))!;
    expect(natural).toBeGreaterThan(hairlineCoveredThreshold());
    expect(natural).toBeLessThan(40);
    const fringe = checkHairline(mesh, above(0.02));
    expect(fringe.covered).toBe(true);
    expect(fringe.share!).toBeLessThan(hairlineCoveredThreshold());
    expect(checkHairline(mesh, null)).toEqual({ share: null, covered: false });
  });

  it("an estimated hairline on a fringe is not used: hairline measures not determinable, with the reason", () => {
    const a = analyzeFace({ ...base, trichion: { point: above(0.02), source: "estimated", confidence: 0.7 } });
    expect(a.landmarks.some((l) => l.id === "trichion")).toBe(false);
    expect(a.warningCodes?.map((w) => w.code)).toContain("hairlineCovered");
    expect(a.quality.issues.map((i) => i.code)).toContain("hairline-covered");
    expect(a.ratios.find((r) => r.id === "FT_U")!.availability).not.toBe("available");
    const r = rateFace({ frontal: a, scale });
    for (const id of HAIR_CRITERIA) expect(r.criteria.find((c) => c.id === id), id).toMatchObject({ assessable: false, notAssessableCode: "hairlineCovered" });
    // the hairline does not drag the score down any more: forehead height is simply missing
    expect(r.criteria.find((c) => c.id === "foreheadWidth")!.assessable).toBe(true);
  });

  it("a manually confirmed low hairline is kept but flagged", () => {
    const a = analyzeFace({ ...base, trichion: { point: above(0.02), source: "manual", confidence: 1 } });
    expect(a.landmarks.some((l) => l.id === "trichion")).toBe(true);
    expect(a.warningCodes?.map((w) => w.code)).toContain("hairlineLow");
  });

  it("no hairline at all → reason hairlineMissing, a plausible one → measured", () => {
    const none = rateFace({ frontal: analyzeFace({ ...base, trichion: null }), scale });
    expect(none.criteria.find((c) => c.id === "foreheadHeight")!.notAssessableCode).toBe("hairlineMissing");
    const ok = analyzeFace({ ...base, trichion: { point: above(0.6), source: "estimated", confidence: 0.7 } });
    expect(ok.warningCodes?.map((w) => w.code) ?? []).not.toContain("hairlineCovered");
    expect(rateFace({ frontal: ok, scale }).criteria.find((c) => c.id === "foreheadHeight")!.assessable).toBe(true);
  });
});
