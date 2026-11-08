/**
 * Analysis reliability (engine 2.0): one of five levels for the whole analysis
 * plus a per-measurement table of detection quality, uncertainty and the factors
 * that influenced it. Pure function of a stored AnalysisResult, so it also works
 * for analyses made before this module existed.
 *
 * Level rule (documented in docs/MODEL_VALIDATION.md): the base level follows the
 * Monte-Carlo σ of the overall score in PSL points — ≤ 0.25 very high (95 %
 * interval within ±0.5, i.e. inside one tier group of the standard scale), ≤ 0.40
 * high, ≤ 0.60 moderate, otherwise low — and is then capped by conditions the σ
 * cannot see: image quality, an unconfirmed hairline, large yaw, low coverage or a
 * missing uncertainty simulation. Unusable images are "not evaluable".
 */
import { RATIO_BY_ID } from "../ratios/database";
import { CONTOUR_LANDMARKS } from "../ratios/evaluate";
import { calibrate, calibrationSlope, CRITERIA, measureReliability, type CriterionId } from "../psl/rubric";
import { measureKeys } from "../scoring/hierarchy";
import type { AnalysisResult, SemanticLandmark, SemanticLandmarkId } from "../types";

export type ReliabilityLevel = "veryHigh" | "high" | "moderate" | "low" | "notEvaluable";
export const RELIABILITY_LEVELS: ReliabilityLevel[] = ["veryHigh", "high", "moderate", "low", "notEvaluable"];
const RANK: Record<ReliabilityLevel, number> = { veryHigh: 0, high: 1, moderate: 2, low: 3, notEvaluable: 4 };
const worse = (a: ReliabilityLevel, b: ReliabilityLevel) => (RANK[a] >= RANK[b] ? a : b);

export const SIGMA_THRESHOLDS_PSL = { veryHigh: 0.25, high: 0.4, moderate: 0.6 } as const;

export type ReliabilityReasonCode = "unusable" | "sigma" | "noUncertainty" | "qualityAcceptable" | "qualityPoor" | "hairlineEstimated" | "noHairline" | "lowCoverage" | "yaw" | "corrected";
export interface ReliabilityReason {
  code: ReliabilityReasonCode;
  /** level this condition limits the analysis to (null = information only) */
  cap: ReliabilityLevel | null;
  params?: Record<string, number>;
}

export type Influence = "yaw" | "pitch" | "expression" | "lighting" | "perspective" | "hairline" | "reconstructed" | "manual";
export type DetectionGrade = "A" | "B" | "C" | "D";
export type MeasureStatus = "scored" | "descriptive" | "notScored" | "unavailable";

export interface MeasureQualityRow {
  key: string;
  kind: "ratio" | "symmetry" | "additional";
  id: string;
  value: number | null;
  sigma: number | null;
  confidence: number;
  /** landmark reliability λ (weakest landmark) */
  reliability: number;
  detection: DetectionGrade | null;
  /** weakest landmark (lowest confidence) */
  weakest: { id: SemanticLandmarkId; source: SemanticLandmark["source"]; precision: SemanticLandmark["precision"]; confidence: number } | null;
  influences: Influence[];
  status: MeasureStatus;
  criterion: CriterionId | null;
}

export interface AnalysisReliability {
  level: ReliabilityLevel;
  /** σ of the overall score in PSL points (null without simulation) */
  sigmaPsl: number | null;
  /** 95 % interval of the overall PSL value */
  interval95: [number, number] | null;
  reasons: ReliabilityReason[];
  rows: MeasureQualityRow[];
  counts: Record<DetectionGrade, number>;
}

const CRITERION_OF = new Map<string, CriterionId>();
for (const c of CRITERIA) for (const k of measureKeys(c)) CRITERION_OF.set(k, c.id);

export function detectionGrade(lms: SemanticLandmark[]): DetectionGrade | null {
  if (!lms.length) return null;
  const minConf = Math.min(...lms.map((l) => l.confidence));
  let g: DetectionGrade = minConf >= 0.85 ? "A" : minConf >= 0.7 ? "B" : minConf >= 0.5 ? "C" : "D";
  if (lms.some((l) => l.source === "estimated") && (g === "A" || g === "B")) g = "C";
  return g;
}

