/**
 * "Ideal example" geometry (rubric 2.0).
 *
 * Starts from MediaPipe's canonical face model — an average face, which is itself
 * rated above average in attractiveness studies (averageness, Langlois & Roggman
 * 1990) — and changes it as little as possible until the scored frontal measures
 * lie inside their reference ranges (with a safety margin). The change is a smooth,
 * mirror-symmetric displacement field (Gaussian radial basis functions on the
 * subject's right half, mirrored to the left), so the result stays a plausible
 * face shape. The objective is
 *
 *   J = Σ_m (distance of measure m from its target interval / dispersion unit)²
 *       + λ · Σ_k |d_k|²   (d_k = RBF displacement, IPD units)
 *
 * minimised by finite-difference gradient descent with backtracking. Targets that
 * conflict with each other or with the face model may remain outside; they are
 * reported, never hidden. The generated mesh is stored (ideal-mesh.data.ts) and
 * re-measured by the app on a rendered image (closed loop, see the UI).
 */
import { computeCore } from "../analysis";
import { createRng, gaussian } from "../geometry";
import { MIRROR } from "../landmarks/canonical";
import { canonicalImageFrame } from "../landmarks/pose";
import { RATIO_BY_ID } from "../ratios/database";
import { CRITERIA, DERIVED_TOLERANCE, EYE_MOUTH_LENGTH } from "../psl/rubric";
import { rangeDistance } from "../scoring/measurement";
import type { AnalysisInput, AnalysisResult, Point, RatioId, T1Range } from "../types";

export type IdealPoint = { x: number; y: number; z: number };

export interface IdealTarget {
  key: string;
  kind: "ratio" | "additional";
  id: string;
  /** reference range of the rubric */
  range: T1Range;
  /** interval the optimiser aims at (range shrunk by the margin) */
  aim: T1Range;
  /** dispersion unit */
  s: number;
}

/** Scored frontal measures with their aim interval (15 % of the width inside each bound; one-sided: ½ unit inside). */
export function idealTargets(): IdealTarget[] {
  const out: IdealTarget[] = [];
  const seen = new Set<string>();
  for (const c of CRITERIA) {
    for (const id of c.inputs.ratios ?? []) {
      if (id === "NW" || seen.has(id)) continue;
      seen.add(id);
      const def = RATIO_BY_ID[id as RatioId];
      const t1 = def.t1;
      const s = def.tolerance;
      const aim: T1Range =
        t1.min != null && t1.max != null ? { min: t1.min + 0.15 * (t1.max - t1.min), max: t1.max - 0.15 * (t1.max - t1.min) } : { min: t1.min != null ? t1.min + 0.5 * s : null, max: t1.max != null ? t1.max - 0.5 * s : null };
      out.push({ key: `r:${id}`, kind: "ratio", id, range: t1, aim, s });
    }
  }
  out.push({ key: "a:EML", kind: "additional", id: "EML", range: { min: EYE_MOUTH_LENGTH.min, max: EYE_MOUTH_LENGTH.max }, aim: { min: 0.3615, max: 0.3685 }, s: EYE_MOUTH_LENGTH.s });
  out.push({ key: "a:FIFTHS", kind: "additional", id: "FIFTHS", range: { min: null, max: 0 }, aim: { min: null, max: 0 }, s: DERIVED_TOLERANCE.fifthsPp });
  return out;
}

export interface TargetCheck {
  key: string;
  id: string;
  kind: IdealTarget["kind"];
  range: T1Range;
  value: number | null;
  /** signed distance outside the reference range in dispersion units (0 = inside) */
  z: number | null;
  inRange: boolean | null;
}

/** Target / actual / deviation for every scored frontal measure of an analysis. */
export function checkTargets(r: Pick<AnalysisResult, "ratios" | "additional">, targets: IdealTarget[] = idealTargets()): TargetCheck[] {
  return targets.map((t) => {
    const v = t.kind === "ratio" ? (r.ratios.find((x) => x.id === t.id)?.value ?? null) : (r.additional.find((x) => x.id === t.id)?.value ?? null);
    const z = v == null ? null : rangeDistance(v, t.range) / t.s;
    return { key: t.key, id: t.id, kind: t.kind, range: t.range, value: v, z, inRange: z == null ? null : z === 0 };
  });
}

