/**
 * PSL rating engine (rubric 2.0): turns a frontal analysis (plus an optional
 * side-view analysis and optional visual assessments) into criterion, category
 * and overall scores with coverage, validity, Monte-Carlo uncertainty and a tier
 * on the selected scale. The aggregation itself lives in scoring/hierarchy.ts and
 * is shared with the frontal analysis.
 */
import type { AnalysisResult, QualityLevel } from "../types";
import { SIDE_BY_ID, toleranceFor, type SideViewResult } from "../side-view";
import { createRng, gaussian, stddev } from "../geometry";
import { plateauIndex } from "../scoring/measurement";
import { aggregateHierarchy, frontalMeasures, type MeasureMap } from "../scoring/hierarchy";
import { assignTier, type PslScaleSnapshot } from "./scale";
import { analysisReliability, type ReliabilityLevel } from "../quality/reliability";
import { AREA_META, CALIBRATION_ANCHORS, calibrate, calibrationSlope, CATEGORY_WEIGHTS, CRITERIA, DEFAULT_MIN_COVERAGE, DESCRIPTIVE_RATIOS, RUBRIC_AREAS, RUBRIC_VERSION, uncalibrate, AGGREGATION_P, type CriterionId, type RubricArea } from "./rubric";

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
  /** 0–100 before calibration */
  index: number | null;
  /** 0–10 */
  score: number | null;
  confidence: number;
  /** rubric 2.0: mean landmark reliability of the used measures (0–1) */
  reliability?: number;
  source: CriterionSource;
  /** which engine inputs contributed */
  usedInputs: string[];
  missingInputs: string[];
}

export interface AreaScore {
  id: RubricArea;
  name: string;
  /** 0–10 */
  score: number | null;
  /** 0–100 */
  index: number | null;
  weight: number;
  assessableWeight: number;
  coverage: number;
  confidence: number;
  /** rubric 2.0: σ of the category score in PSL points (Monte-Carlo) */
  sigma?: number | null;
  /** rubric 2.0: fully compensatory (arithmetic) category index, for transparency */
  arithmeticIndex?: number | null;
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
  /** σ in PSL points (rubric 2.0: Monte-Carlo through the full aggregation) */
  scoreSigma: number | null;
  /** decimals justified by scoreSigma (one significant digit of σ, max 2) */
  displayDecimals?: number;
  /** 0–1 share of the rubric that was assessable */
  coverage: number;
  /** coverage ≥ minCoverage and frontal quality usable */
  valid: boolean;
  /** score computed from < minCoverage → shown as provisional */
  provisional: boolean;
  tier: { id: string; name: string; short: string; group: string | null; min: number; max: number; color: string; description: string; percentile: string | null } | null;
  /** probability that the true score lies in another tier (rubric 2.0, from the MC samples) */
  tierUncertainty?: number | null;
  confidence: number;
  strengths: { id: CriterionId; score: number }[];
  lowerRated: { id: CriterionId; score: number }[];
  notAssessable: { id: CriterionId; code: NotAssessableCode }[];
  quality: { frontalLevel: QualityLevel; frontalAnalyzable: boolean; frontalIssues: number; sideIssues: number; sideUsed: boolean; visualUsed: boolean; hairline: boolean };
  inputs: { frontalCreatedAt: string; sideFacing: "left" | "right" | null; visualProvider: string | null };
  warningCodes: ("frontalUnusable" | "lowCoverage" | "noProfile" | "noVisualProvider" | "lowConfidence" | "legacyEngine")[];
  /** rubric 2.0 aggregation details */
  aggregation?: {
    method: "weighted-power-mean";
    p: number;
    overallIndex: number | null;
    arithmeticIndex: number | null;
    /** arithmeticIndex − overallIndex: how much the non-compensatory aggregation lowered the score */
    compensationPenalty: number | null;
    mcSamples: number;
  };
  /** five-level reliability of the frontal analysis (engine 2.0, quality/reliability.ts) */
  reliability?: ReliabilityLevel;
  /** measures that are shown but deliberately not scored */
  descriptive?: { id: string; value: number | null; reason: string }[];
}

const SIDE_RELIABILITY = 1; // manually placed profile points: reliability not separately quantified

function sideMeasures(side: SideViewResult | null | undefined, into: MeasureMap) {
  if (!side?.analyzable) return;
  const conf = side.issues.some((i) => i.severity === "warning") ? 0.7 : 0.85;
  for (const m of side.measurements) {
    if (m.index == null) continue;
    into.set(`p:${m.id}`, { index: m.index, confidence: conf, reliability: SIDE_RELIABILITY, weight: SIDE_BY_ID[m.id]?.weight ?? 1, source: "profile" });
  }
}

