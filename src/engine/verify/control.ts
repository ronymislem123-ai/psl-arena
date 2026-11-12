/**
 * Stage 3 of the quality control (engine 3.1): an independent control instance
 * re-checks the finished analysis before any result is shown.
 *
 * It recomputes every category score and the overall index with its own code
 * (not the aggregation of the measurement chain) and compares them, checks that no
 * excluded measure or rejected landmark entered the score, that all values are
 * finite and in range, that the result is reproducible over the detection passes,
 * that enough of the rubric could be assessed, and that the parts do not
 * contradict each other. Any failed check rejects the overall result.
 */
import { CATEGORY_WEIGHTS, CRITERIA, RUBRIC_AREAS } from "../psl/rubric";
import type { HierarchyResult } from "../scoring/hierarchy";
import type { LandmarkCheck, MeasureCheck, QcCheck, QualityControl, QualityReport, RatioResult, VerificationPassId } from "../types";
import { measureKey } from "./measures";

export const REPRO_PASS = 3.5; // index points (0.35 PSL)
export const REPRO_WARN = 7.5; // index points (0.75 PSL)
export const COVERAGE_PASS = 0.7;
export const COVERAGE_MIN = 0.5;
export const CT_EYE_DIFF_WARN = 6; // degrees between the two eyes

const CRIT_DEF = new Map(CRITERIA.map((d) => [d.id, d]));

/** Independent recomputation of the category indices and the overall index (weighted means). */
export function recomputeHierarchy(h: HierarchyResult): { categories: Record<string, number | null>; overall: number | null } {
  const categories: Record<string, number | null> = {};
  for (const area of RUBRIC_AREAS) {
    let num = 0;
    let den = 0;
    for (const c of h.criteria) {
      if (c.area !== area || c.index == null) continue;
      const w = (CRIT_DEF.get(c.id)?.weight ?? 0) * c.reliability * Math.max(c.confidence, 0.05);
      if (!(w > 0)) continue;
      num += w * c.index;
      den += w;
    }
    categories[area] = den > 0 ? num / den : null;
  }
  let num = 0;
  let den = 0;
  for (const area of RUBRIC_AREAS) {
    const v = categories[area];
    const w = CATEGORY_WEIGHTS[area] ?? 0;
    if (v == null || !(w > 0)) continue;
    num += w * v;
    den += w;
  }
  return { categories, overall: den > 0 ? num / den : null };
}

export interface ControlInput {
  quality: QualityReport;
  hierarchy: HierarchyResult;
  ratios: RatioResult[];
  landmarks: LandmarkCheck[];
  measures: MeasureCheck[];
  passes: { used: number; total: number; ids: VerificationPassId[]; failed: VerificationPassId[] };
  overallSpread: number | null;
  excludedKeys: Set<string>;
  criticalRejected: boolean;
  baseAssessable: Set<string>;
  iterations: number;
  actions: QualityControl["actions"];
}

