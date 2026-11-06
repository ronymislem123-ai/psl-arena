import { dist } from "../geometry";
import type { AnalysisResult, FeatureObservation, LandmarkMap, RatioId, RatioResult, SymmetryResult } from "../types";

type Partial = Pick<AnalysisResult, "ratios" | "symmetry" | "categories" | "scores"> & { map: LandmarkMap };

const fmt = (v: number, unit: string) => (unit === "percent" ? `${v.toFixed(1)} %` : unit === "degrees" ? `${v.toFixed(1)}°` : v.toFixed(2));

export function buildFeatures(p: Partial): FeatureObservation[] {
  const r = (id: RatioId): RatioResult | undefined => p.ratios.find((x) => x.id === id);
  const sym = (id: string) => p.symmetry.metrics.find((m) => m.id === id);
  const g = (id: keyof LandmarkMap) => p.map[id]?.aligned;
  const out: FeatureObservation[] = [];

  const measured = (id: string, group: FeatureObservation["group"], label: string, ratioId: RatioId, unit: string, kind: FeatureObservation["kind"] = "measured", note?: string) => {
    const res = r(ratioId);
    if (res && res.availability === "available" && res.value !== null) {
      out.push({ id, group, label, kind, summary: `${fmt(res.value, unit)} — ${res.inT1 ? "within" : "outside"} the T1 range`, value: res.value, unit, sourceRatio: ratioId, note });
    } else {
      out.push({ id, group, label, kind: "not-determinable", summary: res?.unavailableReason ?? "Not available", sourceRatio: ratioId, note });
    }
  };
  const nd = (id: string, group: FeatureObservation["group"], label: string, why: string) =>
    out.push({ id, group, label, kind: "not-determinable", summary: why });
  const symFeat = (id: string, group: FeatureObservation["group"], label: string, metricIds: string[]) => {
    const ms = metricIds.map(sym).filter((m): m is NonNullable<typeof m> => !!m);
    if (!ms.length) return nd(id, group, label, "Symmetry metrics unavailable");
    const s = ms.reduce((a, m) => a + m.score, 0) / ms.length;
    out.push({ id, group, label, kind: "measured", summary: `Symmetry sub-score ${s.toFixed(0)}/100 (${ms.map((m) => m.label).join(", ")})`, value: s, unit: "score" });
  };

  const pr = g("pupil_R"), pl = g("pupil_L");
  const ipd = pr && pl ? dist(pr, pl) : null;

  // A. Eyes & Brows
  measured("canthalTilt", "eyesBrows", "Canthal tilt", "CT", "degrees");
  measured("eyeSpacing", "eyesBrows", "Eye spacing", "ESR", "percent");
  const ear = r("EAR");
  if (ear?.value) {
    const d = ear.value > 3.4 ? "elongated fissure" : ear.value < 2.9 ? "rounder/open fissure" : "balanced fissure";
    out.push({ id: "eyeShape", group: "eyesBrows", label: "Eye shape (geometric)", kind: "approximate", summary: `${d} (EAR ${ear.value.toFixed(2)})`, value: ear.value, sourceRatio: "EAR", note: "Shape descriptor derived from the aspect ratio only." });
  } else nd("eyeShape", "eyesBrows", "Eye shape (geometric)", "Eye aspect ratio unavailable");
  symFeat("eyeSymmetry", "eyesBrows", "Eye symmetry", ["eyeHeight", "pfl", "canthalTilt", "canthusHeight"]);
  measured("eyeAspectRatio", "eyesBrows", "Eye aspect ratio", "EAR", "ratio");
  const blm = g("brow_lower_mid_R"), blmL = g("brow_lower_mid_L"), us = g("palpebrale_sup_R"), usL = g("palpebrale_sup_L");
  if (blm && blmL && us && usL && ipd && pr && pl) {
    const browPupil = ((Math.abs(pr.y - blm.y) + Math.abs(pl.y - blmL.y)) / 2) / ipd;
    const browLid = ((Math.abs(us.y - blm.y) + Math.abs(usL.y - blmL.y)) / 2) / ipd;
    out.push({ id: "browPosition", group: "eyesBrows", label: "Brow position", kind: "approximate", summary: `Brow lower edge sits ${browPupil.toFixed(2)}× IPD above the pupils`, value: browPupil, unit: "IPD", note: "Raw measurement; no reference range in the material." });
    out.push({ id: "browToEye", group: "eyesBrows", label: "Brow-to-eye distance", kind: "approximate", summary: `${browLid.toFixed(2)}× IPD from upper lid to brow edge`, value: browLid, unit: "IPD", note: "Raw measurement; no reference range in the material." });
  } else {
    nd("browPosition", "eyesBrows", "Brow position", "Landmarks unavailable");
    nd("browToEye", "eyesBrows", "Brow-to-eye distance", "Landmarks unavailable");
  }
  nd("browDensity", "eyesBrows", "Brow density", "Visual property; not inferred from geometry.");
  const apR = g("brow_apex_R"), bmR = g("brow_medial_R"), bltR = g("brow_lateral_R");
  if (apR && bmR && bltR && ipd) {
    const arch = (Math.max(bmR.y, bltR.y) - apR.y) / ipd;
    out.push({ id: "browShape", group: "eyesBrows", label: "Brow shape (arch)", kind: "approximate", summary: `${arch > 0.12 ? "pronounced arch" : arch > 0.06 ? "soft arch" : "flat brow"} (arch height ${arch.toFixed(2)}× IPD)`, value: arch, unit: "IPD" });
  } else nd("browShape", "eyesBrows", "Brow shape (arch)", "Landmarks unavailable");
  measured("browTilt", "eyesBrows", "Brow tilt", "ET", "degrees");

  // B. Midface & Cheekbones
  const mf = r("MF");
  if (mf?.value && ipd) {
    out.push({ id: "midfaceLength", group: "midface", label: "Midface length", kind: "measured", summary: `Nasion → upper lip = ${(mf.intermediate.nasionToUpperLip / ipd).toFixed(2)}× IPD`, value: mf.intermediate.nasionToUpperLip / ipd, unit: "IPD", sourceRatio: "MF" });
  } else nd("midfaceLength", "midface", "Midface length", "Unavailable");
  measured("midfaceRatio", "midface", "Midface ratio", "MF", "ratio");
  const zr = g("zygion_R"), zl = g("zygion_L");
  if (zr && zl && ipd) out.push({ id: "zygomaticWidth", group: "midface", label: "Zygomatic width", kind: "approximate", summary: `${(dist(zr, zl) / ipd).toFixed(2)}× IPD (soft-tissue contour)`, value: dist(zr, zl) / ipd, unit: "IPD", note: "Soft-tissue stand-in for the bony zygomatic width." });
  else nd("zygomaticWidth", "midface", "Zygomatic width", "Unavailable");
  nd("cheekboneDefinition", "midface", "Visible cheekbone definition", "Requires visual/3D assessment; not inferred from 2D landmarks.");
  measured("highCheekbones", "midface", "Cheekbone position (height)", "CBS", "percent", "approximate", "Uses the soft-tissue zygion level.");
  const mc = p.categories.find((c) => c.id === "midface");
  out.push({ id: "midfaceHarmony", group: "midface", label: "Midface harmony", kind: mc?.index != null ? "measured" : "not-determinable", summary: mc?.index != null ? `Category index ${mc.index.toFixed(0)}/100` : "Unavailable", value: mc?.index ?? undefined, unit: "index" });
  measured("facialWidth", "midface", "Facial width-to-height", "FWHR", "ratio");

  // C. Jaw & Chin
  nd("jawlineDefinition", "jawChin", "Jawline definition", "Requires visual/3D assessment (soft tissue, lighting); not inferred from 2D landmarks.");
  measured("jawWidth", "jawChin", "Jaw width (bigonial / bizygomatic)", "BIG", "percent", "approximate", "Constructed gonions.");
  const big = r("BIG");
  if (big?.value && ipd) out.push({ id: "bigonialWidth", group: "jawChin", label: "Bigonial width", kind: "approximate", summary: `${(big.intermediate.bigonial / ipd).toFixed(2)}× IPD`, value: big.intermediate.bigonial / ipd, unit: "IPD", sourceRatio: "BIG" });
  else nd("bigonialWidth", "jawChin", "Bigonial width", "Unavailable");
  measured("gonialAngle", "jawChin", "Gonial angle (frontal projection only)", "GS", "degrees", "approximate", "The true gonial angle needs a profile photo.");
  const gs = r("GS");
  if (gs?.value) out.push({ id: "jawAngularity", group: "jawChin", label: "Jaw angularity (frontal)", kind: "approximate", summary: gs.value < 145 ? "angular jaw projection" : gs.value < 160 ? "moderately angular" : "rounded jaw projection", value: gs.value, unit: "degrees", sourceRatio: "GS" });
  else nd("jawAngularity", "jawChin", "Jaw angularity (frontal)", "Unavailable");
  symFeat("jawlineSymmetry", "jawChin", "Jawline symmetry", ["gonionWidth", "gonionHeight", "chin"]);
  nd("chinProjection", "jawChin", "Chin projection", "Requires a profile photo (anterior-posterior projection is not visible frontally).");
  measured("chinWidth", "jawChin", "Chin width (mouth/chin)", "M_C", "ratio", "approximate", "Reconstructed chin points.");
  measured("chinPhiltrum", "jawChin", "Chin-to-philtrum ratio", "C_P", "ratio");
  measured("lowerThirdProportions", "jawChin", "Lower third proportion", "FT_L", "percent");
  nd("mandibularDefinition", "jawChin", "Visible mandibular definition", "Requires visual/3D assessment; not inferred from 2D landmarks.");

  // D. Nose & Lips
  measured("noseWidth", "noseLips", "Nose width", "N_BYZGO", "percent");
  measured("noseHeight", "noseLips", "Nose height-to-width", "N_H", "ratio");
  symFeat("noseSymmetry", "noseLips", "Nose symmetry", ["noseTip", "alar"]);
  nd("nasalBridge", "noseLips", "Nasal bridge appearance", "Requires profile view/visual assessment; dorsum shape is not measurable frontally.");
  measured("mouthWidth", "noseLips", "Mouth width", "M_IPD", "percent");
  measured("lipWHR", "noseLips", "Lip width-to-height", "LIP_WHR", "ratio");
  measured("upperLowerLip", "noseLips", "Lower-to-upper lip ratio", "LL_UL", "ratio");
  symFeat("lipSymmetry", "noseLips", "Lip symmetry", ["mouthCornerHeight", "mouthCornerWidth"]);
  measured("mouthNose", "noseLips", "Mouth-to-nose ratio", "M_N", "ratio");

  // E. Overall
  const s = p.scores;
  out.push({ id: "facialHarmony", group: "overall", label: "Facial harmony", kind: s.harmony != null ? "measured" : "not-determinable", summary: s.harmony != null ? `Harmony index ${s.harmony.toFixed(0)}/100` : "Unavailable", value: s.harmony ?? undefined, unit: "index" });
  out.push({ id: "facialSymmetry", group: "overall", label: "Facial symmetry", kind: s.symmetry != null ? "measured" : "not-determinable", summary: s.symmetry != null ? `Symmetry score ${s.symmetry.toFixed(0)}/100` : "Unavailable", value: s.symmetry ?? undefined, unit: "score" });
  out.push({ id: "overallBalance", group: "overall", label: "Overall facial balance", kind: s.proportion != null ? "measured" : "not-determinable", summary: s.proportion != null ? `Proportion score ${s.proportion.toFixed(0)}/100` : "Unavailable", value: s.proportion ?? undefined, unit: "score" });
  nd("facialDefinition", "overall", "Facial definition", "Visual property (soft tissue, lighting, body fat); not inferred from geometry.");
  nd("facialContours", "overall", "Facial contours", "Visual/3D property; not inferred from 2D landmarks.");
  const idx = p.categories.map((c) => c.index).filter((v): v is number => v != null);
  if (idx.length >= 3) {
    const mean = idx.reduce((a, b) => a + b, 0) / idx.length;
    const sd = Math.sqrt(idx.reduce((a, b) => a + (b - mean) ** 2, 0) / idx.length);
    out.push({ id: "featureHarmony", group: "overall", label: "Individual feature harmony", kind: "measured", summary: `${sd < 10 ? "consistent" : sd < 20 ? "moderately varied" : "uneven"} across categories (spread ±${sd.toFixed(0)})`, value: sd, unit: "σ" });
    out.push({ id: "proportionalConsistency", group: "overall", label: "Proportional consistency", kind: "measured", summary: `${p.ratios.filter((x) => x.inT1).length} of ${p.ratios.filter((x) => x.availability === "available").length} evaluable ratios inside T1`, value: p.ratios.filter((x) => x.inT1).length, unit: "count" });
  } else {
    nd("featureHarmony", "overall", "Individual feature harmony", "Not enough category coverage.");
    nd("proportionalConsistency", "overall", "Proportional consistency", "Not enough category coverage.");
  }
  nd("skinAppearance", "overall", "Visible skin appearance", "Not assessed — outside the scope of geometric analysis.");
  return out;
}

export function symmetrySummary(s: SymmetryResult): string {
  if (s.score == null) return "Symmetry not available.";
  const worst = [...s.metrics].sort((a, b) => a.score - b.score).slice(0, 2).map((m) => m.label.toLowerCase());
  return `Symmetry ${s.score.toFixed(0)}/100${worst.length ? `; largest asymmetries: ${worst.join(", ")}` : ""}.`;
}