export function analysisReliability(r: AnalysisResult): AnalysisReliability {
  const q = r.quality;
  const L = new Map(r.landmarks.map((l) => [l.id, l]));
  const yaw = Math.abs(q.pose.yaw);
  const pitch = Math.abs(q.pose.pitch);
  const e = q.expression;
  const exprActive = { mouth: Math.max(e.smile, e.jawOpen, e.pucker) > 0.3, eyes: Math.max(e.blink, e.squint) > 0.3, brows: Math.max(e.browRaise, e.browDown) > 0.3, jaw: e.jawOpen > 0.3 };
  const inflation = q.capture?.perspectiveInflation ?? null;
  const lit = (q.lightingAsymmetry ?? 0) > 0.15 || (q.clipFraction ?? 0) > 0.03;
  const trichion = L.get("trichion");

  const rowFor = (key: string, kind: MeasureQualityRow["kind"], id: string, landmarks: SemanticLandmarkId[], value: number | null, sigma: number | null, confidence: number, status: MeasureStatus, extra: Influence[]): MeasureQualityRow => {
    const lms = landmarks.map((x) => L.get(x)).filter((x): x is SemanticLandmark => !!x);
    const weakestLm = lms.length ? lms.reduce((a, b) => (b.confidence < a.confidence ? b : a)) : null;
    const influences = new Set<Influence>(extra);
    if (lms.some((l) => l.corrected)) influences.add("manual");
    if (landmarks.some((x) => CONTOUR_LANDMARKS.has(x)) && lit) influences.add("lighting");
    return {
      key,
      kind,
      id,
      value,
      sigma,
      confidence,
      reliability: measureReliability(landmarks),
      detection: status === "unavailable" ? null : detectionGrade(lms),
      weakest: weakestLm ? { id: weakestLm.id, source: weakestLm.source, precision: weakestLm.precision, confidence: weakestLm.confidence } : null,
      influences: [...influences],
      status,
      criterion: CRITERION_OF.get(key) ?? null,
    };
  };

  const rows: MeasureQualityRow[] = [];
  for (const x of r.ratios) {
    const def = RATIO_BY_ID[x.id];
    if (def.status === "incomplete") continue;
    const key = `r:${x.id}`;
    const status: MeasureStatus = x.availability !== "available" || x.value == null ? "unavailable" : x.excludedFromScore ? "descriptive" : CRITERION_OF.has(key) ? "scored" : "notScored";
    const inf: Influence[] = [];
    if (def.sensitivity.yaw && yaw > 4) inf.push("yaw");
    if (pitch > 5) inf.push("pitch");
    if (def.sensitivity.expression.some((reg) => exprActive[reg])) inf.push("expression");
    if (def.sensitivity.depth && inflation != null && inflation > 0.05) inf.push("perspective");
    if (def.sensitivity.hairline && trichion?.source === "estimated") inf.push("hairline");
    if (def.status === "reconstructed") inf.push("reconstructed");
    rows.push(rowFor(key, "ratio", x.id, def.landmarks, x.value, x.valueSigma ?? null, x.confidence, status, inf));
  }
  for (const m of r.symmetry.metrics) {
    const key = `s:${m.id}`;
    rows.push(rowFor(key, "symmetry", m.id, m.landmarks, m.value, m.sigma ?? null, r.symmetry.confidence, CRITERION_OF.has(key) ? "scored" : "notScored", yaw > 6 ? ["yaw"] : []));
  }
  for (const a of r.additional) {
    const key = `a:${a.id}`;
    if (!CRITERION_OF.has(key)) continue;
    const lm: SemanticLandmarkId[] = a.id === "EML" ? ["pupil_R", "pupil_L", "stomion", "trichion", "menton"] : ["zygion_R", "zygion_L", "exocanthion_R", "endocanthion_R", "endocanthion_L", "exocanthion_L"];
    const inf: Influence[] = a.id === "EML" && trichion?.source === "estimated" ? ["hairline"] : [];
    rows.push(rowFor(key, "additional", a.id, lm, a.value, null, a.confidence, a.availability === "available" && a.value != null ? "scored" : "unavailable", inf));
  }

  const counts: Record<DetectionGrade, number> = { A: 0, B: 0, C: 0, D: 0 };
  for (const row of rows) if (row.detection && row.status !== "unavailable") counts[row.detection]++;

  // ---- level
  const reasons: ReliabilityReason[] = [];
  if (!q.analyzable || r.scores.overall == null) {
    reasons.push({ code: "unusable", cap: "notEvaluable" });
    return { level: "notEvaluable", sigmaPsl: null, interval95: null, reasons, rows, counts };
  }
  const sigmaPsl = r.uncertainty ? r.uncertainty.overallSigma * calibrationSlope(r.scores.overall) : null;
  let level: ReliabilityLevel;
  if (sigmaPsl == null) {
    level = "moderate";
    reasons.push({ code: "noUncertainty", cap: "moderate" });
  } else {
    level = sigmaPsl <= SIGMA_THRESHOLDS_PSL.veryHigh ? "veryHigh" : sigmaPsl <= SIGMA_THRESHOLDS_PSL.high ? "high" : sigmaPsl <= SIGMA_THRESHOLDS_PSL.moderate ? "moderate" : "low";
    reasons.push({ code: "sigma", cap: level, params: { sigma: sigmaPsl } });
  }
  const cap = (code: ReliabilityReasonCode, c: ReliabilityLevel | null, params?: Record<string, number>) => {
    reasons.push({ code, cap: c, ...(params ? { params } : {}) });
    if (c) level = worse(level, c);
  };
  if (q.level === "acceptable") cap("qualityAcceptable", "high");
  if (q.level === "poor") cap("qualityPoor", "low");
  if (!trichion) cap("noHairline", "moderate");
  else if (trichion.source === "estimated") cap("hairlineEstimated", "high");
  if (r.coverage.fraction < 0.6) cap("lowCoverage", "moderate", { pct: Math.round(r.coverage.fraction * 100) });
  if (yaw > 15) cap("yaw", "moderate", { yaw });
  if (r.corrections) cap("corrected", null, { n: r.corrections.landmarks.length });

  const psl = calibrate(r.scores.overall);
  const interval95: [number, number] | null = sigmaPsl == null ? null : [Math.max(0, psl - 1.96 * sigmaPsl), Math.min(10, psl + 1.96 * sigmaPsl)];
  return { level, sigmaPsl, interval95, reasons, rows, counts };
}
