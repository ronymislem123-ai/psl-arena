import { clamp, dist, tiltDeg } from "../geometry";
import type { LandmarkMap, QualityReport, SemanticLandmarkId, SymmetryMetric, SymmetryResult } from "../types";

const PAIRS: [SemanticLandmarkId, SemanticLandmarkId][] = [
  ["pupil_R", "pupil_L"],
  ["endocanthion_R", "endocanthion_L"],
  ["exocanthion_R", "exocanthion_L"],
  ["alare_R", "alare_L"],
  ["cheilion_R", "cheilion_L"],
  ["gonion_R", "gonion_L"],
  ["zygion_R", "zygion_L"],
  ["chin_corner_R", "chin_corner_L"],
];
const MIDLINE_POINTS: SemanticLandmarkId[] = ["nasion", "subnasale", "labrale_sup", "menton"];

/** Facial midline x from bilateral-pair midpoints and midline landmarks (aligned frame). */
export function midlineX(map: LandmarkMap): number | null {
  const xs: number[] = [];
  for (const [r, l] of PAIRS) {
    const a = map[r];
    const b = map[l];
    if (a && b) xs.push((a.aligned.x + b.aligned.x) / 2);
  }
  for (const id of MIDLINE_POINTS) {
    const p = map[id];
    if (p) xs.push(p.aligned.x);
  }
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
}

const metricScore = (value: number, tol: number) => 100 * Math.exp((-Math.LN2 * value) / tol);

export function computeSymmetry(map: LandmarkMap, quality: QualityReport): SymmetryResult {
  const pr = map.pupil_R;
  const pl = map.pupil_L;
  const mid = midlineX(map);
  if (!pr || !pl || mid === null) {
    return { score: null, metrics: [], confidence: 0, note: "Pupils not available.", noteCode: "pupilsMissing" };
  }
  const ipd = dist(pr.aligned, pl.aligned);
  const metrics: SymmetryMetric[] = [];
  const g = (id: SemanticLandmarkId) => map[id]?.aligned;

  const push = (id: string, label: string, value: number | null, unit: SymmetryMetric["unit"], tol: number, lms: SemanticLandmarkId[]) => {
    if (value === null || !Number.isFinite(value)) return;
    const v = Math.abs(value);
    metrics.push({ id, label, value: v, unit, tolerance: tol, score: metricScore(v, tol), landmarks: lms });
  };

  // eye height / fissure
  const usr = g("palpebrale_sup_R"), lsr = g("palpebrale_inf_R"), usl = g("palpebrale_sup_L"), lsl = g("palpebrale_inf_L");
  if (usr && lsr && usl && lsl) {
    const hR = dist(usr, lsr), hL = dist(usl, lsl);
    push("eyeHeight", "Eye opening (R vs L)", ((hR - hL) / ((hR + hL) / 2)) * 100, "percent", 10, ["palpebrale_sup_R", "palpebrale_inf_R", "palpebrale_sup_L", "palpebrale_inf_L"]);
  }
  const exr = g("exocanthion_R"), enr = g("endocanthion_R"), exl = g("exocanthion_L"), enl = g("endocanthion_L");
  if (exr && enr && exl && enl) {
    const pR = dist(exr, enr), pL = dist(exl, enl);
    push("pfl", "Fissure length (R vs L)", ((pR - pL) / ((pR + pL) / 2)) * 100, "percent", 6, ["exocanthion_R", "endocanthion_R", "exocanthion_L", "endocanthion_L"]);
    push("canthalTilt", "Canthal tilt (R vs L)", tiltDeg(enr, exr) - tiltDeg(enl, exl), "deg", 2, ["endocanthion_R", "exocanthion_R", "endocanthion_L", "exocanthion_L"]);
    push("canthusHeight", "Medial canthus height", (enr.y - enl.y) / ipd, "ipd", 0.02, ["endocanthion_R", "endocanthion_L"]);
  }
  const apR = g("brow_apex_R"), apL = g("brow_apex_L");
  if (apR && apL) push("browHeight", "Brow apex height", (apR.y - apL.y) / ipd, "ipd", 0.03, ["brow_apex_R", "brow_apex_L"]);
  const bmR = g("brow_medial_R"), blR = g("brow_lateral_R"), bmL = g("brow_medial_L"), blL = g("brow_lateral_L");
  if (bmR && blR && bmL && blL) push("browTilt", "Brow tilt (R vs L)", tiltDeg(bmR, blR) - tiltDeg(bmL, blL), "deg", 3, ["brow_medial_R", "brow_lateral_R", "brow_medial_L", "brow_lateral_L"]);
  const cR = g("cheilion_R"), cL = g("cheilion_L");
  if (cR && cL) {
    push("mouthCornerHeight", "Mouth corner height", (cR.y - cL.y) / ipd, "ipd", 0.03, ["cheilion_R", "cheilion_L"]);
    push("mouthCornerWidth", "Mouth corner distance from midline", (Math.abs(cR.x - mid) - Math.abs(cL.x - mid)) / ipd, "ipd", 0.04, ["cheilion_R", "cheilion_L"]);
  }
  const tip = g("pronasale");
  if (tip) push("noseTip", "Nose tip deviation from midline", (tip.x - mid) / ipd, "ipd", 0.03, ["pronasale"]);
  const aR = g("alare_R"), aL = g("alare_L");
  if (aR && aL) push("alar", "Alar base distance from midline", (Math.abs(aR.x - mid) - Math.abs(aL.x - mid)) / ipd, "ipd", 0.03, ["alare_R", "alare_L"]);
  const me = g("menton");
  if (me) push("chin", "Chin deviation from midline", (me.x - mid) / ipd, "ipd", 0.04, ["menton"]);
  const gR = g("gonion_R"), gL = g("gonion_L");
  if (gR && gL) {
    push("gonionWidth", "Gonion distance from midline", (Math.abs(gR.x - mid) - Math.abs(gL.x - mid)) / ipd, "ipd", 0.06, ["gonion_R", "gonion_L"]);
    push("gonionHeight", "Gonion height", (gR.y - gL.y) / ipd, "ipd", 0.05, ["gonion_R", "gonion_L"]);
  }
  const zR = g("zygion_R"), zL = g("zygion_L");
  if (zR && zL) push("zygion", "Cheek width from midline", (Math.abs(zR.x - mid) - Math.abs(zL.x - mid)) / ipd, "ipd", 0.05, ["zygion_R", "zygion_L"]);

  const score = metrics.length ? metrics.reduce((s, m) => s + m.score, 0) / metrics.length : null;
  const yawPenalty = 1 - clamp(Math.abs(quality.pose.yaw) / 20, 0, 0.7);
  const confidence = clamp((0.6 + 0.4 * quality.score) * yawPenalty, 0, 1);
  return {
    score,
    metrics,
    confidence,
    note:
      Math.abs(quality.pose.yaw) > 6
        ? "Head yaw inflates apparent asymmetry; symmetry confidence reduced."
        : "Bilateral landmark comparison after roll normalisation, relative to a fitted facial midline.",
    noteCode: Math.abs(quality.pose.yaw) > 6 ? "yawInflates" : "standard",
  };
}
