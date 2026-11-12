/**
 * Analysis orchestrator: mesh + quality inputs → complete AnalysisResult.
 */
import { alignMesh, buildLandmarks, frameMapper } from "./landmarks/mesh-map";
import { computeAdditional } from "./ratios/additional";
import { computeAppearance } from "./appearance";
import { checkHairline } from "./hairline-check";
import { CATEGORY_ORDER, RATIO_BY_ID } from "./ratios/database";
import { expectedIndex } from "./scoring/measurement";
import { evaluateRatios } from "./ratios/evaluate";
import { assessQuality } from "./quality/assess";
import { computeCategories, computeCoverage, computeOriginalScoring, harmonyIndex, overallScore, proportionScore, structureScore } from "./scoring/aggregate";
import { buildFeatures } from "./scoring/features";
import { computeSymmetry, debiasSymmetry } from "./scoring/symmetry";
import { aggregateHierarchy, frontalMeasures, type HierarchyResult } from "./scoring/hierarchy";
import { RUBRIC_VERSION } from "./psl/rubric";
import { REPEATABILITY_SAFETY } from "./landmarks/repeatability";
import { estimateUncertainty, type CoreScores } from "./scoring/uncertainty";
import type { AnalysisConfig, AnalysisInput, AnalysisResult, CategoryId } from "./types";
import { applyLandmarkPlan, applyMeasurePlan, isQcExcluded, rescoreSymmetry, type QcPlan } from "./verify/plan";
import { prepareVerification, runVerification } from "./verify/run";
import { finalControl } from "./verify/control";

import { ENGINE_VERSION } from "./version";
export { ENGINE_VERSION };

export const DEFAULT_CONFIG: AnalysisConfig = {
  includeReconstructed: true,
  captureDistance: "unknown",
  uncertaintySamples: 40,
  seed: 20251106,
};

/** Manual axis adjustments are limited to ±15° (larger tilts mean the detection, not the axis, is wrong). */
export const MAX_AXIS_ADJUST_DEG = 15;
const clampAxis = (d: number | undefined) => (d && Number.isFinite(d) ? Math.max(-MAX_AXIS_ADJUST_DEG, Math.min(MAX_AXIS_ADJUST_DEG, d)) : 0);

/**
 * Point results without uncertainty simulation (also used by the ideal-example optimiser).
 * engine 3.1: `plan` applies the outcome of the quality control (rejected/uncertain/
 * corrected landmarks, measures that failed their check).
 */
export function computeCore(input: AnalysisInput, plan?: QcPlan | null) {
  const am = alignMesh(input.mesh, clampAxis(input.corrections?.axisAdjustDeg));
  const built = buildLandmarks(input, am);
  const map = plan ? applyLandmarkPlan(built.map, plan, frameMapper(am).toAligned) : built.map;
  const list = built.list;
  const quality = assessQuality(input, map, am.rollDeg, am.pose3d ?? null);
  const ratios = evaluateRatios(map, quality, input.config);
  const symmetry = computeSymmetry(map, quality);
  const additional = computeAdditional(map, ratios, quality, am.aligned);
  if (plan) applyMeasurePlan(ratios, symmetry, additional, plan);
  const categories = computeCategories(ratios);
  const harmony = harmonyIndex(ratios);
  const proportion = proportionScore(categories);
  const structure = structureScore(categories);
  const hierarchy = aggregateHierarchy(frontalMeasures(ratios, symmetry, additional));
  return { am, map, list, quality, ratios, symmetry, additional, categories, harmony, proportion, structure, hierarchy, overall: hierarchy.overall };
}

/** Legacy (engine 1.x) composite, kept for the transparency panel. */
export function legacyOverall(proportion: number | null, symmetry: number | null): number | null {
  return overallScore(proportion, symmetry);
}

function rubricSummary(h: HierarchyResult): NonNullable<AnalysisResult["scores"]["rubric"]> {
  return {
    version: RUBRIC_VERSION,
    categories: Object.fromEntries(h.categories.map((c) => [c.id, c.index])),
    overallArithmetic: h.overallArithmetic,
    compensationPenalty: h.compensationPenalty,
    coverage: h.coverage,
    p: h.p,
  };
}