export function finalControl(x: ControlInput): QualityControl {
  const checks: QcCheck[] = [];
  const add = (c: QcCheck) => checks.push(c);
  const h = x.hierarchy;

  // image quality
  add({ id: "imageQuality", status: !x.quality.analyzable ? "fail" : x.quality.level === "poor" ? "warn" : "pass", params: { level: x.quality.level } });

  // independent detections
  add({ id: "multiPass", status: x.passes.total <= 1 ? "warn" : x.passes.used >= 5 ? "pass" : "warn", params: { used: x.passes.used, total: x.passes.total } });

  // criteria that the checks took out of the result entirely
  const lostCriteria = h.criteria.filter((c) => c.index == null && x.baseAssessable.has(c.id)).map((c) => c.id);

  // landmarks: handled individually (note); a restriction (warn) only when they cost whole criteria or many points
  const n = (s: LandmarkCheck["status"]) => x.landmarks.filter((l) => l.status === s).length;
  const lm = { confirmed: n("confirmed"), corrected: n("corrected"), uncertain: n("uncertain"), rejected: n("rejected"), manual: n("manual"), unverified: n("unverified") };
  add({ id: "landmarks", status: x.criticalRejected ? "fail" : lm.rejected + lm.uncertain >= 4 ? "warn" : lm.rejected || lm.uncertain || lm.corrected ? "note" : "pass", params: lm });
  const ruled = x.landmarks.filter((l) => l.rule);
  const ruledRejected = ruled.filter((l) => l.status === "rejected").length;
  add({ id: "anatomy", status: ruledRejected >= 3 ? "warn" : ruled.length ? "note" : "pass", params: { corrected: ruled.filter((l) => l.status === "corrected").length, rejected: ruledRejected } });

  // measurements
  const m = (s: MeasureCheck["status"]) => x.measures.filter((q) => q.status === s).length;
  const flagged = m("excluded") + m("unstable");
  add({ id: "measurements", status: lostCriteria.length || flagged >= 5 ? "warn" : flagged ? "note" : "pass", params: { stable: m("stable"), unstable: m("unstable"), excluded: m("excluded"), unverified: m("unverified"), total: x.measures.length, lostCriteria: lostCriteria.length } });
  add({ id: "plausibility", status: m("implausible") >= 2 ? "warn" : m("implausible") ? "note" : "pass", params: { implausible: m("implausible") } });

  // independent recomputation + integrity of what entered the score
  const re = recomputeHierarchy(h);
  let maxDelta = 0;
  for (const c of h.categories) {
    const a = c.index;
    const b = re.categories[c.id];
    if ((a == null) !== (b == null)) maxDelta = Infinity;
    else if (a != null && b != null) maxDelta = Math.max(maxDelta, Math.abs(a - b));
  }
  if ((h.overall == null) !== (re.overall == null)) maxDelta = Infinity;
  else if (h.overall != null && re.overall != null) maxDelta = Math.max(maxDelta, Math.abs(h.overall - re.overall));
  const outOfRange = h.criteria.some((c) => c.index != null && !(c.index >= 0 && c.index <= 100)) || h.categories.some((c) => c.index != null && !(c.index >= 0 && c.index <= 100)) || (h.overall != null && !(h.overall >= 0 && h.overall <= 100));
  const leaked = h.criteria.flatMap((c) => c.used).filter((k) => x.excludedKeys.has(k));
  add({ id: "recompute", status: maxDelta <= 1e-6 && !outOfRange && !leaked.length ? "pass" : "fail", params: { maxDelta: Number.isFinite(maxDelta) ? maxDelta : -1, leaked: leaked.join(", ") } });

  // reproducibility of the overall result over the detection passes
  const sp = x.overallSpread;
  add({ id: "reproducibility", status: sp == null ? "warn" : sp <= REPRO_PASS ? "pass" : sp <= REPRO_WARN ? "warn" : "fail", params: sp == null ? {} : { spreadPsl: Math.round(sp) / 10 } });

  // enough of the rubric assessable
  add({ id: "coverage", status: h.coverage >= COVERAGE_PASS ? "pass" : h.coverage >= COVERAGE_MIN ? "warn" : "fail", params: { coverage: Math.round(h.coverage * 100) } });

  // no contradictions between the parts
  const ct = x.ratios.find((r) => r.id === "CT");
  const eyeDiff = ct?.availability === "available" && ct.intermediate.tiltRight != null && ct.intermediate.tiltLeft != null ? Math.abs(ct.intermediate.tiltRight - ct.intermediate.tiltLeft) : null;
  const cats = h.categories.filter((c) => c.index != null).map((c) => c.index!);
  const meanBroken = h.overall != null && cats.length > 0 && (h.overall < Math.min(...cats) - 1e-6 || h.overall > Math.max(...cats) + 1e-6);
  add({ id: "consistency", status: meanBroken ? "fail" : eyeDiff != null && eyeDiff > CT_EYE_DIFF_WARN ? "warn" : "pass", params: eyeDiff != null ? { ctEyeDiff: Math.round(eyeDiff * 10) / 10 } : {} });

  const status: QualityControl["status"] = checks.some((c) => c.status === "fail") ? "failed" : checks.some((c) => c.status === "warn") ? "limited" : "passed";
  return { version: 1, status, passes: x.passes, landmarks: x.landmarks, measures: x.measures, checks, iterations: x.iterations, actions: x.actions, overallSpread: x.overallSpread, lostCriteria };
}

export { measureKey };
