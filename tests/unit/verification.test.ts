/**
 * Engine 3.1 quality control: landmark verification over real detection passes,
 * correction / rejection of single landmarks, anatomical re-analysis, measurement
 * checks, the reject-and-re-analyse loop and the independent final control.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analyzeFace, computeCore } from "@/engine/analysis";
import { MESH_INDEX } from "@/engine/landmarks/mesh-map";
import { rateFace } from "@/engine/psl/rating";
import { RATIO_BY_ID } from "@/engine/ratios/database";
import { buildStandardScale, snapshotScale } from "@/engine/psl/scale";
import type { AnalysisInput, Point, QualityControl } from "@/engine/types";
import { finalControl, recomputeHierarchy, REPRO_PASS } from "@/engine/verify/control";
import { anatomyViolations, landmarkTolerance, TOL_MIN } from "@/engine/verify/landmarks";
import { checkMeasures, EXCLUDE_UNITS, UNSTABLE_UNITS, type MeasureCore } from "@/engine/verify/measures";
import { consensusMesh, median, trimmedSd, trimmedSpread } from "@/engine/verify/stats";
import { prepareVerification, runVerification } from "@/engine/verify/run";
import { analysisInputSchema } from "@/server/schemas";
import { loadVerifiedInput } from "./helpers";

const DIR = join(__dirname, "..", "fixtures", "verification");
const NAMES = readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
const scale = snapshotScale(buildStandardScale());

const ipdOf = (m: Point[]) => Math.hypot(m[473].x - m[468].x, m[473].y - m[468].y);
/** copy of an input with vertex `i` moved by (dx, dy) IPD in the selected meshes (0 = original, 1.. = passes) */
function moved(input: AnalysisInput, i: number, d: { dx: number; dy: number }, which: (k: number) => boolean): AnalysisInput {
  const u = ipdOf(input.mesh);
  const mv = (m: Point[]) => m.map((p, j) => (j === i ? { ...p, x: p.x + d.dx * u, y: p.y + d.dy * u } : p));
  return {
    ...input,
    mesh: which(0) ? mv(input.mesh) : input.mesh,
    verification: { ...input.verification!, passes: input.verification!.passes.map((p, k) => ({ ...p, mesh: which(k + 1) ? mv(p.mesh) : p.mesh })) },
  };
}
const status = (qc: QualityControl, id: string) => qc.landmarks.find((l) => l.id === id)!;

describe("robust statistics", () => {
  it("median, consensus mesh and trimmed spreads ignore one outlier", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    const m = consensusMesh([[{ x: 0, y: 0 }], [{ x: 2, y: 2 }], [{ x: 1, y: 1 }], [{ x: 100, y: -50 }]]);
    expect(m[0]).toEqual({ x: 1.5, y: 0.5 });
    const pts = [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 }, { x: 50, y: 50 }];
    expect(trimmedSpread(pts, { x: 0, y: 0 })).toBeCloseTo(Math.sqrt(2 / 3), 9); // the 50/50 outlier is dropped
    expect(trimmedSd([1, 1, 1, 1, 9])).toBe(0);
  });

  it("tolerances come from the measured repeatability (3σ × safety, at least 1.2 % IPD)", () => {
    expect(landmarkTolerance({ id: "pupil_R", meshIndex: 468 })).toBeGreaterThanOrEqual(TOL_MIN);
    expect(landmarkTolerance({ id: "gonion_R", meshIndices: [58, 172, 136] })).toBeGreaterThanOrEqual(landmarkTolerance({ id: "pupil_R", meshIndex: 468 }));
    expect(landmarkTolerance({ id: "trichion" })).toBeCloseTo(3 * 0.02 * 1.5, 9);
  });
});

