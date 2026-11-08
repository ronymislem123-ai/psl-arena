import { clamp, createRng, gaussian, stddev } from "../geometry";
import type { AnalysisInput, CategoryId, QualityReport, UncertaintyReport } from "../types";
import { CATEGORY_ORDER } from "../ratios/database";
import { LANDMARK_SIGMA_IPD, LANDMARK_SIGMA_Z_IPD, REPEATABILITY_SAFETY } from "../landmarks/repeatability";
import { sampleNoiseField } from "../landmarks/noise-model";

/** Legacy independent-jitter mode (engine 1.x behaviour), kept for the validation comparison. */
export type NoiseMode = "empirical" | "independent";

export interface CoreScores {
  overall: number | null;
  proportion: number | null;
  harmony: number | null;
  symmetry: number | null;
  categories: Record<CategoryId, number | null>;
  ratioValues: Record<string, number | null>;
  /** rubric 2.0 category indices */
  rubric?: Record<string, number | null>;
  /** signed symmetry asymmetries */
  symSigned?: Record<string, number>;
  /** indices of every frontal measure (hierarchy keys) */
  measures?: Record<string, number>;
}

/**
 * Monte-Carlo propagation of landmark localisation noise through the whole
 * scoring pipeline. Engine 2.0: noise fields are drawn from an empirical model of
 * repeated MediaPipe detections (landmarks/noise-model.ts) that keeps the measured
 * per-landmark spread (contour points ≈ 2× eye/nose/mouth points) and, crucially,
 * the correlation between landmarks: errors of neighbouring and of mirror-paired
 * points are largely shared, so independent jitter overstated the σ of local
 * differences and asymmetries 2–19× (docs/MODEL_VALIDATION.md). The field is scaled
 * by the face's IPD × safety factor 1.5 × image-quality factor.
 */
