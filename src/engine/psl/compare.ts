/**
 * Comparison of stored PSL ratings (same profile over time, or different
 * profiles) and progress series. Pure functions; the UI and tests share them.
 *
 * Comparability rules: scores are only directly comparable when the rubric
 * version matches; differing engine versions, scales, coverage, image quality
 * or profile-view usage are reported as warnings, never hidden.
 */
import type { CriterionId, RubricArea } from "./rubric";
import { RUBRIC_AREAS } from "./rubric";
import type { QualityLevel } from "../types";
import type { RatingResult } from "./rating";

export interface CompareItem {
  id: string;
  label: string;
  createdAt: string;
  result: RatingResult;
}

export type CompareWarningCode = "rubricVersion" | "engineVersion" | "scaleDiffers" | "coverageDiffers" | "qualityDiffers" | "sideViewDiffers" | "provisional" | "invalid" | "visualDiffers";

export interface CompareWarning {
  code: CompareWarningCode;
  params?: Record<string, string | number>;
}

export interface ValueRow<I extends string> {
  id: I;
  values: (number | null)[];
  /** value − reference value (index 0); null when either is missing */
  deltas: (number | null)[];
  spread: number | null;
}

export interface CriterionRow extends ValueRow<CriterionId> {
  area: RubricArea;
  /** assessable in every compared rating */
  common: boolean;
}

export interface Comparison {
  items: { id: string; label: string; createdAt: string; score: number | null; tierName: string | null; tierColor: string | null; scaleName: string; scaleVersion: number; rubricVersion: string; engineVersion: string; coverage: number; confidence: number; valid: boolean; provisional: boolean; quality: QualityLevel; sideUsed: boolean; visualUsed: boolean }[];
  scoreDeltas: (number | null)[];
  areas: ValueRow<RubricArea>[];
  criteria: CriterionRow[];
  /** criteria with the largest positive / negative delta of the LAST item vs. the reference (common criteria only) */
  gains: CriterionRow[];
  losses: CriterionRow[];
  warnings: CompareWarning[];
  /** same rubric version everywhere */
  comparable: boolean;
  commonCriteria: number;
}

const COVERAGE_WARN = 0.1;

function row<I extends string>(id: I, values: (number | null)[]): ValueRow<I> {
  const ref = values[0];
  const deltas = values.map((v, i) => (i === 0 ? (v == null ? null : 0) : v == null || ref == null ? null : v - ref));
  const present = values.filter((v): v is number => v != null);
  const spread = present.length >= 2 ? Math.max(...present) - Math.min(...present) : null;
  return { id, values, deltas, spread };
}

