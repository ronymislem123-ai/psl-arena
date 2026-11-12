/**
 * Stage 1 of the quality control (engine 3.1): every semantic landmark is checked
 * on its own.
 *
 * 1. Agreement of the detection passes. The photo is detected several times under
 *    controlled changes (mirror, ±5° rotation, zoomed face crop, zoomed + mirrored).
 *    The verified position is the median of all passes; the single detection of the
 *    unchanged photo is compared with it. Tolerance = 3 × the landmark's measured
 *    repeatability (× safety factor), at least 1.2 % of the inter-pupillary distance.
 *    - confirmed: the original detection and the passes agree within the tolerance
 *    - corrected: the original detection is off, the passes agree → median used,
 *      then re-checked (at least half of the passes within the tolerance)
 *    - uncertain: the passes disagree (spread > tolerance) → counts with reduced confidence
 *    - rejected: the passes disagree strongly (spread > 2.5 × tolerance) → not used
 * 2. Anatomical rules (order along the midline, eye corners around the pupil, lids,
 *    brows above the eyes, nose wings, mouth corners, chin, face contour, sides of
 *    the midline, level of bilateral pairs). A violating landmark is re-analysed:
 *    the pass positions are tried as alternatives; the first one that satisfies the
 *    rules replaces it and is checked again; if none does, the landmark is rejected.
 *
 * This verifies precision and anatomical plausibility. It does not prove that a
 * point sits exactly where an expert would place it; that limit is reported.
 */
import { canonicalVertex } from "../landmarks/canonical";
import { LANDMARK_SIGMA_IPD, REPEATABILITY_SAFETY } from "../landmarks/repeatability";
import type { AnatomyRuleId, LandmarkCheck, LandmarkMap, Point, SemanticLandmark, SemanticLandmarkId } from "../types";
import { medianPoint, trimmedSpread } from "./stats";

/** Tolerance = TOL_K × repeatability σ × safety, never below TOL_MIN (IPD units). */
export const TOL_K = 3;
export const TOL_MIN = 0.012;
/** A spread above REJECT_K × tolerance rejects the landmark. */
export const REJECT_K = 2.5;
/** Repeatability σ (IPD) of landmarks that are not single mesh vertices. */
const SIGMA_DEFAULT: Partial<Record<SemanticLandmarkId, number>> = { trichion: 0.02, neck_R: 0.02, neck_L: 0.02 };

export function landmarkTolerance(l: Pick<SemanticLandmark, "id" | "meshIndex" | "meshIndices">): number {
  const idx = l.meshIndex != null ? [l.meshIndex] : (l.meshIndices ?? []);
  const sigma = idx.length ? Math.max(...idx.map((i) => LANDMARK_SIGMA_IPD[i] ?? 0.006)) : (SIGMA_DEFAULT[l.id] ?? 0.01);
  return Math.max(TOL_MIN, TOL_K * sigma * REPEATABILITY_SAFETY);
}

export interface PassLandmarks {
  /** landmark maps of the detection passes; index 0 = the unchanged photo */
  maps: LandmarkMap[];
}

/** Per-landmark agreement check of the passes around the verified (median) position. */
export function checkLandmarkAgreement(verified: SemanticLandmark[], passes: PassLandmarks | null, ipdPx: number): LandmarkCheck[] {
  return verified.map((l): LandmarkCheck => {
    const tolerance = landmarkTolerance(l);
    if (l.source === "manual" || l.corrected) return { id: l.id, status: "manual", deviation: null, spread: null, tolerance, agreement: null, passes: 0 };
    const pts = passes ? passes.maps.map((m) => m[l.id]?.raw).filter((p): p is Point => !!p && Number.isFinite(p.x) && Number.isFinite(p.y)) : [];
    if (pts.length < 3 || !(ipdPx > 0)) return { id: l.id, status: "unverified", deviation: null, spread: null, tolerance, agreement: null, passes: pts.length };
    const c = l.raw;
    const spread = trimmedSpread(pts, c) / ipdPx;
    const orig = passes!.maps[0]?.[l.id]?.raw ?? null;
    const deviation = orig ? Math.hypot(orig.x - c.x, orig.y - c.y) / ipdPx : null;
    const within = pts.filter((p) => Math.hypot(p.x - c.x, p.y - c.y) / ipdPx <= tolerance).length;
    const agreement = within / pts.length;
    let status: LandmarkCheck["status"];
    if (spread > REJECT_K * tolerance) status = "rejected";
    else if (spread > tolerance) status = "uncertain";
    else if (deviation != null && deviation > tolerance) status = agreement >= 0.5 ? "corrected" : "uncertain";
    else status = "confirmed";
    return { id: l.id, status, deviation, spread, tolerance, agreement, passes: pts.length, ...(status === "corrected" && orig ? { original: orig } : {}), passPoints: pts };
  });
}

