import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { MIRROR } from "@/engine/landmarks/canonical";
import { DESCRIPTIVE_RATIOS, RUBRIC_VERSION } from "@/engine/psl/rubric";
import { applyIdealParams, buildIdealModel, canonicalImageMesh, checkTargets, idealTargets, syntheticInput } from "@/engine/synth/ideal";
import { IDEAL_MESH, IDEAL_RUBRIC_VERSION, IDEAL_STATS, IDEAL_TRICHION } from "@/engine/synth/ideal-mesh.data";

const mesh = IDEAL_MESH.map(([x, y, z]) => ({ x, y, z }));

describe("ideal example geometry", () => {
  it("targets every scored frontal measure and none of the unscored ones", () => {
    const t = idealTargets();
    const ids = t.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of DESCRIPTIVE_RATIOS) expect(ids).not.toContain(d.id);
    expect(ids).toContain("EML");
    expect(ids).toContain("FIFTHS");
    for (const x of t) if (x.range.min != null && x.range.max != null && x.aim.min != null && x.aim.max != null) {
      expect(x.aim.min).toBeGreaterThanOrEqual(x.range.min);
      expect(x.aim.max).toBeLessThanOrEqual(x.range.max);
    }
  });

  it("the stored mesh belongs to the current rubric and meets the targets when measured directly", () => {
    expect(IDEAL_RUBRIC_VERSION).toBe(RUBRIC_VERSION);
    const r = analyzeFace(syntheticInput(mesh, IDEAL_TRICHION, 20));
    expect(r.quality.analyzable).toBe(true);
    const checks = checkTargets(r);
    const outside = checks.filter((c) => c.inRange === false);
    // everything inside its range except boundary cases (< 0.1 dispersion units) and the fifths (Gaussian around 0)
    for (const c of outside) expect(c.id === "FIFTHS" || Math.abs(c.z!) < 0.1, `${c.id} z=${c.z}`).toBe(true);
    expect(checks.filter((c) => c.inRange).length).toBeGreaterThanOrEqual(checks.length - 3);
    expect(r.scores.overall!).toBeGreaterThan(97);
    // perfectly symmetric by construction
    expect(r.symmetry.score!).toBeGreaterThan(99);
  });

  it("is a small, mirror-symmetric change of the canonical average face", () => {
    const base = canonicalImageMesh();
    expect(IDEAL_STATS.meanDisplacementIpd).toBeLessThan(0.05);
    const cx = (mesh[468].x + mesh[473].x) / 2;
    for (let i = 0; i < 468; i++) {
      const m = MIRROR[i];
      expect(mesh[i].x - cx + (mesh[m].x - cx)).toBeCloseTo(0, 1);
      expect(mesh[i].y).toBeCloseTo(mesh[m].y, 1);
      expect(mesh[i].z).toBeCloseTo(base[i].z, 1);
    }
    expect(IDEAL_TRICHION.y).toBeLessThan(mesh[10].y);
  });

  it("the deformation model keeps the midline straight and mirrors both halves", () => {
    const model = buildIdealModel();
    const params = Array.from({ length: model.centers.length * 2 + 1 }, (_, k) => ((k * 7919) % 13) / 1000 - 0.006);
    const { mesh: m } = applyIdealParams(model, params);
    const cx = (m[468].x + m[473].x) / 2;
    for (let i = 0; i < 468; i++) {
      if (MIRROR[i] === i) expect(m[i].x).toBeCloseTo(model.base[i].x, 9);
      else expect(m[i].x - cx + (m[MIRROR[i]].x - cx)).toBeCloseTo(0, 6);
    }
  });
});
