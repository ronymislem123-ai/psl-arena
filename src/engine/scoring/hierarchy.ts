/**
 * Hierarchical, non-compensatory aggregation (rubric 2.0).
 *
 *   measure index (0–100) ──weighted mean──▶ criterion (one trait)
 *   criterion indices ──weighted power mean p──▶ category (A–G)
 *   category indices ──weighted power mean p, category weights──▶ overall
 *
 * Within a criterion the measures describe the same trait, so they are averaged
 * (weights = dependency-adjusted ratio weight × landmark reliability × confidence).
 * Between distinct traits and between categories the weighted power mean with
 * p = 0.5 is used: it is monotone in every input, equals the arithmetic mean when
 * all inputs agree, and gives an excellent trait diminishing returns, so one
 * outstanding feature cannot offset several weak ones 1:1. The difference to the
 * arithmetic mean is reported as the "compensation penalty" (interaction term).
 *
 * Used by the frontal analysis (frontal measures only) and by the PSL rater
 * (frontal + profile + optional visual criteria) so that both report the same model.
 */
import { RATIO_BY_ID } from "../ratios/database";
import type { AdditionalMeasurementResult, RatioResult, SymmetryResult } from "../types";
import { AGGREGATION_P, CATEGORY_WEIGHTS, CRITERIA, EYE_MOUTH_LENGTH, EYELID_RANGES, measureReliability, RUBRIC_AREAS, DERIVED_TOLERANCE, type CriterionDefinition, type CriterionId, type RubricArea } from "../psl/rubric";
import { plateauIndex } from "./measurement";

export type MeasureSource = "frontal" | "profile" | "visual";

export interface Measure {
  /** 0–100 */
  index: number;
  /** 0–1 measurement confidence (pose, quality, expression) */
  confidence: number;
  /** 0–1 landmark reliability (attenuation) */
  reliability: number;
  /** dependency-adjusted relative weight inside the criterion */
  weight: number;
  source: MeasureSource;
}

/** keys: r:<RatioId>, s:<symmetry metric>, a:<AdditionalMeasurementId>, p:<SideMeasurementId>, v:<CriterionId> */
export type MeasureMap = Map<string, Measure>;

export function measureKeys(def: CriterionDefinition): string[] {
  const k: string[] = [];
  for (const id of def.inputs.ratios ?? []) k.push(`r:${id}`);
  for (const id of def.inputs.symmetry ?? []) k.push(`s:${id}`);
  for (const id of def.inputs.additional ?? []) k.push(`a:${id}`);
  for (const id of def.inputs.side ?? []) k.push(`p:${id}`);
  if (def.method === "visual") k.push(`v:${def.id}`);
  return k;
}

/** Index of the derived/additional frontal measures that rubric 2.0 scores. */
export function additionalIndex(id: string, value: number): number | null {
  if (id === "FIFTHS") return plateauIndex(value, { min: null, max: 0 }, DERIVED_TOLERANCE.fifthsPp);
  if (id === "EML") return plateauIndex(value, { min: EYE_MOUTH_LENGTH.min, max: EYE_MOUTH_LENGTH.max }, EYE_MOUTH_LENGTH.s);
  if (id === "MRD1") return plateauIndex(value, EYELID_RANGES.MRD1.range, EYELID_RANGES.MRD1.s);
  if (id === "SSI") return plateauIndex(value, EYELID_RANGES.SSI.range, EYELID_RANGES.SSI.s);
  return null;
}

const ADDITIONAL_RELIABILITY: Record<string, number> = {
  FIFTHS: measureReliability(["zygion_R", "zygion_L"]),
  EML: measureReliability(["trichion"]),
  // lid margins of the mesh: moderate agreement with manual annotation; weighted like the soft-tissue contour points
  MRD1: 0.6,
  SSI: 0.6,
};

/** Frontal measure map from an analysis' parts (point estimates). */
export function frontalMeasures(ratios: RatioResult[], symmetry: SymmetryResult, additional: AdditionalMeasurementResult[]): MeasureMap {
  const m: MeasureMap = new Map();
  for (const r of ratios) {
    if (r.availability !== "available" || r.index == null || r.excludedFromScore) continue;
    const def = RATIO_BY_ID[r.id];
    m.set(`r:${r.id}`, { index: r.index, confidence: r.confidence, reliability: measureReliability(def.landmarks), weight: def.weight, source: "frontal" });
  }
  for (const s of symmetry.metrics) m.set(`s:${s.id}`, { index: s.score, confidence: symmetry.confidence, reliability: measureReliability(s.landmarks), weight: 1, source: "frontal" });
  for (const a of additional) {
    if (a.availability !== "available" || a.value == null) continue;
    const idx = additionalIndex(a.id, a.value);
    if (idx == null) continue;
    m.set(`a:${a.id}`, { index: idx, confidence: a.confidence, reliability: ADDITIONAL_RELIABILITY[a.id] ?? 1, weight: 1, source: "frontal" });
  }
  return m;
}

