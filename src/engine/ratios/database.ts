/**
 * Reference database: the 42 core facial-harmony ratios + 7 additional measurements.
 *
 * Source: community "Ultimate Facial Harmony" guide as provided to this project.
 * The T1 ranges are the guide's reference values and are NOT scientifically
 * validated beauty standards. Only T1 ranges were provided; outer tier
 * boundaries (T2–T5) are therefore `null` everywhere and are never invented.
 */
import type { AdditionalMeasurementDefinition, CategoryId, RatioDefinition, RatioId, T1Range } from "../types";
import { dispersionOf } from "../scoring/measurement";

const SOURCE = "Ultimate Facial Harmony guide (community reference, as provided)";

/** Engine 1.x tolerance rule (kept for reference and for results stored by engine 1.x) — see docs/SCORING.md. */
export function toleranceFor(t1: T1Range): number {
  if (t1.min !== null && t1.max !== null) {
    const target = (t1.min + t1.max) / 2;
    return Math.max(0.1 * Math.abs(target), 0.5 * (t1.max - t1.min));
  }
  const bound = (t1.min ?? t1.max) as number;
  return Math.max(0.1 * Math.abs(bound), 1e-6);
}

export function targetFor(t1: T1Range): number | null {
  if (t1.min !== null && t1.max !== null) return (t1.min + t1.max) / 2;
  return t1.min ?? t1.max;
}

type Draft = Omit<RatioDefinition, "tolerance" | "target" | "tierBoundaries" | "source" | "weight" | "dependencies" | "sensitivity"> & {
  weight?: number;
  dependencies?: RatioId[];
  sensitivity?: Partial<RatioDefinition["sensitivity"]>;
};

const NO_SENS: RatioDefinition["sensitivity"] = { yaw: false, expression: [], depth: false, hairline: false };

function def(d: Draft): RatioDefinition {
  return {
    ...d,
    target: targetFor(d.t1),
    // engine 2.0: the dispersion unit s (natural between-person spread) replaces the 10 %-of-target tolerance
    tolerance: dispersionOf(d.id, d.t1).s,
    tierBoundaries: null,
    source: SOURCE,
    weight: d.weight ?? 1,
    dependencies: d.dependencies ?? [],
    sensitivity: { ...NO_SENS, ...(d.sensitivity ?? {}) },
  };
}

const LIM_2D = "2D frontal photograph: no depth/bony information, soft-tissue landmarks only.";
const LIM_ZYG = "Zygion is approximated by the widest point of the soft-tissue face contour (low precision).";
const LIM_GON = "Gonion is constructed from the smooth mesh contour; frontal jaw angles are approximate.";
const LIM_HAIR = "Depends on the hairline (trichion), which is estimated from the image and can be adjusted manually.";
const LIM_EXPR = "Sensitive to facial expression (smile/open mouth change the measurement).";
const LIM_YAW = "Horizontal widths are foreshortened when the head is turned (yaw).";

