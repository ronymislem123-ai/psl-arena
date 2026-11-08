import { dist } from "../geometry";
import type { AdditionalMeasurementResult, LandmarkMap, Point, QualityReport, RatioResult } from "../types";

const vdist = (a: { y: number }, b: { y: number }) => Math.abs(a.y - b.y);

/** Mean adult horizontal visible iris diameter in mm (Rüfer et al. 2005: 11.71 ± 0.42 mm). */
export const IRIS_DIAMETER_MM = 11.7;

/** MediaPipe eye contours (lid margins), medial ↔ lateral, and iris rings (centre + 4 ring points). */
export const EYE_TOPOLOGY = {
  R: { upper: [33, 246, 161, 160, 159, 158, 157, 173, 133], lower: [33, 7, 163, 144, 145, 153, 154, 155, 133], iris: 468, ring: [469, 470, 471, 472] },
  L: { upper: [263, 466, 388, 387, 386, 385, 384, 398, 362], lower: [263, 249, 390, 373, 374, 380, 381, 382, 362], iris: 473, ring: [474, 475, 476, 477] },
} as const;

/** y of a lid contour at x (linear interpolation between the contour points), or null outside it. */
function lidAt(poly: Point[], x: number): number | null {
  const pts = [...poly].sort((a, b) => a.x - b.x);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (x >= a.x && x <= b.x) return b.x === a.x ? (a.y + b.y) / 2 : a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
  }
  return null;
}

/**
 * Eyelid position from the aligned mesh (pose-normalised frame): MRD1 (iris centre →
 * upper lid margin) and inferior scleral show (lower iris edge → lower lid margin), in
 * millimetres with the iris diameter as scale. The iris radius is taken from the
 * horizontal ring points (the vertical ones are often covered by the lids).
 */
export function eyelidMeasures(aligned: Point[] | undefined): { mrd1: number; ssi: number; perEye: Record<"R" | "L", { mrd1: number; ssi: number; irisPx: number }> } | null {
  if (!aligned || aligned.length < 478) return null;
  const per = {} as Record<"R" | "L", { mrd1: number; ssi: number; irisPx: number }>;
  for (const side of ["R", "L"] as const) {
    const t = EYE_TOPOLOGY[side];
    const c = aligned[t.iris];
    const ring = t.ring.map((i) => aligned[i]);
    const xs = ring.map((p) => p.x);
    const diameter = Math.max(...xs) - Math.min(...xs);
    if (!(diameter > 0)) return null;
    const up = lidAt(t.upper.map((i) => aligned[i]), c.x);
    const lo = lidAt(t.lower.map((i) => aligned[i]), c.x);
    if (up == null || lo == null) return null;
    const mm = IRIS_DIAMETER_MM / diameter;
    per[side] = { mrd1: (c.y - up) * mm, ssi: (lo - (c.y + diameter / 2)) * mm, irisPx: diameter };
  }
  return { mrd1: (per.R.mrd1 + per.L.mrd1) / 2, ssi: (per.R.ssi + per.L.ssi) / 2, perEye: per };
}

