/**
 * Side-view (profile) analysis from manually placed soft-tissue landmarks.
 *
 * Landmark models are unreliable on true profiles, so the user places 16 standard
 * points under guidance. All angles are scale-free; ratios use distances between
 * placed points. The image vertical is taken as the true vertical (natural head
 * position assumed) — this is stated in every result.
 *
 * Reference ranges: GA uses the range of the community guide (older reference
 * 115–130°). Every other range is a published literature norm and is labelled as
 * such; descriptive measures carry no target and are never scored. Nothing here
 * feeds into the 42-ratio frontal score.
 */
import { angleAt, angleBetween, clamp, createRng, dist, gaussian, stddev } from "./geometry";
import { expectedIndex, plateauIndex } from "./scoring/measurement";
import type { Point } from "./types";

export const SIDE_VIEW_VERSION = "2.0.0";

/**
 * Anatomical reference frame of the profile. "image": the image axes are taken as
 * the true horizontal/vertical (natural head position assumed). "frankfort": the
 * soft-tissue Frankfort horizontal through the tragion and the soft-tissue
 * orbitale defines the horizontal. "manual": the user rotates the reference axis.
 * All vertical/horizontal-dependent measures (Z angle, lower-face height,
 * lip–chin ratio, chin meridian) are computed in this frame; pure three-point
 * angles are unaffected.
 */
export type SideReference = { kind: "image" } | { kind: "frankfort"; orbitale: Point } | { kind: "manual"; tiltDeg: number };

/** Signed tilt (degrees, + = clockwise on screen) of the anatomical horizontal relative to the image horizontal. */
export function referenceTilt(points: Partial<Pick<SidePoints, "tragion">>, ref: SideReference | undefined): number {
  if (!ref || ref.kind === "image") return 0;
  if (ref.kind === "frankfort" && !points.tragion) return 0;
  if (ref.kind === "manual") return Math.max(-45, Math.min(45, ref.tiltDeg));
  const v = { x: ref.orbitale.x - points.tragion!.x, y: ref.orbitale.y - points.tragion!.y };
  const a = (Math.atan2(v.y, v.x) * 180) / Math.PI;
  // the orbitale lies anterior to the tragion: take the direction closest to the image horizontal
  return Math.abs(a) <= 90 ? a : a - 180 * Math.sign(a);
}

