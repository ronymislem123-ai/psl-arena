/**
 * Appearance measures for the four "visual" rubric criteria (eye shape, lip shape,
 * cheekbone projection, jawline definition) — measured, shown, NOT scored.
 *
 * No study gives reference ranges for these quantities, so turning them into a
 * score would invent a norm. They are reported as descriptive numbers next to the
 * criterion (the criterion itself is scored only by a vision model or, clearly
 * labelled, by the user's self-assessment).
 *
 * Geometry (from the pose-normalised mesh): eyelid balance and lid-apex position,
 * Cupid's-bow depth and vermilion fullness. Image (computed in the browser from the
 * photo with `measureImageAppearance`): edge contrast along the lower jaw border and
 * the light/shadow contrast between the zygomatic area and the cheek hollow below
 * it. The image measures depend on lighting, make-up and beard — they describe this
 * photo, not the anatomy.
 */
import type { CriterionId } from "./psl/rubric";
import type { Point } from "./types";

export type AppearanceId = "EYE_LID_BALANCE" | "EYE_LID_APEX" | "LIP_BOW" | "LIP_FULLNESS" | "JAW_EDGE" | "MALAR_SHADE";

export interface AppearanceMeasure {
  id: AppearanceId;
  criterion: CriterionId;
  /** null = not available (e.g. no photo pixels, closed eyes) */
  value: number | null;
  unit: "percent" | "ratio";
  basis: "geometry" | "image";
}

/** Image-based inputs, measured in the browser from the photo (raw mesh + pixels). */
export interface AppearanceImageInput {
  /** mean luminance step across the lower jaw border, in units of the face's luminance SD */
  jawEdgeContrast: number | null;
  /** (zygomatic area − cheek hollow) mean luminance, in units of the face's luminance SD */
  malarContrast: number | null;
}

export const APPEARANCE_CRITERION: Record<AppearanceId, CriterionId> = {
  EYE_LID_BALANCE: "eyeShape",
  EYE_LID_APEX: "eyeShape",
  LIP_BOW: "lipShape",
  LIP_FULLNESS: "lipShape",
  JAW_EDGE: "jawlineDefinition",
  MALAR_SHADE: "cheekboneProjection",
};

const EYES = {
  R: { medial: 133, lateral: 33, upper: [246, 161, 160, 159, 158, 157, 173], lower: [7, 163, 144, 145, 153, 154, 155] },
  L: { medial: 362, lateral: 263, upper: [466, 388, 387, 386, 385, 384, 398], lower: [249, 390, 373, 374, 380, 381, 382] },
} as const;

/** Mesh regions (verified against the canonical face: mirror pairs, below-eye zygoma vs. lateral cheek hollow). */
export const MALAR = { R: [116, 117, 118, 123, 50, 101], L: [345, 346, 347, 352, 280, 330] } as const;
export const SUBMALAR = { R: [187, 147, 213, 192, 207], L: [411, 376, 433, 416, 427] } as const;
export const JAW = { R: [172, 136, 150, 149, 176, 148], L: [397, 365, 379, 378, 400, 377] } as const;

const signedDist = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return ((p.x - a.x) * dy - (p.y - a.y) * dx) / (Math.hypot(dx, dy) || 1);
};

function eyeShape(m: Point[]): { balance: number; apex: number } | null {
  const per: { balance: number; apex: number }[] = [];
  for (const e of [EYES.R, EYES.L]) {
    const a = m[e.medial];
    const b = m[e.lateral];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (!(len > 0)) return null;
    // distances from the canthal line; the side of the upper lid is "above"
    const ref = Math.sign(signedDist({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - len }, a, b)) || 1;
    let up = 0;
    let apexT = 0.5;
    for (const i of e.upper) {
      const d = ref * signedDist(m[i], a, b);
      if (d > up) {
        up = d;
        apexT = ((m[i].x - a.x) * (b.x - a.x) + (m[i].y - a.y) * (b.y - a.y)) / (len * len);
      }
    }
    let low = 0;
    for (const i of e.lower) low = Math.max(low, -ref * signedDist(m[i], a, b));
    if (up + low <= 0) return null;
    per.push({ balance: (up / (up + low)) * 100, apex: Math.max(0, Math.min(1, apexT)) * 100 });
  }
  return { balance: (per[0].balance + per[1].balance) / 2, apex: (per[0].apex + per[1].apex) / 2 };
}

function lipShape(m: Point[]): { bow: number; fullness: number } | null {
  const peakY = (m[37].y + m[267].y) / 2;
  const upperH = m[13].y - peakY;
  const lowerFace = m[152].y - m[2].y;
  const vermilion = m[17].y - m[0].y;
  if (!(upperH > 0) || !(lowerFace > 0) || !(vermilion > 0)) return null;
  return { bow: ((m[0].y - peakY) / upperH) * 100, fullness: (vermilion / lowerFace) * 100 };
}