export function estimateUncertainty(
  input: AnalysisInput,
  quality: QualityReport,
  core: (inp: AnalysisInput) => CoreScores,
  samples: number,
  seed: number,
  noise: NoiseMode = "empirical",
): { report: UncertaintyReport; ratioSigma: Record<string, number>; symmetryMetricSigma: Record<string, number> } | null {
  if (samples <= 0) return null;
  const rng = createRng(seed);
  const qualityFactor = 1 + (1 - clamp(quality.score, 0, 1)); // 1 (perfect) … 2 (unusable)
  const m = input.mesh;
  const ipdPx = Math.hypot(m[468].x - m[473].x, m[468].y - m[473].y) || input.rawQuality.faceWidthPx / 2.3;
  const scale = ipdPx * REPEATABILITY_SAFETY * qualityFactor;
  const sigmaXY = LANDMARK_SIGMA_IPD.map((v) => v * scale);
  const sigmaZ = LANDMARK_SIGMA_Z_IPD.map((v) => v * scale);
  // reported summary value (median landmark σ in px)
  const jitterPx = [...sigmaXY].sort((a, b) => a - b)[239];
  const hairlineSigma = (src: "manual" | "estimated") => ipdPx * qualityFactor * (src === "manual" ? 0.015 : 0.03);

  const overall: number[] = [];
  const proportion: number[] = [];
  const harmony: number[] = [];
  const symmetry: number[] = [];
  const cats = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, [] as number[]])) as Record<CategoryId, number[]>;
  const ratioVals: Record<string, number[]> = {};
  const rubricVals: Record<string, number[]> = {};
  const symVals: Record<string, number[]> = {};
  const measureSamples: Record<string, (number | null)[]> = {};

  const empirical = noise === "empirical" && m.length === 478;
  const roll = Math.atan2(m[473].y - m[468].y, m[473].x - m[468].x);
  const g = () => gaussian(rng);
  for (let s = 0; s < samples; s++) {
    const f = empirical ? sampleNoiseField(g, roll) : null;
    const mesh = input.mesh.map((p, i) => {
      const q = f ? { x: p.x + f[3 * i] * scale, y: p.y + f[3 * i + 1] * scale } : { x: p.x + gaussian(rng) * sigmaXY[i], y: p.y + gaussian(rng) * sigmaXY[i] };
      if (p.z === undefined) return q;
      return { ...q, z: p.z + (f ? f[3 * i + 2] * scale : gaussian(rng) * sigmaZ[i]) };
    });
    const trichion = input.trichion
      ? {
          ...input.trichion,
          point: {
            x: input.trichion.point.x + gaussian(rng) * hairlineSigma(input.trichion.source),
            y: input.trichion.point.y + gaussian(rng) * hairlineSigma(input.trichion.source),
          },
        }
      : input.trichion;
    const neck = input.neck
      ? {
          ...input.neck,
          right: { x: input.neck.right.x + gaussian(rng) * ipdPx * 0.02 * qualityFactor, y: input.neck.right.y + gaussian(rng) * ipdPx * 0.02 * qualityFactor },
          left: { x: input.neck.left.x + gaussian(rng) * ipdPx * 0.02 * qualityFactor, y: input.neck.left.y + gaussian(rng) * ipdPx * 0.02 * qualityFactor },
        }
      : input.neck;
    // manually corrected landmarks carry their own placement noise (like a manual hairline)
    const corrections = input.corrections?.landmarks
      ? {
          ...input.corrections,
          landmarks: Object.fromEntries(
            Object.entries(input.corrections.landmarks).map(([id, p]) => [id, p ? { x: p.x + gaussian(rng) * hairlineSigma("manual"), y: p.y + gaussian(rng) * hairlineSigma("manual") } : p]),
          ),
        }
      : input.corrections;
    const r = core({ ...input, mesh, trichion, neck, corrections, config: { ...input.config, uncertaintySamples: 0 } });
    if (r.overall != null) overall.push(r.overall);
    if (r.proportion != null) proportion.push(r.proportion);
    if (r.harmony != null) harmony.push(r.harmony);
    if (r.symmetry != null) symmetry.push(r.symmetry);
    for (const c of CATEGORY_ORDER) if (r.categories[c] != null) cats[c].push(r.categories[c] as number);
    for (const [id, v] of Object.entries(r.ratioValues)) {
      if (v == null) continue;
      (ratioVals[id] ??= []).push(v);
    }
    for (const [id, v] of Object.entries(r.rubric ?? {})) if (v != null) (rubricVals[id] ??= []).push(v);
    for (const [id, v] of Object.entries(r.symSigned ?? {})) (symVals[id] ??= []).push(v);
    const seen = new Set<string>();
    for (const [k, v] of Object.entries(r.measures ?? {})) {
      const arr = (measureSamples[k] ??= new Array(s).fill(null));
      arr.push(Math.round(v * 10) / 10);
      seen.add(k);
    }
    for (const [k, arr] of Object.entries(measureSamples)) if (!seen.has(k)) arr.push(null);
  }
  const categorySigma = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, stddev(cats[c])])) as Record<CategoryId, number>;
  const ratioSigma = Object.fromEntries(Object.entries(ratioVals).map(([id, v]) => [id, stddev(v)]));
  const symmetryMetricSigma = Object.fromEntries(Object.entries(symVals).map(([id, v]) => [id, stddev(v)]));
  const rubricSigma = Object.fromEntries(Object.entries(rubricVals).map(([id, v]) => [id, stddev(v)]));
  return {
    report: {
      method: empirical
        ? "Monte-Carlo landmark noise: empirical correlated noise model (principal components of 35 repeated detections, mirror-augmented) × 1.5 × image-quality factor, depth included, deterministic seed"
        : "Monte-Carlo landmark jitter: independent per-landmark repeatability × 1.5 × image-quality factor (legacy mode)",
      samples,
      jitterPx,
      overallSigma: stddev(overall),
      proportionSigma: stddev(proportion),
      harmonySigma: stddev(harmony),
      symmetrySigma: stddev(symmetry),
      categorySigma,
      rubricSigma,
      measureSamples,
    },
    ratioSigma,
    symmetryMetricSigma,
  };
}
