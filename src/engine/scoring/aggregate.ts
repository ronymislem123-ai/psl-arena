import { CATEGORY_META, CATEGORY_ORDER, RATIO_BY_ID, RATIO_DEFINITIONS } from "../ratios/database";
import type { CategoryId, CategoryScore, Coverage, OriginalScoring, RatioResult } from "../types";
import { THEORETICAL_MAX } from "./tiers";

function weightedIndex(results: RatioResult[]): { index: number | null; confidence: number; ids: RatioResult["id"][] } {
  let num = 0;
  let den = 0;
  let confSum = 0;
  const ids: RatioResult["id"][] = [];
  for (const r of results) {
    if (r.availability !== "available" || r.index === null) continue;
    const w = RATIO_BY_ID[r.id].weight * Math.max(r.confidence, 0.05);
    num += w * r.index;
    den += w;
    confSum += r.confidence;
    ids.push(r.id);
  }
  return { index: den > 0 ? num / den : null, confidence: ids.length ? confSum / ids.length : 0, ids };
}

export function computeCategories(results: RatioResult[]): CategoryScore[] {
  return CATEGORY_ORDER.map((cat): CategoryScore => {
    const members = results.filter((r) => RATIO_BY_ID[r.id].category === cat);
    const w = weightedIndex(members);
    return {
      id: cat,
      label: CATEGORY_META[cat].label,
      index: w.index,
      coverage: { available: w.ids.length, total: members.length },
      confidence: w.confidence,
      contributors: w.ids,
      weight: CATEGORY_META[cat].weight,
    };
  });
}

export function harmonyIndex(results: RatioResult[]): { index: number | null; confidence: number } {
  const w = weightedIndex(results);
  return { index: w.index, confidence: w.confidence };
}

export function proportionScore(categories: CategoryScore[]): number | null {
  let num = 0;
  let den = 0;
  for (const c of categories) {
    if (c.index === null) continue;
    num += c.weight * c.index;
    den += c.weight;
  }
  return den > 0 ? num / den : null;
}

const STRUCTURE_WEIGHTS: Partial<Record<CategoryId, number>> = { jawline: 0.4, midface: 0.3, structure: 0.3 };

export function structureScore(categories: CategoryScore[]): number | null {
  let num = 0;
  let den = 0;
  for (const c of categories) {
    const w = STRUCTURE_WEIGHTS[c.id];
    if (!w || c.index === null) continue;
    num += w * c.index;
    den += w;
  }
  return den > 0 ? num / den : null;
}

export function overallScore(proportion: number | null, symmetry: number | null): number | null {
  if (proportion === null) return null;
  if (symmetry === null) return proportion;
  return 0.8 * proportion + 0.2 * symmetry;
}

export function computeCoverage(results: RatioResult[]): Coverage {
  const total = RATIO_DEFINITIONS.length;
  const evaluable = results.filter((r) => r.availability === "available").length;
  const incomplete = results.filter((r) => RATIO_BY_ID[r.id].status === "incomplete").length;
  const excluded = results.filter((r) => r.availability === "excluded").length;
  const unavailable = results.filter((r) => r.availability === "unavailable" && RATIO_BY_ID[r.id].status !== "incomplete").length;
  const uncertain = results.filter((r) => r.availability === "available" && r.uncertain).length;
  return { evaluable, total, unavailable, incomplete, excluded, uncertain, fraction: evaluable / total };
}

export function computeOriginalScoring(results: RatioResult[]): OriginalScoring {
  const available = results.filter((r) => r.availability === "available");
  const t1 = available.filter((r) => r.inT1 === true);
  const outside = available.filter((r) => r.inT1 === false);
  const undetermined = outside.filter((r) => r.tier === null);
  const points = available.reduce((s, r) => s + (r.tierPoints ?? 0), 0);
  const coverage = computeCoverage(results);
  const allDetermined = coverage.evaluable === coverage.total && undetermined.length === 0;
  return {
    system: "T1–T5 (source material)",
    t1Count: t1.length,
    outsideT1Count: outside.length,
    evaluableCount: available.length,
    unavailableCount: coverage.unavailable + coverage.excluded,
    incompleteCount: coverage.incomplete,
    uncertainCount: coverage.uncertain,
    pointsFromT1: t1.length * 10,
    theoreticalMax: THEORETICAL_MAX,
    originalPercent: allDetermined ? (points / THEORETICAL_MAX) * 100 : null,
    originalPercentNote: allDetermined
      ? "All 42 ratios evaluated with determinable tiers."
      : `The original ${THEORETICAL_MAX}-point percentage requires all 42 ratios with determinable T1–T5 tiers. ${coverage.total - coverage.evaluable} ratio(s) are not evaluable and ${undetermined.length} measured ratio(s) fall outside T1 without defined outer tiers, so it cannot be computed.`,
    coverageAdjustedT1Percent: available.length ? (t1.length / available.length) * 100 : null,
    undeterminedTierCount: undetermined.length,
  };
}