export function compareRatings(items: CompareItem[]): Comparison {
  if (items.length < 2) throw new Error("At least two ratings are required.");
  const results = items.map((i) => i.result);
  const warnings: CompareWarning[] = [];
  const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));
  const rubrics = uniq(results.map((r) => r.rubricVersion));
  const engines = uniq(results.map((r) => r.engineVersion));
  const scales = uniq(results.map((r) => `${r.scale.scaleId}@${r.scale.version}`));
  if (rubrics.length > 1) warnings.push({ code: "rubricVersion", params: { versions: rubrics.join(", ") } });
  if (engines.length > 1) warnings.push({ code: "engineVersion", params: { versions: engines.join(", ") } });
  if (scales.length > 1) warnings.push({ code: "scaleDiffers", params: { scales: uniq(results.map((r) => `${r.scale.name} v${r.scale.version}`)).join(", ") } });
  const covs = results.map((r) => r.coverage);
  if (Math.max(...covs) - Math.min(...covs) > COVERAGE_WARN) warnings.push({ code: "coverageDiffers", params: { min: Math.round(Math.min(...covs) * 100), max: Math.round(Math.max(...covs) * 100) } });
  const levels = uniq(results.map((r) => r.quality.frontalLevel));
  if (levels.length > 1) warnings.push({ code: "qualityDiffers", params: { levels: levels.join(", ") } });
  const sides = uniq(results.map((r) => r.quality.sideUsed));
  if (sides.length > 1) warnings.push({ code: "sideViewDiffers" });
  const visuals = uniq(results.map((r) => r.quality.visualUsed));
  if (visuals.length > 1) warnings.push({ code: "visualDiffers" });
  if (results.some((r) => r.provisional)) warnings.push({ code: "provisional", params: { n: results.filter((r) => r.provisional).length } });
  if (results.some((r) => r.score == null)) warnings.push({ code: "invalid", params: { n: results.filter((r) => r.score == null).length } });

  const areas = RUBRIC_AREAS.map((a) => row(a, results.map((r) => r.areas.find((x) => x.id === a)?.score ?? null)));
  const ids = results[0].criteria.map((c) => c.id);
  const criteria: CriterionRow[] = ids.map((id) => {
    const values = results.map((r) => {
      const c = r.criteria.find((x) => x.id === id);
      return c && c.assessable ? c.score : null;
    });
    const base = row(id, values);
    return { ...base, area: results[0].criteria.find((c) => c.id === id)!.area, common: values.every((v) => v != null) };
  });
  const last = items.length - 1;
  const commonRows = criteria.filter((c) => c.common && c.deltas[last] != null);
  const gains = [...commonRows].filter((c) => c.deltas[last]! > 0.05).sort((a, b) => b.deltas[last]! - a.deltas[last]!).slice(0, 5);
  const losses = [...commonRows].filter((c) => c.deltas[last]! < -0.05).sort((a, b) => a.deltas[last]! - b.deltas[last]!).slice(0, 5);
  const ref = results[0].score;
  return {
    items: items.map((it) => ({
      id: it.id, label: it.label, createdAt: it.createdAt, score: it.result.score, tierName: it.result.tier?.name ?? null, tierColor: it.result.tier?.color ?? null,
      scaleName: it.result.scale.name, scaleVersion: it.result.scale.version, rubricVersion: it.result.rubricVersion, engineVersion: it.result.engineVersion, coverage: it.result.coverage, confidence: it.result.confidence,
      valid: it.result.valid, provisional: it.result.provisional, quality: it.result.quality.frontalLevel, sideUsed: it.result.quality.sideUsed, visualUsed: it.result.quality.visualUsed,
    })),
    scoreDeltas: results.map((r, i) => (i === 0 ? (r.score == null ? null : 0) : r.score == null || ref == null ? null : r.score - ref)),
    areas,
    criteria,
    gains,
    losses,
    warnings,
    comparable: rubrics.length === 1,
    commonCriteria: criteria.filter((c) => c.common).length,
  };
}

export interface ProgressPoint {
  id: string;
  createdAt: string;
  score: number | null;
  coverage: number;
  valid: boolean;
  provisional: boolean;
  rubricVersion: string;
  tierName: string | null;
}

export interface ProgressStep {
  fromId: string;
  toId: string;
  days: number;
  scoreDelta: number | null;
  comparable: boolean;
  biggestChanges: { id: CriterionId; delta: number }[];
}

export interface ProgressSeries {
  points: ProgressPoint[];
  steps: ProgressStep[];
  first: number | null;
  latest: number | null;
  best: number | null;
  /** latest − first (only when both exist and rubric versions match) */
  totalDelta: number | null;
  /** mean absolute score change per step (comparable steps only) */
  meanStep: number | null;
}

