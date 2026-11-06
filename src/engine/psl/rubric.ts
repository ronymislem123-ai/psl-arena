/**
 * Versioned PSL rating rubric.
 *
 * Every criterion names the engine quantities it is built from (frontal ratio
 * indices, symmetry metrics, side-view measurement indices, derived balance
 * measures) or is marked `visual` (only assessable by an external visual
 * assessment provider — never guessed). Each engine quantity is used by exactly
 * one criterion, so no feature is counted twice (checked by a unit test).
 * Weights sum to 100 and are documented in docs/RUBRIC.md together with the
 * calibration curve that maps 0–100 harmony indices to the 0–10 PSL scale.
 */
import type { AdditionalMeasurementId, RatioId } from "../types";
import type { SideMeasurementId } from "../side-view";

export const RUBRIC_VERSION = "1.0.0";

export type RubricArea = "eye" | "midface" | "bone" | "nose" | "mouth" | "symmetry" | "harmony";
export const RUBRIC_AREAS: RubricArea[] = ["eye", "midface", "bone", "nose", "mouth", "symmetry", "harmony"];

export type CriterionMethod = "geometric" | "symmetry" | "profile" | "derived" | "visual";
export type CriterionView = "frontal" | "profile" | "any";
export type DerivedKind = "areaBalance" | "verticalBalance";

export type CriterionId =
  | "canthalTilt" | "eyeSpacing" | "fissureProportions" | "browArea" | "upperLidExposure" | "scleralShow" | "eyeShape"
  | "midfaceRatio" | "facialThirds" | "fwhr" | "faceShape" | "cheekbonePosition" | "eyeMouthGeometry" | "lowerThirdProportions" | "facialFifths"
  | "jawWidth" | "jawHeightRatio" | "jawAngularityFrontal" | "gonialAngle" | "chinProjection" | "neckChinDefinition" | "chinWidthShape" | "cheekboneProjection" | "jawlineDefinition"
  | "noseWidth" | "noseHeightWidth" | "noseProjection" | "nasalAngles"
  | "mouthWidth" | "lipProportions" | "nasolabialAngle" | "lipChinVertical" | "lipShape"
  | "eyeSymmetry" | "noseSymmetry" | "mouthSymmetry" | "jawChinSymmetry"
  | "areaBalance" | "verticalBalance" | "profileConvexity" | "lowerFaceHarmony";

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
  /** rubric weight (all criteria sum to 100) */
  weight: number;
  inputs: CriterionInputs;
  /** what the photo/data must provide */
  requirements: string;
  limitations: string[];
}

export const AREA_META: Record<RubricArea, { name: string; description: string }> = {
  eye: { name: "Eye area", description: "Canthal tilt, spacing, fissure proportions, brows; lid exposure and scleral show only with a visual assessment." },
  midface: { name: "Midface & proportions", description: "Midface ratio, thirds, FWHR, face shape, cheekbone position, eye–mouth geometry, lower third, fifths." },
  bone: { name: "Bone structure", description: "Jaw widths and angles, gonial angle and chin projection (profile), neck definition, chin; visual definition only with a visual assessment." },
  nose: { name: "Nose", description: "Width and height frontally, projection and angles from the profile." },
  mouth: { name: "Lips & mouth", description: "Mouth width, lip proportions, nasolabial angle and lip–chin height from the profile." },
  symmetry: { name: "Symmetry", description: "Left–right agreement of eyes/brows, nose, mouth and jaw/chin in the roll-normalised frame." },
  harmony: { name: "Facial harmony", description: "Balance across areas, vertical balance of the thirds, profile convexity and lower-face harmony." },
};

const LIM_T1 = "Scored against the T1 reference ranges of the frontal ratio database (docs/RATIOS.md).";
const LIM_PROFILE = "Needs a side-view analysis with manually placed landmarks (docs/SIDE_VIEW.md).";
const LIM_VISUAL = "Not inferable from 2D landmarks; assessed only when a visual assessment provider is configured, otherwise reported as not assessable.";

