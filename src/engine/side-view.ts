/**
 * Side-view (profile) analysis from manually placed soft-tissue landmarks.
 *
 * Landmark models are unreliable on true profiles, so the user places 16 standard
 * points under guidance. All angles are scale-free; ratios use distances between
 * placed points. The image vertical is taken as the true vertical (natural head
 * position assumed) — this is stated in every result.
 *
 * Reference ranges: GA uses the range of the provided guide (older reference
 * 115–130°). Every other range is a published literature norm and is labelled as
 * such; descriptive measures carry no target and are never scored. Nothing here
 * feeds into the 42-ratio frontal score.
 */
import { angleAt, angleBetween, clamp, createRng, dist, gaussian, stddev } from "./geometry";
import { indexFromDeviation } from "./scoring/tiers";
import type { Point } from "./types";

export const SIDE_VIEW_VERSION = "1.0.0";

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
  | "CHIN_MERIDIAN";

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
const LIM_VERTICAL = "Uses the image vertical as the true vertical; a tilted head shifts the value.";
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
    limitations: ["Merrifield uses the Frankfort horizontal; the image horizontal is used instead.", LIM_VERTICAL, LIM_MANUAL],
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
}

export type SideIssueCode = "verticalOrder" | "anteriorOrder" | "neckOrder" | "tragionLevel" | "gonionLevel" | "lowResolution";

export interface SideIssue {
  code: SideIssueCode;
  severity: "error" | "warning";
}

export interface SideViewConfig {
  uncertaintySamples: number;
  seed: number;
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
}

export type SideAssumptionCode = "manualPlacement" | "imageVertical" | "proxies" | "separateFromFrontal";

export function toleranceFor(range: { min: number; max: number }): number {
  const target = (range.min + range.max) / 2;
  return Math.max(0.1 * Math.abs(target), 0.5 * (range.max - range.min));
}

