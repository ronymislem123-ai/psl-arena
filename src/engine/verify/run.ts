/**
 * Orchestrates the quality control of one analysis (engine 3.1):
 *
 *   detection passes → verified (median) landmarks → per-landmark check →
 *   anatomical rules with re-analysis of violating landmarks → measurements
 *   recomputed from every pass and checked → reproducibility of the overall
 *   result; a result that is not reproducible is rejected and re-analysed
 *   without the least reproducible measures (at most three rounds) → the final
 *   control (control.ts) checks the finished analysis.
 */
import { frameMapper } from "../landmarks/mesh-map";
import type { AnalysisInput, LandmarkCheck, LandmarkMap, MeasureCheck, Point, QualityControl, SemanticLandmark, SemanticLandmarkId, VerificationPassId } from "../types";
import { alternatives, anatomyViolations, canonicalResidual, checkLandmarkAgreement } from "./landmarks";
import { checkMeasures, measureKey, type MeasureCore } from "./measures";
import { clonePlan, emptyPlan, isQcExcluded, type QcPlan } from "./plan";
import { REPRO_PASS } from "./control";
import { consensusMesh, medianPoint, trimmedSd } from "./stats";

export interface VerificationContext {
  /** pass ids; index 0 = the unchanged photo */
  ids: VerificationPassId[];
  inputs: AnalysisInput[];
  failed: VerificationPassId[];
  /** input with the verified (median) mesh and hairline */
  verified: AnalysisInput;
}

const validMesh = (m: Point[] | undefined | null, n: number) => !!m && m.length === n && m.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

/** Builds the pass inputs and the verified input; null when the input carries no further detections. */
export function prepareVerification(input: AnalysisInput): VerificationContext | null {
  const v = input.verification;
  if (!v?.passes?.length) return null;
  const n = input.mesh.length;
  const passes = v.passes.filter((p) => validMesh(p.mesh, n));
  if (!passes.length) return null;
  const estimated = input.trichion?.source === "estimated";
  const ids: VerificationPassId[] = ["original", ...passes.map((p) => p.id)];
  const meshes = [input.mesh, ...passes.map((p) => p.mesh)];
  const hairPts = [input.trichion?.point ?? null, ...passes.map((p) => p.trichion ?? null)];
  const passTrichion = (pt: Point | null): AnalysisInput["trichion"] => (estimated ? (pt ? { ...input.trichion!, point: pt } : input.trichion) : input.trichion);
  const inputs = meshes.map((mesh, i) => ({ ...input, mesh, trichion: passTrichion(hairPts[i]), verification: null }));
  const okHair = hairPts.filter((p): p is Point => !!p);
  const verifiedTrichion = estimated && okHair.length ? { ...input.trichion!, point: medianPoint(okHair) } : input.trichion;
  const verified: AnalysisInput = { ...input, mesh: consensusMesh(meshes), trichion: verifiedTrichion, verification: null };
  return { ids, inputs, failed: [...(v.failed ?? []), ...v.passes.filter((p) => !validMesh(p.mesh, n)).map((p) => p.id)], verified };
}

export interface CoreForQc extends MeasureCore {
  am: Parameters<typeof frameMapper>[0];
  quality: { issues: { code: string }[] };
  hierarchy: { criteria: { id: string; index: number | null }[] };
  map: LandmarkMap;
  list: SemanticLandmark[];
  overall: number | null;
}

export interface QcRun {
  plan: QcPlan;
  landmarks: LandmarkCheck[];
  measures: MeasureCheck[];
  actions: QualityControl["actions"];
  iterations: number;
  overallSpread: number | null;
  criticalRejected: boolean;
  passes: QualityControl["passes"];
  /** criteria assessable before the checks were applied */
  baseAssessable: Set<string>;
}

const CRITICAL: SemanticLandmarkId[] = ["pupil_R", "pupil_L"];

