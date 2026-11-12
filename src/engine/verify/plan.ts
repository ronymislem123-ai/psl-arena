/**
 * The outcome of the verification stages that the measurement chain applies:
 * rejected landmarks are removed, uncertain ones count with reduced confidence,
 * landmarks re-analysed after an anatomical violation get their corrected
 * position, and measures that failed their check are left out of the score.
 */
import type { AdditionalMeasurementResult, LandmarkMap, MeasureQc, Point, RatioResult, SemanticLandmarkId, SymmetryResult } from "../types";

export interface QcPlan {
  rejected: Set<SemanticLandmarkId>;
  uncertain: Set<SemanticLandmarkId>;
  /** corrected positions (photo pixels) of landmarks re-analysed after an anatomical violation */
  overrides: Map<SemanticLandmarkId, Point>;
  /** measure checks by key ("r:CT", "s:pfl", "a:EML") */
  measures: Map<string, MeasureQc>;
}

/** Confidence factor of a landmark whose detection passes disagree more than its tolerance. */
export const UNCERTAIN_LANDMARK_FACTOR = 0.6;
/** Confidence factor of a measure that is reproducible only within 0.5–1 dispersion units. */
export const UNSTABLE_MEASURE_FACTOR = 0.5;

export function emptyPlan(): QcPlan {
  return { rejected: new Set(), uncertain: new Set(), overrides: new Map(), measures: new Map() };
}

export function clonePlan(p: QcPlan): QcPlan {
  return { rejected: new Set(p.rejected), uncertain: new Set(p.uncertain), overrides: new Map(p.overrides), measures: new Map(p.measures) };
}

export function applyLandmarkPlan(map: LandmarkMap, plan: QcPlan, toAligned: (p: Point) => Point): LandmarkMap {
  const out: LandmarkMap = { ...map };
  for (const [id, p] of plan.overrides) {
    const cur = out[id];
    if (cur && cur.source !== "manual") out[id] = { ...cur, raw: { x: p.x, y: p.y }, aligned: toAligned(p) };
  }
  for (const id of plan.uncertain) {
    const cur = out[id];
    if (cur && cur.source !== "manual") out[id] = { ...cur, confidence: cur.confidence * UNCERTAIN_LANDMARK_FACTOR };
  }
  for (const id of plan.rejected) {
    if (out[id]?.source !== "manual") delete out[id];
  }
  return out;
}

const excluded = (q: MeasureQc | undefined) => q?.status === "excluded" || q?.status === "implausible";
export const isQcExcluded = excluded;

/** Marks the measures with their check result; excluded ones are skipped by the aggregation. */
export function applyMeasurePlan(ratios: RatioResult[], symmetry: SymmetryResult, additional: AdditionalMeasurementResult[], plan: QcPlan): void {
  for (const r of ratios) {
    if (r.availability === "unavailable" && r.unavailableCode === "landmarks" && r.missingLandmarks?.some((id) => plan.rejected.has(id))) {
      r.unavailableCode = "verification";
      r.unavailableReason = `Not measured: a required landmark failed the verification (${r.missingLandmarks.filter((id) => plan.rejected.has(id)).join(", ")}).`;
    }
    const q = plan.measures.get(`r:${r.id}`);
    if (!q || r.availability !== "available") continue;
    r.qc = q;
    if (excluded(q)) r.index = null;
    if (q.status === "unstable") {
      r.confidence *= UNSTABLE_MEASURE_FACTOR;
      r.uncertain = true;
    }
  }
  for (const m of symmetry.metrics) {
    const q = plan.measures.get(`s:${m.id}`);
    if (q) m.qc = q;
  }
  for (const a of additional) {
    const q = plan.measures.get(`a:${a.id}`);
    if (!q || a.availability !== "available") continue;
    a.qc = q;
    if (q.status === "unstable") a.confidence *= UNSTABLE_MEASURE_FACTOR;
  }
  if (symmetry.metrics.some((m) => excluded(m.qc))) symmetry.score = rescoreSymmetry(symmetry).score;
}

/** Symmetry score without the metrics that failed their check (mean of the remaining metric scores). */
export function rescoreSymmetry(sym: SymmetryResult): SymmetryResult {
  const kept = sym.metrics.filter((m) => !excluded(m.qc));
  return { ...sym, score: kept.length ? kept.reduce((s, m) => s + m.score, 0) / kept.length : null };
}