/** Chronological progress of one profile's ratings (any order of input). */
export function progressSeries(items: CompareItem[]): ProgressSeries {
  const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const points: ProgressPoint[] = sorted.map((it) => ({ id: it.id, createdAt: it.createdAt, score: it.result.score, coverage: it.result.coverage, valid: it.result.valid, provisional: it.result.provisional, rubricVersion: it.result.rubricVersion, tierName: it.result.tier?.name ?? null }));
  const steps: ProgressStep[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    const comparable = a.result.rubricVersion === b.result.rubricVersion;
    const changes: { id: CriterionId; delta: number }[] = [];
    for (const c of b.result.criteria) {
      const prev = a.result.criteria.find((x) => x.id === c.id);
      if (c.assessable && c.score != null && prev?.assessable && prev.score != null) changes.push({ id: c.id, delta: c.score - prev.score });
    }
    changes.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta));
    steps.push({ fromId: a.id, toId: b.id, days: (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) / 86_400_000, scoreDelta: comparable && a.result.score != null && b.result.score != null ? b.result.score - a.result.score : null, comparable, biggestChanges: changes.slice(0, 3) });
  }
  const scored = points.filter((p) => p.score != null);
  const first = scored[0]?.score ?? null;
  const latest = scored[scored.length - 1]?.score ?? null;
  const best = scored.length ? Math.max(...scored.map((p) => p.score!)) : null;
  const sameRubric = new Set(points.map((p) => p.rubricVersion)).size === 1;
  const comparableSteps = steps.filter((s) => s.scoreDelta != null);
  return {
    points, steps, first, latest, best,
    totalDelta: sameRubric && first != null && latest != null && scored.length >= 2 ? latest - first : null,
    meanStep: comparableSteps.length ? comparableSteps.reduce((s, x) => s + Math.abs(x.scoreDelta!), 0) / comparableSteps.length : null,
  };
}

// ---------------------------------------------------------------- raw frontal analyses
import type { AnalysisResult, Availability, CategoryId, RatioId } from "../types";
import { CATEGORY_ORDER, RATIO_BY_ID, RATIO_DEFINITIONS } from "../ratios/database";

export interface AnalysisCompareItem {
  id: string;
  label: string;
  createdAt: string;
  result: AnalysisResult;
}

export type AnalysisCompareWarningCode = "engineVersion" | "qualityDiffers" | "hairlineDiffers" | "coverageDiffers" | "configDiffers" | "unusable" | "captureDistanceDiffers";

export interface AnalysisCompareWarning {
  code: AnalysisCompareWarningCode;
  params?: Record<string, string | number>;
}

export interface RatioCompareRow {
  id: RatioId;
  number: number;
  unit: string;
  values: (number | null)[];
  indices: (number | null)[];
  inT1: (boolean | null)[];
  availability: Availability[];
  valueDeltas: (number | null)[];
  indexDeltas: (number | null)[];
  /** available in every analysis */
  common: boolean;
}

export type ScoreKey = "overall" | "proportion" | "harmony" | "structure" | "symmetry";

export interface AnalysisComparison {
  items: { id: string; label: string; createdAt: string; engineVersion: string; quality: AnalysisResult["quality"]["level"]; analyzable: boolean; coverage: number; evaluable: number; total: number; confidence: number; hairline: boolean; includeReconstructed: boolean; captureDistance: string; overall: number | null }[];
  scores: ValueRow<ScoreKey>[];
  categories: ValueRow<CategoryId>[];
  symmetryMetrics: ValueRow<string>[];
  ratios: RatioCompareRow[];
  /** ratios whose index improved / worsened most in the last analysis vs. the reference (common ratios only) */
  gains: RatioCompareRow[];
  losses: RatioCompareRow[];
  warnings: AnalysisCompareWarning[];
  comparable: boolean;
  commonRatios: number;
}

