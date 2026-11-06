/**
 * PSL rating engine: turns a frontal analysis (plus an optional side-view
 * analysis and optional visual assessments) into criterion scores, area scores,
 * an overall PSL score, coverage/validity and a tier on the selected scale.
 */
import type { AnalysisResult, QualityLevel } from "../types";
import type { SideViewResult } from "../side-view";
import { assignTier, type PslScaleSnapshot } from "./scale";
import { AREA_META, CALIBRATION_ANCHORS, calibrate, calibrationSlope, CRITERIA, DEFAULT_MIN_COVERAGE, DERIVED_TOLERANCE, RUBRIC_AREAS, RUBRIC_VERSION, totalWeight, type CriterionDefinition, type CriterionId, type RubricArea } from "./rubric";

export interface VisualAssessment {
  /** 0–10 on the PSL-like criterion scale */
  score: number;
  confidence: number;
  note?: string;
}

export interface VisualAssessmentSet {
  providerId: string;
  modelVersion: string;
  assessedAt: string;
  assessments: Partial<Record<CriterionId, VisualAssessment>>;
}

export interface RatingInput {
  frontal: AnalysisResult;
  side?: SideViewResult | null;
  visual?: VisualAssessmentSet | null;
  scale: PslScaleSnapshot;
  minCoverage?: number;
}

export type NotAssessableCode = "requiresProfile" | "requiresVisualProvider" | "inputsUnavailable" | "notEnoughAreas" | "frontalUnusable";
export type CriterionSource = "frontal" | "profile" | "mixed" | "visual-model" | "derived";

export interface CriterionScore {
  id: CriterionId;
  area: RubricArea;
  weight: number;
  assessable: boolean;
  notAssessableCode?: NotAssessableCode;
  /** 0–100 before calibration (null for visual-model scores) */
  index: number | null;
  /** 0–10 */
  score: number | null;
  confidence: number;
  source: CriterionSource;
  /** which engine inputs contributed */
  usedInputs: string[];
  missingInputs: string[];
}

export interface AreaScore {
  id: RubricArea;
  name: string;
  score: number | null;
  index: number | null;
  weight: number;
  assessableWeight: number;
  coverage: number;
  confidence: number;
}

export interface RatingResult {
  rubricVersion: string;
  engineVersion: string;
  sideViewVersion: string | null;
  createdAt: string;
  calibration: [number, number][];
  minCoverage: number;
  scale: PslScaleSnapshot;
  criteria: CriterionScore[];
  areas: AreaScore[];
  /** 0–10 (null when invalid or no assessable criterion) */
  score: number | null;
  /** approximate σ in PSL points propagated from the frontal uncertainty */
  scoreSigma: number | null;
  /** 0–1 share of the rubric weight that was assessable */
  coverage: number;
  /** coverage ≥ minCoverage and frontal quality usable */
  valid: boolean;
  /** score computed from < minCoverage → shown as provisional */
  provisional: boolean;
  tier: { id: string; name: string; short: string; group: string | null; min: number; max: number; color: string; description: string; percentile: string | null } | null;
  confidence: number;
  strengths: { id: CriterionId; score: number }[];
  lowerRated: { id: CriterionId; score: number }[];
  notAssessable: { id: CriterionId; code: NotAssessableCode }[];
  quality: { frontalLevel: QualityLevel; frontalAnalyzable: boolean; frontalIssues: number; sideIssues: number; sideUsed: boolean; visualUsed: boolean; hairline: boolean };
  inputs: { frontalCreatedAt: string; sideFacing: "left" | "right" | null; visualProvider: string | null };
  warningCodes: ("frontalUnusable" | "lowCoverage" | "noProfile" | "noVisualProvider" | "lowConfidence")[];
}

const PROFILE_ONLY_METHODS = new Set(["profile"]);

function indexHalving(abs: number, tol: number): number {
  if (abs <= 0) return 100;
  return 100 * Math.pow(2, -abs / Math.max(tol, 1e-9));
}