// ---------------------------------------------------------------- anatomical rules

type Get = (id: SemanticLandmarkId) => Point | undefined;
export interface RuleViolation {
  rule: AnatomyRuleId;
  /** landmarks suspected of being misplaced (the rule cannot tell which of them) */
  suspects: SemanticLandmarkId[];
}

const PAIRS: [SemanticLandmarkId, SemanticLandmarkId][] = [
  ["endocanthion_R", "endocanthion_L"], ["exocanthion_R", "exocanthion_L"], ["palpebrale_sup_R", "palpebrale_sup_L"], ["palpebrale_inf_R", "palpebrale_inf_L"],
  ["brow_medial_R", "brow_medial_L"], ["brow_lateral_R", "brow_lateral_L"], ["alare_R", "alare_L"], ["cheilion_R", "cheilion_L"],
  ["zygion_R", "zygion_L"], ["gonion_R", "gonion_L"], ["chin_corner_R", "chin_corner_L"],
];
const MIDLINE: SemanticLandmarkId[] = ["trichion", "glabella", "nasion", "pronasale", "subnasale", "labrale_sup", "stomion_sup", "stomion_inf", "labrale_inf", "menton"];

/**
 * Coarse anatomical plausibility in the measurement frame (upright, y downwards,
 * subject's right on the image left), lengths in inter-pupillary distances. The
 * margins are wide: the rules catch landmarks on the wrong structure, not shape
 * differences between people.
 */
export function anatomyViolations(get: Get, opts: { eyesClosed?: boolean } = {}): RuleViolation[] {
  const pr = get("pupil_R");
  const pl = get("pupil_L");
  if (!pr || !pl) return [];
  const u = Math.hypot(pl.x - pr.x, pl.y - pr.y);
  if (!(u > 0)) return [];
  const mid = (pr.x + pl.x) / 2;
  const lat = (p: Point) => Math.abs(p.x - mid) / u;
  const out: RuleViolation[] = [];
  const v = (rule: AnatomyRuleId, ...suspects: SemanticLandmarkId[]) => out.push({ rule, suspects });

  // sides of the midline
  for (const [r, l] of PAIRS) {
    const a = get(r);
    const b = get(l);
    if (a && (a.x - mid) / u > -0.05) v("sideOfMidline", r);
    if (b && (b.x - mid) / u < 0.05) v("sideOfMidline", l);
    if (a && b && Math.abs(a.y - b.y) / u > 0.35) v("bilateralLevel", r, l);
  }
  // order along the midline (top to bottom)
  const chain = MIDLINE.map((id) => ({ id, p: get(id) })).filter((x): x is { id: SemanticLandmarkId; p: Point } => !!x.p);
  for (let i = 1; i < chain.length; i++) {
    const a = chain[i - 1];
    const b = chain[i];
    const slack = a.id === "stomion_sup" && b.id === "stomion_inf" ? 0.03 : 0;
    if (b.p.y - a.p.y < -slack * u) v("midlineOrder", a.id, b.id);
  }
  const tr = get("trichion");
  const gl = get("glabella");
  if (tr && gl && (gl.y - tr.y) / u < 0.4) v("hairlineAbove", "trichion");
  for (const s of ["R", "L"] as const) {
    const p = s === "R" ? pr : pl;
    const en = get(`endocanthion_${s}`);
    const ex = get(`exocanthion_${s}`);
    if (ex && lat(ex) < lat(p) + 0.1) v("eyeOrder", `exocanthion_${s}`);
    if (en && lat(en) > lat(p) - 0.1) v("eyeOrder", `endocanthion_${s}`);
    const ps = get(`palpebrale_sup_${s}`);
    const pi = get(`palpebrale_inf_${s}`);
    if (!opts.eyesClosed && ps && pi && (pi.y - ps.y) / u < 0.02) v("lidOrder", `palpebrale_sup_${s}`, `palpebrale_inf_${s}`);
    if (ps && (p.y - ps.y) / u < -0.05) v("lidOrder", `palpebrale_sup_${s}`);
    if (pi && (pi.y - p.y) / u < -0.05) v("lidOrder", `palpebrale_inf_${s}`);
    const bm = get(`brow_medial_${s}`);
    const bl = get(`brow_lateral_${s}`);
    const ba = get(`brow_apex_${s}`);
    const bw = get(`brow_lower_mid_${s}`);
    if (bm && en && (en.y - bm.y) / u < 0.1) v("browAboveEye", `brow_medial_${s}`);
    if (bl && ex && (ex.y - bl.y) / u < 0.05) v("browAboveEye", `brow_lateral_${s}`);
    if (ba && ps && (ps.y - ba.y) / u < 0.15) v("browAboveEye", `brow_apex_${s}`);
    if (bw && ps && (ps.y - bw.y) / u < 0.05) v("browAboveEye", `brow_lower_mid_${s}`);
    const al = get(`alare_${s}`);
    const na = get("nasion");
    const st = get("stomion");
    if (al && (lat(al) < 0.12 || (ex && lat(al) > lat(ex)) || (na && al.y < na.y) || (st && al.y > st.y))) v("noseWings", `alare_${s}`);
    const ch = get(`cheilion_${s}`);
    const sn = get("subnasale");
    const me = get("menton");
    if (ch && (lat(ch) < 0.25 || (sn && ch.y < sn.y) || (me && ch.y > me.y))) v("mouthCorners", `cheilion_${s}`);
    const cc = get(`chin_corner_${s}`);
    if (cc && me && (me.y - cc.y) / u < -0.05) v("chinLowest", "menton", `chin_corner_${s}`);
    const zy = get(`zygion_${s}`);
    const go = get(`gonion_${s}`);
    if (zy && ex && lat(zy) < lat(ex)) v("contourWidth", `zygion_${s}`);
    if (go && zy && lat(go) > lat(zy) + 0.1) v("contourWidth", `gonion_${s}`);
    if (go && ch && lat(go) < lat(ch)) v("contourWidth", `gonion_${s}`);
    if (go && ex && go.y < ex.y) v("contourWidth", `gonion_${s}`);
  }
  const me = get("menton");
  const li = get("labrale_inf");
  if (me && li && me.y <= li.y) v("chinLowest", "menton");
  return out;
}