export const RATIO_DEFINITIONS: RatioDefinition[] = [
  def({
    id: "ESR", number: 1, name: "Eye Spacing Ratio", abbreviation: "ESR", category: "eyeArea", unit: "percent",
    formula: "IPD / bizygomatic width × 100",
    landmarks: ["pupil_R", "pupil_L", "zygion_R", "zygion_L"],
    t1: { min: 45.0, max: 47.9 }, status: "defined",
    methodology: "Distance between the pupil centres divided by the distance between the zygion stand-ins.",
    limitations: [LIM_ZYG, LIM_YAW],
    sensitivity: { yaw: true, depth: true },
  }),
  def({
    id: "OCD", number: 2, name: "Outer Canthal Distance Ratio", abbreviation: "OCD", category: "eyeArea", unit: "percent",
    formula: "outer canthal distance / bizygomatic width × 100",
    landmarks: ["exocanthion_R", "exocanthion_L", "zygion_R", "zygion_L"],
    t1: { min: 62, max: 68 }, status: "reconstructed",
    methodology: "Distance between the lateral canthi divided by bizygomatic width. The denominator was reconstructed from the visual template.",
    limitations: ["Denominator/measurement convention reconstructed from the visual template.", LIM_ZYG, LIM_YAW],
    dependencies: ["ESR"], weight: 0.8,
    sensitivity: { yaw: true, depth: true },
  }),
  def({
    id: "ICD", number: 3, name: "Intercanthal Distance to Palpebral Fissure Length", abbreviation: "ICD", category: "eyeArea", unit: "ratio",
    formula: "intercanthal distance / mean palpebral fissure length",
    landmarks: ["endocanthion_R", "endocanthion_L", "exocanthion_R", "exocanthion_L"],
    t1: { min: 0.93, max: 1.05 }, status: "defined",
    methodology: "Distance between the medial canthi divided by the mean of both palpebral fissure lengths (lateral to medial canthus).",
    limitations: [LIM_2D],
  }),
  def({
    id: "EAR", number: 4, name: "Eye Aspect Ratio", abbreviation: "EAR", category: "eyeArea", unit: "ratio",
    formula: "palpebral fissure length / eye height (mean of both eyes)",
    landmarks: ["endocanthion_R", "endocanthion_L", "exocanthion_R", "exocanthion_L", "palpebrale_sup_R", "palpebrale_sup_L", "palpebrale_inf_R", "palpebrale_inf_L"],
    t1: { min: 3.0, max: 3.6 }, status: "defined",
    methodology: "Per eye: fissure length divided by the vertical opening at the pupil (upper to lower lid). The two ratios are averaged.",
    limitations: ["Eye opening changes with squinting, blinking and smiling.", LIM_EXPR],
    sensitivity: { expression: ["eyes"] },
  }),
  def({
    id: "PFL_BYZGO", number: 5, name: "Palpebral Fissure Length to Bizygomatic Width", abbreviation: "PFL/BYZGO", category: "eyeArea", unit: "percent",
    formula: "mean palpebral fissure length / bizygomatic width × 100",
    landmarks: ["endocanthion_R", "endocanthion_L", "exocanthion_R", "exocanthion_L", "zygion_R", "zygion_L"],
    t1: { min: 19.5, max: 21.5 }, status: "defined",
    methodology: "Mean fissure length divided by bizygomatic width.",
    limitations: [LIM_ZYG, LIM_YAW],
    dependencies: ["ICD"], weight: 0.9,
    sensitivity: { yaw: true, depth: true },
  }),
  def({
    id: "M_IPD", number: 6, name: "Mouth Width to IPD", abbreviation: "M/IPD", category: "lips", unit: "percent",
    formula: "mouth width / IPD × 100",
    landmarks: ["cheilion_R", "cheilion_L", "pupil_R", "pupil_L"],
    t1: { min: 80, max: 88 }, status: "defined",
    methodology: "Distance between the mouth corners divided by the inter-pupillary distance.",
    limitations: [LIM_EXPR],
    sensitivity: { expression: ["mouth"] },
  }),
  def({
    id: "EBL", number: 7, name: "Eyebrow Length", abbreviation: "EBL", category: "eyeArea", unit: "percent",
    formula: "eyebrow length / IPD × 100 (mean of both brows)",
    landmarks: ["brow_medial_R", "brow_lateral_R", "brow_medial_L", "brow_lateral_L", "pupil_R", "pupil_L"],
    t1: { min: 69, max: 79 }, status: "defined",
    methodology: "Distance from brow head to brow tail (mesh brow contour end points) divided by IPD.",
    limitations: ["Brow end points depend on grooming and hair density; the mesh brow ends are approximate."],
    sensitivity: { expression: ["brows"] },
  }),
  def({
    id: "EBS", number: 8, name: "Eyebrow Spacing", abbreviation: "EBS", category: "eyeArea", unit: "percent",
    formula: "eye height / pupillary-to-brow distance (per template)",
    landmarks: ["pupil_R", "pupil_L", "brow_lower_mid_R", "brow_lower_mid_L", "palpebrale_sup_R", "palpebrale_inf_R", "palpebrale_sup_L", "palpebrale_inf_L"],
    t1: { min: 90, max: 98 }, status: "incomplete",
    methodology: "Not measured: the literal formula in the text does not reproduce the stated target range, so the exact convention requires the visual template.",
    limitations: ["Measurement convention incomplete in the source (community guide); not scored."],
    sensitivity: { expression: ["brows", "eyes"] },
  }),
  def({
    id: "ICD_N", number: 9, name: "Intercanthal Distance to Nose Width", abbreviation: "ICD/N", category: "nose", unit: "ratio",
    formula: "intercanthal distance / nose (alar) width",
    landmarks: ["endocanthion_R", "endocanthion_L", "alare_R", "alare_L"],
    t1: { min: 1.0, max: 1.1 }, status: "reconstructed",
    methodology: "Medial canthus to medial canthus divided by alar base width (most lateral alar points). End points fixed by this implementation.",
    limitations: ["End points were fixed by this implementation (medial canthi; alar base points).", LIM_YAW],
    sensitivity: { yaw: true, depth: true },
  }),
  def({
    id: "EME", number: 10, name: "Eye–Mouth–Eye Angle", abbreviation: "EME", category: "midface", unit: "degrees",
    formula: "angle at the mouth centre (stomion) between the rays to the two pupil centres",
    landmarks: ["pupil_R", "pupil_L", "stomion"],
    t1: { min: 47, max: 48 }, status: "defined",
    methodology: "Triangle pupil–stomion–pupil with the vertex at the mouth centre (E–M–E). A longer pupil-to-mouth distance gives a smaller angle.",
    limitations: ["The stomion moves with expression (smile, open mouth)."],
    sensitivity: { expression: ["mouth"] },
  }),
  def({
    id: "IAA", number: 11, name: "Ipsilateral Alar Angle", abbreviation: "IAA", category: "midface", unit: "degrees",
    formula: "per template (not textually defined)",
    landmarks: ["alare_R", "alare_L"],
    t1: { min: 85, max: 95 }, status: "incomplete",
    methodology: "Not measured: the angle construction is only defined by the visual template.",
    limitations: ["Angle construction incomplete in the source (community guide); not scored."],
  }),
  def({
    id: "JFA", number: 12, name: "Jaw Frontal Angle", abbreviation: "JFA", category: "jawline", unit: "degrees",
    formula: "per template (not textually defined)",
    landmarks: ["gonion_R", "gonion_L", "menton"],
    t1: { min: 85, max: 95 }, status: "incomplete",
    methodology: "Not measured: the exact angle construction requires the visual template.",
    limitations: ["Angle construction incomplete in the source (community guide); not scored."],
  }),
  def({
    id: "DEV_IAA_JFA", number: 13, name: "IAA/JFA Deviation", abbreviation: "DEV IAA/JFA", category: "jawline", unit: "degrees",
    formula: "|IAA − JFA|",
    landmarks: [],
    t1: { min: 0, max: 3 }, status: "incomplete",
    methodology: "Not measured: depends on IAA and JFA, which are incomplete.",
    limitations: ["Depends on incomplete measurements; not scored."],
    dependencies: ["IAA", "JFA"], weight: 0.5,
  }),
  def({
    id: "BIT", number: 14, name: "Bitemporal Width", abbreviation: "BIT", category: "jawline", unit: "percent",
    formula: "bitemporal width / bizygomatic width × 100",
    landmarks: ["frontotemporale_R", "frontotemporale_L", "zygion_R", "zygion_L"],
    t1: { min: 85, max: 95 }, status: "defined",
    methodology: "Temple contour points at brow level divided by bizygomatic width.",
    limitations: ["Temple points are soft-tissue contour points and may be covered by hair.", LIM_ZYG, LIM_YAW],
    sensitivity: { yaw: true, depth: true },
  }),
  def({
    id: "DEV_BIT_BIG", number: 15, name: "BIT/BIG Deviation", abbreviation: "DEV BIT/BIG", category: "jawline", unit: "percent",
    formula: "|BIT − BIG|",
    landmarks: ["frontotemporale_R", "frontotemporale_L", "gonion_R", "gonion_L", "zygion_R", "zygion_L"],
    t1: { min: 0, max: 3 }, status: "defined",
    methodology: "Absolute difference of the two percentages.",
    limitations: [LIM_GON, LIM_ZYG],
    dependencies: ["BIT", "BIG"], weight: 0.5,
    sensitivity: { yaw: true },
  }),
  def({
    id: "BIG", number: 16, name: "Bigonial Width", abbreviation: "BIG", category: "jawline", unit: "percent",
    formula: "bigonial width / bizygomatic width × 100",
    landmarks: ["gonion_R", "gonion_L", "zygion_R", "zygion_L"],
    t1: { min: 85, max: 92 }, status: "defined",
    methodology: "Distance between the constructed gonions divided by bizygomatic width.",
    limitations: [LIM_GON, LIM_ZYG, LIM_YAW],
    sensitivity: { yaw: true, depth: true },
  }),
  def({
    id: "JWHR", number: 17, name: "Jaw Width-to-Height Ratio", abbreviation: "JWHR", category: "jawline", unit: "ratio",
    formula: "bigonial width / (stomion-to-menton height)",
    landmarks: ["gonion_R", "gonion_L", "stomion", "menton"],
    t1: { min: 1.85, max: 1.95 }, status: "reconstructed",
    methodology: "Vertical bounds fixed by this implementation: stomion (lip line) to menton. Alternative conventions (subnasale–menton) give systematically lower values.",
    limitations: ["Vertical measurement bounds are not unambiguous in the material (reconstructed).", LIM_GON, LIM_EXPR],
    sensitivity: { yaw: true, expression: ["mouth", "jaw"] },
  }),
  def({
    id: "M_BIG", number: 18, name: "Mouth Width to Bigonial Width", abbreviation: "M/BIG", category: "lips", unit: "percent",
    formula: "mouth width / bigonial width × 100",
    landmarks: ["cheilion_R", "cheilion_L", "gonion_R", "gonion_L"],
    t1: { min: 40, max: 45 }, status: "defined",
    methodology: "Mouth-corner distance divided by the constructed bigonial width.",
    limitations: [LIM_GON, LIM_EXPR],
    dependencies: ["M_IPD"], weight: 0.8,
    sensitivity: { yaw: true, expression: ["mouth"] },
  }),
  def({
    id: "GS", number: 19, name: "Gonial Slope (frontal projection)", abbreviation: "GS", category: "jawline", unit: "degrees",
    formula: "angle at the gonion between the ramus line and the mandibular body line (mean of both sides)",
    landmarks: ["gonion_R", "gonion_L", "ramus_upper_R", "ramus_upper_L", "mandible_body_R", "mandible_body_L"],
    t1: { min: 138, max: 143 }, status: "reconstructed",
    methodology: "Frontal projection of the jaw angle from the face contour. This is NOT the lateral gonial angle.",
    limitations: ["The mesh contour is smooth around the jaw angle, so values tend to be larger than the anatomical angle.", LIM_GON, LIM_2D],
    sensitivity: { yaw: true, expression: ["jaw"] },
  }),
  def({
    id: "M_N", number: 20, name: "Mouth Width to Nose Width", abbreviation: "M/N", category: "lips", unit: "ratio",
    formula: "mouth width / nose (alar) width",
    landmarks: ["cheilion_R", "cheilion_L", "alare_R", "alare_L"],
    t1: { min: 1.38, max: 1.52 }, status: "defined",
    methodology: "Mouth-corner distance divided by alar base width.",
    limitations: [LIM_EXPR, LIM_YAW],
    sensitivity: { yaw: true, expression: ["mouth"] },
  }),
  def({
    id: "MF", number: 21, name: "Midface Ratio", abbreviation: "MF", category: "midface", unit: "ratio",
    formula: "IPD / nasion-to-upper-lip height",
    landmarks: ["pupil_R", "pupil_L", "nasion", "labrale_sup"],
    t1: { min: 0.95, max: 1.03 }, status: "defined",
    methodology: "IPD divided by the vertical distance from the soft-tissue nasion to the upper vermilion border.",
    limitations: ["Soft-tissue nasion from the mesh (medium precision).", "Pitch (head tilt up/down) shortens vertical distances."],
    sensitivity: { expression: ["mouth"] },
  }),
  def({
    id: "FWHR", number: 22, name: "Facial Width-to-Height Ratio", abbreviation: "FWHR", category: "midface", unit: "ratio",
    formula: "bizygomatic width / brow-to-upper-lip height",
    landmarks: ["zygion_R", "zygion_L", "brow_line", "labrale_sup"],
    t1: { min: 1.9, max: 2.05 }, status: "defined",
    methodology: "Bizygomatic width divided by the vertical distance from the brow line (lower brow edge) to the upper vermilion border.",
    limitations: ["The brow reference is the lower edge of the brows at mid-brow (convention stated in docs).", LIM_ZYG, LIM_YAW],
    dependencies: ["MF"], weight: 0.9,
    sensitivity: { yaw: true, depth: true, expression: ["brows", "mouth"] },
  }),
  def({
    id: "TFWHR", number: 23, name: "Total Facial Width-to-Height Ratio", abbreviation: "TFWHR", category: "structure", unit: "ratio",
    formula: "total facial height / bizygomatic width",
    landmarks: ["trichion", "menton", "zygion_R", "zygion_L"],
    t1: { min: 1.33, max: 1.38 }, status: "defined",
    methodology: "Hairline-to-menton height divided by bizygomatic width.",
    limitations: [LIM_HAIR, LIM_ZYG, LIM_YAW],
    sensitivity: { yaw: true, depth: true, hairline: true },
  }),
  def({
    id: "CBS", number: 24, name: "Cheekbone Position", abbreviation: "CBS", category: "midface", unit: "percent",
    formula: "cheekbone-to-lip distance / pupillary-plane-to-lip distance × 100",
    landmarks: ["zygion_R", "zygion_L", "pupil_R", "pupil_L", "stomion"],
    t1: { min: 80, max: null }, status: "defined",
    methodology: "Vertical distance from the zygion level to the lip line divided by the vertical distance from the pupil line to the lip line.",
    limitations: ["Only a lower bound (> 80 %) is defined.", "Lip reference fixed as the stomion (lip line).", LIM_ZYG],
    sensitivity: { expression: ["mouth"] },
  }),
  def({
    id: "N_H", number: 25, name: "Nose Height-to-Width", abbreviation: "N/H", category: "nose", unit: "ratio",
    formula: "nose height / nose width",
    landmarks: ["nasion", "subnasale", "alare_R", "alare_L"],
    t1: { min: 1.4, max: 1.59 }, status: "defined",
    methodology: "Vertical nasion-to-subnasale distance divided by alar base width.",
    limitations: ["Pitch shortens the vertical nose height.", LIM_YAW],
    sensitivity: { yaw: true, depth: true },
  }),
  def({
    id: "M_C", number: 26, name: "Mouth Width to Chin Width", abbreviation: "M/C", category: "lowerThird", unit: "ratio",
    formula: "mouth width / chin width",
    landmarks: ["cheilion_R", "cheilion_L", "chin_corner_R", "chin_corner_L"],
    t1: { min: 0.95, max: 1.05 }, status: "reconstructed",
    methodology: "Chin width taken between the lateral chin-pad contour points (mesh 176/400), which lie under the mouth corners in a neutral face.",
    limitations: ["Chin measurement points reconstructed (visual reference not available).", LIM_EXPR],
    sensitivity: { expression: ["mouth"] },
  }),
  def({
    id: "NBR_ALA", number: 27, name: "Nose Bridge / Alar Measurement", abbreviation: "NBR/ALA", category: "nose", unit: "ratio",
    formula: "per template (end points not textually defined)",
    landmarks: ["nasion", "alare_R", "alare_L"],
    t1: { min: 2.0, max: 2.15 }, status: "incomplete",
    methodology: "Not measured: the end points are not fully defined in the text.",
    limitations: ["End points incomplete in the source (community guide); not scored."],
  }),
  def({
    id: "N_BYZGO", number: 28, name: "Nose Width to Bizygomatic Width", abbreviation: "N/BYZGO", category: "nose", unit: "percent",
    formula: "nose width / bizygomatic width × 100",
    landmarks: ["alare_R", "alare_L", "zygion_R", "zygion_L"],
    t1: { min: 24, max: 26 }, status: "defined",
    methodology: "Alar base width divided by bizygomatic width.",
    limitations: ["Strongly affected by close-range (selfie) perspective, which enlarges the nose.", LIM_ZYG, LIM_YAW],
    sensitivity: { yaw: true, depth: true },
  }),
  def({
    id: "CT", number: 29, name: "Canthal Tilt", abbreviation: "CT", category: "eyeArea", unit: "degrees",
    formula: "angle of the medial-to-lateral canthus line vs. the inter-pupillary horizontal (mean of both eyes)",
    landmarks: ["endocanthion_R", "exocanthion_R", "endocanthion_L", "exocanthion_L", "pupil_R", "pupil_L"],
    t1: { min: 5, max: 8 }, status: "defined",
    methodology: "Positive when the lateral canthus is higher than the medial canthus. Measured after roll normalisation.",
    limitations: ["Yaw shifts apparent canthus positions; squinting changes the tilt."],
    sensitivity: { expression: ["eyes"] },
  }),
  def({
    id: "ET", number: 30, name: "Eyebrow Tilt", abbreviation: "ET", category: "eyeArea", unit: "degrees",
    formula: "angle of the brow head-to-tail line vs. the horizontal (mean of both brows)",
    landmarks: ["brow_medial_R", "brow_lateral_R", "brow_medial_L", "brow_lateral_L"],
    t1: { min: 5, max: 13 }, status: "defined",
    methodology: "Positive when the brow tail is higher than the brow head.",
    limitations: ["Brow ends are approximate; brow expression changes the tilt."],
    sensitivity: { expression: ["brows"] },
  }),
  def({
    id: "DEV_CT_ET", number: 31, name: "Canthal/Brow Tilt Deviation", abbreviation: "DEV CT/ET", category: "eyeArea", unit: "degrees",
    formula: "|CT − ET|",
    landmarks: ["endocanthion_R", "exocanthion_R", "endocanthion_L", "exocanthion_L", "brow_medial_R", "brow_lateral_R", "brow_medial_L", "brow_lateral_L"],
    t1: { min: 0, max: 3 }, status: "defined",
    methodology: "Absolute difference between canthal tilt and eyebrow tilt.",
    limitations: ["Inherits the limitations of CT and ET."],
    dependencies: ["CT", "ET"], weight: 0.5,
    sensitivity: { expression: ["eyes", "brows"] },
  }),
  def({
    id: "FWHF", number: 32, name: "Forehead Height to Face Width", abbreviation: "FWHF", category: "structure", unit: "percent",
    formula: "forehead height / reference face width × 100",
    landmarks: ["trichion", "glabella", "zygion_R", "zygion_L"],
    t1: { min: 44, max: 50 }, status: "reconstructed",
    methodology: "Reference face width fixed as bizygomatic width by this implementation. Forehead height = hairline to glabella.",
    limitations: ["Reference face width had to be fixed before calculation (reconstructed).", LIM_HAIR, LIM_ZYG],
    dependencies: ["FT_U"], weight: 0.7,
    sensitivity: { hairline: true, yaw: true },
  }),
  def({
    id: "LL_UL", number: 33, name: "Lower-to-Upper Lip Height", abbreviation: "LL/UL", category: "lips", unit: "ratio",
    formula: "lower lip height / upper lip height",
    landmarks: ["labrale_sup", "stomion_sup", "stomion_inf", "labrale_inf"],
    t1: { min: 1.4, max: 1.9 }, status: "defined",
    methodology: "Vermilion heights measured on the midline (vermilion border to inner lip edge).",
    limitations: [LIM_EXPR, "Lip vermilion borders are medium-precision landmarks."],
    sensitivity: { expression: ["mouth"] },
  }),
  def({
    id: "L3P", number: 34, name: "Lower Third Proportion", abbreviation: "L3P", category: "lowerThird", unit: "percent",
    formula: "nasal base-to-mouth / nasal base-to-chin × 100",
    landmarks: ["subnasale", "stomion", "menton"],
    t1: { min: 31, max: 33 }, status: "defined",
    methodology: "Subnasale-to-stomion height divided by subnasale-to-menton height.",
    limitations: ["Open mouth or smile moves the stomion.", "Pitch changes vertical proportions slightly."],
    sensitivity: { expression: ["mouth", "jaw"] },
  }),
  def({
    id: "LFF", number: 35, name: "Lower Face to Face", abbreviation: "LFF", category: "structure", unit: "percent",
    formula: "nasion-to-chin / hairline-to-chin × 100",
    landmarks: ["nasion", "menton", "trichion"],
    t1: { min: 63, max: 67 }, status: "defined",
    methodology: "Vertical nasion-to-menton height divided by trichion-to-menton height.",
    limitations: [LIM_HAIR],
    dependencies: ["FT_U"], weight: 0.8,
    sensitivity: { hairline: true },
  }),
  def({
    id: "C_P", number: 36, name: "Chin-to-Philtrum Ratio", abbreviation: "C/P", category: "lowerThird", unit: "ratio",
    formula: "lower lip-to-chin height / subnasale-to-upper lip height",
    landmarks: ["labrale_inf", "menton", "subnasale", "labrale_sup"],
    t1: { min: 2.1, max: 2.5 }, status: "defined",
    methodology: "Chin height (lower vermilion border to menton) divided by the philtrum length (subnasale to upper vermilion border).",
    limitations: ["\"Lip midpoint\" interpreted as the upper vermilion border on the midline.", LIM_EXPR],
    sensitivity: { expression: ["mouth", "jaw"] },
  }),
  def({
    id: "FT_L", number: 37, name: "Facial Third – Lower", abbreviation: "FT-L", category: "lowerThird", unit: "percent",
    formula: "lower third (subnasale–menton) / total facial height × 100",
    landmarks: ["subnasale", "menton", "trichion"],
    t1: { min: 34, max: 37 }, status: "defined",
    methodology: "Subnasale-to-menton divided by trichion-to-menton.",
    limitations: [LIM_HAIR, "Open mouth lengthens the lower third."],
    dependencies: ["FT_M", "FT_U"], weight: 0.67,
    sensitivity: { hairline: true, expression: ["jaw"] },
  }),
  def({
    id: "FT_M", number: 38, name: "Facial Third – Middle", abbreviation: "FT-M", category: "structure", unit: "percent",
    formula: "middle third (glabella–subnasale) / total facial height × 100",
    landmarks: ["glabella", "subnasale", "trichion", "menton"],
    t1: { min: 31, max: 33 }, status: "defined",
    methodology: "Glabella (mid-brow reference) to subnasale divided by trichion-to-menton.",
    limitations: [LIM_HAIR],
    dependencies: ["FT_L", "FT_U"], weight: 0.67,
    sensitivity: { hairline: true },
  }),
  def({
    id: "FT_U", number: 39, name: "Facial Third – Upper", abbreviation: "FT-U", category: "structure", unit: "percent",
    formula: "upper third (trichion–glabella) / total facial height × 100",
    landmarks: ["trichion", "glabella", "menton"],
    t1: { min: 30, max: 32 }, status: "defined",
    methodology: "Trichion to glabella divided by trichion-to-menton.",
    limitations: [LIM_HAIR],
    dependencies: ["FT_L", "FT_M"], weight: 0.67,
    sensitivity: { hairline: true },
  }),
  def({
    id: "LIP_WHR", number: 40, name: "Lip Width-to-Height Ratio", abbreviation: "LIP WHR", category: "lips", unit: "ratio",
    formula: "mouth width / total lip height",
    landmarks: ["cheilion_R", "cheilion_L", "labrale_sup", "labrale_inf"],
    t1: { min: 3.0, max: 3.5 }, status: "defined",
    methodology: "Mouth-corner distance divided by the vertical height from the upper to the lower vermilion border.",
    limitations: [LIM_EXPR, "An open mouth inflates total lip height."],
    dependencies: ["LL_UL", "M_IPD"], weight: 0.8,
    sensitivity: { expression: ["mouth"] },
  }),
  def({
    id: "NW", number: 41, name: "Neck Width", abbreviation: "NW", category: "jawline", unit: "percent",
    formula: "neck width / bigonial width × 100",
    landmarks: ["neck_R", "neck_L", "gonion_R", "gonion_L"],
    t1: { min: 90, max: 98 }, status: "defined",
    methodology: "Requires manually placed neck edge points (the landmark model does not cover the neck).",
    limitations: ["Neck points must be placed manually; clothing and hair often hide the neck.", LIM_GON],
    sensitivity: { yaw: true },
  }),
  def({
    id: "EYS", number: 42, name: "EYS", abbreviation: "EYS", category: "eyeArea", unit: "ratio",
    formula: "not defined in the material",
    landmarks: [],
    t1: { min: 2.9, max: 3.6 }, status: "incomplete",
    methodology: "Not measured: the measurement method is not defined in the source (community guide).",
    limitations: ["Undefined measurement; not scored."],
  }),
];