/** Confidence-weighted mean of indices; null when nothing is available. */
function weightedMean(items: { index: number; confidence: number }[]): { index: number; confidence: number } | null {
  if (!items.length) return null;
  let num = 0;
  let den = 0;
  let conf = 0;
  for (const it of items) {
    const w = Math.max(it.confidence, 0.05);
    num += w * it.index;
    den += w;
    conf += it.confidence;
  }
  return { index: num / den, confidence: conf / items.length };
}

export function rateFace(input: RatingInput): RatingResult {
  const { frontal, side, visual, scale } = input;
  const minCoverage = input.minCoverage ?? DEFAULT_MIN_COVERAGE;
  const createdAt = new Date().toISOString();
  const ratioById = new Map(frontal.ratios.map((r) => [r.id, r]));
  const symById = new Map(frontal.symmetry.metrics.map((m) => [m.id, m]));
  const addById = new Map(frontal.additional.map((a) => [a.id, a]));
  const sideById = new Map((side?.analyzable ? side.measurements : []).map((m) => [m.id, m]));
  const frontalUsable = frontal.quality.analyzable;

  const scoreCriterion = (def: CriterionDefinition, areaIndices: Map<RubricArea, number>): CriterionScore => {
    const base = { id: def.id, area: def.area, weight: def.weight };
    if (def.method === "visual") {
      const v = visual?.assessments[def.id];
      if (!v) return { ...base, assessable: false, notAssessableCode: "requiresVisualProvider", index: null, score: null, confidence: 0, source: "visual-model", usedInputs: [], missingInputs: ["visual"] };
      return { ...base, assessable: true, index: null, score: Math.max(0, Math.min(10, v.score)), confidence: v.confidence, source: "visual-model", usedInputs: [`visual:${visual!.providerId}`], missingInputs: [] };
    }
    if (def.inputs.derived === "areaBalance") {
      const vals = Array.from(areaIndices.values());
      if (vals.length < 3) return { ...base, assessable: false, notAssessableCode: "notEnoughAreas", index: null, score: null, confidence: 0, source: "derived", usedInputs: [], missingInputs: ["areas"] };
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
      const index = indexHalving(sd, DERIVED_TOLERANCE.areaBalanceIndexSd);
      return { ...base, assessable: true, index, score: calibrate(index), confidence: 0.8, source: "derived", usedInputs: Array.from(areaIndices.keys()).map((k) => `area:${k}`), missingInputs: [] };
    }
    if (def.inputs.derived === "verticalBalance") {
      const thirds = (["FT_U", "FT_M", "FT_L"] as const).map((id) => ratioById.get(id)).filter((r) => r && r.availability === "available" && r.value != null);
      if (thirds.length < 3) return { ...base, assessable: false, notAssessableCode: "inputsUnavailable", index: null, score: null, confidence: 0, source: "derived", usedInputs: [], missingInputs: ["FT_U", "FT_M", "FT_L"] };
      const dev = Math.max(...thirds.map((r) => Math.abs(r!.value! - 100 / 3)));
      const index = indexHalving(dev, DERIVED_TOLERANCE.verticalBalancePp);
      const conf = thirds.reduce((s, r) => s + r!.confidence, 0) / 3;
      return { ...base, assessable: true, index, score: calibrate(index), confidence: conf, source: "derived", usedInputs: ["FT_U", "FT_M", "FT_L"], missingInputs: [] };
    }
    const items: { index: number; confidence: number }[] = [];
    const used: string[] = [];
    const missing: string[] = [];
    let fromFrontal = false;
    let fromSide = false;
    for (const id of def.inputs.ratios ?? []) {
      const r = ratioById.get(id);
      if (r && r.availability === "available" && r.index != null) {
        items.push({ index: r.index, confidence: r.confidence });
        used.push(id);
        fromFrontal = true;
      } else missing.push(id);
    }
    for (const id of def.inputs.symmetry ?? []) {
      const m = symById.get(id);
      if (m) {
        items.push({ index: m.score, confidence: frontal.symmetry.confidence });
        used.push(`sym:${id}`);
        fromFrontal = true;
      } else missing.push(`sym:${id}`);
    }
    for (const id of def.inputs.additional ?? []) {
      const a = addById.get(id);
      if (a && a.availability === "available" && a.value != null && id === "FIFTHS") {
        items.push({ index: indexHalving(a.value, DERIVED_TOLERANCE.fifthsPp), confidence: a.confidence });
        used.push(id);
        fromFrontal = true;
      } else missing.push(id);
    }
    for (const id of def.inputs.side ?? []) {
      const m = sideById.get(id);
      if (m && m.index != null) {
        items.push({ index: m.index, confidence: side?.issues.some((i) => i.severity === "warning") ? 0.7 : 0.85 });
        used.push(`side:${id}`);
        fromSide = true;
      } else missing.push(`side:${id}`);
    }
    const agg = weightedMean(items);
    if (!agg) {
      const code: NotAssessableCode = PROFILE_ONLY_METHODS.has(def.method) || (def.inputs.side && !def.inputs.ratios?.length) ? "requiresProfile" : def.inputs.side && !side ? "requiresProfile" : "inputsUnavailable";
      return { ...base, assessable: false, notAssessableCode: code, index: null, score: null, confidence: 0, source: def.method === "profile" ? "profile" : "frontal", usedInputs: [], missingInputs: missing };
    }
    const source: CriterionSource = fromFrontal && fromSide ? "mixed" : fromSide ? "profile" : "frontal";
    return { ...base, assessable: true, index: agg.index, score: calibrate(agg.index), confidence: agg.confidence, source, usedInputs: used, missingInputs: missing };
  };

  // pass 1: everything except the area-balance meta criterion
  const prelim = new Map<CriterionId, CriterionScore>();
  for (const def of CRITERIA) if (def.inputs.derived !== "areaBalance") prelim.set(def.id, scoreCriterion(def, new Map()));
  const areaIndexFor = (area: RubricArea): number | null => {
    let num = 0;
    let den = 0;
    for (const c of prelim.values()) {
      if (c.area !== area || !c.assessable || c.score == null) continue;
      num += c.weight * c.score;
      den += c.weight;
    }
    return den > 0 ? num / den : null;
  };
  const areaScoreMap = new Map<RubricArea, number>();
  for (const area of RUBRIC_AREAS) {
    if (area === "harmony") continue;
    const v = areaIndexFor(area);
    if (v != null) areaScoreMap.set(area, v * 10); // PSL 0–10 → 0–100 for the spread measure
  }
  const criteria: CriterionScore[] = CRITERIA.map((def) => (def.inputs.derived === "areaBalance" ? scoreCriterion(def, areaScoreMap) : prelim.get(def.id)!));

  // frontal unusable ⇒ nothing is assessable (no seemingly precise values)
  if (!frontalUsable) for (const c of criteria) Object.assign(c, { assessable: false, notAssessableCode: "frontalUnusable", index: null, score: null, confidence: 0 });

  const areas: AreaScore[] = RUBRIC_AREAS.map((area) => {
    const members = criteria.filter((c) => c.area === area);
    const weight = members.reduce((s, c) => s + c.weight, 0);
    let num = 0;
    let den = 0;
    let conf = 0;
    let n = 0;
    for (const c of members) {
      if (!c.assessable || c.score == null) continue;
      num += c.weight * c.score;
      den += c.weight;
      conf += c.confidence;
      n++;
    }
    const score = den > 0 ? num / den : null;
    return { id: area, name: AREA_META[area].name, score, index: score == null ? null : score * 10, weight, assessableWeight: den, coverage: weight > 0 ? den / weight : 0, confidence: n ? conf / n : 0 };
  });

  const total = totalWeight();
  let num = 0;
  let den = 0;
  let confSum = 0;
  for (const c of criteria) {
    if (!c.assessable || c.score == null) continue;
    num += c.weight * c.score;
    den += c.weight;
    confSum += c.weight * c.confidence;
  }
  const coverage = den / total;
  const rawScore = den > 0 ? num / den : null;
  const valid = frontalUsable && rawScore != null && coverage >= minCoverage;
  const provisional = frontalUsable && rawScore != null && coverage < minCoverage;
  const score = frontalUsable ? rawScore : null;
  const confidence = den > 0 ? confSum / den : 0;

  // σ: frontal overall sigma (index units) through the local calibration slope, scaled by the frontal weight share
  let scoreSigma: number | null = null;
  if (score != null && frontal.uncertainty) {
    const frontalWeight = criteria.filter((c) => c.assessable && (c.source === "frontal" || c.source === "mixed")).reduce((s, c) => s + c.weight, 0);
    const share = den > 0 ? frontalWeight / den : 0;
    const meanIndex = criteria.filter((c) => c.assessable && c.index != null).reduce((s, c, _, arr) => s + c.index! / arr.length, 0);
    scoreSigma = frontal.uncertainty.overallSigma * calibrationSlope(meanIndex) * share;
  }

  const assessed = criteria.filter((c) => c.assessable && c.score != null).sort((a, b) => b.score! - a.score!);
  const strengths = assessed.filter((c) => c.score! >= 6.5).slice(0, 4).map((c) => ({ id: c.id, score: c.score! }));
  const lowerRated = [...assessed].reverse().filter((c) => c.score! < 5).slice(0, 4).map((c) => ({ id: c.id, score: c.score! }));
  const notAssessable = criteria.filter((c) => !c.assessable).map((c) => ({ id: c.id, code: c.notAssessableCode ?? ("inputsUnavailable" as const) }));

  const tierRow = score != null ? assignTier(scale, score) : null;
  const tier = tierRow ? { id: tierRow.id, name: tierRow.name, short: tierRow.short, group: tierRow.group, min: tierRow.min, max: tierRow.max, color: tierRow.color, description: tierRow.description, percentile: tierRow.percentile } : null;

  const warningCodes: RatingResult["warningCodes"] = [];
  if (!frontalUsable) warningCodes.push("frontalUnusable");
  if (provisional) warningCodes.push("lowCoverage");
  if (!side?.analyzable) warningCodes.push("noProfile");
  if (!visual) warningCodes.push("noVisualProvider");
  if (confidence > 0 && confidence < 0.5) warningCodes.push("lowConfidence");

  return {
    rubricVersion: RUBRIC_VERSION,
    engineVersion: frontal.engineVersion,
    sideViewVersion: side?.engineVersion ?? null,
    createdAt,
    calibration: CALIBRATION_ANCHORS,
    minCoverage,
    scale,
    criteria,
    areas,
    score,
    scoreSigma,
    coverage,
    valid,
    provisional,
    tier,
    confidence,
    strengths,
    lowerRated,
    notAssessable,
    quality: {
      frontalLevel: frontal.quality.level,
      frontalAnalyzable: frontalUsable,
      frontalIssues: frontal.quality.issues.filter((i) => i.severity !== "info").length,
      sideIssues: side?.issues.length ?? 0,
      sideUsed: !!side?.analyzable,
      visualUsed: !!visual,
      hairline: frontal.landmarks.some((l) => l.id === "trichion"),
    },
    inputs: { frontalCreatedAt: frontal.createdAt, sideFacing: side?.facing ?? null, visualProvider: visual?.providerId ?? null },
    warningCodes,
  };
}

/** Counts of criteria per state, for displays and exports. */
export function ratingSummary(r: RatingResult) {
  const assessable = r.criteria.filter((c) => c.assessable).length;
  return { assessable, notAssessable: r.criteria.length - assessable, total: r.criteria.length, areasAssessed: r.areas.filter((a) => a.score != null).length };
}

export function formatPsl(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? "—" : v.toFixed(1);
}
