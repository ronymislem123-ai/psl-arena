/**
 * Property-based checks of the engine 2.0 measurement chain on seeded random
 * deformations of real and synthetic faces: bounded outputs, similarity and
 * mirror invariance, determinism.
 */
import { describe, expect, it } from "vitest";
import { analyzeFace, computeCore, DEFAULT_CONFIG } from "@/engine/analysis";
import { createRng } from "@/engine/geometry";
import { MIRROR } from "@/engine/landmarks/canonical";
import { rateFace } from "@/engine/psl/rating";
import { buildStandardScale, snapshotScale } from "@/engine/psl/scale";
import { deformMesh, type DeformationId, type MeshPoint } from "@/engine/synth/deform";
import { canonicalImageMesh } from "@/engine/synth/ideal";
import type { AnalysisInput } from "@/engine/types";
import { inputFromFixture, loadFixture } from "./helpers";

const OPS: [DeformationId, number][] = [["eyeSpacing", 0.08], ["eyeSize", 0.15], ["canthalTilt", 6], ["browHeight", 0.06], ["noseWidth", 0.15], ["noseLength", 0.06], ["mouthWidth", 0.12], ["lipFullness", 0.3], ["faceWidth", 0.1], ["jawWidth", 0.12], ["chinHeight", 0.08], ["midfaceHeight", 0.06], ["foreheadHeight", 0.08], ["asymmetryEye", 0.03]];
const scale = snapshotScale(buildStandardScale());
const cfg = { ...DEFAULT_CONFIG, uncertaintySamples: 0 };
const bases: [string, AnalysisInput][] = [
  ["obama", inputFromFixture(loadFixture("obama"), { config: cfg })],
  ["ai-face", inputFromFixture(loadFixture("ai-face"), { config: cfg })],
  ["average", (() => { const i = inputFromFixture(loadFixture("obama"), { config: cfg }); const m = canonicalImageMesh(); const ipd = Math.hypot(m[473].x - m[468].x, m[473].y - m[468].y); return { ...i, mesh: m, trichion: { point: { x: m[10].x, y: m[10].y - 0.45 * ipd }, source: "manual" as const, confidence: 1 } }; })()],
];

function randomVariant(base: AnalysisInput, rng: () => number): AnalysisInput {
  const n = 1 + Math.floor(rng() * 4);
  const defs = Array.from({ length: n }, () => {
    const [id, a] = OPS[Math.floor(rng() * OPS.length)];
    return { id, amount: (rng() * 2 - 1) * a };
  });
  return { ...base, mesh: deformMesh(base.mesh as MeshPoint[], defs) };
}

/** Similarity transform of all input coordinates (z scales with the image). */
function similarity(inp: AnalysisInput, s: number, deg: number, tx: number, ty: number): AnalysisInput {
  const a = (deg * Math.PI) / 180;
  const c = inp.mesh[1];
  const T = (p: { x: number; y: number; z?: number }) => ({ x: c.x + s * ((p.x - c.x) * Math.cos(a) - (p.y - c.y) * Math.sin(a)) + tx, y: c.y + s * ((p.x - c.x) * Math.sin(a) + (p.y - c.y) * Math.cos(a)) + ty, ...(p.z !== undefined ? { z: p.z * s } : {}) });
  return { ...inp, mesh: inp.mesh.map(T), trichion: inp.trichion ? { ...inp.trichion, point: T(inp.trichion.point) } : inp.trichion, rawQuality: { ...inp.rawQuality, faceWidthPx: inp.rawQuality.faceWidthPx * s, faceHeightPx: inp.rawQuality.faceHeightPx * s } };
}

/** What the detector returns for the mirrored photo: x mirrored and left/right landmark indices swapped. */
function mirror(inp: AnalysisInput): AnalysisInput {
  const W = inp.rawQuality.imageWidth;
  const m = inp.mesh.map((_, i) => {
    const p = inp.mesh[i < 468 ? MIRROR[i] : i < 473 ? i + 5 : i - 5];
    return { ...p, x: W - p.x, ...(p.z !== undefined ? { z: p.z } : {}) };
  });
  return { ...inp, mesh: m, trichion: inp.trichion ? { ...inp.trichion, point: { x: W - inp.trichion.point.x, y: inp.trichion.point.y } } : inp.trichion };
}

describe("engine properties on random deformations", () => {
  const rng = createRng(4242);
  const samples = bases.flatMap(([name, b]) => Array.from({ length: 12 }, (_, k) => ({ name: `${name}#${k}`, input: randomVariant(b, rng) })));

  it("keeps every score inside its range and never returns NaN", () => {
    for (const { name, input } of samples) {
      const a = analyzeFace(input);
      if (!a.quality.analyzable) continue;
      const o = a.scores.overall!;
      expect(Number.isFinite(o), name).toBe(true);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(100);
      for (const [k, v] of Object.entries(a.scores.rubric!.categories)) if (v != null) expect(v >= 0 && v <= 100, `${name} ${k} ${v}`).toBe(true);
      expect(a.scores.rubric!.compensationPenalty!).toBeGreaterThanOrEqual(-1e-9);
      const r = rateFace({ frontal: a, scale });
      expect(r.score! >= 0 && r.score! <= 10, name).toBe(true);
      for (const x of a.ratios) if (x.index != null) expect(x.index >= 0 && x.index <= 100, `${name} ${x.id}`).toBe(true);
    }
  });

  it("is invariant to image scale, translation and in-plane rotation", () => {
    for (const { name, input } of samples.slice(0, 18)) {
      const a = computeCore(input).overall!;
      for (const [s, deg, tx, ty] of [[1.7, 0, 40, -25], [0.6, 33, 0, 0], [1, 180, 10, 10], [1.3, -95, -50, 80]] as const) {
        expect(computeCore(similarity(input, s, deg, tx, ty)).overall!, `${name} s=${s} deg=${deg}`).toBeCloseTo(a, 6);
      }
    }
  });

  it("gives the mirrored photo the same scores", () => {
    for (const { name, input } of samples.slice(0, 18)) {
      const a = computeCore(input);
      const b = computeCore(mirror(input));
      expect(b.overall!, name).toBeCloseTo(a.overall!, 4);
      expect(b.symmetry.score!, name).toBeCloseTo(a.symmetry.score!, 4);
    }
  });

  it("is deterministic including the Monte-Carlo", () => {
    const inp = { ...samples[0].input, config: { ...DEFAULT_CONFIG, uncertaintySamples: 16 } };
    const a = analyzeFace(inp);
    const b = analyzeFace(inp);
    expect(a.scores.overall).toBe(b.scores.overall);
    expect(a.uncertainty!.overallSigma).toBe(b.uncertainty!.overallSigma);
  });
});