// ------------------------------------------------------------------ base face and input

export const IDEAL_IMAGE = { width: 800, height: 1000, ipdPx: 200 } as const;

/** The canonical face model in image pixels (frontal, pupils level, IPD = 200 px). */
export function canonicalImageMesh(): IdealPoint[] {
  const v = Array.from({ length: 478 }, (_, i) => canonicalImageFrame(i));
  const ipd = Math.hypot(v[473].x - v[468].x, v[473].y - v[468].y);
  const s = IDEAL_IMAGE.ipdPx / ipd;
  const cx = (v[468].x + v[473].x) / 2;
  const cy = (v[468].y + v[473].y) / 2;
  return v.map((p) => ({ x: IDEAL_IMAGE.width / 2 + (p.x - cx) * s, y: IDEAL_IMAGE.height * 0.42 + (p.y - cy) * s, z: p.z * s }));
}

/** Analysis input for a synthetic mesh (ideal capture conditions, neutral expression, known hairline). */
export function syntheticInput(mesh: IdealPoint[], trichion: Point | null, samples = 0): AnalysisInput {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of mesh) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return {
    mesh,
    trichion: trichion ? { point: trichion, source: "manual", confidence: 1 } : null,
    neck: null,
    blendshapes: {},
    transformMatrix: null,
    rawQuality: { imageWidth: IDEAL_IMAGE.width, imageHeight: IDEAL_IMAGE.height, faceWidthPx: maxX - minX, faceHeightPx: maxY - minY, sharpness: 400, brightness: 125, contrast: 50, faceBox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }, faceCount: 1 },
    config: { includeReconstructed: true, captureDistance: "standard", uncertaintySamples: samples, seed: 20251106 },
  };
}

// ------------------------------------------------------------------ deformation model

export interface IdealModel {
  base: IdealPoint[];
  centers: number[];
  radiusIpd: number;
  /** weights[i] = list of [centerIndex, w] for vertex i (right half and midline) */
  weights: [number, number][][];
}

const isMid = (i: number) => MIRROR[i] === i;

export function buildIdealModel(base: IdealPoint[] = canonicalImageMesh(), nCenters = 44, radiusIpd = 0.16): IdealModel {
  const ipd = IDEAL_IMAGE.ipdPx;
  const cx = (base[468].x + base[473].x) / 2;
  // subject's right half (image left) and the midline; iris points follow their eye
  const half = base.map((p, i) => ({ i, p })).filter(({ i, p }) => i < 468 && (isMid(i) || p.x < cx));
  // farthest-point sampling of the centers (deterministic, starting at the nose tip)
  const centers: number[] = [1];
  const dmin = half.map(({ p }) => Math.hypot(p.x - base[1].x, p.y - base[1].y));
  while (centers.length < nCenters) {
    let best = 0;
    for (let k = 1; k < half.length; k++) if (dmin[k] > dmin[best]) best = k;
    const c = half[best].i;
    centers.push(c);
    for (let k = 0; k < half.length; k++) dmin[k] = Math.min(dmin[k], Math.hypot(half[k].p.x - base[c].x, half[k].p.y - base[c].y));
  }
  const r2 = 2 * (radiusIpd * ipd) ** 2;
  const weights: [number, number][][] = base.map(() => []);
  for (let i = 0; i < 478; i++) {
    const src = i >= 468 ? (i < 473 ? 468 : 473) : i; // iris points move with the pupil centre
    const own = src === 473 ? 468 : base[src].x > cx + 1e-9 && !isMid(src) ? MIRROR[src] : src;
    const p = base[own];
    for (let k = 0; k < centers.length; k++) {
      const c = base[centers[k]];
      const w = Math.exp(-((p.x - c.x) ** 2 + (p.y - c.y) ** 2) / r2);
      if (w > 1e-3) weights[i].push([k, w]);
    }
  }
  return { base, centers, radiusIpd, weights };
}

