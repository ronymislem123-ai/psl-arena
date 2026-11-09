/**
 * Measurement model (engine 2.0): how far a measured value is from its reference
 * range, in units that mean the same for every ratio.
 *
 * 1. Dispersion unit s per ratio = the natural between-person spread of that ratio.
 *    Coefficients of variation (CV) of the component distances come from Fang,
 *    Clapham & Chung 2011 (27 groups, n = 2,359; within-group CVs: intercanthal
 *    .087, nasal width .078, mouth width .076, biocular .051, bizygomatic .046,
 *    forehead height .098) where available, otherwise from a stated convention.
 *    The CV of a ratio a/b is sqrt(CVa² + CVb² − 2ρ·CVa·CVb) with ρ = 0.5; this ρ
 *    reproduces the directly measured spread of Pallett et al. 2010's width ratio
 *    (SD .022 at .46 → CV .048; propagated .049). s = CV(ratio) × reference value.
 *    Angles and deviation measures use conventions (marked).
 * 2. Index = 100 inside the reference range, 100·exp(−½·(d/s)²) at a distance d
 *    outside (Gaussian fall-off in units of s): a face 1 s outside scores 61, 2 s
 *    outside 14. This replaces the scale-dependent "10 % of the target" rule.
 * 3. The reported index is the expectation of that function over the measurement
 *    uncertainty of the value (σ from the landmark Monte-Carlo): a value that might
 *    be inside or outside the range scores in between, so the index is smooth and
 *    unbiased with respect to measurement noise.
 */
import type { RatioId, T1Range } from "../types";

export type DispersionBasis = "literature" | "propagated" | "convention";
export interface Dispersion {
  s: number;
  basis: DispersionBasis;
  note: string;
}
/**
 * supported: a study supports the reference direction; convention: community range,
 * untested; contradicted: evidence contradicts the direction; constructMismatch: the
 * range is not reached by any real or AI test face with this landmark construction
 * (all on the same side, median ≥ 2 dispersion units) — not a usable reference.
 * The last two are shown but not scored.
 */
export type EvidenceStatus = "supported" | "convention" | "contradicted" | "constructMismatch";
export interface Evidence {
  status: EvidenceStatus;
  note: string;
}

const RHO = 0.5;
const CV = {
  // Fang et al. 2011 (women, pooled groups)
  intercanthal: 0.087, nasalWidth: 0.078, mouthWidth: 0.076, biocular: 0.051, bizygomatic: 0.046, foreheadHeight: 0.098,
  // conventions (no population CV in the sources read) — marked "conv" in the docs
  ipd: 0.05, fissureLength: 0.07, eyeHeight: 0.15, browLength: 0.08, bigonial: 0.07, bitemporal: 0.05, noseHeight: 0.07,
  midfaceHeight: 0.06, lowerFace: 0.07, upperLip: 0.12, lowerLip: 0.14, lipTotal: 0.12, stomionMenton: 0.08, lowerLipChin: 0.09,
  chinWidth: 0.08, faceHeight: 0.045, nasionMenton: 0.05, glabellaSubnasale: 0.06, cheekLip: 0.06, neck: 0.08,
} as const;
const cvRatio = (a: number, b: number) => Math.sqrt(a * a + b * b - 2 * RHO * a * b);
const lit = (s: number, note: string): Dispersion => ({ s, basis: "literature", note });
const prop = (cv: number, ref: number, note: string): Dispersion => ({ s: cv * ref, basis: "propagated", note });
const conv = (s: number, note: string): Dispersion => ({ s, basis: "convention", note });

