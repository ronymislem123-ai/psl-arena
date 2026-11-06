import { clamp, createRng, gaussian, stddev } from "../geometry";
import type { AnalysisInput, CategoryId, QualityReport, UncertaintyReport } from "../types";
import { CATEGORY_ORDER } from "../ratios/database";

export interface CoreScores {
  overall: number | null;
  proportion: number | null;
  harmony: number | null;
  symmetry: number | null;
  categories: Record<CategoryId, number | null>;
  ratioValues: Record<string, number | null>;
}

/**
 * Monte-Carlo propagation of landmark localisation noise through the whole
 * scoring pipeline. Noise sigma scales with face size and image quality.
 */
export function estimateUncertainty(
  input: AnalysisInput,
  quality: QualityReport,
  core: (inp: AnalysisInput) => CoreScores,
  samples: number,
  seed: number,
): { report: UncertaintyReport; ratioSigma: Record<string, number> } | null {
  if (samples <= 0) return null;
  const rng = createRng(seed);
  const qualityFactor = 1 + (1 - clamp(quality.score, 0, 1)); // 1 (perfect) … 2 (unusable)
  const jitterPx = 0.006 * input.rawQuality.faceWidthPx * qualityFactor;

  const overall: number[] = [];
  const proportion: number[] = [];
  const harmony: number[] = [];
  const symmetry: number[] = [];
  const cats = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, [] as number[]])) as Record<CategoryId, number[]>;
  const ratioVals: Record<string, number[]> = {};

  for (let s = 0; s < samples; s++) {
    const mesh = input.mesh.map((p) => ({ x: p.x + gaussian(rng) * jitterPx, y: p.y + gaussian(rng) * jitterPx }));
    const trichion = input.trichion
      ? {
          ...input.trichion,
          point: {
            x: input.trichion.point.x + gaussian(rng) * jitterPx * (input.trichion.source === "manual" ? 2 : 3),
            y: input.trichion.point.y + gaussian(rng) * jitterPx * (input.trichion.source === "manual" ? 2 : 3),
          },
        }
      : input.trichion;
    const neck = input.neck
      ? {
          ...input.neck,
          right: { x: input.neck.right.x + gaussian(rng) * jitterPx * 3, y: input.neck.right.y + gaussian(rng) * jitterPx * 3 },
          left: { x: input.neck.left.x + gaussian(rng) * jitterPx * 3, y: input.neck.left.y + gaussian(rng) * jitterPx * 3 },
        }
      : input.neck;
    const r = core({ ...input, mesh, trichion, neck, config: { ...input.config, uncertaintySamples: 0 } });
    if (r.overall != null) overall.push(r.overall);
    if (r.proportion != null) proportion.push(r.proportion);
    if (r.harmony != null) harmony.push(r.harmony);
    if (r.symmetry != null) symmetry.push(r.symmetry);
    for (const c of CATEGORY_ORDER) if (r.categories[c] != null) cats[c].push(r.categories[c] as number);
    for (const [id, v] of Object.entries(r.ratioValues)) {
      if (v == null) continue;
      (ratioVals[id] ??= []).push(v);
    }
  }
  const categorySigma = Object.fromEntries(CATEGORY_ORDER.map((c) => [c, stddev(cats[c])])) as Record<CategoryId, number>;
  const ratioSigma = Object.fromEntries(Object.entries(ratioVals).map(([id, v]) => [id, stddev(v)]));
  return {
    report: {
      method: "Monte-Carlo landmark jitter (Gaussian, σ scaled by face size and image quality), deterministic seed",
      samples,
      jitterPx,
      overallSigma: stddev(overall),
      proportionSigma: stddev(proportion),
      harmonySigma: stddev(harmony),
      symmetrySigma: stddev(symmetry),
      categorySigma,
    },
    ratioSigma,
  };
}