describe("real detection passes (portraits A/B and the synthetic render)", () => {
  for (const name of NAMES) {
    it(`${name}: every landmark verified, measurements reproducible, quality control passed`, () => {
      const input = loadVerifiedInput(name);
      expect(input.verification!.passes).toHaveLength(5);
      const a = analyzeFace(input);
      const qc = a.qc!;
      expect(qc.status).toBe("passed");
      expect(qc.passes.used).toBe(6);
      expect(qc.landmarks.length).toBeGreaterThan(45);
      for (const l of qc.landmarks.filter((x) => x.status !== "manual")) {
        expect(l.status, l.id).toBe("confirmed");
        expect(l.spread!, l.id).toBeLessThanOrEqual(l.tolerance);
        expect(l.passes, l.id).toBe(6);
      }
      expect(qc.measures.filter((m) => m.status === "implausible")).toEqual([]);
      expect(qc.measures.filter((m) => m.status === "stable").length).toBeGreaterThanOrEqual(35);
      expect(qc.overallSpread!).toBeLessThanOrEqual(REPRO_PASS);
      expect(qc.checks.find((c) => c.id === "recompute")!.status).toBe("pass");
      expect(a.scores.overall).not.toBeNull();
      // the analysis is measured on the verified (median) mesh
      const ctx = prepareVerification(input)!;
      expect(a.mesh.raw[1].x).toBeCloseTo(median([input.mesh, ...input.verification!.passes.map((p) => p.mesh)].map((m) => m[1].x)), 9);
      expect(ctx.ids).toEqual(["original", "mirror", "rotPlus", "rotMinus", "zoom", "zoomMirror"]);
      // the rating built on it is valid
      const r = rateFace({ frontal: a, scale });
      expect(r.qcStatus).toBe("passed");
      expect(r.valid).toBe(true);
    });
  }
});

describe("single landmarks: corrected, uncertain, rejected, anatomically re-analysed", () => {
  const base = loadVerifiedInput("portrait-a");
  const ref = analyzeFace(base);
  const ct = (a: ReturnType<typeof analyzeFace>) => a.ratios.find((r) => r.id === "CT")!.value!;

  it("a misplaced point in the single detection is corrected to the agreeing passes and re-checked", () => {
    const ex = MESH_INDEX.exocanthion_R!;
    const a = analyzeFace(moved(base, ex, { dx: -0.08, dy: 0.05 }, (k) => k === 0));
    const l = status(a.qc!, "exocanthion_R");
    expect(l.status).toBe("corrected");
    expect(l.deviation!).toBeGreaterThan(l.tolerance);
    expect(l.agreement!).toBeGreaterThanOrEqual(0.5);
    expect(l.original).toBeTruthy();
    // the measurement uses the verified position: CT barely moves although the original point moved by 9 % IPD
    expect(Math.abs(ct(a) - ct(ref))).toBeLessThan(0.5);
    expect(a.qc!.checks.find((c) => c.id === "landmarks")!.status).toBe("note");
    expect(a.qc!.status).toBe("passed");
  });

  it("passes that disagree make a point uncertain (reduced confidence) or rejected (not used)", () => {
    const nt = MESH_INDEX.pronasale!;
    const unc = analyzeFace(moved(moved(base, nt, { dx: 0.05, dy: 0 }, (k) => k === 1 || k === 3), nt, { dx: -0.05, dy: 0.02 }, (k) => k === 2 || k === 4));
    expect(status(unc.qc!, "pronasale").status).toBe("uncertain");
    expect(unc.landmarks.find((l) => l.id === "pronasale")).toBeTruthy();

    const al = MESH_INDEX.alare_R!;
    const rej = analyzeFace(moved(moved(base, al, { dx: 0.2, dy: 0.1 }, (k) => k === 1 || k === 3), al, { dx: -0.2, dy: -0.15 }, (k) => k === 2 || k === 4));
    expect(status(rej.qc!, "alare_R").status).toBe("rejected");
    for (const id of ["N_BYZGO"] as const) {
      const r = rej.ratios.find((x) => x.id === id)!;
      expect(r.availability, id).toBe("unavailable");
      expect(r.unavailableCode, id).toBe("verification");
    }
  });

  it("anatomical rules: a point on the wrong side of a neighbour is re-analysed — corrected from a pass, otherwise rejected", () => {
    // subnasale above the nose tip in every detection → no alternative → rejected with the rule
    const sn = MESH_INDEX.subnasale!;
    const all = analyzeFace(moved(base, sn, { dx: 0, dy: -0.35 }, () => true));
    const l = status(all.qc!, "subnasale");
    expect(l.status).toBe("rejected");
    expect(l.rule).toBe("midlineOrder");
    expect(all.ratios.filter((r) => r.unavailableCode === "verification").length).toBeGreaterThan(0);
    expect(all.qc!.actions.some((x) => x.code === "rejectLandmark" && x.ids.includes("subnasale"))).toBe(true);
    // wrong in all passes but one: the correct pass replaces it, the rules hold again
    const fixed = analyzeFace(moved(base, sn, { dx: 0, dy: -0.35 }, (k) => k !== 5));
    const f = status(fixed.qc!, "subnasale");
    expect(f.status).toBe("corrected");
    expect(f.rule).toBe("midlineOrder");
    const snAfter = fixed.landmarks.find((x) => x.id === "subnasale")!;
    expect(snAfter).toBeTruthy();
    expect(fixed.qc!.actions.some((x) => x.code === "correctLandmark" && x.ids.includes("subnasale"))).toBe(true);
    expect(fixed.ratios.find((r) => r.id === "N_H")!.availability).toBe("available");
  });

  it("the rules do not fire on the real faces", () => {
    for (const name of NAMES) {
      const c = computeCore(prepareVerification(loadVerifiedInput(name))!.verified);
      expect(anatomyViolations((id) => c.map[id]?.aligned), name).toEqual([]);
    }
  });
});

