import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { analyzeFace, MAX_AXIS_ADJUST_DEG } from "@/engine/analysis";
import { RATIO_BY_ID } from "@/engine/ratios/database";
import type { AnalysisInput, AnalysisResult } from "@/engine/types";
import { analysisInputSchema } from "@/server/schemas";
import { inputFromFixture, loadFixture } from "./helpers";

const dir = mkdtempSync(join(tmpdir(), "psl-corr-"));
process.env.PSL_ARENA_DATA_DIR = dir;
const auth = await import("@/server/auth");
const db = await import("@/server/db");
const services = await import("@/server/services");

const base = inputFromFixture(loadFixture("obama"), { config: { includeReconstructed: true, captureDistance: "unknown", uncertaintySamples: 0, seed: 1 } });
const A = analyzeFace(base);
const lm = (r: AnalysisResult, id: string) => r.landmarks.find((l) => l.id === id)!;
const val = (r: AnalysisResult, id: string) => r.ratios.find((x) => x.id === id)!.value;

describe("manual landmark correction", () => {
  it("moves exactly the corrected landmark and recomputes only the measures that use it", () => {
    const p = lm(A, "alare_R").raw;
    const moved = { x: p.x + 6, y: p.y };
    const B = analyzeFace({ ...base, corrections: { landmarks: { alare_R: moved } } });
    const b = lm(B, "alare_R");
    expect(b.raw).toEqual(moved);
    expect(b.corrected).toBe(true);
    expect(b.source).toBe("manual");
    expect(b.originalRaw).toEqual(p);
    for (const r of A.ratios) {
      if (r.value == null) continue;
      const uses = RATIO_BY_ID[r.id].landmarks.includes("alare_R");
      if (uses) expect(val(B, r.id), r.id).not.toBeCloseTo(r.value, 6);
      else expect(val(B, r.id), r.id).toBeCloseTo(r.value, 9);
    }
    // the analysis is flagged everywhere it travels
    expect(B.corrections).toEqual({ landmarks: ["alare_R"], axisAdjustDeg: 0 });
    expect(B.warningCodes?.some((w) => w.code === "corrected")).toBe(true);
    expect(A.corrections).toBeNull();
  });

  it("an empty correction is a no-op", () => {
    const B = analyzeFace({ ...base, corrections: { landmarks: {}, axisAdjustDeg: 0 } });
    expect(B.scores.overall).toBeCloseTo(A.scores.overall!, 12);
    expect(B.corrections).toBeNull();
  });

  it("tilting the reference axis changes angles by the tilt and leaves distance ratios unchanged", () => {
    const B = analyzeFace({ ...base, corrections: { axisAdjustDeg: 4 } });
    expect(B.mesh.axisAdjustDeg).toBe(4);
    // canthal tilt is the mean of both sides, so a rigid tilt cancels; the per-side tilts change by ±4°
    const tiltR = (r: AnalysisResult) => { const en = lm(r, "endocanthion_R").aligned, ex = lm(r, "exocanthion_R").aligned; return (Math.atan2(en.y - ex.y, en.x - ex.x) * 180) / Math.PI; };
    expect(Math.abs(tiltR(B) - tiltR(A))).toBeCloseTo(4, 6);
    // Euclidean distance ratios are invariant; projected heights (midface ratio) follow the axis
    for (const id of ["ESR", "ICD", "M_N", "M_IPD"] as const) expect(val(B, id), id).toBeCloseTo(val(A, id)!, 6);
    expect(val(B, "MF")).not.toBeCloseTo(val(A, "MF")!, 4);
    expect(B.corrections!.axisAdjustDeg).toBe(4);
  });

  it("clamps the axis adjustment to ±15°", () => {
    const B = analyzeFace({ ...base, corrections: { axisAdjustDeg: 40 } });
    expect(B.mesh.axisAdjustDeg).toBe(MAX_AXIS_ADJUST_DEG);
    expect(B.corrections!.axisAdjustDeg).toBe(MAX_AXIS_ADJUST_DEG);
  });

  it("propagates the manual placement noise in the Monte-Carlo and stays deterministic", () => {
    const inp: AnalysisInput = { ...base, config: { ...base.config, uncertaintySamples: 20 }, corrections: { landmarks: { cheilion_R: lm(A, "cheilion_R").raw } } };
    const r1 = analyzeFace(inp);
    const r2 = analyzeFace(inp);
    expect(r1.scores.overall).toBe(r2.scores.overall);
    expect(r1.ratios.find((r) => r.id === "M_IPD")!.valueSigma!).toBeGreaterThan(0);
  });
});

describe("server validation of corrections", () => {
  let userId = "";
  beforeAll(() => {
    db.closeDb();
    userId = auth.signup({ email: "corr@example.com", password: "corr strong password", name: "Corr" }).id;
  });
  afterAll(() => {
    db.closeDb();
    rmSync(dir, { recursive: true, force: true });
  });
  it("stores corrections with the input and rejects points outside the image", () => {
    const input = analysisInputSchema.parse({ ...base, corrections: { landmarks: { alare_R: { x: 300, y: 300 } }, axisAdjustDeg: 2 } }) as AnalysisInput;
    const rec = services.createAnalysis(userId, { profileLabel: "Corr", storeImage: false, input });
    expect(rec.result.corrections).toEqual({ landmarks: ["alare_R"], axisAdjustDeg: 2 });
    const bad = { ...input, corrections: { landmarks: { alare_R: { x: -5, y: 10 } } } };
    expect(() => services.createAnalysis(userId, { profileLabel: "Corr", storeImage: false, input: bad })).toThrow(/outside the image/);
    expect(() => analysisInputSchema.parse({ ...base, corrections: { axisAdjustDeg: 30 } })).toThrow();
  });
  it("keeps the capture metrics of engine 2.0 through the schema", () => {
    const parsed = analysisInputSchema.parse({ ...base, rawQuality: { ...base.rawQuality, focalLength35mm: 26, clipDark: 0.01, lightingAsymmetry: 0.2 } });
    expect(parsed.rawQuality.focalLength35mm).toBe(26);
    expect(parsed.rawQuality.clipDark).toBe(0.01);
  });
});