/** Point scores of one (jittered) input; exported for the noise-model research tests. */
export function coreScores(input: AnalysisInput, plan?: QcPlan | null): CoreScores {
  const c = computeCore(input, plan);
  return {
    overall: c.overall,
    proportion: c.proportion,
    harmony: c.harmony.index,
    symmetry: c.symmetry.score,
    categories: Object.fromEntries(c.categories.map((x) => [x.id, x.index])) as Record<CategoryId, number | null>,
    ratioValues: Object.fromEntries(c.ratios.map((r) => [r.id, r.availability === "available" ? r.value : null])),
    rubric: Object.fromEntries(c.hierarchy.categories.map((x) => [x.id, x.index])),
    symSigned: Object.fromEntries(c.symmetry.metrics.filter((m) => m.signed !== undefined).map((m) => [m.id, m.signed!])),
    measures: Object.fromEntries(Array.from(frontalMeasures(c.ratios, c.symmetry, c.additional).entries()).map(([k, m]) => [k, m.index])),
  };
}

export function analyzeFace(rawInput: AnalysisInput): AnalysisResult {
  let input: AnalysisInput = { ...rawInput, config: { ...DEFAULT_CONFIG, ...rawInput.config } };
  // engine 3.1: several detections of the same photo → verified (median) landmarks
  const ctx = prepareVerification(input);
  if (ctx) input = ctx.verified;
  // hair over the forehead: an estimated hairline far below any natural position is not used
  const hair = checkHairline(input.mesh, input.trichion?.point);
  if (hair.covered && input.trichion?.source === "estimated") {
    input = { ...input, trichion: null, hairlineCovered: { share: hair.share! } };
    if (ctx) ctx.inputs = ctx.inputs.map((pi) => ({ ...pi, trichion: null, hairlineCovered: { share: hair.share! } }));
  }
  const hairlineLow = hair.covered && input.trichion?.source === "manual" ? hair.share! : null;
  // quality control stages 1–2: landmarks, measurements, reproducibility (re-analysed when rejected)
  const qcRun = runVerification(ctx, input, (inp, p) => computeCore(inp, p));
  const plan = qcRun.plan;
  const c = computeCore(input, plan);
  const coverage = computeCoverage(c.ratios);
  const original = computeOriginalScoring(c.ratios);

  const unc = estimateUncertainty(input, c.quality, (inp) => coreScores(inp, plan), input.config.uncertaintySamples, input.config.seed);
  if (unc) {
    for (const r of c.ratios) {
      const s = unc.ratioSigma[r.id];
      if (s !== undefined) r.valueSigma = s;
      // engine 2.0: index = expectation over the measurement uncertainty of the value
      if (r.availability === "available" && r.value != null && s !== undefined && !isQcExcluded(r.qc)) {
        const def = RATIO_BY_ID[r.id];
        r.index = expectedIndex(r.value, s, def.t1, def.tolerance);
      }
    }
    // symmetry without the landmark-noise floor; the best noise estimate is the MC σ
    // without the conservative safety factor (that factor only widens reported σ)
    c.symmetry = rescoreSymmetry(debiasSymmetry(c.symmetry, Object.fromEntries(Object.entries(unc.symmetryMetricSigma).map(([k, v]) => [k, v / REPEATABILITY_SAFETY]))));
    // aggregates from the uncertainty-aware indices
    c.categories = computeCategories(c.ratios);
    c.harmony = harmonyIndex(c.ratios);
    c.proportion = proportionScore(c.categories);
    c.structure = structureScore(c.categories);
    c.hierarchy = aggregateHierarchy(frontalMeasures(c.ratios, c.symmetry, c.additional));
    c.overall = c.hierarchy.overall;
    for (const cat of c.categories) cat.sigma = unc.report.categorySigma[cat.id];
    c.symmetry.sigma = unc.report.symmetrySigma;
  }

  // quality control stage 3: the final control instance re-checks the finished analysis
  const excludedKeys = new Set([...plan.measures.entries()].filter(([, q]) => isQcExcluded(q)).map(([k]) => k));
  const qc = finalControl({
    quality: c.quality,
    hierarchy: c.hierarchy,
    ratios: c.ratios,
    landmarks: qcRun.landmarks,
    measures: qcRun.measures,
    passes: qcRun.passes,
    overallSpread: qcRun.overallSpread,
    excludedKeys,
    criticalRejected: qcRun.criticalRejected,
    baseAssessable: qcRun.baseAssessable,
    iterations: qcRun.iterations,
    actions: qcRun.actions,
  });
  if (qc.status === "failed") c.overall = null;

  const scores: AnalysisResult["scores"] = {
    harmony: c.harmony.index,
    proportion: c.proportion,
    structure: c.structure,
    symmetry: c.symmetry.score,
    overall: c.overall,
    rubric: rubricSummary(c.hierarchy),
    confidence: c.harmony.confidence,
  };

  const warnings: string[] = [];
  const warningCodes: NonNullable<AnalysisResult["warningCodes"]> = [];
  if (!c.quality.analyzable) {
    warnings.push("Image quality is unusable; results are shown for transparency only and must not be used for comparison.");
    warningCodes.push({ code: "unusable" });
  }
  if (coverage.fraction < 0.6) {
    warnings.push(`Only ${coverage.evaluable} of ${coverage.total} ratios are evaluable; scores are coverage-adjusted and less comparable.`);
    warningCodes.push({ code: "lowCoverage", params: { evaluable: coverage.evaluable, total: coverage.total } });
  }
  if (coverage.uncertain > 0) {
    warnings.push(`${coverage.uncertain} evaluable ratio(s) have low confidence.`);
    warningCodes.push({ code: "uncertainRatios", params: { n: coverage.uncertain } });
  }
  if (input.hairlineCovered) {
    warnings.push(`Hairline covered by hair: the skin/hair transition gives an upper third of only ${input.hairlineCovered.share.toFixed(0)} % (natural range starts near 23 %); thirds, forehead, TFWHR, LFF and eye–mouth length are not evaluated.`);
    warningCodes.push({ code: "hairlineCovered", params: { share: Math.round(input.hairlineCovered.share) } });
  } else if (!c.map.trichion) {
    warnings.push("Hairline not available: thirds, TFWHR, LFF and FWHF are not evaluated.");
    warningCodes.push({ code: "noHairline" });
  }
  if (hairlineLow != null) {
    warnings.push(`The placed hairline gives an upper third of only ${hairlineLow.toFixed(0)} % — check that hair does not cover the forehead.`);
    warningCodes.push({ code: "hairlineLow", params: { share: Math.round(hairlineLow) } });
  }
  const corrected = c.list.filter((l) => l.corrected).map((l) => l.id);
  const axisAdjustDeg = clampAxis(input.corrections?.axisAdjustDeg);
  if (corrected.length || axisAdjustDeg) {
    warnings.push(`Manually corrected: ${corrected.length} landmark(s)${axisAdjustDeg ? `, reference axis ${axisAdjustDeg > 0 ? "+" : ""}${axisAdjustDeg.toFixed(1)}°` : ""}. Results depend on the manual placement.`);
    warningCodes.push({ code: "corrected", params: { n: corrected.length, axis: axisAdjustDeg } });
  }
  if (qc.status === "failed") {
    warnings.push(`Quality control failed (${qc.checks.filter((x) => x.status === "fail").map((x) => x.id).join(", ")}): no overall result is given.`);
    warningCodes.push({ code: "qcFailed" });
  } else if (qc.status === "limited") {
    warnings.push(`Quality control passed with restrictions (${qc.checks.filter((x) => x.status === "warn").map((x) => x.id).join(", ")}).`);
    warningCodes.push({ code: "qcLimited" });
  }
  if (c.quality.expression.smile > 0.45) {
    warnings.push("Smile detected: mouth, lip, eye-opening and lower-third measurements carry reduced confidence.");
    warningCodes.push({ code: "smile" });
  }

  const features = buildFeatures({ ratios: c.ratios, symmetry: c.symmetry, categories: c.categories, scores, map: c.map });
  const additional = c.additional;

  return {
    engineVersion: ENGINE_VERSION,
    createdAt: new Date().toISOString(),
    config: input.config,
    landmarks: c.list,
    mesh: c.am,
    quality: c.quality,
    ratios: c.ratios,
    additional,
    appearance: computeAppearance(c.am.aligned, input.appearanceImage, { eyesOpen: !c.quality.issues.some((i) => i.code === "eyes-closed") }),
    symmetry: c.symmetry,
    features,
    categories: c.categories,
    original,
    coverage,
    scores,
    uncertainty: unc?.report ?? null,
    corrections: corrected.length || axisAdjustDeg ? { landmarks: corrected, axisAdjustDeg } : null,
    qc,
    warnings,
    warningCodes,
  };
}

export { CATEGORY_ORDER };