/** Positions of a landmark in the measurement frame for each alternative (pass positions, closest first). */
export function alternatives(passPoints: Point[] | undefined, verified: Point): Point[] {
  if (!passPoints?.length) return [];
  const med = medianPoint(passPoints);
  return [...passPoints].sort((a, b) => Math.hypot(a.x - med.x, a.y - med.y) - Math.hypot(b.x - med.x, b.y - med.y)).filter((p) => Math.hypot(p.x - verified.x, p.y - verified.y) > 1e-6);
}

/**
 * Distance (IPD units) between a landmark and where the MediaPipe canonical face
 * puts it, after scaling the canonical face to the pupils of this face. Faces
 * differ, but a point on the wrong structure is far off; used to decide which of
 * the landmarks named by a violated rule is the misplaced one.
 */
export function canonicalResidual(l: Pick<SemanticLandmark, "meshIndex" | "meshIndices">, aligned: Point, pr: Point, pl: Point): number {
  const idx = l.meshIndex != null ? [l.meshIndex] : (l.meshIndices ?? []);
  if (!idx.length) return 0;
  const cr = canonicalVertex(468);
  const cl = canonicalVertex(473);
  const s = Math.hypot(pl.x - pr.x, pl.y - pr.y) / Math.hypot(cl.x - cr.x, cl.y - cr.y);
  const cm = { x: (cr.x + cl.x) / 2, y: (cr.y + cl.y) / 2 };
  const pm = { x: (pr.x + pl.x) / 2, y: (pr.y + pl.y) / 2 };
  let x = 0;
  let y = 0;
  for (const i of idx) {
    const v = canonicalVertex(i);
    x += v.x;
    y += v.y;
  }
  x /= idx.length;
  y /= idx.length;
  const pred = { x: pm.x + s * (x - cm.x), y: pm.y - s * (y - cm.y) };
  const u = Math.hypot(pl.x - pr.x, pl.y - pr.y);
  return Math.hypot(aligned.x - pred.x, aligned.y - pred.y) / u;
}