/** params: [dx_0, dy_0, …, dx_{K−1}, dy_{K−1}, trichionOffset] in IPD units. */
export function applyIdealParams(model: IdealModel, params: number[]): { mesh: IdealPoint[]; trichion: Point } {
  const ipd = IDEAL_IMAGE.ipdPx;
  const { base } = model;
  const cx = (base[468].x + base[473].x) / 2;
  const mesh = base.map((p, i) => {
    let dx = 0;
    let dy = 0;
    for (const [k, w] of model.weights[i]) {
      dx += w * params[2 * k];
      dy += w * params[2 * k + 1];
    }
    const src = i >= 468 ? (i < 473 ? 468 : 473) : i;
    const mirrored = src === 473 || (base[src].x > cx + 1e-9 && !isMid(src));
    if (isMid(src) && src < 468) dx = 0;
    return { x: p.x + (mirrored ? -dx : dx) * ipd, y: p.y + dy * ipd, z: p.z };
  });
  const top = mesh[10];
  const tOff = params[params.length - 1];
  return { mesh, trichion: { x: top.x, y: top.y + tOff * ipd } };
}

export function idealObjective(model: IdealModel, params: number[], targets: IdealTarget[], lambda: number): { J: number; fit: number; reg: number } {
  const { mesh, trichion } = applyIdealParams(model, params);
  let fit = 0;
  try {
    const c = computeCore(syntheticInput(mesh, trichion));
    for (const t of targets) {
      const v = t.kind === "ratio" ? c.ratios.find((x) => x.id === t.id)?.value : c.additional.find((x) => x.id === t.id)?.value;
      if (v == null) {
        fit += 25;
        continue;
      }
      const d = rangeDistance(v, t.aim) / t.s;
      fit += d * d;
    }
  } catch {
    return { J: 1e9, fit: 1e9, reg: 0 };
  }
  let reg = 0;
  for (let k = 0; k < params.length - 1; k++) reg += params[k] * params[k];
  return { J: fit + lambda * reg, fit, reg };
}

export interface IdealRun {
  params: number[];
  mesh: IdealPoint[];
  trichion: Point;
  history: { iter: number; J: number; fit: number }[];
}

/**
 * (1+1) evolution strategy with the 1/5 success rule (deterministic seed). The
 * objective is not smooth — the zygion is the widest of several contour pairs and
 * constructed points switch — so gradient methods stall; the ES only needs
 * objective values.
 */
export function optimizeIdeal(opts: { iterations?: number; lambda?: number; model?: IdealModel; start?: number[]; seed?: number; onIter?: (i: number, J: number, fit: number) => void } = {}): IdealRun {
  const model = opts.model ?? buildIdealModel();
  const targets = idealTargets();
  const lambda = opts.lambda ?? 4;
  const n = model.centers.length * 2 + 1;
  const p = opts.start ? [...opts.start] : new Array(n).fill(0);
  if (!opts.start) {
    // initial hairline: 0.45 × nasion–menton above the nasion (a typical upper third)
    const b = model.base;
    p[n - 1] = -((b[152].y - b[168].y) * 0.45) / IDEAL_IMAGE.ipdPx + (b[168].y - b[10].y) / IDEAL_IMAGE.ipdPx;
  }
  const rng = createRng(opts.seed ?? 20261108);
  let cur = idealObjective(model, p, targets, lambda);
  const history = [{ iter: 0, J: cur.J, fit: cur.fit }];
  let sigma = 0.01;
  const iters = opts.iterations ?? 12000;
  for (let it = 1; it <= iters; it++) {
    // mutate a random subset (sparse steps help with many weakly coupled parameters)
    const q = [...p];
    const share = 0.15 + 0.85 * rng();
    for (let j = 0; j < n; j++) if (rng() < share) q[j] += sigma * gaussian(rng);
    const nx = idealObjective(model, q, targets, lambda);
    if (nx.J < cur.J) {
      for (let j = 0; j < n; j++) p[j] = q[j];
      cur = nx;
      sigma = Math.min(sigma * 1.5, 0.05);
    } else sigma = Math.max(sigma * Math.pow(1.5, -0.25), 2e-5);
    if (it % 200 === 0) {
      history.push({ iter: it, J: cur.J, fit: cur.fit });
      opts.onIter?.(it, cur.J, cur.fit);
    }
  }
  const { mesh, trichion } = applyIdealParams(model, p);
  return { params: p, mesh, trichion, history };
}