describe("measurement checks", () => {
  const core = (vals: Record<string, number>): MeasureCore => ({
    ratios: Object.entries(vals).map(([id, value]) => ({ id, value, availability: "available", confidence: 1, uncertain: false, inT1: null, deviation: null, normalizedDeviation: null, tier: null, tierPoints: null, tierNote: "", index: 50, intermediate: {} })) as never,
    symmetry: { score: null, metrics: [], confidence: 1, note: "" },
    additional: [],
  });
  it("stable, unstable, excluded and implausible by the spread over the passes in dispersion units", () => {
    // CT: dispersion unit s = the natural between-person spread (degrees); the trimmed SD of
    // [−a, a, −a, a, 0, 0] drops one a² → a·√(3/5)
    const s = RATIO_BY_ID.CT.tolerance;
    const passesOf = (sd: number) => [-1, 1, -1, 1, 0, 0].map((k) => core({ CT: 6 + (k * sd * s) / Math.sqrt(3 / 5) }));
    const res = (sd: number, v = 6) => checkMeasures(core({ CT: v }), passesOf(sd), new Set())[0];
    expect(res(0.1).status).toBe("stable");
    expect(res(0.7).status).toBe("unstable");
    expect(res(1.6).status).toBe("excluded");
    expect(res(0.1, 200).status).toBe("implausible");
    expect(UNSTABLE_UNITS).toBeLessThan(EXCLUDE_UNITS);
    // a measure on an uncertain landmark is at most unstable
    const onUncertain = checkMeasures(core({ CT: 6 }), passesOf(0.1), new Set(["exocanthion_R"]))[0];
    expect(onUncertain.status).toBe("unstable");
    expect(onUncertain.reason).toBe("uncertainLandmark");
    // without passes nothing can be reproduced: unverified, still scored
    expect(checkMeasures(core({ CT: 6 }), null, new Set())[0].status).toBe("unverified");
  });

  it("excluded measures leave the score, the quality control reports them", () => {
    const input = loadVerifiedInput("portrait-b");
    const a = analyzeFace(input);
    const excluded = a.qc!.measures.filter((m) => m.status === "excluded" || m.status === "implausible");
    for (const m of excluded.filter((x) => x.kind === "ratio")) {
      const r = a.ratios.find((x) => x.id === m.id)!;
      expect(r.qc!.status).toBe(m.status);
      expect(r.index).toBeNull();
      expect(a.scores.rubric).toBeTruthy();
    }
    const used = a.qc!.measures.length;
    expect(used).toBeGreaterThan(40);
  });
});