export const DISPERSION: Partial<Record<RatioId, Dispersion>> = {
  ESR: lit(2.2, "Pallett et al. 2010: SD .022 of the interpupillary/face-width ratio (≈ 2.2 pp)"),
  OCD: prop(cvRatio(CV.biocular, CV.bizygomatic), 65, "biocular .051 / bizygomatic .046 (Fang 2011)"),
  ICD: prop(cvRatio(CV.intercanthal, CV.fissureLength), 0.99, "intercanthal .087 (Fang 2011) / fissure length conv. .07"),
  EAR: prop(cvRatio(CV.fissureLength, CV.eyeHeight), 3.3, "fissure length conv. .07 / eye height conv. .15"),
  PFL_BYZGO: prop(cvRatio(CV.fissureLength, CV.bizygomatic), 20.5, "fissure length conv. .07 / bizygomatic .046"),
  M_IPD: prop(cvRatio(CV.mouthWidth, CV.ipd), 84, "mouth width .076 (Fang 2011) / IPD conv. .05"),
  EBL: prop(cvRatio(CV.browLength, CV.ipd), 74, "brow length conv. .08 / IPD conv. .05"),
  ICD_N: prop(cvRatio(CV.intercanthal, CV.nasalWidth), 1.05, "intercanthal .087 / nasal width .078 (Fang 2011)"),
  EME: conv(2.5, "angle; convention 2.5°"),
  BIT: prop(cvRatio(CV.bitemporal, CV.bizygomatic), 90, "bitemporal conv. .05 / bizygomatic .046"),
  DEV_BIT_BIG: conv(3, "deviation measure; convention 3 pp"),
  BIG: prop(cvRatio(CV.bigonial, CV.bizygomatic), 88.5, "bigonial conv. .07 / bizygomatic .046"),
  JWHR: prop(cvRatio(CV.bigonial, CV.stomionMenton), 1.9, "bigonial conv. .07 / stomion–menton conv. .08"),
  M_BIG: prop(cvRatio(CV.mouthWidth, CV.bigonial), 42.5, "mouth width .076 / bigonial conv. .07"),
  GS: conv(6, "frontal projection of the jaw angle; convention 6°"),
  M_N: prop(cvRatio(CV.mouthWidth, CV.nasalWidth), 1.45, "mouth width .076 / nasal width .078 (Fang 2011)"),
  MF: prop(cvRatio(CV.ipd, CV.midfaceHeight), 0.99, "IPD conv. .05 / nasion–upper-lip conv. .06"),
  FWHR: prop(cvRatio(CV.bizygomatic, CV.midfaceHeight), 1.975, "bizygomatic .046 / brow–lip height conv. .06"),
  TFWHR: prop(cvRatio(CV.faceHeight, CV.bizygomatic), 1.355, "face height conv. .045 / bizygomatic .046"),
  CBS: prop(CV.cheekLip * 1.2, 80, "cheekbone-to-lip / pupil-to-lip, conv. CV .072"),
  N_H: prop(cvRatio(CV.noseHeight, CV.nasalWidth), 1.495, "nose height conv. .07 / nasal width .078"),
  M_C: prop(cvRatio(CV.mouthWidth, CV.chinWidth), 1.0, "mouth width .076 / chin width conv. .08"),
  N_BYZGO: prop(cvRatio(CV.nasalWidth, CV.bizygomatic), 25, "nasal width .078 / bizygomatic .046 (Fang 2011)"),
  CT: conv(3, "angle; convention 3°"),
  ET: conv(4, "angle; convention 4°"),
  DEV_CT_ET: conv(3, "deviation measure; convention 3°"),
  FWHF: prop(cvRatio(CV.foreheadHeight, CV.bizygomatic), 47, "forehead height .098 / bizygomatic .046 (Fang 2011)"),
  LL_UL: prop(cvRatio(CV.lowerLip, CV.upperLip), 1.65, "lip heights conv. .14 / .12"),
  L3P: prop(cvRatio(CV.upperLip, CV.lowerFace), 32, "subnasale–stomion conv. .12 / lower face conv. .07"),
  LFF: prop(cvRatio(CV.nasionMenton, CV.faceHeight), 65, "nasion–menton conv. .05 / face height conv. .045"),
  C_P: prop(cvRatio(CV.lowerLipChin, CV.upperLip), 2.3, "lower lip–chin conv. .09 / philtrum conv. .12"),
  FT_L: prop(cvRatio(CV.lowerFace, CV.faceHeight), 35.5, "lower face conv. .07 / face height conv. .045"),
  FT_M: prop(cvRatio(CV.glabellaSubnasale, CV.faceHeight), 32, "glabella–subnasale conv. .06 / face height conv. .045"),
  FT_U: prop(cvRatio(CV.foreheadHeight, CV.faceHeight), 31, "forehead height .098 (Fang 2011) / face height conv. .045"),
  LIP_WHR: prop(cvRatio(CV.mouthWidth, CV.lipTotal), 3.25, "mouth width .076 / lip height conv. .12"),
  NW: prop(cvRatio(CV.neck, CV.bigonial), 94, "neck width conv. .08 / bigonial conv. .07"),
};

