/**
 * PSL rating engine (rubric 2.0): turns a frontal analysis (plus an optional
 * side-view analysis and optional visual assessments) into criterion, category
 * and overall scores with coverage, validity, Monte-Carlo uncertainty and a tier
 * on the selected scale. The aggregation itself lives in scoring/hierarchy.ts and
 * is shared with the frontal analysis.
 */
import type { AnalysisResult, QualityLevel } from "../types";
import { RATIO_BY_ID } from "../ratios/database";
import { stddev } from "../geometry";
import { aggregateHierarchy, frontalMeasures, type MeasureMap } from "../scoring/hierarchy";
import { assignTier, type PslScaleSnapshot } from "./scale";
import { analysisReliability, type ReliabilityLevel } from "../quality/reliability";
import { AREA_META, CALIBRATION_ANCHORS, calibrate, calibrationSlope, CATEGORY_WEIGHTS, CRITERIA, DEFAULT_MIN_COVERAGE, DESCRIPTIVE_RATIOS, MIN_SCORABLE_COVERAGE, RUBRIC_AREAS, RUBRIC_VERSION, uncalibrate, AGGREGATION_P, type CriterionId, type RubricArea } from "./rubric";

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

/** Why the vision model did or did not contribute to a rating. */
export type VisualStatus = "used" | "notConfigured" | "noConsent" | "noImage" | "failed";

export interface RatingInput {
  /** rubric 3.0: the front profile is the only input (no side view) */
  frontal: AnalysisResult;
  visual?: VisualAssessmentSet | null;
  /** rubric 2.1: status of the vision model for this rating (default: used when `visual` is set, else notConfigured) */
  visualStatus?: VisualStatus;
  /** short, language-neutral error code when the model call failed */
  visualError?: string;
  /**
   * rubric 2.1: the user's own 0–10 assessment of visual criteria (only those
   * criteria; a vision-model result takes precedence). Enters the aggregation with
   * reduced confidence/reliability and is labelled "self-assessment" everywhere.
   */
  selfAssessment?: Partial<Record<CriterionId, number>> | null;
  scale: PslScaleSnapshot;
  minCoverage?: number;
}

export type NotAssessableCode =
  | "requiresProfile"
  | "requiresVisualProvider" // rubric ≤ 2.0 (stored ratings)
  | "visualNotConfigured"
  | "visualNoConsent"
  | "visualNoImage"
  | "visualFailed"
  | "visualNotAssessable"
  | "profileNotDeterminable"
  | "inputsUnavailable"
  | "hairlineCovered"
  | "hairlineMissing"
  | "notEnoughAreas"
  | "frontalUnusable";
export type CriterionSource = "frontal" | "profile" | "mixed" | "visual-model" | "self-assessment" | "derived";

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
  inputs: { frontalCreatedAt: string; sideFacing: "left" | "right" | null; visualProvider: string | null; visualModel?: string | null; visualStatus?: VisualStatus; visualError?: string | null; sidePlacement?: "manual" | "automatic" | "mixed" | null };
  /** rubric 2.1: descriptive appearance measures of the frontal analysis (shown, never scored) */
  appearance?: import("../appearance").AppearanceMeasure[];
  /** rubric 2.1: criteria the user assessed themselves (0–10 as entered) */
  selfAssessment?: Partial<Record<CriterionId, number>>;
  /** rubric 2.1: per visual criterion, the model's short reason */
  visualNotes?: Partial<Record<CriterionId, string>>;
  warningCodes: ("frontalUnusable" | "lowCoverage" | "insufficientData" | /* rubric ≤ 2.x */ "noProfile" | "noVisualProvider" | "visualFailed" | "selfAssessment" | "lowConfidence" | "legacyEngine")[];
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

/** Criteria that only detect a defect: full marks are the normal case, not a strength. */
export const NO_DEFECT_CRITERIA: ReadonlySet<CriterionId> = new Set<CriterionId>(["scleralShow"]);

/** Self-assessments count with half confidence and half reliability (subjective, not reproducible). */
export const SELF_ASSESSMENT_WEIGHTING = { confidence: 0.5, reliability: 0.5 } as const;