function visualMeasures(visual: VisualAssessmentSet | null | undefined, into: MeasureMap) {
  if (!visual) return;
  for (const def of CRITERIA) {
    if (def.method !== "visual") continue;
    const v = visual.assessments[def.id];
    if (!v) continue;
    into.set(`v:${def.id}`, { index: uncalibrate(Math.max(0, Math.min(10, v.score))), confidence: v.confidence, reliability: 1, weight: 1, source: "visual" });
  }
}

/** Decimals that the uncertainty justifies: one significant digit of σ, at most 2. */
export function pslDecimals(sigma: number | null | undefined): number {
  if (sigma == null || !Number.isFinite(sigma) || sigma <= 0) return 1;
  return Math.max(0, Math.min(2, -Math.floor(Math.log10(sigma))));
}

export function rateFace(input: RatingInput): RatingResult {
  const { frontal, side, visual, scale } = input;
  const minCoverage = input.minCoverage ?? DEFAULT_MIN_COVERAGE;
  const createdAt = new Date().toISOString();
  const frontalUsable = frontal.quality.analyzable;
  const legacyEngine = Number.parseInt(frontal.engineVersion, 10) < 2;

  const measures = frontalMeasures(frontal.ratios, frontal.symmetry, frontal.additional);
  sideMeasures(side, measures);
  visualMeasures(visual, measures);
  const h = aggregateHierarchy(measures);

  const criteria: CriterionScore[] = CRITERIA.map((def, i) => {
    const a = h.criteria[i];
    const base = { id: def.id, area: def.area, weight: def.weight };
    if (!frontalUsable) return { ...base, assessable: false, notAssessableCode: "frontalUnusable", index: null, score: null, confidence: 0, source: def.method === "visual" ? "visual-model" : def.method === "profile" ? "profile" : "frontal", usedInputs: [], missingInputs: a.missing };
    if (a.index == null) {
      const code: NotAssessableCode =
        def.method === "visual" ? "requiresVisualProvider" : def.method === "profile" || (def.inputs.side?.length && !side?.analyzable && !(def.inputs.ratios ?? []).some((r) => measures.has(`r:${r}`))) ? "requiresProfile" : "inputsUnavailable";
      return { ...base, assessable: false, notAssessableCode: code, index: null, score: null, confidence: 0, source: def.method === "visual" ? "visual-model" : def.method === "profile" ? "profile" : "frontal", usedInputs: [], missingInputs: a.missing };
    }
    const source: CriterionSource = a.fromVisual ? "visual-model" : a.fromFrontal && a.fromProfile ? "mixed" : a.fromProfile ? "profile" : "frontal";
    const usedInputs = a.used.map((k) => (k.startsWith("r:") || k.startsWith("a:") ? k.slice(2) : k.startsWith("s:") ? `sym:${k.slice(2)}` : k.startsWith("p:") ? `side:${k.slice(2)}` : `visual:${visual?.providerId ?? "?"}`));
    return { ...base, assessable: true, index: a.index, score: calibrate(a.index), confidence: a.confidence, reliability: a.reliability, source, usedInputs, missingInputs: a.missing };
  });

  // Monte-Carlo: replay the frontal landmark-noise samples (and the profile σ) through the same aggregation
  const samples = frontalUsable ? frontal.uncertainty?.measureSamples : undefined;
  const n = samples ? Math.max(0, ...Object.values(samples).map((a) => a.length)) : 0;
  const pslSamples: number[] = [];
  const catSamples: Record<string, number[]> = {};
  if (samples && n > 1) {
    const rng = createRng(frontal.config.seed ^ 0x5eed);
    for (let s = 0; s < n; s++) {
      const mm: MeasureMap = new Map(measures);
      for (const [k, arr] of Object.entries(samples)) {
        const base = measures.get(k);
        if (!base) continue;
        const v = arr[s];
        if (v == null) mm.delete(k);
        else mm.set(k, { ...base, index: v });
      }
      if (side?.analyzable) {
        for (const m of side.measurements) {
          const def = SIDE_BY_ID[m.id];
          const key = `p:${m.id}`;
          const base = mm.get(key);
          if (!base || !def?.range || m.value == null || !(m.valueSigma! > 0)) continue;
          mm.set(key, { ...base, index: plateauIndex(m.value + m.valueSigma! * gaussian(rng), def.range, toleranceFor(def.range, def.unit)) });
        }
      }
      const hs = aggregateHierarchy(mm);
      if (hs.overall != null) pslSamples.push(calibrate(hs.overall));
      for (const c of hs.categories) if (c.index != null) (catSamples[c.id] ??= []).push(calibrate(c.index));
    }
  }

  const areas: AreaScore[] = RUBRIC_AREAS.map((area) => {
    const c = h.categories.find((x) => x.id === area)!;
    const index = frontalUsable ? c.index : null;
    const weight = CATEGORY_WEIGHTS[area] ?? 0;
    return {
      id: area,
      name: AREA_META[area].name,
      score: index == null ? null : calibrate(index),
      index,
      weight,
      assessableWeight: weight * c.coverage,
      coverage: c.coverage,
      confidence: c.confidence,
      sigma: catSamples[area]?.length > 1 ? stddev(catSamples[area]) : null,
      arithmeticIndex: frontalUsable ? c.arithmetic : null,
    };
  });

  const coverage = frontalUsable ? h.coverage : 0;
  const overallIndex = frontalUsable ? h.overall : null;
  const score = overallIndex == null ? null : calibrate(overallIndex);
  const valid = frontalUsable && score != null && coverage >= minCoverage;
  const provisional = frontalUsable && score != null && coverage < minCoverage;
  const confidence = frontalUsable ? h.confidence : 0;

  let scoreSigma: number | null = null;
  if (score != null) {
    if (pslSamples.length > 1) scoreSigma = stddev(pslSamples);
    else if (frontal.uncertainty) {
      // engine 1.x analyses without stored samples: overall σ through the local calibration slope
      scoreSigma = frontal.uncertainty.overallSigma * calibrationSlope(overallIndex!);
    }
  }

  const assessed = criteria.filter((c) => c.assessable && c.score != null).sort((a, b) => b.score! - a.score!);
  const strengths = assessed.filter((c) => c.score! >= 6.5).slice(0, 4).map((c) => ({ id: c.id, score: c.score! }));
  const lowerRated = [...assessed].reverse().filter((c) => c.score! < 5).slice(0, 4).map((c) => ({ id: c.id, score: c.score! }));
  const notAssessable = criteria.filter((c) => !c.assessable).map((c) => ({ id: c.id, code: c.notAssessableCode ?? ("inputsUnavailable" as const) }));

  const tierRow = score != null ? assignTier(scale, score) : null;
  const tier = tierRow ? { id: tierRow.id, name: tierRow.name, short: tierRow.short, group: tierRow.group, min: tierRow.min, max: tierRow.max, color: tierRow.color, description: tierRow.description, percentile: tierRow.percentile } : null;
  const tierUncertainty = tierRow && pslSamples.length > 1 ? pslSamples.filter((v) => assignTier(scale, v)?.id !== tierRow.id).length / pslSamples.length : null;

  const warningCodes: RatingResult["warningCodes"] = [];
  if (!frontalUsable) warningCodes.push("frontalUnusable");
  if (provisional) warningCodes.push("lowCoverage");
  if (!side?.analyzable) warningCodes.push("noProfile");
  if (!visual) warningCodes.push("noVisualProvider");
  if (confidence > 0 && confidence < 0.5) warningCodes.push("lowConfidence");
  if (legacyEngine) warningCodes.push("legacyEngine");

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
    displayDecimals: pslDecimals(scoreSigma),
    coverage,
    valid,
    provisional,
    tier,
    tierUncertainty,
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
    aggregation: { method: "weighted-power-mean", p: AGGREGATION_P, overallIndex, arithmeticIndex: frontalUsable ? h.overallArithmetic : null, compensationPenalty: frontalUsable ? h.compensationPenalty : null, mcSamples: pslSamples.length },
    reliability: analysisReliability(frontal).level,
    descriptive: DESCRIPTIVE_RATIOS.map((d) => ({ id: d.id, value: frontal.ratios.find((r) => r.id === d.id)?.value ?? null, reason: d.reason })),
  };
}

/** Counts of criteria per state, for displays and exports. */
export function ratingSummary(r: RatingResult) {
  const assessable = r.criteria.filter((c) => c.assessable).length;
  return { assessable, notAssessable: r.criteria.length - assessable, total: r.criteria.length, areasAssessed: r.areas.filter((a) => a.score != null).length };
}

/** PSL value with the precision its uncertainty justifies (default 1 decimal). */
export function formatPsl(v: number | null | undefined, decimals = 1): string {
  return v == null || !Number.isFinite(v) ? "—" : v.toFixed(decimals);
}
