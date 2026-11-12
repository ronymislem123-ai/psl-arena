/**
 * Stage 2 of the quality control (engine 3.1): every measurement is recomputed
 * from each detection pass (with the verified/corrected landmarks) and checked.
 *
 * - reproducibility: spread of the value over the passes in dispersion units s
 *   (the natural between-person spread of the measure). ≤ 0.5 s stable,
 *   0.5–1 s unstable (counts with half confidence), > 1 s excluded from the score
 *   ("the photo does not determine this measure better than people differ").
 * - plausibility: a value more than 12 s outside its reference range is a
 *   measurement error, not anatomy → excluded.
 * - a measure built on an uncertain landmark is at most "unstable".
 */
import { DERIVED_TOLERANCE, EYE_MOUTH_LENGTH, EYELID_RANGES } from "../psl/rubric";
import { RATIO_BY_ID } from "../ratios/database";
import { rangeDistance } from "../scoring/measurement";
import type { AdditionalMeasurementResult, MeasureCheck, MeasureQc, RatioResult, SemanticLandmarkId, SymmetryResult, T1Range } from "../types";
import { trimmedSd } from "./stats";

export const UNSTABLE_UNITS = 0.5;
export const EXCLUDE_UNITS = 1;
export const IMPLAUSIBLE_UNITS = 12;

export interface MeasureCore {
  ratios: RatioResult[];
  symmetry: SymmetryResult;
  additional: AdditionalMeasurementResult[];
}

/** Reference range and dispersion unit of the additional measures the rubric scores. */
export const ADDITIONAL_SCALE: Record<string, { t1: T1Range; s: number }> = {
  FIFTHS: { t1: { min: null, max: 0 }, s: DERIVED_TOLERANCE.fifthsPp },
  EML: { t1: { min: EYE_MOUTH_LENGTH.min, max: EYE_MOUTH_LENGTH.max }, s: EYE_MOUTH_LENGTH.s },
  MRD1: { t1: EYELID_RANGES.MRD1.range, s: EYELID_RANGES.MRD1.s },
  SSI: { t1: EYELID_RANGES.SSI.range, s: EYELID_RANGES.SSI.s },
};

function judge(value: number, t1: T1Range, s: number, passValues: number[] | null, onUncertainLandmark: boolean): MeasureQc {
  const spread = passValues && passValues.length >= 3 ? trimmedSd(passValues) : null;
  const spreadUnits = spread != null && Number.isFinite(spread) ? spread / s : null;
  if (Math.abs(rangeDistance(value, t1)) / s > IMPLAUSIBLE_UNITS) return { status: "implausible", spread, spreadUnits, reason: "implausible" };
  if (spreadUnits == null) return { status: onUncertainLandmark ? "unstable" : "unverified", spread: null, spreadUnits: null, ...(onUncertainLandmark ? { reason: "uncertainLandmark" as const } : {}) };
  if (spreadUnits > EXCLUDE_UNITS) return { status: "excluded", spread, spreadUnits, reason: "unreproducible" };
  if (spreadUnits > UNSTABLE_UNITS) return { status: "unstable", spread, spreadUnits, reason: "unreproducible" };
  if (onUncertainLandmark) return { status: "unstable", spread, spreadUnits, reason: "uncertainLandmark" };
  return { status: "stable", spread, spreadUnits };
}

const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

export function checkMeasures(core: MeasureCore, passes: MeasureCore[] | null, uncertain: Set<SemanticLandmarkId>): MeasureCheck[] {
  const out: MeasureCheck[] = [];
  for (const r of core.ratios) {
    if (r.availability !== "available" || r.value == null || r.excludedFromScore) continue;
    const def = RATIO_BY_ID[r.id];
    const vals = passes ? passes.map((p) => p.ratios.find((x) => x.id === r.id)).filter((x) => x?.availability === "available").map((x) => x!.value).filter(finite) : null;
    out.push({ id: r.id, kind: "ratio", ...judge(r.value, def.t1, def.tolerance, vals, def.landmarks.some((id) => uncertain.has(id))) });
  }
  for (const m of core.symmetry.metrics) {
    const vals = passes ? passes.map((p) => p.symmetry.metrics.find((x) => x.id === m.id)?.value).filter(finite) : null;
    out.push({ id: m.id, kind: "symmetry", ...judge(m.value, { min: null, max: 0 }, m.tolerance, vals, m.landmarks.some((id) => uncertain.has(id))) });
  }
  for (const a of core.additional) {
    const sc = ADDITIONAL_SCALE[a.id];
    if (!sc || a.availability !== "available" || a.value == null) continue;
    const vals = passes ? passes.map((p) => p.additional.find((x) => x.id === a.id)).filter((x) => x?.availability === "available").map((x) => x!.value).filter(finite) : null;
    out.push({ id: a.id, kind: "additional", ...judge(a.value, sc.t1, sc.s, vals, false) });
  }
  return out;
}

export const measureKey = (m: Pick<MeasureCheck, "id" | "kind">) => `${m.kind === "ratio" ? "r" : m.kind === "symmetry" ? "s" : "a"}:${m.id}`;