export function computeAdditional(map: LandmarkMap, ratios: RatioResult[], quality: QualityReport, aligned?: Point[]): AdditionalMeasurementResult[] {
  const g = (id: keyof LandmarkMap) => map[id]?.aligned;
  const out: AdditionalMeasurementResult[] = [];
  const baseConf = 0.6 + 0.4 * quality.score;

  out.push({ id: "CMA", value: null, availability: "unavailable", confidence: 0, noteCode: "requiresProfile", note: "Requires a lateral (profile) photograph; not measurable from a frontal image." });
  out.push({ id: "GA", value: null, availability: "unavailable", confidence: 0, noteCode: "requiresProfileSeeGS", note: "True gonial angle requires a lateral view. The frontal projection is reported as GS and is not comparable to the 115–130° reference." });

  // forehead finger rule
  const tr = g("trichion"), gl = g("glabella"), sn = g("subnasale"), pr = g("pupil_R"), pl = g("pupil_L");
  const ipd = pr && pl ? dist(pr, pl) : null;
  if (tr && gl && sn && ipd) {
    const fh = vdist(tr, gl);
    const mid = vdist(gl, sn);
    out.push({
      id: "FH_FINGER", value: fh / mid, values: { foreheadOverMiddleThird: fh / mid, foreheadOverIpd: fh / ipd }, availability: "available", confidence: baseConf * (map.trichion?.confidence ?? 0.5), noteCode: "fingerRule",
      note: `Forehead height is ${(fh / mid).toFixed(2)}× the middle third and ${(fh / ipd).toFixed(2)}× IPD. The "three fingers" rule is a non-metric rule of thumb and is not scored.`,
    });
  } else {
    out.push({ id: "FH_FINGER", value: null, availability: "unavailable", confidence: 0, noteCode: "hairlineMissing", note: "Hairline not available." });
  }

  // fifths
  const zr = g("zygion_R"), zl = g("zygion_L"), exr = g("exocanthion_R"), enr = g("endocanthion_R"), enl = g("endocanthion_L"), exl = g("exocanthion_L");
  if (zr && zl && exr && enr && enl && exl) {
    // order points left→right by x
    const pts = [zr, exr, enr, enl, exl, zl].sort((a, b) => a.x - b.x);
    const total = pts[5].x - pts[0].x;
    const seg = [0, 1, 2, 3, 4].map((i) => ((pts[i + 1].x - pts[i].x) / total) * 100);
    const dev = seg.reduce((s, v) => s + Math.abs(v - 20), 0) / 5;
    out.push({
      id: "FIFTHS", value: dev, values: { outer1: seg[0], eye1: seg[1], intercanthal: seg[2], eye2: seg[3], outer2: seg[4], meanDeviation: dev },
      availability: "available", confidence: baseConf * 0.85, noteCode: "fifths",
      note: `Fifths (left→right): ${seg.map((v) => v.toFixed(1) + " %").join(" · ")}. Mean deviation from 20 % = ${dev.toFixed(1)} pp. Scored in rubric 2.0 (facial fifths), not part of the 42-ratio set.`,
    });
  } else {
    out.push({ id: "FIFTHS", value: null, availability: "unavailable", confidence: 0, noteCode: "landmarksMissing", note: "Required landmarks missing." });
  }

  // BYZ/BIG raw
  const gr = g("gonion_R"), gll = g("gonion_L");
  if (zr && zl && gr && gll) {
    const v = dist(zr, zl) / dist(gr, gll);
    const big = ratios.find((r) => r.id === "BIG");
    out.push({
      id: "BYZ_BIG", value: v, values: { ratio: v, big: big?.value ?? NaN }, availability: "available", confidence: baseConf * 0.7, noteCode: "byzBig",
      note: `Raw bizygomatic ÷ bigonial = ${v.toFixed(2)} (older atlas target 1.35). Contradicts BIG ${big?.value ? big.value.toFixed(1) + " %" : ""} (85–92 % ⇒ 1.09–1.18); reported for reference only, not scored.`,
    });
  } else {
    out.push({ id: "BYZ_BIG", value: null, availability: "unavailable", confidence: 0, noteCode: "landmarksMissing", note: "Required landmarks missing." });
  }

  out.push({ id: "EAR_ANGLE", value: null, availability: "unavailable", confidence: 0, noteCode: "noEarLandmarks", note: "No ear landmarks in the face model and no defined target range." });

  const tip = g("pronasale"), me = g("menton");
  if (tip && me && sn && ipd) {
    const d = dist(tip, me);
    const lower = vdist(sn, me);
    out.push({
      id: "NOSE_CHIN", value: d / ipd, values: { noseTipToMentonOverIpd: d / ipd, noseTipToMentonOverLowerThird: d / lower },
      availability: "available", confidence: baseConf * 0.8, noteCode: "noseChin",
      note: `Nose tip → menton = ${(d / ipd).toFixed(2)}× IPD (${(d / lower).toFixed(2)}× lower third). Raw value only — no formula or target defined.`,
    });
  } else {
    out.push({ id: "NOSE_CHIN", value: null, availability: "unavailable", confidence: 0, noteCode: "landmarksMissing", note: "Required landmarks missing." });
  }

  // Pallett et al. 2010 length ratio: vertical pupil line → mouth over hairline → chin
  const st = g("stomion");
  if (tr && me && pr && pl && st) {
    const eyeY = (pr.y + pl.y) / 2;
    const len = vdist(tr, me);
    const v = Math.abs(st.y - eyeY) / len;
    out.push({
      id: "EML", value: v, values: { ratio: v, eyeToMouthOverIpd: ipd ? Math.abs(st.y - eyeY) / ipd : NaN },
      availability: "available", confidence: baseConf * Math.min(map.trichion?.confidence ?? 0.5, map.menton?.confidence ?? 0.8), noteCode: "eyeMouthLength",
      note: `Pupil line → mouth = ${(v * 100).toFixed(1)} % of hairline → chin (preferred .36–.37 in Pallett et al. 2010, white female faces).`,
    });
  } else {
    out.push({ id: "EML", value: null, availability: "unavailable", confidence: 0, noteCode: tr ? "landmarksMissing" : "hairlineMissing", note: tr ? "Required landmarks missing." : "Hairline not available." });
  }

  // eyelid position (MRD1, inferior scleral show) from the full aligned mesh
  const lid = eyelidMeasures(aligned);
  const eyesOpen = !quality.issues.some((i) => i.code === "eyes-closed");
  if (lid && eyesOpen) {
    const conf = baseConf * 0.75;
    out.push({ id: "MRD1", value: lid.mrd1, values: { mm: lid.mrd1, right: lid.perEye.R.mrd1, left: lid.perEye.L.mrd1 }, availability: "available", confidence: conf, noteCode: "eyelid", note: `Iris centre → upper lid margin = ${lid.mrd1.toFixed(1)} mm (right ${lid.perEye.R.mrd1.toFixed(1)}, left ${lid.perEye.L.mrd1.toFixed(1)}; normal 4–5 mm).` });
    out.push({ id: "SSI", value: lid.ssi, values: { mm: lid.ssi, right: lid.perEye.R.ssi, left: lid.perEye.L.ssi }, availability: "available", confidence: conf, noteCode: "eyelid", note: `Lower iris edge → lower lid margin = ${lid.ssi.toFixed(1)} mm (right ${lid.perEye.R.ssi.toFixed(1)}, left ${lid.perEye.L.ssi.toFixed(1)}; ≤ 0 = no scleral show below the iris).` });
  } else {
    for (const id of ["MRD1", "SSI"] as const) out.push({ id, value: null, availability: "unavailable", confidence: 0, noteCode: "landmarksMissing", note: lid ? "Eyes closed or partly closed." : "Iris landmarks not available." });
  }
  return out;
}