describe("final control instance", () => {
  const a = analyzeFace(loadVerifiedInput("portrait-a"));
  const c = computeCore(prepareVerification(loadVerifiedInput("portrait-a"))!.verified);
  const baseCtl = {
    quality: c.quality,
    hierarchy: c.hierarchy,
    ratios: c.ratios,
    landmarks: a.qc!.landmarks,
    measures: a.qc!.measures,
    passes: a.qc!.passes,
    overallSpread: 0.5,
    excludedKeys: new Set<string>(),
    criticalRejected: false,
    baseAssessable: new Set(c.hierarchy.criteria.filter((x) => x.index != null).map((x) => x.id)),
    iterations: 1,
    actions: [],
  };
  it("recomputes every category and the overall index independently", () => {
    const re = recomputeHierarchy(c.hierarchy);
    expect(re.overall!).toBeCloseTo(c.hierarchy.overall!, 9);
    for (const k of c.hierarchy.categories) if (k.index != null) expect(re.categories[k.id]!).toBeCloseTo(k.index, 9);
    expect(finalControl(baseCtl).checks.find((x) => x.id === "recompute")!.status).toBe("pass");
  });
  it("rejects a result whose numbers do not add up, that used an excluded measure or that is not reproducible", () => {
    const tampered = finalControl({ ...baseCtl, hierarchy: { ...c.hierarchy, overall: c.hierarchy.overall! + 2 } });
    expect(tampered.checks.find((x) => x.id === "recompute")!.status).toBe("fail");
    expect(tampered.status).toBe("failed");
    const leaked = finalControl({ ...baseCtl, excludedKeys: new Set([c.hierarchy.criteria.find((x) => x.used.length)!.used[0]]) });
    expect(leaked.status).toBe("failed");
    const unstable = finalControl({ ...baseCtl, overallSpread: 9 });
    expect(unstable.checks.find((x) => x.id === "reproducibility")!.status).toBe("fail");
    expect(finalControl({ ...baseCtl, overallSpread: 5 }).status).toBe("limited");
    expect(finalControl({ ...baseCtl, criticalRejected: true }).status).toBe("failed");
  });
  it("a failed control removes the overall result of the analysis and of the rating", () => {
    const thin = { ...loadVerifiedInput("portrait-a") };
    // unusable image quality → the control fails
    const bad = analyzeFace({ ...thin, rawQuality: { ...thin.rawQuality, sharpness: 1, brightness: 5 } });
    expect(bad.qc!.status).toBe("failed");
    expect(bad.scores.overall).toBeNull();
    expect(bad.warningCodes!.some((w) => w.code === "qcFailed")).toBe(true);
    const r = rateFace({ frontal: bad, scale });
    expect(r.score).toBeNull();
  });
});

describe("server input", () => {
  it("accepts the verification passes and no user-set coverage threshold", () => {
    const input = loadVerifiedInput("portrait-a");
    const parsed = analysisInputSchema.parse(input);
    expect(parsed.verification!.passes).toHaveLength(5);
    expect(() => analysisInputSchema.parse({ ...input, verification: { passes: [{ id: "other", mesh: input.mesh }] } })).toThrow();
  });
});

describe("reject and re-analyse", () => {
  it("a result that is not reproducible over the passes is rejected, re-analysed without the least reproducible measure and checked again", () => {
    const input = loadVerifiedInput("portrait-a");
    const ctx = prepareVerification(input)!;
    const index = new Map(ctx.inputs.map((x, k) => [x, k]));
    const s = RATIO_BY_ID.CT.tolerance;
    // CT varies by ≈ 0.8 dispersion units over the passes and, while it is scored, moves the overall result by ± 8 points
    const compute = (inp: AnalysisInput, plan: Parameters<typeof computeCore>[1]) => {
      const c = computeCore(inp, plan);
      const k = index.get(inp);
      if (k == null) return c;
      const sign = [0, 1, -1, 1, -1, 0][k];
      const ct = c.ratios.find((r) => r.id === "CT")!;
      if (ct.availability === "available") ct.value = 6 + (sign * 0.8 * s) / Math.sqrt(3 / 5);
      const excluded = plan?.measures.get("r:CT")?.status === "excluded";
      return { ...c, overall: c.overall! + (excluded ? 0 : sign * 8) };
    };
    const run = runVerification(ctx, ctx.verified, compute);
    expect(run.iterations).toBe(2);
    expect(run.actions.some((a) => a.round === 2 && a.code === "excludeMeasure" && a.ids.includes("r:CT"))).toBe(true);
    expect(run.measures.find((m) => m.id === "CT")!.status).toBe("excluded");
    expect(run.measures.find((m) => m.id === "CT")!.reason).toBe("reproducibility");
    expect(run.overallSpread!).toBeLessThanOrEqual(REPRO_PASS);
  });
});