/** Evidence on whether the guide's reference direction is supported (docs/research/2026-11-reengineering-literature.md). */
export const EVIDENCE: Partial<Record<RatioId, Evidence>> = {
  ESR: { status: "supported", note: "Pallett et al. 2010: preferred interpupillary/face-width ratio ≈ .46 (white female faces); the guide's 45–47.9 % contains it." },
  FWHR: { status: "contradicted", note: "Geniole et al. 2015 meta-analysis: higher FWHR is rated less attractive (r̄ = −.26); FWHR also tracks BMI and shifts ~5 % with camera distance. Shown, not scored." },
  JWHR: { status: "constructMismatch", note: "Reconstructed convention: all 6 test faces (4 photos, 2 AI faces) lie above the range (median 4.5 dispersion units, values 2.5–2.8 vs 1.85–1.95), so the source must have used another construction. Shown, not scored." },
  ET: { status: "constructMismatch", note: "All 6 test faces have a negative brow tilt (−2 to −7°) against the 5–13° range (median −2.7 units): the source's angle convention (brow head → apex?) differs from the head → tail line used here. Shown, not scored." },
  DEV_CT_ET: { status: "constructMismatch", note: "Difference between canthal tilt and brow tilt; inherits the brow-tilt convention mismatch. Shown, not scored." },
  GS: { status: "constructMismatch", note: "All 6 test faces lie above the 138–143° range (146–153°): the mesh contour smooths the jaw corner, so the frontal projection is systematically larger than the source's construction (≈ 145–160° expected for most faces). Shown, not scored." },
  ICD_N: { status: "constructMismatch", note: "All 6 test faces lie below the 1.0–1.1 range (median −3.0 units). Alar width relative to the intercanthal distance also differs systematically between populations (Farkas et al. 2005), so a single narrow range is not a fair reference. Shown, not scored." },
  FT_U: { status: "convention", note: "Equal-thirds canons rarely hold in real faces (Jayaratne et al. 2012)." },
  FT_M: { status: "convention", note: "Equal-thirds canons rarely hold in real faces (Jayaratne et al. 2012)." },
  FT_L: { status: "convention", note: "Equal-thirds canons rarely hold in real faces (Jayaratne et al. 2012)." },
};

/** Statuses whose ratios are shown but excluded from every score. */
export function isUnscored(status: EvidenceStatus): boolean {
  return status === "contradicted" || status === "constructMismatch";
}

export function evidenceOf(id: RatioId): Evidence {
  return EVIDENCE[id] ?? { status: "convention", note: "Reference range from the community guide; no study testing it was found." };
}

export function dispersionOf(id: RatioId, t1: T1Range): Dispersion {
  const d = DISPERSION[id];
  if (d) return d;
  const ref = Math.abs(t1.min ?? t1.max ?? 1) || 1;
  return conv(0.07 * ref, "fallback convention: CV .07 of the reference value");
}

/** Signed distance outside [min, max] (0 inside). */
export function rangeDistance(x: number, t1: T1Range): number {
  if (t1.min !== null && x < t1.min) return x - t1.min;
  if (t1.max !== null && x > t1.max) return x - t1.max;
  return 0;
}

/** 100 inside the range, Gaussian fall-off outside in units of s. */
export function plateauIndex(x: number, t1: T1Range, s: number): number {
  const d = rangeDistance(x, t1);
  if (d === 0) return 100;
  const z = d / Math.max(s, 1e-12);
  return 100 * Math.exp(-0.5 * z * z);
}

// Composite Simpson rule over ±5σ (64 intervals) with the standard normal density.
const SIMPSON: [number, number][] = (() => {
  const n = 64;
  const a = -5;
  const h = 10 / n;
  const out: [number, number][] = [];
  let W = 0;
  for (let i = 0; i <= n; i++) {
    const z = a + i * h;
    const c = i === 0 || i === n ? 1 : i % 2 ? 4 : 2;
    const w = (c * h * Math.exp(-0.5 * z * z)) / (3 * Math.sqrt(2 * Math.PI));
    out.push([z, w]);
    W += w;
  }
  return out.map(([z, w]) => [z, w / W]);
})();

/** Expected plateau index when the true value is N(x, σ²). */
export function expectedIndex(x: number, sigma: number, t1: T1Range, s: number): number {
  if (!(sigma > 0)) return plateauIndex(x, t1, s);
  let e = 0;
  for (const [z, w] of SIMPSON) e += w * plateauIndex(x + sigma * z, t1, s);
  return e;
}