export function compareAnalyses(items: AnalysisCompareItem[]): AnalysisComparison {
  if (items.length < 2) throw new Error("At least two analyses are required.");
  const results = items.map((i) => i.result);
  const uniq = <T,>(xs: T[]) => Array.from(new Set(xs));
  const warnings: AnalysisCompareWarning[] = [];
  const engines = uniq(results.map((r) => r.engineVersion));
  if (engines.length > 1) warnings.push({ code: "engineVersion", params: { versions: engines.join(", ") } });
  const levels = uniq(results.map((r) => r.quality.level));
  if (levels.length > 1) warnings.push({ code: "qualityDiffers", params: { levels: levels.join(", ") } });
  const hair = results.map((r) => r.landmarks.some((l) => l.id === "trichion"));
  if (uniq(hair).length > 1) warnings.push({ code: "hairlineDiffers" });
  const covs = results.map((r) => r.coverage.fraction);
  if (Math.max(...covs) - Math.min(...covs) > 0.1) warnings.push({ code: "coverageDiffers", params: { min: Math.round(Math.min(...covs) * 100), max: Math.round(Math.max(...covs) * 100) } });
  if (uniq(results.map((r) => r.config.includeReconstructed)).length > 1) warnings.push({ code: "configDiffers" });
  if (uniq(results.map((r) => r.config.captureDistance)).length > 1) warnings.push({ code: "captureDistanceDiffers", params: { values: uniq(results.map((r) => r.config.captureDistance)).join(", ") } });
  if (results.some((r) => !r.quality.analyzable)) warnings.push({ code: "unusable", params: { n: results.filter((r) => !r.quality.analyzable).length } });

  const scoreKeys: ScoreKey[] = ["overall", "proportion", "harmony", "structure", "symmetry"];
  const scores = scoreKeys.map((k) => row(k, results.map((r) => r.scores[k])));
  const categories = CATEGORY_ORDER.map((c) => row(c, results.map((r) => r.categories.find((x) => x.id === c)?.index ?? null)));
  const metricIds = uniq(results.flatMap((r) => r.symmetry.metrics.map((m) => m.id)));
  const symmetryMetrics = metricIds.map((id) => row(id, results.map((r) => r.symmetry.metrics.find((m) => m.id === id)?.score ?? null)));
  const ratios: RatioCompareRow[] = RATIO_DEFINITIONS.map((def) => {
    const rs = results.map((r) => r.ratios.find((x) => x.id === def.id));
    const values = rs.map((x) => (x && x.availability === "available" ? x.value : null));
    const indices = rs.map((x) => (x && x.availability === "available" ? x.index : null));
    const v = row(def.id, values);
    const ix = row(def.id, indices);
    return { id: def.id, number: def.number, unit: def.unit, values, indices, inT1: rs.map((x) => (x && x.availability === "available" ? x.inT1 : null)), availability: rs.map((x) => x?.availability ?? "unavailable"), valueDeltas: v.deltas, indexDeltas: ix.deltas, common: values.every((x) => x != null) };
  });
  const last = items.length - 1;
  const common = ratios.filter((r) => r.common && r.indexDeltas[last] != null);
  const gains = [...common].filter((r) => r.indexDeltas[last]! > 1).sort((a, b) => b.indexDeltas[last]! - a.indexDeltas[last]!).slice(0, 5);
  const losses = [...common].filter((r) => r.indexDeltas[last]! < -1).sort((a, b) => a.indexDeltas[last]! - b.indexDeltas[last]!).slice(0, 5);
  return {
    items: items.map((it, i) => ({ id: it.id, label: it.label, createdAt: it.createdAt, engineVersion: it.result.engineVersion, quality: it.result.quality.level, analyzable: it.result.quality.analyzable, coverage: it.result.coverage.fraction, evaluable: it.result.coverage.evaluable, total: it.result.coverage.total, confidence: it.result.scores.confidence, hairline: hair[i], includeReconstructed: it.result.config.includeReconstructed, captureDistance: it.result.config.captureDistance, overall: it.result.scores.overall })),
    scores, categories, symmetryMetrics, ratios, gains, losses, warnings,
    comparable: engines.length === 1,
    commonRatios: ratios.filter((r) => r.common).length,
  };
}

export function ratioName(id: RatioId): string {
  return RATIO_BY_ID[id].name;
}
