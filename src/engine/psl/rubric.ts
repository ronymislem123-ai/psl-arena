/**
 * Versioned PSL rating rubric — version 2.0.0 (2026-11 re-engineering).
 *
 * Hierarchy: measures (frontal ratios, symmetry metrics, profile measurements,
 * derived measures) → criteria (one anatomical trait each; every measure feeds
 * exactly one criterion, checked by a unit test) → 7 primary categories → overall.
 * "Harmony" is not a separately scored category any more: it is the interaction
 * term of the non-compensatory aggregation (docs/RUBRIC.md, docs/SCORING_MODEL.md).
 *
 * What changed against 1.0.0 and why (docs/SYSTEM_AUDIT.md):
 * - removed `areaBalance` (rewarded uniformly weak faces) and `verticalBalance`
 *   (scored the three thirds twice);
 * - FWHR is shown but not scored: its reference direction is contradicted by a
 *   meta-analysis (Geniole et al. 2015);
 * - forehead & hairline became a category; the bitemporal width moved there;
 * - the frontal chin-to-philtrum ratio and the profile lip–chin ratio describe the
 *   same construct and form one criterion;
 * - new criterion `eyeMouthLength` (Pallett et al. 2010, the one length ratio with
 *   published preference data).
 * Criteria of 1.0.0 that no longer exist stay in LEGACY_CRITERIA so that stored
 * ratings keep rendering.
 */
import type { AdditionalMeasurementId, RatioId, SemanticLandmarkId } from "../types";
import type { SideMeasurementId } from "../side-view";
import { evidenceOf } from "../scoring/measurement";

export const RUBRIC_VERSION = "2.0.0";

export type RubricArea = "eye" | "proportions" | "bone" | "nose" | "mouth" | "symmetry" | "forehead" | /* 1.0 only */ "midface" | "harmony";
/** Active categories of rubric 2.0, in display order. */
export const RUBRIC_AREAS: RubricArea[] = ["eye", "proportions", "bone", "nose", "mouth", "symmetry", "forehead"];

export type CriterionMethod = "geometric" | "symmetry" | "profile" | "derived" | "visual";
export type CriterionView = "frontal" | "profile" | "any";
/** rubric 1.0 derived criteria (stored ratings only) */
export type DerivedKind = "areaBalance" | "verticalBalance";

export type CriterionId =
  | "canthalTilt" | "eyeSpacing" | "fissureProportions" | "browArea" | "upperLidExposure" | "scleralShow" | "eyeShape"
  | "midfaceRatio" | "facialThirds" | "faceShape" | "eyeMouthGeometry" | "eyeMouthLength" | "lowerThirdProportions" | "facialFifths" | "profileConvexity" | "lowerFaceHarmony"
  | "jawWidth" | "jawHeightRatio" | "jawAngularityFrontal" | "gonialAngle" | "chinProjection" | "neckChinDefinition" | "chinWidthShape" | "cheekbonePosition" | "cheekboneProjection" | "jawlineDefinition"
  | "noseWidth" | "noseHeightWidth" | "noseProjection" | "nasalAngles"
  | "mouthWidth" | "lipProportions" | "nasolabialAngle" | "lipChinVertical" | "lipShape"
  | "eyeSymmetry" | "noseSymmetry" | "mouthSymmetry" | "jawChinSymmetry"
  | "foreheadHeight" | "foreheadWidth"
  // rubric 1.0 only (kept for stored ratings)
  | "fwhr" | "areaBalance" | "verticalBalance";

export interface CriterionInputs {
  ratios?: RatioId[];
  symmetry?: string[];
  side?: SideMeasurementId[];
  additional?: AdditionalMeasurementId[];
  derived?: DerivedKind;
}

export interface CriterionDefinition {
  id: CriterionId;
  area: RubricArea;
  name: string;
  definition: string;
  method: CriterionMethod;
  view: CriterionView;
  /** relative weight inside its category (rubric 2.0: 1 for every criterion) */
  weight: number;
  inputs: CriterionInputs;
  requirements: string;
  limitations: string[];
  /** only in rubric 1.0 */
  legacy?: boolean;
}