/** Weighted power mean (p ≠ 0) of non-negative values. */
export function powerMean(items: { x: number; w: number }[], p: number = AGGREGATION_P): number | null {
  let num = 0;
  let den = 0;
  let lo = Infinity;
  let hi = -Infinity;
  for (const { x, w } of items) {
    if (!(w > 0)) continue;
    num += w * Math.pow(Math.max(x, 0), p);
    den += w;
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  }
  if (den <= 0) return null;
  // a mean lies between its inputs; clamp the floating-point round trip of x^p
  return Math.min(hi, Math.max(lo, Math.pow(num / den, 1 / p)));
}

export interface CriterionAggregate {
  id: CriterionId;
  area: RubricArea;
  index: number | null;
  confidence: number;
  reliability: number;
  used: string[];
  missing: string[];
  fromFrontal: boolean;
  fromProfile: boolean;
  fromVisual: boolean;
}

export interface CategoryAggregate {
  id: RubricArea;
  index: number | null;
  /** arithmetic (fully compensatory) mean, for transparency */
  arithmetic: number | null;
  weight: number;
  /** share of the category's non-visual criteria that were assessable */
  coverage: number;
  confidence: number;
  assessed: number;
  total: number;
}

export interface HierarchyResult {
  criteria: CriterionAggregate[];
  categories: CategoryAggregate[];
  overall: number | null;
  /** arithmetic mean of the category indices with the same weights */
  overallArithmetic: number | null;
  /** overallArithmetic − overall (≥ 0): the interaction term */
  compensationPenalty: number | null;
  /** category-weighted share of the non-visual criteria that were assessable */
  coverage: number;
  /** weight-averaged confidence of the assessed criteria */
  confidence: number;
  p: number;
}

export function aggregateCriterion(def: CriterionDefinition, measures: MeasureMap): CriterionAggregate {
  const used: string[] = [];
  const missing: string[] = [];
  let num = 0;
  let den = 0;
  let conf = 0;
  let rel = 0;
  let fromFrontal = false;
  let fromProfile = false;
  let fromVisual = false;
  for (const key of measureKeys(def)) {
    const m = measures.get(key);
    if (!m) {
      missing.push(key);
      continue;
    }
    const w = m.weight * m.reliability * Math.max(m.confidence, 0.05);
    num += w * m.index;
    den += w;
    conf += m.weight * m.confidence;
    rel += m.weight * m.reliability;
    used.push(key);
    if (m.source === "frontal") fromFrontal = true;
    else if (m.source === "profile") fromProfile = true;
    else fromVisual = true;
  }
  const wsum = used.reduce((s, k) => s + measures.get(k)!.weight, 0);
  return {
    id: def.id,
    area: def.area,
    index: den > 0 ? num / den : null,
    confidence: wsum > 0 ? conf / wsum : 0,
    reliability: wsum > 0 ? rel / wsum : 0,
    used,
    missing,
    fromFrontal,
    fromProfile,
    fromVisual,
  };
}

export function aggregateHierarchy(measures: MeasureMap, p: number = AGGREGATION_P, criteriaDefs: CriterionDefinition[] = CRITERIA): HierarchyResult {
  const criteria = criteriaDefs.map((d) => aggregateCriterion(d, measures));
  const byId = new Map(criteriaDefs.map((d) => [d.id, d]));
  const categories: CategoryAggregate[] = RUBRIC_AREAS.map((area) => {
    const members = criteria.filter((c) => c.area === area);
    const geometric = members.filter((c) => byId.get(c.id)!.method !== "visual");
    const assessedGeo = geometric.filter((c) => c.index != null);
    const items = members.filter((c) => c.index != null).map((c) => ({ x: c.index!, w: byId.get(c.id)!.weight * c.reliability * Math.max(c.confidence, 0.05), c }));
    const index = powerMean(items, p);
    const arithmetic = powerMean(items, 1);
    const wsum = items.reduce((s, it) => s + it.w, 0);
    const confidence = wsum > 0 ? items.reduce((s, it) => s + it.w * it.c.confidence, 0) / wsum : 0;
    const geoWeight = geometric.reduce((s, c) => s + byId.get(c.id)!.weight, 0);
    const coverage = geoWeight > 0 ? assessedGeo.reduce((s, c) => s + byId.get(c.id)!.weight, 0) / geoWeight : 0;
    return { id: area, index, arithmetic, weight: CATEGORY_WEIGHTS[area] ?? 0, coverage, confidence, assessed: items.length, total: members.length };
  });
  const catItems = categories.filter((c) => c.index != null).map((c) => ({ x: c.index!, w: c.weight }));
  const overall = powerMean(catItems, p);
  const overallArithmetic = powerMean(catItems, 1);
  const wTotal = categories.reduce((s, c) => s + c.weight, 0);
  const coverage = wTotal > 0 ? categories.reduce((s, c) => s + c.weight * c.coverage, 0) / wTotal : 0;
  const wAssessed = categories.filter((c) => c.index != null).reduce((s, c) => s + c.weight, 0);
  const confidence = wAssessed > 0 ? categories.filter((c) => c.index != null).reduce((s, c) => s + c.weight * c.confidence, 0) / wAssessed : 0;
  return {
    criteria,
    categories,
    overall,
    overallArithmetic,
    compensationPenalty: overall != null && overallArithmetic != null ? overallArithmetic - overall : null,
    coverage,
    confidence,
    p,
  };
}