export const RATIO_BY_ID: Record<RatioId, RatioDefinition> = Object.fromEntries(
  RATIO_DEFINITIONS.map((d) => [d.id, d]),
) as Record<RatioId, RatioDefinition>;

export const CATEGORY_META: Record<CategoryId, { label: string; weight: number; description: string }> = {
  eyeArea: { label: "Eye Area", weight: 22, description: "Eye spacing, fissure proportions, canthal and brow tilt, brow length." },
  midface: { label: "Midface", weight: 14, description: "Midface compactness, cheekbone position, eye–mouth geometry, FWHR." },
  nose: { label: "Nose", weight: 10, description: "Nose width and height relative to the eyes and face." },
  lips: { label: "Lips", weight: 10, description: "Mouth width and lip proportions." },
  jawline: { label: "Jawline", weight: 20, description: "Bigonial/bitemporal widths, jaw angle projection, jaw height ratio." },
  lowerThird: { label: "Lower Third", weight: 10, description: "Lower-third proportions, chin and philtrum relations." },
  structure: { label: "Facial Structure", weight: 14, description: "Vertical thirds, total height-to-width, forehead proportion." },
};

export const CATEGORY_ORDER: CategoryId[] = ["eyeArea", "midface", "nose", "lips", "jawline", "lowerThird", "structure"];