/** All appearance measures (geometry from the aligned mesh, image parts as measured in the browser). */
export function computeAppearance(aligned: Point[] | undefined, image?: AppearanceImageInput | null, opts: { eyesOpen?: boolean } = {}): AppearanceMeasure[] {
  const ok = !!aligned && aligned.length >= 468;
  const eye = ok && opts.eyesOpen !== false ? eyeShape(aligned!) : null;
  const lip = ok ? lipShape(aligned!) : null;
  const fin = (v: number | null | undefined) => (v != null && Number.isFinite(v) ? v : null);
  return [
    { id: "EYE_LID_BALANCE", criterion: "eyeShape", value: fin(eye?.balance), unit: "percent", basis: "geometry" },
    { id: "EYE_LID_APEX", criterion: "eyeShape", value: fin(eye?.apex), unit: "percent", basis: "geometry" },
    { id: "LIP_BOW", criterion: "lipShape", value: fin(lip?.bow), unit: "percent", basis: "geometry" },
    { id: "LIP_FULLNESS", criterion: "lipShape", value: fin(lip?.fullness), unit: "percent", basis: "geometry" },
    { id: "JAW_EDGE", criterion: "jawlineDefinition", value: fin(image?.jawEdgeContrast), unit: "ratio", basis: "image" },
    { id: "MALAR_SHADE", criterion: "cheekboneProjection", value: fin(image?.malarContrast), unit: "ratio", basis: "image" },
  ];
}

/** Luminance (0–255) at an image position, or null outside the image. */
export type LuminanceSampler = (x: number, y: number) => number | null;

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/**
 * Image measures from the raw (image-space) mesh and a luminance sampler. Pure,
 * so it is unit-tested with synthetic images; the browser passes a canvas sampler.
 */
export function measureImageAppearance(mesh: Point[], lum: LuminanceSampler): AppearanceImageInput {
  const ipd = Math.hypot(mesh[468].x - mesh[473].x, mesh[468].y - mesh[473].y);
  if (!(ipd > 0)) return { jawEdgeContrast: null, malarContrast: null };
  const r = Math.max(1, ipd * 0.06);
  // patch mean around a point (disc of radius r, coarse grid)
  const patch = (p: Point, rad = r) => {
    const vals: number[] = [];
    const step = Math.max(1, rad / 3);
    for (let dy = -rad; dy <= rad; dy += step) for (let dx = -rad; dx <= rad; dx += step) {
      if (dx * dx + dy * dy > rad * rad) continue;
      const v = lum(p.x + dx, p.y + dy);
      if (v != null) vals.push(v);
    }
    return vals.length ? mean(vals) : null;
  };
  // face luminance spread: SD of patch means over the whole mesh (lighting-normalised contrast unit)
  const facePatches: number[] = [];
  for (let i = 0; i < 468; i += 7) {
    const v = patch(mesh[i], r / 2);
    if (v != null) facePatches.push(v);
  }
  if (facePatches.length < 20) return { jawEdgeContrast: null, malarContrast: null };
  const mu = mean(facePatches);
  const sd = Math.sqrt(mean(facePatches.map((v) => (v - mu) ** 2)));
  if (!(sd > 1)) return { jawEdgeContrast: null, malarContrast: null };

  // jaw border: luminance just inside vs. just outside the face contour, along the outward normal
  const centre = mesh[1];
  const steps: number[] = [];
  for (const side of [JAW.R, JAW.L]) {
    for (let k = 0; k < side.length; k++) {
      const p = mesh[side[k]];
      const prev = mesh[side[Math.max(0, k - 1)]];
      const next = mesh[side[Math.min(side.length - 1, k + 1)]];
      let nx = -(next.y - prev.y);
      let ny = next.x - prev.x;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl;
      ny /= nl;
      if ((p.x - centre.x) * nx + (p.y - centre.y) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const d = ipd * 0.12;
      const inside = patch({ x: p.x - nx * d * 0.6, y: p.y - ny * d * 0.6 }, r / 2);
      const outside = patch({ x: p.x + nx * d * 0.6, y: p.y + ny * d * 0.6 }, r / 2);
      if (inside != null && outside != null) steps.push(Math.abs(inside - outside));
    }
  }
  const jaw = steps.length >= 6 ? mean(steps) / sd : null;

  // cheekbone: zygomatic area brighter than the hollow below it (under light from above/front)
  const region = (ids: readonly number[]) => {
    const v = ids.map((i) => patch(mesh[i], r / 2)).filter((x): x is number => x != null);
    return v.length ? mean(v) : null;
  };
  const diffs: number[] = [];
  for (const [mal, sub] of [[MALAR.R, SUBMALAR.R], [MALAR.L, SUBMALAR.L]] as const) {
    const a = region(mal);
    const b = region(sub);
    if (a != null && b != null) diffs.push(a - b);
  }
  const malar = diffs.length ? mean(diffs) / sd : null;
  return { jawEdgeContrast: jaw, malarContrast: malar };
}