function visualMeasures(visual: VisualAssessmentSet | null | undefined, self: RatingInput["selfAssessment"], into: MeasureMap) {
  for (const def of CRITERIA) {
    if (def.method !== "visual") continue;
    const v = visual?.assessments[def.id];
    if (v) {
      into.set(`v:${def.id}`, { index: uncalibrate(Math.max(0, Math.min(10, v.score))), confidence: v.confidence, reliability: 1, weight: 1, source: "visual" });
      continue;
    }
    const s = self?.[def.id];
    if (s != null && Number.isFinite(s)) into.set(`v:${def.id}`, { index: uncalibrate(Math.max(0, Math.min(10, s))), ...SELF_ASSESSMENT_WEIGHTING, weight: 1, source: "self" });
  }
}

/** Decimals that the uncertainty justifies: one significant digit of σ, at most 2. */
export function pslDecimals(sigma: number | null | undefined): number {
  if (sigma == null || !Number.isFinite(sigma) || sigma <= 0) return 1;
  return Math.max(0, Math.min(2, -Math.floor(Math.log10(sigma))));
}

export function rateFace(input: RatingInput): RatingResult {
  const { frontal, visual, scale } = input;
  const visualStatus: VisualStatus = input.visualStatus ?? (visual ? "used" : "notConfigured");
  const minCoverage = input.minCoverage ?? DEFAULT_MIN_COVERAGE;
  const createdAt = new Date().toISOString();
  const frontalUsable = frontal.quality.analyzable;
  const legacyEngine = Number.parseInt(frontal.engineVersion, 10) < 2;

  const measures = frontalMeasures(frontal.ratios, frontal.symmetry, frontal.additional);
  visualMeasures(visual, input.selfAssessment, measures);
  const h = aggregateHierarchy(measures);
  // criteria whose frontal inputs all depend on the hairline (thirds, forehead, eye–mouth length)
  const hairlineCode: NotAssessableCode = frontal.warningCodes?.some((w) => w.code === "hairlineCovered") ? "hairlineCovered" : "hairlineMissing";
  const needsHairline = (def: (typeof CRITERIA)[number]) => {
    const r = def.inputs.ratios ?? [];
    const add = def.inputs.additional ?? [];
    return (r.length > 0 || add.length > 0) && r.every((id) => RATIO_BY_ID[id]?.sensitivity?.hairline) && add.every((id) => id === "EML");
  };

  const criteria: CriterionScore[] = CRITERIA.map((def, i) => {
    const a = h.criteria[i];
    const base = { id: def.id, area: def.area, weight: def.weight };
    if (!frontalUsable) return { ...base, assessable: false, notAssessableCode: "frontalUnusable", index: null, score: null, confidence: 0, source: def.method === "visual" ? "visual-model" : def.method === "profile" ? "profile" : "frontal", usedInputs: [], missingInputs: a.missing };
    if (a.index == null) {
      const visualCode: NotAssessableCode =
        visualStatus === "used" ? "visualNotAssessable" : visualStatus === "noConsent" ? "visualNoConsent" : visualStatus === "noImage" ? "visualNoImage" : visualStatus === "failed" ? "visualFailed" : "visualNotConfigured";
      const needsProfile = def.method === "profile" || (def.inputs.side?.length && !(def.inputs.ratios ?? []).some((r) => measures.has(`r:${r}`)));
      const code: NotAssessableCode =
        def.method === "visual" ? visualCode : needsProfile ? "requiresProfile" : needsHairline(def) && !frontal.landmarks.some((l) => l.id === "trichion") ? hairlineCode : "inputsUnavailable";
      return { ...base, assessable: false, notAssessableCode: code, index: null, score: null, confidence: 0, source: def.method === "visual" ? "visual-model" : def.method === "profile" ? "profile" : "frontal", usedInputs: [], missingInputs: a.missing };
    }
    const source: CriterionSource = a.fromVisual ? "visual-model" : a.fromSelf ? "self-assessment" : a.fromFrontal && a.fromProfile ? "mixed" : a.fromProfile ? "profile" : "frontal";
    const usedInputs = a.used.map((k) => (k.startsWith("r:") || k.startsWith("a:") ? k.slice(2) : k.startsWith("s:") ? `sym:${k.slice(2)}` : k.startsWith("p:") ? `side:${k.slice(2)}` : a.fromSelf ? "self-assessment" : `visual:${visual?.providerId ?? "?"}`));
    return { ...base, assessable: true, index: a.index, score: calibrate(a.index), confidence: a.confidence, reliability: a.reliability, source, usedInputs, missingInputs: a.missing };
  });

  // Monte-Carlo: replay the frontal landmark-noise samples through the same aggregation
  const samples = frontalUsable ? frontal.uncertainty?.measureSamples : undefined;
  const n = samples ? Math.max(0, ...Object.values(samples).map((a) => a.length)) : 0;
  const pslSamples: number[] = [];
  const catSamples: Record<string, number[]> = {};
  if (samples && n > 1) {
    // centre each measure's samples on its point index: the stored samples are raw
    // landmark-noise replays (e.g. symmetry without the noise-floor correction that the
    // point value has), so only their spread is used, not their offset
    const shift: Record<string, number> = {};
    for (const [k, arr] of Object.entries(samples)) {
      const base = measures.get(k);
      const vals = arr.filter((v): v is number => v != null);
      if (base && vals.length) shift[k] = base.index - vals.reduce((x, y) => x + y, 0) / vals.length;
    }
    for (let s = 0; s < n; s++) {
      const mm: MeasureMap = new Map(measures);
      for (const [k, arr] of Object.entries(samples)) {
        const base = measures.get(k);
        if (!base) continue;
        const v = arr[s];
        if (v == null) mm.delete(k);
        else mm.set(k, { ...base, index: Math.max(0, Math.min(100, v + (shift[k] ?? 0))) });
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
  // too much missing for a meaningful total: no (seemingly precise) overall score
  const insufficient = frontalUsable && h.overall != null && coverage < MIN_SCORABLE_COVERAGE;
  const overallIndex = frontalUsable && !insufficient ? h.overall : null;
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
  // "no defect" criteria (e.g. no scleral show below the iris) reach 10 on almost every
  // face; they lower a score when the defect is present but are no strength
  const strengths = assessed.filter((c) => c.score! >= 6.5 && !NO_DEFECT_CRITERIA.has(c.id)).slice(0, 4).map((c) => ({ id: c.id, score: c.score! }));
  const lowerRated = [...assessed].reverse().filter((c) => c.score! < 5).slice(0, 4).map((c) => ({ id: c.id, score: c.score! }));
  const notAssessable = criteria.filter((c) => !c.assessable).map((c) => ({ id: c.id, code: c.notAssessableCode ?? ("inputsUnavailable" as const) }));

  const tierRow = score != null ? assignTier(scale, score) : null;
  const tier = tierRow ? { id: tierRow.id, name: tierRow.name, short: tierRow.short, group: tierRow.group, min: tierRow.min, max: tierRow.max, color: tierRow.color, description: tierRow.description, percentile: tierRow.percentile } : null;
  const tierUncertainty = tierRow && pslSamples.length > 1 ? pslSamples.filter((v) => assignTier(scale, v)?.id !== tierRow.id).length / pslSamples.length : null;

  const warningCodes: RatingResult["warningCodes"] = [];
  if (!frontalUsable) warningCodes.push("frontalUnusable");
  if (provisional) warningCodes.push("lowCoverage");
  if (insufficient) warningCodes.push("insufficientData");
  if (!visual && visualStatus === "notConfigured" && criteria.some((c) => CRITERIA.some((d) => d.id === c.id && d.method === "visual") && !c.assessable)) warningCodes.push("noVisualProvider");
  if (visualStatus === "failed") warningCodes.push("visualFailed");
  if (criteria.some((c) => c.source === "self-assessment")) warningCodes.push("selfAssessment");
  if (confidence > 0 && confidence < 0.5) warningCodes.push("lowConfidence");
  if (legacyEngine) warningCodes.push("legacyEngine");

  return {
    rubricVersion: RUBRIC_VERSION,
    engineVersion: frontal.engineVersion,
    sideViewVersion: null,
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
      sideIssues: 0,
      sideUsed: false,
      visualUsed: !!visual,
      hairline: frontal.landmarks.some((l) => l.id === "trichion"),
    },
    inputs: { frontalCreatedAt: frontal.createdAt, sideFacing: null, visualProvider: visual?.providerId ?? null, visualModel: visual?.modelVersion ?? null, visualStatus, visualError: input.visualError ?? null, sidePlacement: null },
    appearance: frontal.appearance,
    selfAssessment: input.selfAssessment ? Object.fromEntries(Object.entries(input.selfAssessment).filter(([k, v]) => v != null && CRITERIA.some((c) => c.id === k && c.method === "visual"))) : undefined,
    visualNotes: visual ? Object.fromEntries(Object.entries(visual.assessments).filter(([, v]) => v?.note).map(([k, v]) => [k, v!.note!])) : undefined,
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
