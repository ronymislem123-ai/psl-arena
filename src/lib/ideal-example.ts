"use client";
/**
 * "IDEALBEISPIEL ANSEHEN": renders the stored ideal geometry, detects it again with
 * the same MediaPipe model the app uses, re-measures it with the full engine and
 * corrects the rendered geometry by the detection residual (closed loop) until the
 * re-detected landmarks match the target geometry.
 */
import { analyzeFace } from "@/engine/analysis";
import { checkTargets, IDEAL_IMAGE, syntheticInput, type TargetCheck } from "@/engine/synth/ideal";
import { IDEAL_MESH, IDEAL_RUBRIC_VERSION, IDEAL_STATS, IDEAL_TRICHION } from "@/engine/synth/ideal-mesh.data";
import type { AnalysisResult } from "@/engine/types";
import { detectFaces } from "@/lib/vision/detect";
import { computeRawQuality } from "@/lib/vision/quality";
import { renderFace, type RenderPoint } from "@/lib/vision/render-face";

export interface IdealIteration {
  iteration: number;
  detected: boolean;
  /** mean / max distance of the re-detected landmarks from the target geometry (IPD) */
  residualMean: number | null;
  residualMax: number | null;
  inRange: number;
  total: number;
  /** Σ z² over the targets (dispersion units) */
  misfit: number | null;
  /** largest landmark residuals (mesh index, IPD) */
  worst?: [number, number][];
}

export interface IdealExampleResult {
  rubricVersion: string;
  stats: typeof IDEAL_STATS;
  /** model geometry measured directly (no rendering) */
  geometric: { analysis: AnalysisResult; checks: TargetCheck[] };
  /** best re-detected iteration */
  redetected: { analysis: AnalysisResult; checks: TargetCheck[]; imageDataUrl: string } | null;
  iterations: IdealIteration[];
  bestIteration: number | null;
  /** rendered image of every iteration (only with keepImages, for research runs) */
  images?: string[];
}

const target = (): RenderPoint[] => IDEAL_MESH.map(([x, y, z]) => ({ x, y, z }));

export async function runIdealExample(opts: { iterations?: number; damping?: number; keepImages?: boolean; onProgress?: (it: IdealIteration) => void } = {}): Promise<IdealExampleResult> {
  const T = target();
  const ipd = IDEAL_IMAGE.ipdPx;
  const geometricAnalysis = analyzeFace(syntheticInput(T, IDEAL_TRICHION, 40));
  const geometric = { analysis: geometricAnalysis, checks: checkTargets(geometricAnalysis) };
  const canvas = document.createElement("canvas");
  canvas.width = IDEAL_IMAGE.width;
  canvas.height = IDEAL_IMAGE.height;
  let M = T.map((p) => ({ ...p }));
  const iterations: IdealIteration[] = [];
  let best: IdealExampleResult["redetected"] = null;
  let bestMisfit = Infinity;
  let bestIteration: number | null = null;
  const n = opts.iterations ?? 4;
  const images: string[] = [];
  const alpha = opts.damping ?? 0.4;
  for (let k = 0; k < n; k++) {
    renderFace(canvas, M, IDEAL_TRICHION);
    if (opts.keepImages) images.push(canvas.toDataURL("image/png"));
    const faces = await detectFaces(canvas);
    if (!faces.length) {
      const it = { iteration: k, detected: false, residualMean: null, residualMax: null, inRange: 0, total: geometric.checks.length, misfit: null };
      iterations.push(it);
      opts.onProgress?.(it);
      break;
    }
    const f = faces[0];
    const D = f.mesh;
    let sum = 0;
    let max = 0;
    const res: [number, number][] = [];
    for (let i = 0; i < 478; i++) {
      const d = Math.hypot(D[i].x - T[i].x, D[i].y - T[i].y) / ipd;
      sum += d;
      max = Math.max(max, d);
      res.push([i, d]);
    }
    const worst = res.sort((a, b) => b[1] - a[1]).slice(0, 12);
    const analysis = analyzeFace({
      mesh: D,
      trichion: { point: IDEAL_TRICHION, source: "manual", confidence: 1 },
      neck: null,
      blendshapes: f.blendshapes,
      transformMatrix: f.matrix,
      rawQuality: computeRawQuality(canvas, f, faces.length, { sourceWidth: canvas.width, sourceHeight: canvas.height, exif: null, sourceMime: "image/png" }),
      config: { includeReconstructed: true, captureDistance: "standard", uncertaintySamples: 40, seed: 20251106 },
    });
    const checks = checkTargets(analysis);
    const misfit = checks.reduce((s, c) => s + (c.z ?? 5) ** 2, 0);
    const it: IdealIteration = { iteration: k, detected: true, residualMean: sum / 478, residualMax: max, inRange: checks.filter((c) => c.inRange).length, total: checks.length, misfit, worst };
    iterations.push(it);
    opts.onProgress?.(it);
    if (misfit < bestMisfit) {
      bestMisfit = misfit;
      bestIteration = k;
      best = { analysis, checks, imageDataUrl: canvas.toDataURL("image/png") };
    }
    // closed loop: move the rendered geometry against the detector's residual
    // (damped: the detector's response to a geometry change is not exactly one-to-one)
    M = M.map((p, i) => ({ x: p.x - alpha * (D[i].x - T[i].x), y: p.y - alpha * (D[i].y - T[i].y), z: p.z }));
  }
  return { rubricVersion: IDEAL_RUBRIC_VERSION, stats: IDEAL_STATS, geometric, redetected: best, iterations, bestIteration, ...(opts.keepImages ? { images } : {}) };
}