export const ADDITIONAL_DEFINITIONS: AdditionalMeasurementDefinition[] = [
  {
    id: "CMA", name: "Cervicomental Angle", unit: "degrees", referenceValue: null, status: "unavailable-frontal",
    description: "Angle between the underside of the chin and the neck line (submental region).",
    methodology: "Requires a lateral (profile) photograph; cannot be measured from a frontal image.",
    limitations: ["Not measurable in 2D frontal view."], landmarks: [],
  },
  {
    id: "GA", name: "Gonial Angle", unit: "degrees", referenceValue: "115–130° (older reference)", status: "unavailable-frontal",
    description: "Angle at the gonion between the mandibular body and the ascending ramus.",
    methodology: "The true gonial angle is a lateral-view measurement. The frontal projection is reported separately as GS and is not the same quantity.",
    limitations: ["Not measurable in 2D frontal view; see GS for the frontal projection."], landmarks: [],
  },
  {
    id: "FH_FINGER", name: "Forehead Height (finger rule)", unit: "none", referenceValue: "≈ three finger widths (rule of thumb)", status: "raw-only",
    description: "Rough visual rule: the forehead (hairline to brow) is about three finger widths tall.",
    methodology: "Reported as forehead height relative to the middle third and to IPD; no absolute scale is available in a photo.",
    limitations: ["Non-metric rule of thumb; no scoring.", "Depends on the estimated hairline."], landmarks: ["trichion", "glabella", "subnasale"],
  },
  {
    id: "FIFTHS", name: "Facial Fifths", unit: "percent", referenceValue: "≈ 20 % each", status: "measurable",
    description: "Horizontal division of the face into five segments: outer face–lateral canthus, eye, intercanthal, eye, lateral canthus–outer face.",
    methodology: "Segment widths measured between the zygion stand-ins and the canthi, expressed as % of the total width.",
    limitations: ["Outer segments depend on the soft-tissue face contour.", "Not part of the 42-ratio core scoring."],
    landmarks: ["zygion_R", "exocanthion_R", "endocanthion_R", "endocanthion_L", "exocanthion_L", "zygion_L"],
  },
  {
    id: "BYZ_BIG", name: "Bizygomatic / Bigonial", unit: "ratio", referenceValue: "1.35 (older atlas value)", status: "raw-only",
    description: "Older ratio from the measurement atlas. The source material is contradictory (BIG = 85–92 % implies 1.09–1.18).",
    methodology: "Raw value bizygomatic ÷ bigonial reported for reference only; no scoring.",
    limitations: ["Formula/labels contradictory in the source material; do not score."], landmarks: ["zygion_R", "zygion_L", "gonion_R", "gonion_L"],
  },
  {
    id: "EAR_ANGLE", name: "Ear Angle", unit: "degrees", referenceValue: null, status: "undefined",
    description: "Ear angle/ratio from the visual template; no target range defined.",
    methodology: "Not measurable: the face landmark model has no ear landmarks and no target is defined.",
    limitations: ["No ear landmarks; no defined target."], landmarks: [],
  },
  {
    id: "NOSE_CHIN", name: "Nose–Chin", unit: "ratio", referenceValue: null, status: "raw-only",
    description: "Additional visual measurement; raw values documented only.",
    methodology: "Raw distance nose tip → menton reported relative to IPD and to the lower third; no formula or target defined, no scoring.",
    limitations: ["Undefined formula and target; raw value only."], landmarks: ["pronasale", "menton", "subnasale"],
  },
  {
    id: "EML", name: "Eye–Mouth Length Ratio", unit: "ratio", referenceValue: ".36–.37 (Pallett et al. 2010)", status: "measurable",
    description: "Vertical distance from the pupil line to the mouth (stomion) over the face length from hairline to chin.",
    methodology: "Aligned (pose-normalised) frame; pupil midpoint height to stomion height divided by trichion-to-menton height. Scored in rubric 2.0 (criterion eyeMouthLength) with the published dispersion .017.",
    limitations: ["Preference data from white female faces only (Pallett et al. 2010).", "Depends on the estimated or confirmed hairline.", "Mouth opening moves the stomion."],
    landmarks: ["pupil_R", "pupil_L", "stomion", "trichion", "menton"],
  },
  {
    id: "MRD1", name: "Upper lid position (MRD1)", unit: "none", referenceValue: "4–5 mm (Putterman 2012)", status: "measurable",
    description: "Margin–reflex distance 1: iris centre to upper lid margin in millimetres.",
    methodology: "Aligned (pose-normalised) mesh; vertical distance from the iris centre (468/473) to the upper lid contour at the iris-centre column, scaled by the horizontal iris diameter (ring points) = 11.7 mm (Rüfer et al. 2005); mean of both eyes. Scored in rubric 2.1 (criterion upper lid position).",
    limitations: ["Lid margins are mesh contour points; lashes, make-up and lid shadows shift them.", "Individual iris diameters vary by ± 0.4 mm (± 4 %)."],
    landmarks: ["pupil_R", "pupil_L"],
  },
  {
    id: "SSI", name: "Inferior scleral show", unit: "none", referenceValue: "≤ 0 mm; > 1 mm = lower-lid retraction (Bartley 1996)", status: "measurable",
    description: "Visible sclera between the lower edge of the iris and the lower lid margin, in millimetres.",
    methodology: "Aligned mesh; lower lid contour at the iris-centre column minus the lower iris edge (centre + horizontal iris radius), scaled by the iris diameter = 11.7 mm; mean of both eyes. Negative = the lid covers the lower iris edge. Scored in rubric 2.1 (criterion scleral show).",
    limitations: ["Lid margins are mesh contour points; lashes and make-up shift them.", "Gaze direction changes the value: looking up exposes sclera below the iris."],
    landmarks: ["pupil_R", "pupil_L"],
  },
];

export const ADDITIONAL_BY_ID = Object.fromEntries(ADDITIONAL_DEFINITIONS.map((d) => [d.id, d])) as Record<
  AdditionalMeasurementDefinition["id"],
  AdditionalMeasurementDefinition
>;