export const AREA_META: Record<RubricArea, { name: string; description: string; legacy?: boolean }> = {
  eye: { name: "Eye area", description: "Canthal tilt, spacing, fissure proportions, brows; lid exposure, scleral show and eye shape only with a visual assessment." },
  proportions: { name: "Facial proportions", description: "Midface ratio, middle and lower thirds, face shape, eye–mouth geometry and length ratio, lower third, fifths; profile convexity and lower-face height from the profile." },
  bone: { name: "Bone structure", description: "Jaw width, frontal jaw angle, chin width, cheekbone position; gonial angle, chin projection and neck–chin definition from the profile; cheekbone projection and jawline definition only with a visual assessment." },
  nose: { name: "Nose", description: "Width and height-to-width frontally, projection and angles from the profile." },
  mouth: { name: "Lips & mouth", description: "Mouth width, lip proportions, lip–chin height (frontal and profile) and nasolabial angle." },
  symmetry: { name: "Symmetry", description: "Left–right agreement of eyes/brows, nose, mouth and jaw/chin in the pose-normalised frame." },
  forehead: { name: "Forehead & hairline", description: "Forehead height (upper third, forehead-to-width) and forehead width (bitemporal); needs the hairline for the height." },
  midface: { name: "Midface & proportions", description: "Rubric 1.0 area (now split into proportions, bone and forehead).", legacy: true },
  harmony: { name: "Facial harmony", description: "Rubric 1.0 area (replaced by the balance term of the aggregation).", legacy: true },
};

/**
 * Category weights (sum 100). Evidence-informed order, conventional values
 * (docs/RUBRIC.md): eyes carry the most variance in whole-face judgements, then
 * nose, then mouth, the forehead the least (Gao 2025); proportions/averageness
 * are the most consistent shape predictor (Lee et al. 2025, Pallett et al. 2010);
 * symmetry is a weak predictor in recent large samples (Lee et al. 2025; Van
 * Dongen 2011); jaw prominence mattered among single features (Mogilski & Welling
 * 2018) but frontal 2D jaw landmarks are unreliable (Lim et al. 2022).
 */
export const CATEGORY_WEIGHTS: Partial<Record<RubricArea, number>> = { eye: 25, proportions: 20, bone: 15, nose: 12, mouth: 10, symmetry: 10, forehead: 8 };

/**
 * Exponent of the weighted power mean over the categories. p = 1 would be fully
 * compensatory (one excellent category offsets a weak one 1:1); p → 0 is the
 * geometric mean. p = 0.5 is a moderate non-compensatory choice: studies show
 * configural, non-additive judgements (Abbas & Duchaine 2008; Lin & Zhou 2021),
 * but no study quantifies the degree, so p is a stated model parameter with a
 * sensitivity analysis in docs/MODEL_VALIDATION.md.
 */
export const AGGREGATION_P = 0.5;

/**
 * Reliability (attenuation λ, 0–1) of measures by the weakest landmark they use.
 * Lim et al. 2022: 2D bigonial width ICC .16, bizygomatic .66; trichion, menton
 * and gonion carry the largest automatic-landmarking errors (Türkün et al. 2026;
 * Kleisner et al. 2025). Used as weights: noisy measures count less.
 */
export const LANDMARK_RELIABILITY: Partial<Record<SemanticLandmarkId, number>> = {
  gonion_R: 0.4, gonion_L: 0.4, ramus_upper_R: 0.4, ramus_upper_L: 0.4, mandible_body_R: 0.4, mandible_body_L: 0.4,
  zygion_R: 0.75, zygion_L: 0.75,
  trichion: 0.6,
  chin_corner_R: 0.6, chin_corner_L: 0.6,
  frontotemporale_R: 0.6, frontotemporale_L: 0.6,
  neck_R: 0.6, neck_L: 0.6,
};

/** Pallett et al. 2010 length ratio: (pupil line → mouth) / (hairline → chin); preferred .36–.37, SD .017. */
export const EYE_MOUTH_LENGTH = { min: 0.36, max: 0.37, s: 0.017 } as const;

