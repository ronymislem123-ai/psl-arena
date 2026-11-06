import { dist } from "../geometry";
import type { AdditionalMeasurementResult, LandmarkMap, QualityReport, RatioResult } from "../types";

const vdist = (a: { y: number }, b: { y: number }) => Math.abs(a.y - b.y);

export function computeAdditional(map: LandmarkMap, ratios: RatioResult[], quality: QualityReport): AdditionalMeasurementResult[] {
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
      note: `Fifths (left→right): ${seg.map((v) => v.toFixed(1) + " %").join(" · ")}. Mean deviation from 20 % = ${dev.toFixed(1)} pp. Informational, not part of the 42-ratio score.`,
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
  return out;
}