export const CRITERIA: CriterionDefinition[] = [
  // A — eye area (18)
  { id: "canthalTilt", area: "eye", name: "Canthal tilt", definition: "Inclination of the intercanthal axis (lateral canthus relative to the medial canthus).", method: "geometric", view: "frontal", weight: 4, inputs: { ratios: ["CT"] }, requirements: "Frontal photo, eyes open, yaw ≤ 15°.", limitations: [LIM_T1, "Yaw and squinting change the measured tilt."] },
  { id: "eyeSpacing", area: "eye", name: "Eye spacing", definition: "Inter-pupillary, outer-canthal and intercanthal distances relative to the face and the fissure.", method: "geometric", view: "frontal", weight: 4, inputs: { ratios: ["ESR", "OCD", "ICD"] }, requirements: "Frontal photo with visible canthi.", limitations: [LIM_T1, "Bizygomatic width uses a soft-tissue stand-in."] },
  { id: "fissureProportions", area: "eye", name: "Fissure proportions", definition: "Eye aspect ratio and fissure length relative to the face width.", method: "geometric", view: "frontal", weight: 3, inputs: { ratios: ["EAR", "PFL_BYZGO"] }, requirements: "Neutral expression, eyes open.", limitations: [LIM_T1, "Eye opening changes with expression and fatigue."] },
  { id: "browArea", area: "eye", name: "Brow position & shape", definition: "Brow tilt, its agreement with the canthal tilt and brow length.", method: "geometric", view: "frontal", weight: 3, inputs: { ratios: ["ET", "DEV_CT_ET", "EBL"] }, requirements: "Brows visible (no fringe).", limitations: [LIM_T1, "Grooming changes brow ends."] },
  { id: "upperLidExposure", area: "eye", name: "Upper lid exposure", definition: "Visible upper eyelid (lid show) between lash line and brow.", method: "visual", view: "frontal", weight: 2, inputs: {}, requirements: "Visual assessment provider.", limitations: [LIM_VISUAL] },
  { id: "scleralShow", area: "eye", name: "Scleral show", definition: "Visible sclera below the iris with a relaxed gaze.", method: "visual", view: "frontal", weight: 1, inputs: {}, requirements: "Visual assessment provider.", limitations: [LIM_VISUAL] },
  { id: "eyeShape", area: "eye", name: "Eye shape", definition: "Overall fissure shape (almond, round, hooded …) as a visual impression.", method: "visual", view: "frontal", weight: 1, inputs: {}, requirements: "Visual assessment provider.", limitations: [LIM_VISUAL, "The geometric aspect ratio is already scored under fissure proportions."] },
  // B — midface & proportions (17)
  { id: "midfaceRatio", area: "midface", name: "Midface ratio", definition: "Midface height relative to the inter-pupillary distance.", method: "geometric", view: "frontal", weight: 3, inputs: { ratios: ["MF"] }, requirements: "Frontal photo, pitch ≤ 15°.", limitations: [LIM_T1, "Pitch shortens/lengthens the midface."] },
  { id: "facialThirds", area: "midface", name: "Facial thirds", definition: "Upper, middle and lower third of the face against their reference ranges.", method: "geometric", view: "frontal", weight: 3, inputs: { ratios: ["FT_U", "FT_M", "FT_L"] }, requirements: "Hairline visible/confirmed.", limitations: [LIM_T1, "Depends on the estimated or confirmed hairline."] },
  { id: "fwhr", area: "midface", name: "Facial width-to-height", definition: "Bizygomatic width over brow-to-upper-lip height.", method: "geometric", view: "frontal", weight: 3, inputs: { ratios: ["FWHR"] }, requirements: "Frontal photo.", limitations: [LIM_T1, "Soft-tissue zygion; perspective distortion at short distances."] },
  { id: "faceShape", area: "midface", name: "Face shape proportions", definition: "Total height-to-width, lower-face share and forehead proportion.", method: "geometric", view: "frontal", weight: 2, inputs: { ratios: ["TFWHR", "LFF", "FWHF"] }, requirements: "Hairline visible/confirmed.", limitations: [LIM_T1, "Depends on the hairline."] },
  { id: "cheekbonePosition", area: "midface", name: "Cheekbone position", definition: "Height of the widest facial point relative to the midface.", method: "geometric", view: "frontal", weight: 2, inputs: { ratios: ["CBS"] }, requirements: "Frontal photo.", limitations: [LIM_T1, "Soft-tissue contour stands in for the zygomatic arch."] },
  { id: "eyeMouthGeometry", area: "midface", name: "Eye–mouth geometry", definition: "Angle of the eye–mouth–eye triangle.", method: "geometric", view: "frontal", weight: 2, inputs: { ratios: ["EME"] }, requirements: "Neutral mouth.", limitations: [LIM_T1, "The stomion moves with expression."] },
  { id: "lowerThirdProportions", area: "midface", name: "Lower third proportions", definition: "Lower third share and chin-to-philtrum ratio.", method: "geometric", view: "frontal", weight: 1, inputs: { ratios: ["L3P", "C_P"] }, requirements: "Lips closed.", limitations: [LIM_T1] },
  { id: "facialFifths", area: "midface", name: "Facial fifths", definition: "Deviation of the five horizontal fifths from equal width (neoclassical canon).", method: "geometric", view: "frontal", weight: 1, inputs: { additional: ["FIFTHS"] }, requirements: "Frontal photo, yaw ≤ 15°.", limitations: ["Equal fifths are a historical canon that most faces do not meet exactly (Farkas); scored with the app tolerance rule (3 pp)."] },
  // C — bone structure (22)
  { id: "jawWidth", area: "bone", name: "Jaw width", definition: "Bigonial and bitemporal widths relative to the bizygomatic width and their agreement.", method: "geometric", view: "frontal", weight: 5, inputs: { ratios: ["BIG", "DEV_BIT_BIG", "BIT"] }, requirements: "Jawline visible (no beard/hair over the angles).", limitations: [LIM_T1, "Gonions are constructed from the soft-tissue silhouette."] },
  { id: "jawHeightRatio", area: "bone", name: "Jaw width-to-height", definition: "Bigonial width over the lower-face height.", method: "geometric", view: "frontal", weight: 2, inputs: { ratios: ["JWHR"] }, requirements: "Frontal photo.", limitations: [LIM_T1, "Reconstructed convention (docs/RATIOS.md)."] },
  { id: "jawAngularityFrontal", area: "bone", name: "Jaw angularity (frontal)", definition: "Frontal projection of the jaw angle (gonial slope).", method: "geometric", view: "frontal", weight: 2, inputs: { ratios: ["GS"] }, requirements: "Frontal photo.", limitations: [LIM_T1, "Frontal projection only; not the true gonial angle."] },
  { id: "gonialAngle", area: "bone", name: "Gonial angle (profile)", definition: "Soft-tissue gonial angle between ramus and mandibular body.", method: "profile", view: "profile", weight: 3, inputs: { side: ["GA"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE, "Soft-tissue proxy with the tragion as ramus reference."] },
  { id: "chinProjection", area: "bone", name: "Chin projection (profile)", definition: "Chin position relative to the lips and the facial line (Z angle, H angle).", method: "profile", view: "profile", weight: 3, inputs: { side: ["ZANG", "HANG"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE, "Uses the image vertical as the true vertical."] },
  { id: "neckChinDefinition", area: "bone", name: "Neck–chin definition", definition: "Cervicomental and mentocervical angles; neck width frontally when neck points are placed.", method: "profile", view: "any", weight: 2, inputs: { side: ["CMA", "MCA"], ratios: ["NW"] }, requirements: "Side-view analysis or manual neck points.", limitations: [LIM_PROFILE, "Submental fat and head flexion change the angles."] },
  { id: "chinWidthShape", area: "bone", name: "Chin width", definition: "Mouth width relative to the chin width.", method: "geometric", view: "frontal", weight: 2, inputs: { ratios: ["M_C"] }, requirements: "Frontal photo.", limitations: [LIM_T1, "Reconstructed chin corners."] },
  { id: "cheekboneProjection", area: "bone", name: "Cheekbone projection", definition: "Visible zygomatic prominence (3D projection).", method: "visual", view: "any", weight: 2, inputs: {}, requirements: "Visual assessment provider.", limitations: [LIM_VISUAL, "Lighting and body fat dominate the impression."] },
  { id: "jawlineDefinition", area: "bone", name: "Jawline definition", definition: "Visible sharpness of the mandibular border.", method: "visual", view: "any", weight: 1, inputs: {}, requirements: "Visual assessment provider.", limitations: [LIM_VISUAL] },
  // D — nose (9)
  { id: "noseWidth", area: "nose", name: "Nose width", definition: "Alar width relative to the face and the intercanthal distance.", method: "geometric", view: "frontal", weight: 3, inputs: { ratios: ["N_BYZGO", "ICD_N"] }, requirements: "Frontal photo, standard distance.", limitations: [LIM_T1, "Selfie distance widens the nose."] },
  { id: "noseHeightWidth", area: "nose", name: "Nose height-to-width", definition: "Nasal height over alar width.", method: "geometric", view: "frontal", weight: 2, inputs: { ratios: ["N_H"] }, requirements: "Frontal photo.", limitations: [LIM_T1] },
  { id: "noseProjection", area: "nose", name: "Nose projection (profile)", definition: "Goode ratio of tip projection to nasal length.", method: "profile", view: "profile", weight: 2, inputs: { side: ["GOODE"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE] },
  { id: "nasalAngles", area: "nose", name: "Nasal angles (profile)", definition: "Nasofrontal, nasofacial and nasomental angles.", method: "profile", view: "profile", weight: 2, inputs: { side: ["NFA", "NFC", "NMA"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE] },
  // E — lips & mouth (8)
  { id: "mouthWidth", area: "mouth", name: "Mouth width", definition: "Mouth width relative to IPD, nose and jaw.", method: "geometric", view: "frontal", weight: 3, inputs: { ratios: ["M_IPD", "M_N", "M_BIG"] }, requirements: "Neutral mouth.", limitations: [LIM_T1, "Smiling widens the mouth."] },
  { id: "lipProportions", area: "mouth", name: "Lip proportions", definition: "Lower-to-upper lip height and lip width-to-height.", method: "geometric", view: "frontal", weight: 2, inputs: { ratios: ["LL_UL", "LIP_WHR"] }, requirements: "Lips closed, relaxed.", limitations: [LIM_T1] },
  { id: "nasolabialAngle", area: "mouth", name: "Nasolabial angle (profile)", definition: "Angle between the columella and the upper lip.", method: "profile", view: "profile", weight: 1, inputs: { side: ["NLA"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE] },
  { id: "lipChinVertical", area: "mouth", name: "Lip–chin height (profile)", definition: "Vertical lip–chin ratio (Sn–Stm : Stm–Me).", method: "profile", view: "profile", weight: 1, inputs: { side: ["LCR"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE] },
  { id: "lipShape", area: "mouth", name: "Lip shape", definition: "Vermilion shape and fullness as a visual impression.", method: "visual", view: "frontal", weight: 1, inputs: {}, requirements: "Visual assessment provider.", limitations: [LIM_VISUAL] },
  // F — symmetry (10)
  { id: "eyeSymmetry", area: "symmetry", name: "Eye & brow symmetry", definition: "Left–right agreement of eye opening, fissure length, canthal tilt, canthus height, brow height and tilt.", method: "symmetry", view: "frontal", weight: 3, inputs: { symmetry: ["eyeHeight", "pfl", "canthalTilt", "canthusHeight", "browHeight", "browTilt"] }, requirements: "Frontal photo, yaw ≤ 10°.", limitations: ["Yaw inflates apparent asymmetry."] },
  { id: "noseSymmetry", area: "symmetry", name: "Nose symmetry", definition: "Nose tip and alar base relative to the midline.", method: "symmetry", view: "frontal", weight: 2, inputs: { symmetry: ["noseTip", "alar"] }, requirements: "Frontal photo.", limitations: ["Yaw inflates apparent asymmetry."] },
  { id: "mouthSymmetry", area: "symmetry", name: "Mouth symmetry", definition: "Mouth corner heights and distances from the midline.", method: "symmetry", view: "frontal", weight: 2, inputs: { symmetry: ["mouthCornerHeight", "mouthCornerWidth"] }, requirements: "Neutral mouth.", limitations: ["Expression changes mouth symmetry."] },
  { id: "jawChinSymmetry", area: "symmetry", name: "Jaw & chin symmetry", definition: "Gonion width/height agreement, cheek width agreement and chin deviation.", method: "symmetry", view: "frontal", weight: 3, inputs: { symmetry: ["gonionWidth", "gonionHeight", "zygion", "chin"] }, requirements: "Frontal photo.", limitations: ["Constructed gonions and soft-tissue zygions."] },
  // G — harmony (16)
  { id: "areaBalance", area: "harmony", name: "Balance across areas", definition: "How evenly the eye, midface, bone, nose, mouth and symmetry areas score (low spread = harmonious).", method: "derived", view: "any", weight: 7, inputs: { derived: "areaBalance" }, requirements: "At least three assessable areas.", limitations: ["Meta-measure over the area scores; it rewards consistency, not level."] },
  { id: "verticalBalance", area: "harmony", name: "Vertical balance", definition: "Equality of the three facial thirds (largest deviation from one third).", method: "derived", view: "frontal", weight: 3, inputs: { derived: "verticalBalance", ratios: [] }, requirements: "Hairline visible/confirmed.", limitations: ["Uses the same landmarks as the thirds criterion but measures equality rather than each third's reference range."] },
  { id: "profileConvexity", area: "harmony", name: "Profile convexity", definition: "Facial convexity angle G–Sn–Pg.", method: "profile", view: "profile", weight: 3, inputs: { side: ["FCA"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE] },
  { id: "lowerFaceHarmony", area: "harmony", name: "Lower-face harmony (profile)", definition: "Lower face height share (Sn–Me / G–Me).", method: "profile", view: "profile", weight: 3, inputs: { side: ["LFH"] }, requirements: "Side-view analysis.", limitations: [LIM_PROFILE] },
];

export const CRITERION_BY_ID = Object.fromEntries(CRITERIA.map((c) => [c.id, c])) as Record<CriterionId, CriterionDefinition>;

/**
 * Calibration anchors (index 0–100 → PSL 0–10), linear between anchors.
 * A rubric convention: chosen so that the project's real-portrait fixtures land
 * near the centre of the scale and only a geometrically flawless face approaches
 * the top. Not empirically validated (docs/RUBRIC.md, docs/VALIDATION.md).
 */
export const CALIBRATION_ANCHORS: [number, number][] = [
  [0, 0.5],
  [30, 2.5],
  [50, 4.0],
  [65, 5.0],
  [80, 6.3],
  [90, 7.5],
  [100, 9.0],
];

/** Minimum share of the rubric weight that must be assessable for a fully valid score. */
export const DEFAULT_MIN_COVERAGE = 0.7;

/** Tolerances of the derived measures (app rule: index halves per tolerance unit). */
export const DERIVED_TOLERANCE = { areaBalanceIndexSd: 20, verticalBalancePp: 3.33, fifthsPp: 3 } as const;

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

/** Local slope of the calibration curve (PSL per index point) for σ propagation. */
export function calibrationSlope(index: number): number {
  const a = CALIBRATION_ANCHORS;
  for (let i = 1; i < a.length; i++) if (index <= a[i][0]) return (a[i][1] - a[i - 1][1]) / (a[i][0] - a[i - 1][0]);
  return (a[a.length - 1][1] - a[a.length - 2][1]) / (a[a.length - 1][0] - a[a.length - 2][0]);
}

export function totalWeight(): number {
  return CRITERIA.reduce((s, c) => s + c.weight, 0);
}