const LIM_T1 = "Scored against the reference ranges of the frontal ratio database (docs/RATIOS.md), in units of the natural between-person spread.";
const LIM_PROFILE = "Needs a side-view analysis with manually placed landmarks (docs/SIDE_VIEW.md).";
const LIM_VISUAL = "Not inferable from 2D landmarks; assessed only when a visual assessment provider is configured, otherwise reported as not assessable.";
const LIM_JAW = "Frontal jaw landmarks are soft-tissue constructions with low reliability (2D bigonial width ICC .16, Lim et al. 2022); weighted accordingly.";

const c = (d: Omit<CriterionDefinition, "weight"> & { weight?: number }): CriterionDefinition => ({ weight: 1, ...d });

export const CRITERIA: CriterionDefinition[] = [
  // A — eye area
  c({ id: "canthalTilt", area: "eye", name: "Canthal tilt", definition: "Inclination of the intercanthal axis (lateral canthus relative to the medial canthus).", method: "geometric", view: "frontal", inputs: { ratios: ["CT"] }, requirements: "Frontal photo, eyes open, yaw ≤ 15°.", limitations: [LIM_T1, "Squinting and residual pitch change the measured tilt."] }),
  c({ id: "eyeSpacing", area: "eye", name: "Eye spacing", definition: "Inter-pupillary, outer-canthal and intercanthal distances relative to the face and the fissure.", method: "geometric", view: "frontal", inputs: { ratios: ["ESR", "ICD", "OCD"] }, requirements: "Frontal photo with visible canthi.", limitations: [LIM_T1, "The interpupillary/face-width ratio is the one measure here with published preference data (Pallett et al. 2010)."] }),
  c({ id: "fissureProportions", area: "eye", name: "Fissure proportions", definition: "Eye aspect ratio and fissure length relative to the face width.", method: "geometric", view: "frontal", inputs: { ratios: ["EAR", "PFL_BYZGO"] }, requirements: "Neutral expression, eyes open.", limitations: [LIM_T1, "Eye opening changes with expression and fatigue."] }),
  c({ id: "browArea", area: "eye", name: "Brow length", definition: "Brow length relative to the inter-pupillary distance. Brow tilt and its agreement with the canthal tilt are shown but not scored (angle convention does not match the reference, docs/SYSTEM_AUDIT.md).", method: "geometric", view: "frontal", inputs: { ratios: ["EBL"] }, requirements: "Brows visible (no fringe).", limitations: [LIM_T1, "Grooming changes brow ends."] }),
  c({ id: "upperLidExposure", area: "eye", name: "Upper lid exposure", definition: "Visible upper eyelid (lid show) between lash line and brow.", method: "visual", view: "frontal", inputs: {}, requirements: "Visual assessment provider.", limitations: [LIM_VISUAL] }),
  c({ id: "scleralShow", area: "eye", name: "Scleral show", definition: "Visible sclera below the iris with a relaxed gaze.", method: "visual", view: "frontal", inputs: {}, requirements: "Visual assessment provider.", limitations: [LIM_VISUAL] }),
  c({ id: "eyeShape", area: "eye", name: "Eye shape", definition: "Overall fissure shape (almond, round, hooded …) as a visual impression.", method: "visual", view: "frontal", inputs: {}, requirements: "Visual assessment provider.", limitations: [LIM_VISUAL] }),
  // F — facial proportions
  c({ id: "midfaceRatio", area: "proportions", name: "Midface ratio", definition: "Midface height relative to the inter-pupillary distance.", method: "geometric", view: "frontal", inputs: { ratios: ["MF"] }, requirements: "Frontal photo, pitch ≤ 15°.", limitations: [LIM_T1, "Residual pitch shortens/lengthens the midface."] }),
  c({ id: "facialThirds", area: "proportions", name: "Middle & lower third", definition: "Middle and lower third of the face height against their reference ranges (the upper third belongs to the forehead category).", method: "geometric", view: "frontal", inputs: { ratios: ["FT_M", "FT_L"] }, requirements: "Hairline visible/confirmed.", limitations: [LIM_T1, "Depends on the estimated or confirmed hairline.", "Equal-thirds canons rarely hold in real faces (Jayaratne et al. 2012)."] }),
  c({ id: "faceShape", area: "proportions", name: "Face shape proportions", definition: "Total height-to-width, lower-face share and the agreement of forehead and jaw widths.", method: "geometric", view: "frontal", inputs: { ratios: ["TFWHR", "LFF", "DEV_BIT_BIG"] }, requirements: "Hairline visible/confirmed.", limitations: [LIM_T1, "Depends on the hairline and the soft-tissue face contour."] }),
  c({ id: "eyeMouthGeometry", area: "proportions", name: "Eye–mouth geometry", definition: "Angle of the eye–mouth–eye triangle.", method: "geometric", view: "frontal", inputs: { ratios: ["EME"] }, requirements: "Neutral mouth.", limitations: [LIM_T1, "The stomion moves with expression."] }),
  c({ id: "eyeMouthLength", area: "proportions", name: "Eye–mouth length ratio", definition: "Vertical distance pupil line → mouth over hairline → chin (Pallett et al. 2010: preferred .36–.37).", method: "geometric", view: "frontal", inputs: { additional: ["EML"] }, requirements: "Hairline visible/confirmed, neutral mouth.", limitations: ["Preference data from white female faces only (Pallett et al. 2010); the optimum may differ for other groups.", "Depends on the hairline."] }),
  c({ id: "lowerThirdProportions", area: "proportions", name: "Lower third proportions", definition: "Share of the upper lip in the lower third (subnasale → stomion over subnasale → menton).", method: "geometric", view: "frontal", inputs: { ratios: ["L3P"] }, requirements: "Lips closed.", limitations: [LIM_T1] }),
  c({ id: "facialFifths", area: "proportions", name: "Facial fifths", definition: "Deviation of the five horizontal fifths from equal width (neoclassical canon).", method: "geometric", view: "frontal", inputs: { additional: ["FIFTHS"] }, requirements: "Frontal photo, yaw ≤ 15°.", limitations: ["Equal fifths are a historical canon that most faces do not meet (Farkas; Jayaratne et al. 2012); scored with a 3 pp dispersion unit."] }),
  c({ id: "profileConvexity", area: "proportions", name: "Profile convexity", definition: "Facial convexity angle G–Sn–Pg.", method: "profile", view: "profile", inputs: { side: ["FCA"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE] }),
  c({ id: "lowerFaceHarmony", area: "proportions", name: "Lower-face height (profile)", definition: "Lower face height share (Sn–Me / G–Me) in the anatomical reference frame.", method: "profile", view: "profile", inputs: { side: ["LFH"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE] }),
  // B — bone structure
  c({ id: "jawWidth", area: "bone", name: "Jaw width", definition: "Bigonial width relative to the bizygomatic width.", method: "geometric", view: "frontal", inputs: { ratios: ["BIG"] }, requirements: "Jawline visible (no beard/hair over the angles).", limitations: [LIM_T1, LIM_JAW] }),
  c({ id: "jawAngularityFrontal", area: "bone", name: "Jaw angularity (frontal)", definition: "Frontal projection of the jaw angle (gonial slope).", method: "geometric", view: "frontal", inputs: { ratios: ["GS"] }, requirements: "Frontal photo.", limitations: [LIM_T1, LIM_JAW, "Frontal projection only; not the true gonial angle."] }),
  c({ id: "chinWidthShape", area: "bone", name: "Chin width", definition: "Mouth width relative to the chin width.", method: "geometric", view: "frontal", inputs: { ratios: ["M_C"] }, requirements: "Frontal photo.", limitations: [LIM_T1, "Reconstructed chin corners."] }),
  c({ id: "cheekbonePosition", area: "bone", name: "Cheekbone position", definition: "Height of the widest facial point relative to the midface.", method: "geometric", view: "frontal", inputs: { ratios: ["CBS"] }, requirements: "Frontal photo.", limitations: [LIM_T1, "Soft-tissue contour stands in for the zygomatic arch (2D bizygomatic ICC .66, Lim et al. 2022)."] }),
  c({ id: "gonialAngle", area: "bone", name: "Gonial angle (profile)", definition: "Soft-tissue gonial angle between ramus and mandibular body.", method: "profile", view: "profile", inputs: { side: ["GA"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE, "Soft-tissue proxy with the tragion as ramus reference."] }),
  c({ id: "chinProjection", area: "bone", name: "Chin projection (profile)", definition: "Chin position relative to the lips and the facial line (Z angle, H angle).", method: "profile", view: "profile", inputs: { side: ["ZANG", "HANG"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE, "Z angle against the anatomical reference axis (Frankfort horizontal when the orbitale is placed)."] }),
  c({ id: "neckChinDefinition", area: "bone", name: "Neck–chin definition", definition: "Cervicomental and mentocervical angles; neck width frontally when neck points are placed.", method: "profile", view: "any", inputs: { side: ["CMA", "MCA"], ratios: ["NW"] }, requirements: "Side-view analysis or manual neck points.", limitations: [LIM_PROFILE, "Submental fat and head flexion change the angles."] }),
  c({ id: "cheekboneProjection", area: "bone", name: "Cheekbone projection", definition: "Visible zygomatic prominence (3D projection).", method: "visual", view: "any", inputs: {}, requirements: "Visual assessment provider.", limitations: [LIM_VISUAL, "Lighting and body fat dominate the impression."] }),
  c({ id: "jawlineDefinition", area: "bone", name: "Jawline definition", definition: "Visible sharpness of the mandibular border.", method: "visual", view: "any", inputs: {}, requirements: "Visual assessment provider.", limitations: [LIM_VISUAL] }),
  // D — nose
  c({ id: "noseWidth", area: "nose", name: "Nose width", definition: "Alar width relative to the bizygomatic width (the intercanthal comparison is shown but not scored).", method: "geometric", view: "frontal", inputs: { ratios: ["N_BYZGO"] }, requirements: "Frontal photo, standard distance.", limitations: [LIM_T1, "Close camera distance widens the nose (≈ +30 % at 30 cm, Ward et al. 2018)."] }),
  c({ id: "noseHeightWidth", area: "nose", name: "Nose height-to-width", definition: "Nasal height over alar width.", method: "geometric", view: "frontal", inputs: { ratios: ["N_H"] }, requirements: "Frontal photo.", limitations: [LIM_T1] }),
  c({ id: "noseProjection", area: "nose", name: "Nose projection (profile)", definition: "Goode ratio of tip projection to nasal length.", method: "profile", view: "profile", inputs: { side: ["GOODE"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE] }),
  c({ id: "nasalAngles", area: "nose", name: "Nasal angles (profile)", definition: "Nasofrontal, nasofacial and nasomental angles.", method: "profile", view: "profile", inputs: { side: ["NFA", "NFC", "NMA"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE] }),
  // E — lips & mouth
  c({ id: "mouthWidth", area: "mouth", name: "Mouth width", definition: "Mouth width relative to IPD, nose and jaw.", method: "geometric", view: "frontal", inputs: { ratios: ["M_IPD", "M_N", "M_BIG"] }, requirements: "Neutral mouth.", limitations: [LIM_T1, "Smiling widens the mouth."] }),
  c({ id: "lipProportions", area: "mouth", name: "Lip proportions", definition: "Lower-to-upper lip height and lip width-to-height.", method: "geometric", view: "frontal", inputs: { ratios: ["LL_UL", "LIP_WHR"] }, requirements: "Lips closed, relaxed.", limitations: [LIM_T1] }),
  c({ id: "lipChinVertical", area: "mouth", name: "Lip–chin height", definition: "Lower lip and chin height relative to the philtrum: frontal chin-to-philtrum ratio and profile Stm–Me : Sn–Stm (one construct, both views).", method: "geometric", view: "any", inputs: { ratios: ["C_P"], side: ["LCR"] }, requirements: "Frontal photo (and optionally a side view), lips closed.", limitations: [LIM_T1, "Profile part needs a side-view analysis."] }),
  c({ id: "nasolabialAngle", area: "mouth", name: "Nasolabial angle (profile)", definition: "Angle between the columella and the upper lip.", method: "profile", view: "profile", inputs: { side: ["NLA"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE] }),
  c({ id: "lipShape", area: "mouth", name: "Lip shape", definition: "Vermilion shape and fullness as a visual impression.", method: "visual", view: "frontal", inputs: {}, requirements: "Visual assessment provider.", limitations: [LIM_VISUAL] }),
  // A — symmetry
  c({ id: "eyeSymmetry", area: "symmetry", name: "Eye & brow symmetry", definition: "Left–right agreement of eye opening, fissure length, canthal tilt, canthus height, brow height and tilt.", method: "symmetry", view: "frontal", inputs: { symmetry: ["eyeHeight", "pfl", "canthalTilt", "canthusHeight", "browHeight", "browTilt"] }, requirements: "Frontal photo, yaw ≤ 10°.", limitations: ["Residual yaw inflates apparent asymmetry; asymmetry is measured after 3D pose normalisation when depth is available."] }),
  c({ id: "noseSymmetry", area: "symmetry", name: "Nose symmetry", definition: "Nose tip and alar base relative to the midline.", method: "symmetry", view: "frontal", inputs: { symmetry: ["noseTip", "alar"] }, requirements: "Frontal photo.", limitations: ["The nose tip shifts ≈ 21·sin(yaw) mm with residual yaw."] }),
  c({ id: "mouthSymmetry", area: "symmetry", name: "Mouth symmetry", definition: "Mouth corner heights and distances from the midline.", method: "symmetry", view: "frontal", inputs: { symmetry: ["mouthCornerHeight", "mouthCornerWidth"] }, requirements: "Neutral mouth.", limitations: ["Expression changes mouth symmetry."] }),
  c({ id: "jawChinSymmetry", area: "symmetry", name: "Jaw & chin symmetry", definition: "Gonion width/height agreement, cheek width agreement and chin deviation.", method: "symmetry", view: "frontal", inputs: { symmetry: ["gonionWidth", "gonionHeight", "zygion", "chin"] }, requirements: "Frontal photo.", limitations: ["Constructed gonions and soft-tissue zygions.", LIM_JAW] }),
  // G — forehead & hairline
  c({ id: "foreheadHeight", area: "forehead", name: "Forehead height", definition: "Upper third of the face height and forehead height relative to the face width.", method: "geometric", view: "frontal", inputs: { ratios: ["FT_U", "FWHF"] }, requirements: "Hairline visible/confirmed.", limitations: [LIM_T1, "The hairline is estimated from colour change or placed manually; automatic hairline landmarks carry large errors."] }),
  c({ id: "foreheadWidth", area: "forehead", name: "Forehead width", definition: "Bitemporal width relative to the bizygomatic width.", method: "geometric", view: "frontal", inputs: { ratios: ["BIT"] }, requirements: "Temples visible (no hair over the temples).", limitations: [LIM_T1, "Temple contour points are soft-tissue stand-ins."] }),
];

/** Rubric 1.0 criteria that no longer exist (rendering of stored ratings only). */
export const LEGACY_CRITERIA: CriterionDefinition[] = [
  { id: "fwhr", area: "midface", name: "Facial width-to-height", definition: "Bizygomatic width over brow-to-upper-lip height (rubric 1.0; shown but not scored since 2.0).", method: "geometric", view: "frontal", weight: 3, inputs: { ratios: ["FWHR"] }, requirements: "Frontal photo.", limitations: [], legacy: true },
  { id: "jawHeightRatio", area: "bone", name: "Jaw width-to-height", definition: "Bigonial width over the lower-face height (rubric 1.0; removed in 2.0 because the reconstructed construction does not reproduce the reference range).", method: "geometric", view: "frontal", weight: 2, inputs: { ratios: ["JWHR"] }, requirements: "—", limitations: [], legacy: true },
  { id: "areaBalance", area: "harmony", name: "Balance across areas", definition: "Spread of the area scores (rubric 1.0; removed because it rewarded uniformly weak faces).", method: "derived", view: "any", weight: 7, inputs: { derived: "areaBalance" }, requirements: "—", limitations: [], legacy: true },
  { id: "verticalBalance", area: "harmony", name: "Vertical balance", definition: "Equality of the three thirds (rubric 1.0; removed because it scored the thirds twice).", method: "derived", view: "frontal", weight: 3, inputs: { derived: "verticalBalance" }, requirements: "—", limitations: [], legacy: true },
];

export const CRITERION_BY_ID = Object.fromEntries([...LEGACY_CRITERIA, ...CRITERIA].map((x) => [x.id, x])) as Record<CriterionId, CriterionDefinition>;

/** Measures that are reported but deliberately not scored (with the reason). */
export const DESCRIPTIVE_RATIOS: { id: RatioId; reason: string }[] = (["FWHR", "JWHR", "ET", "DEV_CT_ET", "ICD_N"] as RatioId[]).map((id) => ({ id, reason: evidenceOf(id).note }));

/**
 * Calibration (overall index 0–100 → PSL 0–10): linear, PSL = index / 10.
 *
 * Rubric 1.0 placed its anchors so that the project's own portraits landed near
 * the centre (circular, docs/SYSTEM_AUDIT.md D11). A population anchor ("an
 * average face = 5.5") needs either human ratings or population data of every
 * measure; neither exists here. The model simulation in psl/calibration.ts (every
 * measure centred in its reference range) predicted a median index of ≈ 85, but
 * all six real and AI test faces scored 54–79, so that assumption is rejected
 * (docs/MODEL_VALIDATION.md). The linear map is therefore used: equal index
 * differences are equal PSL differences everywhere (no compressed region), 10 means
 * every scored measure inside its reference range, and the value is a geometric
 * conformity score — not a population percentile or an attractiveness rank.
 */
export const CALIBRATION_ANCHORS: [number, number][] = [
  [0, 0],
  [100, 10],
];

/** Minimum share of the geometric rubric (category-weighted) that must be assessable for a fully valid score. */
export const DEFAULT_MIN_COVERAGE = 0.7;

/** Dispersion units of derived measures. */
export const DERIVED_TOLERANCE = { fifthsPp: 3, eyeMouthLength: EYE_MOUTH_LENGTH.s } as const;

export function calibrate(index: number): number {
  const a = CALIBRATION_ANCHORS;
  if (index <= a[0][0]) return a[0][1];
  for (let i = 1; i < a.length; i++) {
    const [x0, y0] = a[i - 1];
    const [x1, y1] = a[i];
    if (index <= x1) return y0 + ((index - x0) / (x1 - x0)) * (y1 - y0);
  }
  return a[a.length - 1][1];
}

/** Local slope of the calibration curve (PSL per index point). */
export function calibrationSlope(index: number): number {
  const a = CALIBRATION_ANCHORS;
  for (let i = 1; i < a.length; i++) if (index <= a[i][0]) return (a[i][1] - a[i - 1][1]) / (a[i][0] - a[i - 1][0]);
  return (a[a.length - 1][1] - a[a.length - 2][1]) / (a[a.length - 1][0] - a[a.length - 2][0]);
}

/** Inverse of calibrate (PSL 0–10 → index 0–100), used for visual-model scores. */
export function uncalibrate(psl: number): number {
  const a = CALIBRATION_ANCHORS;
  if (psl <= a[0][1]) return a[0][0];
  for (let i = 1; i < a.length; i++) {
    const [x0, y0] = a[i - 1];
    const [x1, y1] = a[i];
    if (psl <= y1) return x0 + ((psl - y0) / (y1 - y0)) * (x1 - x0);
  }
  return a[a.length - 1][0];
}

/** Sum of the active category weights (100). */
export function totalWeight(): number {
  return RUBRIC_AREAS.reduce((s, a) => s + (CATEGORY_WEIGHTS[a] ?? 0), 0);
}

/** Reliability of a frontal ratio from its landmarks (weakest landmark). */
export function measureReliability(landmarks: SemanticLandmarkId[]): number {
  let r = 1;
  for (const id of landmarks) r = Math.min(r, LANDMARK_RELIABILITY[id] ?? 1);
  return r;
}
