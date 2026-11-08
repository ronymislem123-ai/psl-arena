/**
 * Model population simulation (validation tool, rubric 2.0).
 *
 * Hypothesis tested: every scored measure varies between people around the middle
 * of its reference range (the bound for one-sided ranges) with its own dispersion
 * unit as standard deviation; signed asymmetries vary around 0 with their
 * dispersion unit. Measures are drawn independently, captured under ideal
 * conditions and aggregated with the real rubric (scoring/hierarchy.ts).
 *
 * Result (docs/MODEL_VALIDATION.md): the simulated median overall index is ≈ 85
 * with SD ≈ 4.6, while all six real/AI test faces score 54–79 — the hypothesis is
 * rejected, so the simulation is NOT used to anchor the PSL calibration. It is
 * used for property checks (spread, aggregation sensitivity to p) only.
 */
import { createRng, gaussian } from "../geometry";
import { RATIO_BY_ID } from "../ratios/database";
import { metricScore } from "../scoring/symmetry";
import { plateauIndex } from "../scoring/measurement";
import { additionalIndex, aggregateHierarchy, type MeasureMap } from "../scoring/hierarchy";
import { CRITERIA, EYE_MOUTH_LENGTH, DERIVED_TOLERANCE, measureReliability } from "./rubric";
import type { RatioId, SemanticLandmarkId } from "../types";

/** Dispersion units (= halving constants of engine 1.x) of the symmetry metrics. */
export const SYMMETRY_UNITS: Record<string, { tol: number; landmarks: SemanticLandmarkId[] }> = {
  eyeHeight: { tol: 10, landmarks: [] },
  pfl: { tol: 6, landmarks: [] },
  canthalTilt: { tol: 2, landmarks: [] },
  canthusHeight: { tol: 0.02, landmarks: [] },
  browHeight: { tol: 0.03, landmarks: [] },
  browTilt: { tol: 3, landmarks: [] },
  mouthCornerHeight: { tol: 0.03, landmarks: [] },
  mouthCornerWidth: { tol: 0.04, landmarks: [] },
  noseTip: { tol: 0.03, landmarks: [] },
  alar: { tol: 0.03, landmarks: [] },
  chin: { tol: 0.04, landmarks: [] },
  gonionWidth: { tol: 0.06, landmarks: ["gonion_R", "gonion_L"] },
  gonionHeight: { tol: 0.05, landmarks: ["gonion_R", "gonion_L"] },
  zygion: { tol: 0.05, landmarks: ["zygion_R", "zygion_L"] },
};

/** Frontal ratios that a standard analysis (no manual neck points) can score. */
export function simulatedRatios(): RatioId[] {
  const ids = new Set<RatioId>();
  for (const c of CRITERIA) for (const r of c.inputs.ratios ?? []) if (r !== "NW") ids.add(r);
  return [...ids];
}

function center(t1: { min: number | null; max: number | null }): number {
  if (t1.min != null && t1.max != null) return (t1.min + t1.max) / 2;
  return (t1.min ?? t1.max)!;
}

/** One simulated frontal measure map; `shift` moves every measure by k dispersion units (for sensitivity checks). */
export function simulateFace(rng: () => number, shift = 0): MeasureMap {
  const m: MeasureMap = new Map();
  for (const id of simulatedRatios()) {
    const def = RATIO_BY_ID[id];
    const s = def.tolerance;
    const x = center(def.t1) + s * (gaussian(rng) + shift);
    m.set(`r:${id}`, { index: plateauIndex(x, def.t1, s), confidence: 1, reliability: measureReliability(def.landmarks), weight: def.weight, source: "frontal" });
  }
  for (const [id, u] of Object.entries(SYMMETRY_UNITS)) {
    const v = Math.abs(u.tol * (gaussian(rng) + shift));
    m.set(`s:${id}`, { index: metricScore(v, u.tol), confidence: 1, reliability: measureReliability(u.landmarks), weight: 1, source: "frontal" });
  }
  const fifths = Math.abs(DERIVED_TOLERANCE.fifthsPp * (gaussian(rng) + shift));
  m.set("a:FIFTHS", { index: additionalIndex("FIFTHS", fifths)!, confidence: 1, reliability: measureReliability(["zygion_R", "zygion_L"]), weight: 1, source: "frontal" });
  const eml = (EYE_MOUTH_LENGTH.min + EYE_MOUTH_LENGTH.max) / 2 + EYE_MOUTH_LENGTH.s * (gaussian(rng) + shift);
  m.set("a:EML", { index: additionalIndex("EML", eml)!, confidence: 1, reliability: measureReliability(["trichion"]), weight: 1, source: "frontal" });
  return m;
}

export interface PopulationSummary {
  n: number;
  seed: number;
  median: number;
  mean: number;
  sd: number;
  p05: number;
  p25: number;
  p75: number;
  p95: number;
  arithmeticMedian: number;
}

const quantile = (sorted: number[], q: number) => {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};

/** Overall indices of a simulated population (frontal measures only). */
export function simulatePopulation(n = 4000, seed = 20261108, p?: number): { overall: number[]; arithmetic: number[]; summary: PopulationSummary } {
  const rng = createRng(seed);
  const overall: number[] = [];
  const arithmetic: number[] = [];
  for (let i = 0; i < n; i++) {
    const h = aggregateHierarchy(simulateFace(rng), p);
    if (h.overall != null) overall.push(h.overall);
    if (h.overallArithmetic != null) arithmetic.push(h.overallArithmetic);
  }
  const s = [...overall].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / (s.length - 1));
  const sa = [...arithmetic].sort((a, b) => a - b);
  return { overall, arithmetic, summary: { n, seed, median: quantile(s, 0.5), mean, sd, p05: quantile(s, 0.05), p25: quantile(s, 0.25), p75: quantile(s, 0.75), p95: quantile(s, 0.95), arithmeticMedian: quantile(sa, 0.5) } };
}