/** Perpendicular distance of p from the infinite line a–b, signed by side. */
function signedLineDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return ((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

export function detectFacing(points: Pick<SidePoints, "pronasale" | "tragion">): "left" | "right" {
  return points.pronasale.x < points.tragion.x ? "left" : "right";
}

type RawValues = Record<SideMeasurementId, { value: number; intermediate: Record<string, number> }>;

/** All raw values for one point set. `ax` is the anterior unit direction along x (−1 faces left). */
function computeValues(P: SidePoints, ax: 1 | -1): RawValues {
  const vdist = (a: Point, b: Point) => Math.abs(a.y - b.y);
  const lip = ax * P.labrale_sup.x >= ax * P.labrale_inf.x ? P.labrale_sup : P.labrale_inf;
  const zd = { x: P.pogonion.x - lip.x, y: P.pogonion.y - lip.y };
  const zm = Math.hypot(zd.x, zd.y) || 1;
  const zAngle = (Math.acos(clamp((zd.x * -ax) / zm, -1, 1)) * 180) / Math.PI;
  const gm = vdist(P.glabella, P.menton) || 1;
  const nasalLength = dist(P.nasion, P.pronasale) || 1;
  const projection = Math.abs(signedLineDistance(P.pronasale, P.nasion, P.alar_crease));
  const off = signedLineDistance(P.rhinion, P.nasion, P.pronasale);
  const anteriorSign = Math.sign(signedLineDistance({ x: P.nasion.x + ax, y: P.nasion.y }, P.nasion, P.pronasale)) || 1;
  const upperLip = vdist(P.subnasale, P.stomion) || 1;
  const nm = vdist(P.nasion, P.menton) || 1;
  return {
    GA: { value: angleAt(P.tragion, P.gonion, P.menton), intermediate: {} },
    CMA: { value: angleAt(P.menton, P.cervical, P.neck), intermediate: {} },
    MCA: { value: angleBetween({ x: P.pogonion.x - P.glabella.x, y: P.pogonion.y - P.glabella.y }, { x: P.cervical.x - P.menton.x, y: P.cervical.y - P.menton.y }), intermediate: {} },
    NFA: { value: angleAt(P.glabella, P.nasion, P.pronasale), intermediate: {} },
    NFC: { value: angleBetween({ x: P.pogonion.x - P.glabella.x, y: P.pogonion.y - P.glabella.y }, { x: P.pronasale.x - P.nasion.x, y: P.pronasale.y - P.nasion.y }), intermediate: {} },
    NMA: { value: angleAt(P.nasion, P.pronasale, P.pogonion), intermediate: {} },
    NLA: { value: angleAt(P.pronasale, P.subnasale, P.labrale_sup), intermediate: {} },
    MLA: { value: angleAt(P.labrale_inf, P.labiomental, P.pogonion), intermediate: {} },
    FCA: { value: angleAt(P.glabella, P.subnasale, P.pogonion), intermediate: {} },
    HANG: { value: angleAt(P.nasion, P.pogonion, P.labrale_sup), intermediate: {} },
    ZANG: { value: zAngle, intermediate: { lipUsed: lip === P.labrale_sup ? 1 : 2 } },
    LFH: { value: (vdist(P.subnasale, P.menton) / gm) * 100, intermediate: { lowerFace: vdist(P.subnasale, P.menton), glabellaMenton: gm } },
    LCR: { value: vdist(P.stomion, P.menton) / upperLip, intermediate: { upperLip, lipChin: vdist(P.stomion, P.menton) } },
    GOODE: { value: projection / nasalLength, intermediate: { projection, nasalLength } },
    DORSUM: { value: ((off * anteriorSign) / nasalLength) * 100, intermediate: { offset: off * anteriorSign, nasalLength } },
    CHIN_MERIDIAN: { value: ((ax * (P.pogonion.x - P.nasion.x)) / nm) * 100, intermediate: { nasionMenton: nm } },
  };
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
    const index = indexFromDeviation(Math.abs(dev), toleranceFor(def.range));
    per[def.id] = { deviation: dev, index, inRange: dev === 0 };
    if (def.weight > 0) {
      num += def.weight * index;
      den += def.weight;
      scoredCount++;
    }
  }
  return { score: den > 0 ? num / den : null, scoredCount, per };
}

export function findIssues(P: SidePoints, facing: "left" | "right"): SideIssue[] {
  const ax = facing === "left" ? -1 : 1;
  const issues: SideIssue[] = [];
  const vertical: SideLandmarkId[] = ["glabella", "nasion", "pronasale", "subnasale", "labrale_sup", "stomion", "labrale_inf", "labiomental", "pogonion", "menton"];
  for (let i = 1; i < vertical.length; i++) {
    if (P[vertical[i]].y <= P[vertical[i - 1]].y) {
      issues.push({ code: "verticalOrder", severity: "error" });
      break;
    }
  }
  if (ax * P.pronasale.x <= ax * P.subnasale.x || ax * P.pronasale.x <= ax * P.nasion.x || ax * P.pronasale.x <= ax * P.rhinion.x) issues.push({ code: "anteriorOrder", severity: "error" });
  if (P.cervical.y <= P.menton.y || P.neck.y <= P.cervical.y) issues.push({ code: "neckOrder", severity: "error" });
  if (P.tragion.y < P.glabella.y || P.tragion.y > P.labrale_sup.y) issues.push({ code: "tragionLevel", severity: "warning" });
  if (P.gonion.y < P.subnasale.y || P.gonion.y > P.cervical.y) issues.push({ code: "gonionLevel", severity: "warning" });
  if (Math.abs(P.glabella.y - P.menton.y) < 150) issues.push({ code: "lowResolution", severity: "warning" });
  return issues;
}

export function analyzeSideView(points: SidePoints, config: Partial<SideViewConfig> = {}): SideViewResult {
  const cfg = { ...SIDE_DEFAULT_CONFIG, ...config };
  const facing = detectFacing(points);
  const ax: 1 | -1 = facing === "left" ? -1 : 1;
  const issues = findIssues(points, facing);
  const analyzable = !issues.some((i) => i.severity === "error");
  const faceHeightPx = Math.abs(points.glabella.y - points.menton.y);
  const sigmaPx = Math.max(1.5, 0.004 * faceHeightPx);
  const assumptionCodes: SideAssumptionCode[] = ["manualPlacement", "imageVertical", "proxies", "separateFromFrontal"];

  if (!analyzable) {
    // unsuitable placements never yield seemingly precise values
    return {
      engineVersion: SIDE_VIEW_VERSION, facing, analyzable: false,
      measurements: SIDE_DEFINITIONS.map((d) => ({ id: d.id, value: null, inRange: null, deviation: null, index: null, valueSigma: null, intermediate: {} })),
      score: null, scoreSigma: null, scoredCount: 0, issues, assumptionCodes, faceHeightPx, uncertainty: { samples: 0, sigmaPx },
    };
  }

  const values = computeValues(points, ax);
  const { score, scoredCount, per } = scoreOf(values);

  // Monte-Carlo placement jitter (deterministic seed) → σ per value and for the score
  let scoreSigma: number | null = null;
  const sigmas: Partial<Record<SideMeasurementId, number>> = {};
  const samples = Math.max(0, Math.floor(cfg.uncertaintySamples));
  if (samples >= 4) {
    const rng = createRng(cfg.seed);
    const scores: number[] = [];
    const series: Record<string, number[]> = {};
    for (let s = 0; s < samples; s++) {
      const jittered = {} as SidePoints;
      for (const id of SIDE_LANDMARK_ORDER) jittered[id] = { x: points[id].x + gaussian(rng) * sigmaPx, y: points[id].y + gaussian(rng) * sigmaPx };
      const v = computeValues(jittered, ax);
      const sc = scoreOf(v).score;
      if (sc != null) scores.push(sc);
      for (const d of SIDE_DEFINITIONS) (series[d.id] ??= []).push(v[d.id].value);
    }
    scoreSigma = scores.length > 1 ? stddev(scores) : null;
    for (const d of SIDE_DEFINITIONS) sigmas[d.id] = stddev(series[d.id] ?? []);
  }

  const measurements: SideMeasurementResult[] = SIDE_DEFINITIONS.map((d) => ({
    id: d.id,
    value: Number.isFinite(values[d.id].value) ? values[d.id].value : null,
    inRange: per[d.id].inRange,
    deviation: per[d.id].deviation,
    index: per[d.id].index,
    valueSigma: sigmas[d.id] ?? null,
    intermediate: values[d.id].intermediate,
  }));

  return { engineVersion: SIDE_VIEW_VERSION, facing, analyzable: true, measurements, score, scoreSigma, scoredCount, issues, assumptionCodes, faceHeightPx, uncertainty: { samples: samples >= 4 ? samples : 0, sigmaPx } };
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