export function runVerification<C extends CoreForQc>(ctx: VerificationContext | null, input: AnalysisInput, compute: (input: AnalysisInput, plan: QcPlan | null) => C, opts: { eyesClosed?: boolean } = {}): QcRun {
  const plan = emptyPlan();
  const actions: QualityControl["actions"] = [];
  const base = compute(input, null);
  const eyesClosed = opts.eyesClosed ?? base.quality.issues.some((i) => i.code === "eyes-closed");
  const passCores0 = ctx ? ctx.inputs.map((pi) => compute(pi, null)) : null;
  const pr = base.map.pupil_R?.raw;
  const pl = base.map.pupil_L?.raw;
  const ipdPx = pr && pl ? Math.hypot(pl.x - pr.x, pl.y - pr.y) : 0;

  // --- stage 1a: agreement of the passes per landmark
  const landmarks = checkLandmarkAgreement(base.list, passCores0 ? { maps: passCores0.map((c) => c.map) } : null, ipdPx);
  const byId = new Map(landmarks.map((l) => [l.id, l]));
  let criticalRejected = false;
  for (const l of landmarks) {
    if (l.status === "rejected") {
      if (CRITICAL.includes(l.id)) criticalRejected = true;
      else plan.rejected.add(l.id);
    } else if (l.status === "uncertain") plan.uncertain.add(l.id);
  }
  const rejectedFirst = landmarks.filter((l) => l.status === "rejected" && !CRITICAL.includes(l.id)).map((l) => l.id);
  if (rejectedFirst.length) actions.push({ round: 1, code: "rejectLandmark", ids: rejectedFirst });

  // --- stage 1b: anatomical rules; violating landmarks are re-analysed
  const frame = frameMapper(base.am);
  const aligned = (id: SemanticLandmarkId, over?: [SemanticLandmarkId, Point]) => {
    if (over && over[0] === id) return frame.toAligned(over[1]);
    if (plan.rejected.has(id)) return undefined;
    const o = plan.overrides.get(id);
    return o ? frame.toAligned(o) : base.map[id]?.aligned;
  };
  // one landmark per violated rule and round: the suspect farthest from where the canonical face
  // puts it is re-analysed first (a pass position that satisfies the rules replaces it, else it is
  // rejected); then the rules are evaluated again
  const residual = (id: SemanticLandmarkId) => {
    const p = aligned(id);
    const r = aligned("pupil_R");
    const l = aligned("pupil_L");
    const lm = base.map[id];
    return p && r && l && lm ? canonicalResidual(lm, p, r, l) : 0;
  };
  for (let round = 1; round <= 6; round++) {
    const viol = anatomyViolations((id) => aligned(id), { eyesClosed });
    if (!viol.length) break;
    const fixed: string[] = [];
    const dropped: string[] = [];
    const done = new Set<SemanticLandmarkId>();
    for (const v of viol) {
      const candidates = v.suspects.filter((s) => base.map[s] && base.map[s]!.source !== "manual" && !plan.rejected.has(s) && !CRITICAL.includes(s) && byId.has(s));
      if (!candidates.length || candidates.some((s) => done.has(s))) continue;
      const s = candidates.sort((a, b) => residual(b) - residual(a))[0];
      const chk = byId.get(s)!;
      const lm = base.map[s]!;
      const stillViolates = (over?: [SemanticLandmarkId, Point]) => anatomyViolations((id) => aligned(id, over), { eyesClosed }).some((x) => x.rule === v.rule && x.suspects.includes(s));
      if (!stillViolates()) continue; // resolved by another correction in this round
      done.add(s);
      const alt = alternatives(chk.passPoints, plan.overrides.get(s) ?? lm.raw).find((p) => !stillViolates([s, p]) && !anatomyViolations((id) => aligned(id, [s, p]), { eyesClosed }).some((x) => x.suspects.includes(s)));
      if (alt) {
        plan.overrides.set(s, alt);
        plan.uncertain.delete(s);
        Object.assign(chk, { status: "corrected", rule: v.rule, original: chk.original ?? lm.raw });
        fixed.push(s);
      } else {
        plan.rejected.add(s);
        plan.uncertain.delete(s);
        Object.assign(chk, { status: "rejected", rule: v.rule });
        dropped.push(s);
      }
    }
    if (fixed.length) actions.push({ round, code: "correctLandmark", ids: fixed });
    if (dropped.length) actions.push({ round, code: "rejectLandmark", ids: dropped });
    if (!fixed.length && !dropped.length) break;
  }

  // --- stage 2: measurements from every pass, then reproducibility of the result
  let measures: MeasureCheck[] = [];
  let overallSpread: number | null = null;
  let iterations = 0;
  const current = clonePlan(plan);
  for (let round = 1; round <= 3; round++) {
    iterations = round;
    const core = compute(input, current);
    const pcs = ctx ? ctx.inputs.map((pi) => compute(pi, current)) : null;
    if (round === 1) {
      measures = checkMeasures(core, pcs, current.uncertain);
      for (const m of measures) current.measures.set(measureKey(m), { status: m.status, spread: m.spread, spreadUnits: m.spreadUnits, ...(m.reason ? { reason: m.reason } : {}) });
      const ex = measures.filter((m) => isQcExcluded(m)).map((m) => measureKey(m));
      if (ex.length) actions.push({ round, code: "excludeMeasure", ids: ex });
      // the overall spread is judged with the measure checks applied
      const pcs2 = ctx ? ctx.inputs.map((pi) => compute(pi, current)) : null;
      overallSpread = spreadOf(pcs2);
    } else {
      overallSpread = spreadOf(pcs);
    }
    if (overallSpread == null || overallSpread <= REPRO_PASS || round === 3) break;
    // rejected: not reproducible enough → re-analyse without the least reproducible measures
    const culprits = measures.filter((m) => m.status === "unstable" && current.measures.get(measureKey(m))?.status === "unstable").sort((a, b) => (b.spreadUnits ?? 0) - (a.spreadUnits ?? 0)).slice(0, 3);
    if (!culprits.length) break;
    for (const m of culprits) {
      const q = { status: "excluded" as const, spread: m.spread, spreadUnits: m.spreadUnits, reason: "reproducibility" as const };
      current.measures.set(measureKey(m), q);
      Object.assign(m, q);
    }
    actions.push({ round: round + 1, code: "excludeMeasure", ids: culprits.map((m) => measureKey(m)) });
  }
  const used = ctx ? ctx.inputs.length : 1;
  return {
    plan: current,
    landmarks,
    measures,
    actions,
    iterations,
    overallSpread,
    criticalRejected,
    baseAssessable: new Set(base.hierarchy.criteria.filter((c) => c.index != null).map((c) => c.id)),
    passes: { used, total: ctx ? used + ctx.failed.length : 1, ids: ctx ? ctx.ids : ["original"], failed: ctx ? ctx.failed : [] },
  };
}

function spreadOf(cores: { overall: number | null }[] | null): number | null {
  if (!cores) return null;
  const v = cores.map((c) => c.overall).filter((x): x is number => x != null && Number.isFinite(x));
  if (v.length < 3) return null;
  const s = trimmedSd(v);
  return Number.isFinite(s) ? s : null;
}
