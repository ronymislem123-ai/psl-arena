/**
 * Analysis orchestrator: mesh + quality inputs → complete AnalysisResult.
 */
import { alignMesh, buildLandmarks } from "./landmarks/mesh-map";
import { computeAdditional } from "./ratios/additional";
import { CATEGORY_ORDER } from "./ratios/database";
import { evaluateRatios } from "./ratios/evaluate";
import { assessQuality } from "./quality/assess";
import { computeCategories, computeCoverage, computeOriginalScoring, harmonyIndex, overallScore, proportionScore, structureScore } from "./scoring/aggregate";
import { buildFeatures } from "./scoring/features";
import { computeSymmetry } from "./scoring/symmetry";
import { estimateUncertainty, type CoreScores } from "./scoring/uncertainty";
import type { AnalysisConfig, AnalysisInput, AnalysisResult, CategoryId } from "./types";

export const ENGINE_VERSION = "1.0.0";

export const DEFAULT_CONFIG: AnalysisConfig = {
  includeReconstructed: true,
  captureDistance: "unknown",
  uncertaintySamples: 40,
  seed: 20251106,
};

function computeCore(input: AnalysisInput) {
  const am = alignMesh(input.mesh);
  const { map, list } = buildLandmarks(input, am);
  const quality = assessQuality(input, map, am.rollDeg);
  const ratios = evaluateRatios(map, quality, input.config);
  const symmetry = computeSymmetry(map, quality);
  const categories = computeCategories(ratios);
  const harmony = harmonyIndex(ratios);
  const proportion = proportionScore(categories);
  const structure = structureScore(categories);
  const overall = overallScore(proportion, symmetry.score);
  return { am, map, list, quality, ratios, symmetry, categories, harmony, proportion, structure, overall };
}

function coreScores(input: AnalysisInput): CoreScores {
  const c = computeCore(input);
  return {
    overall: c.overall,
    proportion: c.proportion,
    harmony: c.harmony.index,
    symmetry: c.symmetry.score,
    categories: Object.fromEntries(c.categories.map((x) => [x.id, x.index])) as Record<CategoryId, number | null>,
    ratioValues: Object.fromEntries(c.ratios.map((r) => [r.id, r.availability === "available" ? r.value : null])),
  };
}

export function analyzeFace(rawInput: AnalysisInput): AnalysisResult {
  const input: AnalysisInput = { ...rawInput, config: { ...DEFAULT_CONFIG, ...rawInput.config } };
  const c = computeCore(input);
  const coverage = computeCoverage(c.ratios);
  const original = computeOriginalScoring(c.ratios);

  const unc = estimateUncertainty(input, c.quality, coreScores, input.config.uncertaintySamples, input.config.seed);
  if (unc) {
    for (const r of c.ratios) {
      const s = unc.ratioSigma[r.id];
      if (s !== undefined) r.valueSigma = s;
    }
    for (const cat of c.categories) cat.sigma = unc.report.categorySigma[cat.id];
    c.symmetry.sigma = unc.report.symmetrySigma;
  }

  const scores: AnalysisResult["scores"] = {
    harmony: c.harmony.index,
    proportion: c.proportion,
    structure: c.structure,
    symmetry: c.symmetry.score,
    overall: c.overall,
    confidence: c.harmony.confidence,
  };

  const warnings: string[] = [];
  if (!c.quality.analyzable) warnings.push("Image quality is unusable; results are shown for transparency only and must not be used for comparison.");
  if (coverage.fraction < 0.6) warnings.push(`Only ${coverage.evaluable} of ${coverage.total} ratios are evaluable; scores are coverage-adjusted and less comparable.`);
  if (coverage.uncertain > 0) warnings.push(`${coverage.uncertain} evaluable ratio(s) have low confidence.`);
  if (!c.map.trichion) warnings.push("Hairline not available: thirds, TFWHR, LFF and FWHF are not evaluated.");
  if (c.quality.expression.smile > 0.45) warnings.push("Smile detected: mouth, lip, eye-opening and lower-third measurements carry reduced confidence.");

  const features = buildFeatures({ ratios: c.ratios, symmetry: c.symmetry, categories: c.categories, scores, map: c.map });
  const additional = computeAdditional(c.map, c.ratios, c.quality);

  return {
    engineVersion: ENGINE_VERSION,
    createdAt: new Date().toISOString(),
    config: input.config,
    landmarks: c.list,
    mesh: c.am,
    quality: c.quality,
    ratios: c.ratios,
    additional,
    symmetry: c.symmetry,
    features,
    categories: c.categories,
    original,
    coverage,
    scores,
    uncertainty: unc?.report ?? null,
    warnings,
  };
}

export { CATEGORY_ORDER };