/** Rotates all points about the tragion so that the anatomical horizontal becomes the image horizontal. */
export function toReferenceFrame<T extends Partial<SidePoints>>(points: T, tiltDeg: number): T {
  if (!tiltDeg) return points;
  const t = points.tragion ?? points.glabella ?? points.pronasale ?? { x: 0, y: 0 };
  const r = (-tiltDeg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  const out = {} as T;
  for (const id of Object.keys(points) as SideLandmarkId[]) {
    const p = points[id];
    if (!p) continue;
    out[id] = { x: t.x + (p.x - t.x) * c - (p.y - t.y) * s, y: t.y + (p.x - t.x) * s + (p.y - t.y) * c };
  }
  return out;
}

export type SideLandmarkId =
  | "glabella"
  | "nasion"
  | "rhinion"
  | "pronasale"
  | "subnasale"
  | "alar_crease"
  | "labrale_sup"
  | "stomion"
  | "labrale_inf"
  | "labiomental"
  | "pogonion"
  | "menton"
  | "cervical"
  | "neck"
  | "gonion"
  | "tragion";

/** Guided placement order: midline top → bottom, then throat, then the posterior points. */
export const SIDE_LANDMARK_ORDER: SideLandmarkId[] = [
  "glabella", "nasion", "rhinion", "pronasale", "subnasale", "alar_crease", "labrale_sup", "stomion",
  "labrale_inf", "labiomental", "pogonion", "menton", "cervical", "neck", "gonion", "tragion",
];

export type SidePoints = Record<SideLandmarkId, Point>;
/** A (possibly incomplete) point set: automatic detection may not find every point. */
export type SidePointSet = Partial<SidePoints>;

/**
 * Points every analysis needs (the facial midline from nasion to menton). The
 * remaining points (glabella, rhinion, alar crease, cervical/neck point, gonion,
 * tragion) are optional: measurements that need a missing point are reported as not
 * determinable. The glabella is optional because hair in front of the forehead can
 * hide it in a profile photo.
 */
export const SIDE_CORE_POINTS: SideLandmarkId[] = ["nasion", "pronasale", "subnasale", "labrale_sup", "stomion", "labrale_inf", "labiomental", "pogonion", "menton"];

/** How a point was obtained. */
export type SidePointSource = "manual" | "contour" | "derived" | "segment";

export type SideMeasurementId =
  | "GA"
  | "CMA"
  | "MCA"
  | "NFA"
  | "NFC"
  | "NMA"
  | "NLA"
  | "MLA"
  | "FCA"
  | "HANG"
  | "ZANG"
  | "LFH"
  | "LCR"
  | "GOODE"
  | "DORSUM"
  | "CHIN_MERIDIAN"
  | "MPA"
  | "MFP"
  | "CHP";

export type SideSource = "guide" | "literature" | "descriptive";
export type SideUnit = "degrees" | "ratio" | "percent";

export interface SideMeasurementDefinition {
  id: SideMeasurementId;
  name: string;
  unit: SideUnit;
  /** null = descriptive, never scored. min === max = point target (tolerance from the app rule). */
  range: { min: number; max: number } | null;
  source: SideSource;
  /** citation / guide note (English; German lives in the i18n layer) */
  reference: string;
  description: string;
  methodology: string;
  limitations: string[];
  landmarks: SideLandmarkId[];
  weight: number;
}

const LIM_MANUAL = "Depends on manual landmark placement (±1–2 px typical).";
const LIM_VERTICAL = "Measured against the anatomical reference axis (Frankfort horizontal from tragion and orbitale, a manually rotated axis, or — if neither is set — the image vertical); with the image vertical, a tilted head shifts the value.";
const LIM_SOFT = "Soft-tissue proxy for a cephalometric (bony) measurement.";

export const SIDE_DEFINITIONS: SideMeasurementDefinition[] = [
  {
    id: "GA", name: "Gonial angle (soft tissue)", unit: "degrees", range: { min: 115, max: 130 }, source: "guide",
    reference: "Provided guide: older reference range 115–130°.",
    description: "Angle of the jaw between the ascending ramus and the mandibular body.",
    methodology: "Angle at the gonion between the ray to the tragion (ramus direction) and the ray to the menton (body direction).",
    limitations: [LIM_SOFT, "The ramus is approximated by the gonion–tragion line and the body by the gonion–menton line; the true cephalometric angle uses bony tangents.", LIM_MANUAL],
    landmarks: ["tragion", "gonion", "menton"], weight: 1,
  },
  {
    id: "CMA", name: "Cervicomental angle", unit: "degrees", range: { min: 105, max: 120 }, source: "literature",
    reference: "Ellenbogen & Karlin 1980: aesthetic cervicomental angle 105–120°.",
    description: "Angle under the chin between the submental line and the front of the neck.",
    methodology: "Angle at the cervical point between the ray to the menton and the ray to the neck point.",
    limitations: ["Sensitive to head flexion/extension and to submental fat.", LIM_MANUAL],
    landmarks: ["menton", "cervical", "neck"], weight: 1,
  },
  {
    id: "MCA", name: "Mentocervical angle", unit: "degrees", range: { min: 80, max: 95 }, source: "literature",
    reference: "Powell & Humphreys 1984 (aesthetic triangle): mentocervical angle 80–95°.",
    description: "Angle between the facial plane and the submental line.",
    methodology: "Angle between the direction glabella → pogonion and the direction menton → cervical point.",
    limitations: ["Depends on the chin and on head posture.", LIM_MANUAL],
    landmarks: ["glabella", "pogonion", "menton", "cervical"], weight: 1,
  },
  {
    id: "NFA", name: "Nasofrontal angle", unit: "degrees", range: { min: 115, max: 130 }, source: "literature",
    reference: "Powell & Humphreys 1984: nasofrontal angle 115–130°.",
    description: "Angle at the nasion between the forehead and the nasal dorsum.",
    methodology: "Angle at the nasion between the ray to the glabella and the ray to the pronasale.",
    limitations: ["The glabella is a soft-tissue point; brow prominence and the hairline shift it.", LIM_MANUAL],
    landmarks: ["glabella", "nasion", "pronasale"], weight: 1,
  },
  {
    id: "NFC", name: "Nasofacial angle", unit: "degrees", range: { min: 30, max: 40 }, source: "literature",
    reference: "Powell & Humphreys 1984: nasofacial angle 30–40°.",
    description: "Inclination of the nasal dorsum relative to the facial plane.",
    methodology: "Angle between the line glabella–pogonion and the line nasion–pronasale.",
    limitations: ["Chin position changes the facial plane and therefore the angle.", LIM_MANUAL],
    landmarks: ["glabella", "pogonion", "nasion", "pronasale"], weight: 1,
  },
  {
    id: "NMA", name: "Nasomental angle", unit: "degrees", range: { min: 120, max: 132 }, source: "literature",
    reference: "Powell & Humphreys 1984: nasomental angle 120–132°.",
    description: "Angle at the nasal tip between the dorsum and the line to the chin.",
    methodology: "Angle at the pronasale between the ray to the nasion and the ray to the pogonion.",
    limitations: ["Combines nasal projection with chin projection.", LIM_MANUAL],
    landmarks: ["nasion", "pronasale", "pogonion"], weight: 1,
  },
  {
    id: "NLA", name: "Nasolabial angle", unit: "degrees", range: { min: 90, max: 110 }, source: "literature",
    reference: "Powell & Humphreys 1984 / Legan & Burstone 1980: nasolabial angle ≈ 90–110°.",
    description: "Angle between the columella and the upper lip.",
    methodology: "Angle at the subnasale between the ray to the pronasale (columella direction) and the ray to the labrale superius.",
    limitations: ["The columella is approximated by the pronasale–subnasale line.", "Lip posture changes the value.", LIM_MANUAL],
    landmarks: ["pronasale", "subnasale", "labrale_sup"], weight: 1,
  },
  {
    id: "MLA", name: "Mentolabial angle", unit: "degrees", range: null, source: "descriptive",
    reference: "Published values vary widely (≈ 110–130°), therefore descriptive only.",
    description: "Depth of the fold between the lower lip and the chin.",
    methodology: "Angle at the labiomental fold between the ray to the labrale inferius and the ray to the pogonion.",
    limitations: ["No agreed reference range; not scored.", LIM_MANUAL],
    landmarks: ["labrale_inf", "labiomental", "pogonion"], weight: 0,
  },
  {
    id: "FCA", name: "Facial convexity (G–Sn–Pg)", unit: "degrees", range: { min: 164, max: 172 }, source: "literature",
    reference: "Legan & Burstone 1980: angle of convexity 12° ± 4° ⇒ interior angle G–Sn–Pg 164–172°.",
    description: "Overall profile convexity from forehead to chin via the nose base.",
    methodology: "Interior angle at the subnasale between the ray to the glabella and the ray to the pogonion (180° = straight profile).",
    limitations: [LIM_SOFT, LIM_MANUAL],
    landmarks: ["glabella", "subnasale", "pogonion"], weight: 1,
  },
  {
    id: "HANG", name: "Holdaway H angle", unit: "degrees", range: { min: 7, max: 15 }, source: "literature",
    reference: "Holdaway 1983: H angle 7–15°.",
    description: "Upper-lip prominence relative to the soft-tissue facial line.",
    methodology: "Angle at the pogonion between the ray to the nasion and the ray to the labrale superius (H line).",
    limitations: ["Holdaway relates the ideal value to the skeletal ANB angle, which a photo cannot provide.", LIM_SOFT, LIM_MANUAL],
    landmarks: ["nasion", "pogonion", "labrale_sup"], weight: 1,
  },
  {
    id: "ZANG", name: "Merrifield Z angle", unit: "degrees", range: { min: 71, max: 89 }, source: "literature",
    reference: "Merrifield 1966: Z angle 80° ± 9° (adults).",
    description: "Inclination of the profile line (chin to most protrusive lip) against the horizontal.",
    methodology: "Angle between the posterior horizontal and the line from the most protrusive lip to the pogonion; 90° = vertical, smaller = chin behind the lips.",
    limitations: ["Merrifield uses the Frankfort horizontal; it is used when the orbitale is placed, otherwise the manual or image horizontal.", LIM_VERTICAL, LIM_MANUAL],
    landmarks: ["pogonion", "labrale_sup", "labrale_inf"], weight: 1,
  },
  {
    id: "LFH", name: "Lower face height (Sn–Me / G–Me)", unit: "percent", range: { min: 50, max: 50 }, source: "literature",
    reference: "Legan & Burstone 1980: G–Sn : Sn–Me' = 1 : 1 (point target; tolerance from the app rule).",
    description: "Share of the lower face in the glabella–menton height.",
    methodology: "Vertical distance subnasale–menton divided by the vertical distance glabella–menton, in percent.",
    limitations: [LIM_VERTICAL, LIM_MANUAL],
    landmarks: ["glabella", "subnasale", "menton"], weight: 1,
  },
  {
    id: "LCR", name: "Vertical lip–chin ratio (Stm–Me / Sn–Stm)", unit: "ratio", range: { min: 2, max: 2 }, source: "literature",
    reference: "Legan & Burstone 1980: Sn–Stm : Stm–Me' = 1 : 2 (point target; tolerance from the app rule).",
    description: "Lower lip plus chin height relative to the upper lip height.",
    methodology: "Vertical distance stomion–menton divided by the vertical distance subnasale–stomion.",
    limitations: ["Requires closed lips (stomion).", LIM_VERTICAL, LIM_MANUAL],
    landmarks: ["subnasale", "stomion", "menton"], weight: 1,
  },
  {
    id: "GOODE", name: "Nasal projection (Goode)", unit: "ratio", range: { min: 0.55, max: 0.6 }, source: "literature",
    reference: "Goode's method (in Powell & Humphreys 1984): projection / length 0.55–0.60.",
    description: "How far the nasal tip projects relative to the nasal length.",
    methodology: "Perpendicular distance of the pronasale from the line nasion–alar crease, divided by the distance nasion–pronasale.",
    limitations: ["The alar crease is a soft-tissue point that is hard to place precisely.", LIM_MANUAL],
    landmarks: ["nasion", "alar_crease", "pronasale"], weight: 1,
  },
  {
    id: "DORSUM", name: "Dorsal profile", unit: "percent", range: null, source: "descriptive",
    reference: "No target: positive = dorsal hump, negative = saddle, 0 = straight dorsum.",
    description: "Deviation of the nasal dorsum from a straight line.",
    methodology: "Signed perpendicular offset of the rhinion from the line nasion–pronasale in percent of the nasal length (anterior = positive).",
    limitations: ["Descriptive only; not scored.", LIM_MANUAL],
    landmarks: ["nasion", "rhinion", "pronasale"], weight: 0,
  },
  {
    id: "CHIN_MERIDIAN", name: "Chin position (zero meridian)", unit: "percent", range: null, source: "descriptive",
    reference: "Gonzalez-Ulloa zero meridian: vertical through the nasion; no numeric target in the material.",
    description: "Horizontal position of the chin relative to the vertical through the nasion.",
    methodology: "Anterior offset of the pogonion from the vertical through the nasion, in percent of the nasion–menton height (positive = chin ahead).",
    limitations: ["Descriptive only; not scored.", LIM_VERTICAL, LIM_MANUAL],
    landmarks: ["nasion", "pogonion", "menton"], weight: 0,
  },
  {
    id: "MPA", name: "Mandibular plane angle (soft tissue)", unit: "degrees", range: { min: 20, max: 30 }, source: "literature",
    reference: "Frankfort–mandibular plane angle 25° ± 5° (Tweed 1954); soft-tissue proxy measured against the reference horizontal.",
    description: "Steepness of the lower border of the jaw relative to the horizontal; high values mean a steep (long, retrusive) mandible, low values a flat one.",
    methodology: "Angle between the line soft-tissue gonion → soft-tissue menton and the reference horizontal (Frankfort horizontal when tragion and orbitale are set, otherwise the image horizontal).",
    limitations: [LIM_SOFT, LIM_VERTICAL, "The bony mandibular plane runs a few degrees steeper than the soft-tissue jaw line; the soft-tissue gonion is reconstructed."],
    landmarks: ["gonion", "menton"], weight: 1,
  },
  {
    id: "MFP", name: "Midface projection (Sn to glabella vertical)", unit: "percent", range: { min: 2.4, max: 7.2 }, source: "literature",
    reference: "Legan & Burstone 1980: subnasale 6 ± 3 mm ahead of the glabella vertical; converted with a soft-tissue G–Me' height of 125 mm (Farkas 1994 adult means 115–135 mm).",
    description: "How far the upper lip base (subnasale) lies ahead of the forehead, i.e. the forward position of the maxilla/midface.",
    methodology: "Horizontal distance subnasale − glabella along the anterior direction in the reference frame, in percent of the vertical glabella–menton height.",
    limitations: [LIM_VERTICAL, "The millimetre norm is converted to a percentage with an average face height (± 8 %).", LIM_SOFT],
    landmarks: ["glabella", "subnasale", "menton"], weight: 1,
  },
  {
    id: "CHP", name: "Chin projection (Pg to glabella vertical)", unit: "percent", range: { min: -3.2, max: 3.2 }, source: "literature",
    reference: "Legan & Burstone 1980: soft-tissue pogonion 0 ± 4 mm relative to the glabella vertical; converted with G–Me' = 125 mm.",
    description: "Forward (positive) or backward (negative) position of the chin relative to the forehead.",
    methodology: "Horizontal distance pogonion − glabella along the anterior direction in the reference frame, in percent of the vertical glabella–menton height.",
    limitations: [LIM_VERTICAL, "The millimetre norm is converted to a percentage with an average face height (± 8 %)."],
    landmarks: ["glabella", "pogonion", "menton"], weight: 1,
  },
];

export const SIDE_BY_ID = Object.fromEntries(SIDE_DEFINITIONS.map((d) => [d.id, d])) as Record<SideMeasurementId, SideMeasurementDefinition>;

export interface SideMeasurementResult {
  id: SideMeasurementId;
  value: number | null;
  /** null for descriptive measures */
  inRange: boolean | null;
  /** signed distance outside the range (0 inside); null for descriptive */
  deviation: number | null;
  /** 0–100 harmony index; null for descriptive */
  index: number | null;
  /** standard deviation of the value under landmark jitter (null without simulation) */
  valueSigma: number | null;
  intermediate: Record<string, number>;
  /** landmarks this measurement needs that are not available (value is then null: not determinable) */
  missingLandmarks?: SideLandmarkId[];
}

export type SideIssueCode = "verticalOrder" | "anteriorOrder" | "neckOrder" | "tragionLevel" | "gonionLevel" | "lowResolution" | "missingCore";

export interface SideIssue {
  code: SideIssueCode;
  severity: "error" | "warning";
}

export interface SideViewConfig {
  uncertaintySamples: number;
  seed: number;
  /** anatomical reference axis (default: image axes) */
  reference?: SideReference;
  /** how the points were obtained (default: manual placement) */
  placement?: "manual" | "automatic" | "mixed";
  /** per-point provenance (automatic detection) */
  pointSources?: Partial<Record<SideLandmarkId, SidePointSource>>;
}

export const SIDE_DEFAULT_CONFIG: SideViewConfig = { uncertaintySamples: 40, seed: 20251106 };

export interface SideViewResult {
  engineVersion: string;
  facing: "left" | "right";
  analyzable: boolean;
  measurements: SideMeasurementResult[];
  /** weighted mean index of the scored measurements; null when not analyzable */
  score: number | null;
  scoreSigma: number | null;
  scoredCount: number;
  issues: SideIssue[];
  /** language-neutral codes rendered by the UI */
  assumptionCodes: SideAssumptionCode[];
  faceHeightPx: number;
  uncertainty: { samples: number; sigmaPx: number };
  /** reference axis used (missing on results of version 1.0 = image axes) */
  reference?: { kind: SideReference["kind"]; tiltDeg: number; orbitale?: Point };
  /** version 2.0: how the points were obtained and which ones are available */
  placement?: "manual" | "automatic" | "mixed";
  pointSources?: Partial<Record<SideLandmarkId, SidePointSource>>;
  missingPoints?: SideLandmarkId[];
}

export type SideAssumptionCode = "manualPlacement" | "automaticPlacement" | "imageVertical" | "frankfortHorizontal" | "manualAxis" | "proxies" | "separateFromFrontal";

/**
 * Dispersion unit of a profile measure (engine 2.0). Literature ranges are mostly
 * reported as mean ± 1 SD, so half the range width is used; point targets and very
 * narrow ranges get a unit-specific floor (3° for angles, 2 pp for percentages,
 * 5 % of the target for ratios).
 */
export function toleranceFor(range: { min: number; max: number }, unit: SideMeasurementDefinition["unit"] = "ratio"): number {
  const half = (range.max - range.min) / 2;
  const target = (range.min + range.max) / 2;
  const floor = unit === "degrees" ? 3 : unit === "percent" ? 2 : 0.05 * Math.abs(target);
  return Math.max(half, floor, 1e-6);
}

/** Perpendicular distance of p from the infinite line a–b, signed by side. */
function signedLineDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return ((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

export function detectFacing(points: Partial<Pick<SidePoints, "pronasale" | "tragion" | "nasion" | "subnasale">>): "left" | "right" {
  const prn = points.pronasale;
  if (!prn) return "right";
  if (points.tragion) return prn.x < points.tragion.x ? "left" : "right";
  // without the tragion: the nasal tip lies anterior to nasion and subnasale
  const back = [points.nasion, points.subnasale].filter(Boolean) as Point[];
  if (!back.length) return "right";
  const bx = back.reduce((s, p) => s + p.x, 0) / back.length;
  return prn.x < bx ? "left" : "right";
}

type RawValues = Record<SideMeasurementId, { value: number; intermediate: Record<string, number> }>;

const NA = { value: Number.NaN, intermediate: {} };

/** All raw values for one point set. `ax` is the anterior unit direction along x (−1 faces left). Missing inputs give NaN. */
function computeValues(P: SidePointSet, ax: 1 | -1): RawValues {
  const has = (...ids: SideLandmarkId[]) => ids.every((id) => !!P[id]);
  const vdist = (a: Point, b: Point) => Math.abs(a.y - b.y);
  const out = {} as RawValues;
  const put = (id: SideMeasurementId, need: SideLandmarkId[], f: () => { value: number; intermediate: Record<string, number> }) => {
    out[id] = has(...need) ? f() : NA;
  };
  const p = P as SidePoints; // only dereferenced after `has`
  put("GA", ["tragion", "gonion", "menton"], () => ({ value: angleAt(p.tragion, p.gonion, p.menton), intermediate: {} }));
  put("CMA", ["menton", "cervical", "neck"], () => ({ value: angleAt(p.menton, p.cervical, p.neck), intermediate: {} }));
  put("MCA", ["glabella", "pogonion", "menton", "cervical"], () => ({ value: angleBetween({ x: p.pogonion.x - p.glabella.x, y: p.pogonion.y - p.glabella.y }, { x: p.cervical.x - p.menton.x, y: p.cervical.y - p.menton.y }), intermediate: {} }));
  put("NFA", ["glabella", "nasion", "pronasale"], () => ({ value: angleAt(p.glabella, p.nasion, p.pronasale), intermediate: {} }));
  put("NFC", ["glabella", "pogonion", "nasion", "pronasale"], () => ({ value: angleBetween({ x: p.pogonion.x - p.glabella.x, y: p.pogonion.y - p.glabella.y }, { x: p.pronasale.x - p.nasion.x, y: p.pronasale.y - p.nasion.y }), intermediate: {} }));
  put("NMA", ["nasion", "pronasale", "pogonion"], () => ({ value: angleAt(p.nasion, p.pronasale, p.pogonion), intermediate: {} }));
  put("NLA", ["pronasale", "subnasale", "labrale_sup"], () => ({ value: angleAt(p.pronasale, p.subnasale, p.labrale_sup), intermediate: {} }));
  put("MLA", ["labrale_inf", "labiomental", "pogonion"], () => ({ value: angleAt(p.labrale_inf, p.labiomental, p.pogonion), intermediate: {} }));
  put("FCA", ["glabella", "subnasale", "pogonion"], () => ({ value: angleAt(p.glabella, p.subnasale, p.pogonion), intermediate: {} }));
  put("HANG", ["nasion", "pogonion", "labrale_sup"], () => ({ value: angleAt(p.nasion, p.pogonion, p.labrale_sup), intermediate: {} }));
  put("ZANG", ["pogonion", "labrale_sup", "labrale_inf"], () => {
    const lip = ax * p.labrale_sup.x >= ax * p.labrale_inf.x ? p.labrale_sup : p.labrale_inf;
    const zd = { x: p.pogonion.x - lip.x, y: p.pogonion.y - lip.y };
    const zm = Math.hypot(zd.x, zd.y) || 1;
    return { value: (Math.acos(clamp((zd.x * -ax) / zm, -1, 1)) * 180) / Math.PI, intermediate: { lipUsed: lip === p.labrale_sup ? 1 : 2 } };
  });
  put("LFH", ["glabella", "subnasale", "menton"], () => {
    const gm = vdist(p.glabella, p.menton) || 1;
    return { value: (vdist(p.subnasale, p.menton) / gm) * 100, intermediate: { lowerFace: vdist(p.subnasale, p.menton), glabellaMenton: gm } };
  });
  put("LCR", ["subnasale", "stomion", "menton"], () => {
    const upperLip = vdist(p.subnasale, p.stomion) || 1;
    return { value: vdist(p.stomion, p.menton) / upperLip, intermediate: { upperLip, lipChin: vdist(p.stomion, p.menton) } };
  });
  put("GOODE", ["nasion", "alar_crease", "pronasale"], () => {
    const nasalLength = dist(p.nasion, p.pronasale) || 1;
    const projection = Math.abs(signedLineDistance(p.pronasale, p.nasion, p.alar_crease));
    return { value: projection / nasalLength, intermediate: { projection, nasalLength } };
  });
  put("DORSUM", ["nasion", "rhinion", "pronasale"], () => {
    const nasalLength = dist(p.nasion, p.pronasale) || 1;
    const off = signedLineDistance(p.rhinion, p.nasion, p.pronasale);
    const anteriorSign = Math.sign(signedLineDistance({ x: p.nasion.x + ax, y: p.nasion.y }, p.nasion, p.pronasale)) || 1;
    return { value: ((off * anteriorSign) / nasalLength) * 100, intermediate: { offset: off * anteriorSign, nasalLength } };
  });
  put("CHIN_MERIDIAN", ["nasion", "pogonion", "menton"], () => {
    const nm = vdist(p.nasion, p.menton) || 1;
    return { value: ((ax * (p.pogonion.x - p.nasion.x)) / nm) * 100, intermediate: { nasionMenton: nm } };
  });
  put("MPA", ["gonion", "menton"], () => {
    const dx = ax * (p.menton.x - p.gonion.x);
    const dy = p.menton.y - p.gonion.y;
    // positive when the jaw line descends towards the chin (image y points down)
    return { value: (Math.atan2(dy, Math.max(1e-6, dx)) * 180) / Math.PI, intermediate: { run: dx, rise: dy } };
  });
  put("MFP", ["glabella", "subnasale", "menton"], () => {
    const gm = vdist(p.glabella, p.menton) || 1;
    return { value: ((ax * (p.subnasale.x - p.glabella.x)) / gm) * 100, intermediate: { offset: ax * (p.subnasale.x - p.glabella.x), glabellaMenton: gm } };
  });
  put("CHP", ["glabella", "pogonion", "menton"], () => {
    const gm = vdist(p.glabella, p.menton) || 1;
    return { value: ((ax * (p.pogonion.x - p.glabella.x)) / gm) * 100, intermediate: { offset: ax * (p.pogonion.x - p.glabella.x), glabellaMenton: gm } };
  });
  return out;
}

function scoreOf(values: RawValues): { score: number | null; scoredCount: number; per: Record<SideMeasurementId, { deviation: number | null; index: number | null; inRange: boolean | null }> } {
  let num = 0;
  let den = 0;
  let scoredCount = 0;
  const per = {} as Record<SideMeasurementId, { deviation: number | null; index: number | null; inRange: boolean | null }>;
  for (const def of SIDE_DEFINITIONS) {
    const v = values[def.id].value;
    if (!def.range || !Number.isFinite(v)) {
      per[def.id] = { deviation: null, index: null, inRange: null };
      continue;
    }
    const dev = v < def.range.min ? v - def.range.min : v > def.range.max ? v - def.range.max : 0;
    const index = plateauIndex(v, def.range, toleranceFor(def.range, def.unit));
    per[def.id] = { deviation: dev, index, inRange: dev === 0 };
    if (def.weight > 0) {
      num += def.weight * index;
      den += def.weight;
      scoredCount++;
    }
  }
  return { score: den > 0 ? num / den : null, scoredCount, per };
}

/**
 * Glabella–menton height in pixels; without a glabella from the nasion–menton height
 * (G–Me ≈ 1.1 × N–Me in adults: glabella ≈ 1–1.5 cm above the nasion, N–Me ≈ 12 cm).
 */
export function faceHeightOf(P: SidePointSet): number {
  if (P.glabella && P.menton) return Math.abs(P.glabella.y - P.menton.y);
  if (P.nasion && P.menton) return 1.1 * Math.abs(P.nasion.y - P.menton.y);
  return 0;
}

export function findIssues(P: SidePointSet, facing: "left" | "right"): SideIssue[] {
  const ax = facing === "left" ? -1 : 1;
  const issues: SideIssue[] = [];
  if (SIDE_CORE_POINTS.some((id) => !P[id])) issues.push({ code: "missingCore", severity: "error" });
  const vertical = (["glabella", "nasion", "pronasale", "subnasale", "labrale_sup", "stomion", "labrale_inf", "labiomental", "pogonion", "menton"] as SideLandmarkId[]).filter((id) => P[id]);
  for (let i = 1; i < vertical.length; i++) {
    if (P[vertical[i]]!.y <= P[vertical[i - 1]]!.y) {
      issues.push({ code: "verticalOrder", severity: "error" });
      break;
    }
  }
  const prn = P.pronasale;
  if (prn && (["subnasale", "nasion", "rhinion"] as SideLandmarkId[]).some((id) => P[id] && ax * prn.x <= ax * P[id]!.x)) issues.push({ code: "anteriorOrder", severity: "error" });
  if ((P.cervical && P.menton && P.cervical.y <= P.menton.y) || (P.neck && P.cervical && P.neck.y <= P.cervical.y)) issues.push({ code: "neckOrder", severity: "error" });
  if (P.tragion && P.glabella && P.labrale_sup && (P.tragion.y < P.glabella.y || P.tragion.y > P.labrale_sup.y)) issues.push({ code: "tragionLevel", severity: "warning" });
  if (P.gonion && P.subnasale && (P.gonion.y < P.subnasale.y || (P.cervical && P.gonion.y > P.cervical.y))) issues.push({ code: "gonionLevel", severity: "warning" });
  if (faceHeightOf(P) > 0 && faceHeightOf(P) < 150) issues.push({ code: "lowResolution", severity: "warning" });
  return issues;
}

export function analyzeSideView(rawPoints: SidePointSet, config: Partial<SideViewConfig> = {}): SideViewResult {
  const cfg = { ...SIDE_DEFAULT_CONFIG, ...config };
  const tiltDeg = referenceTilt(rawPoints, cfg.reference);
  // every measurement is taken in the anatomical frame (horizontal = reference axis)
  const points = toReferenceFrame(rawPoints, tiltDeg);
  const facing = detectFacing(points);
  const ax: 1 | -1 = facing === "left" ? -1 : 1;
  const issues = findIssues(points, facing);
  const analyzable = !issues.some((i) => i.severity === "error");
  const faceHeightPx = faceHeightOf(points);
  const placement = cfg.placement ?? "manual";
  const sigmaPx = Math.max(1.5, (placement === "manual" ? 0.004 : 0.006) * faceHeightPx);
  // the Frankfort horizontal needs the tragion; without it the image axes are used
  const kind = cfg.reference?.kind === "frankfort" && !rawPoints.tragion ? "image" : (cfg.reference?.kind ?? "image");
  const axisCode: SideAssumptionCode = kind === "frankfort" ? "frankfortHorizontal" : kind === "manual" ? "manualAxis" : "imageVertical";
  const assumptionCodes: SideAssumptionCode[] = [placement === "manual" ? "manualPlacement" : "automaticPlacement", axisCode, "proxies", "separateFromFrontal"];
  const reference: SideViewResult["reference"] = { kind, tiltDeg, ...(cfg.reference?.kind === "frankfort" && kind === "frankfort" ? { orbitale: cfg.reference.orbitale } : {}) };
  const missingPoints = SIDE_LANDMARK_ORDER.filter((id) => !points[id]);
  const provenance = { placement, ...(cfg.pointSources ? { pointSources: cfg.pointSources } : {}), missingPoints };
  const missingOf = (d: SideMeasurementDefinition) => d.landmarks.filter((id) => !points[id]);

  if (!analyzable) {
    // unsuitable placements never yield seemingly precise values
    return {
      engineVersion: SIDE_VIEW_VERSION, facing, analyzable: false,
      measurements: SIDE_DEFINITIONS.map((d) => ({ id: d.id, value: null, inRange: null, deviation: null, index: null, valueSigma: null, intermediate: {}, ...(missingOf(d).length ? { missingLandmarks: missingOf(d) } : {}) })),
      score: null, scoreSigma: null, scoredCount: 0, issues, assumptionCodes, faceHeightPx, uncertainty: { samples: 0, sigmaPx }, reference, ...provenance,
    };
  }

  const values = computeValues(points, ax);
  const scored = scoreOf(values);
  let score = scored.score;
  const { scoredCount, per } = scored;

  // Monte-Carlo placement jitter (deterministic seed) → σ per value and for the score
  let scoreSigma: number | null = null;
  const sigmas: Partial<Record<SideMeasurementId, number>> = {};
  const samples = Math.max(0, Math.floor(cfg.uncertaintySamples));
  if (samples >= 4) {
    const rng = createRng(cfg.seed);
    const scores: number[] = [];
    const series: Record<string, number[]> = {};
    for (let s = 0; s < samples; s++) {
      const jittered: SidePointSet = {};
      for (const id of SIDE_LANDMARK_ORDER) {
        // the random stream does not depend on which points exist (reproducible per point)
        const gx = gaussian(rng);
        const gy = gaussian(rng);
        const q = points[id];
        if (q) jittered[id] = { x: q.x + gx * sigmaPx, y: q.y + gy * sigmaPx };
      }
      // (jitter is isotropic, so jittering in the reference frame is equivalent to jittering the raw points)
      const v = computeValues(jittered, ax);
      const sc = scoreOf(v).score;
      if (sc != null) scores.push(sc);
      for (const d of SIDE_DEFINITIONS) if (Number.isFinite(v[d.id].value)) (series[d.id] ??= []).push(v[d.id].value);
    }
    scoreSigma = scores.length > 1 ? stddev(scores) : null;
    for (const d of SIDE_DEFINITIONS) if (series[d.id]?.length) sigmas[d.id] = stddev(series[d.id]);
  }

  const measurements: SideMeasurementResult[] = SIDE_DEFINITIONS.map((d) => {
    const v = values[d.id].value;
    const sig = sigmas[d.id];
    const missing = missingOf(d);
    // engine 2.0: expectation of the index over the placement uncertainty
    const index = d.range && Number.isFinite(v) && sig ? expectedIndex(v, sig, d.range, toleranceFor(d.range, d.unit)) : per[d.id].index;
    return {
      id: d.id,
      value: Number.isFinite(v) ? v : null,
      inRange: per[d.id].inRange,
      deviation: per[d.id].deviation,
      index,
      valueSigma: Number.isFinite(v) ? (sig ?? null) : null,
      intermediate: values[d.id].intermediate,
      ...(missing.length ? { missingLandmarks: missing } : {}),
    };
  });
  // the score follows the uncertainty-aware indices
  {
    let num = 0;
    let den = 0;
    for (const d of SIDE_DEFINITIONS) {
      const m = measurements.find((x) => x.id === d.id);
      if (d.weight > 0 && m?.index != null) {
        num += d.weight * m.index;
        den += d.weight;
      }
    }
    if (den > 0) score = num / den;
  }

  return { engineVersion: SIDE_VIEW_VERSION, facing, analyzable: true, measurements, score, scoreSigma, scoredCount, issues, assumptionCodes, faceHeightPx, uncertainty: { samples: samples >= 4 ? samples : 0, sigmaPx }, reference, ...provenance };
}

export function formatSideValue(id: SideMeasurementId, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const unit = SIDE_BY_ID[id].unit;
  if (unit === "degrees") return `${v.toFixed(1)}°`;
  if (unit === "percent") return `${v.toFixed(1)} %`;
  return v.toFixed(2);
}

export function formatSideRange(id: SideMeasurementId): string {
  const def = SIDE_BY_ID[id];
  if (!def.range) return "—";
  const f = (v: number) => (def.unit === "ratio" ? v.toFixed(2) : v.toFixed(0));
  const suffix = def.unit === "degrees" ? "°" : def.unit === "percent" ? " %" : "";
  if (def.range.min === def.range.max) return `≈ ${f(def.range.min)}${suffix}`;
  return `${f(def.range.min)}–${f(def.range.max)}${suffix}`;
}
