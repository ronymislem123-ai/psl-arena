/**
 * Automatic profile landmarks from a person-segmentation mask (engine side-view 2.0).
 *
 * Face-landmark models do not work on true profiles (the MediaPipe face detector
 * finds no face beyond ≈ 60–70° of yaw), but the soft-tissue midline points of a
 * lateral photo all lie on the silhouette: glabella, nasion, nasal tip, subnasale,
 * lips, chin, menton, the cervical point and the front of the neck. This module
 * traces the outer contour of the segmented person, follows its anterior part from
 * the top of the head down the neck and defines each point geometrically:
 *
 * - extreme points of the anterior coordinate (pronasale, labrale sup./inf., pogonion);
 * - the deepest point of a concavity, measured from the chord of its neighbours
 *   (nasion between glabella and nasal tip, subnasale, stomion, labiomental fold,
 *   cervical point);
 * - the most convex point of the chin between pogonion and cervical point (menton).
 *
 * Points that are not on the silhouette (alar crease, tragion, orbitale) are not
 * guessed. The soft-tissue gonion is derived from the face-skin / body-skin border
 * of the multiclass segmentation only when that border has a plausible jaw corner;
 * otherwise it is reported as not determinable. Everything here is pure TypeScript
 * (no DOM), so it runs in the browser, on the server and in unit tests.
 */
import type { Point } from "./types";
import type { SideLandmarkId, SidePointSet, SidePointSource } from "./side-view";

export const SIDE_AUTO_VERSION = "1.0.0";

/** Multiclass selfie segmenter labels (MediaPipe selfie_multiclass_256x256). */
export const SEG_LABELS = { background: 0, hair: 1, bodySkin: 2, faceSkin: 3, clothes: 4, others: 5 } as const;

export interface ProfileMaskInput {
  /** mask size (pixels) */
  width: number;
  height: number;
  /** foreground probability 0–1 per pixel (1 − background confidence), row-major */
  foreground: Float32Array | number[];
  /** optional class label per pixel (SEG_LABELS) */
  categories?: Uint8Array | number[];
  /** mask pixel → image pixel: image = offset + mask · scale */
  scale?: number;
  offset?: Point;
}

export type AutoIssueCode =
  | "noPerson"
  | "personCut"
  | "notProfile"
  | "noNose"
  | "lowResolution"
  | "chinNotFound"
  | "neckNotFound"
  | "lipsMerged"
  | "gonionNotFound"
  | "offContourPoints";

export interface AutoIssue {
  code: AutoIssueCode;
  severity: "error" | "warning" | "info";
}

export interface AutoProfileResult {
  version: string;
  ok: boolean;
  facing: "left" | "right" | null;
  points: SidePointSet;
  sources: Partial<Record<SideLandmarkId, SidePointSource>>;
  /** 0–1 per point: how distinct the defining feature was */
  confidence: Partial<Record<SideLandmarkId, number>>;
  issues: AutoIssue[];
  /** anterior silhouette (image coordinates, thinned) for display */
  contour: Point[];
  /** image pixels per estimated centimetre (scale of all search windows; from the head length and the vertex → nasal tip height) */
  scalePx: number | null;
  /** intermediate values for tests and troubleshooting */
  diag?: Record<string, number | number[] | string>;
}

// ------------------------------------------------------------------ mask helpers

/** Largest 4-connected foreground component as a 0/1 mask. */
export function largestComponent(bin: Uint8Array, w: number, h: number): { mask: Uint8Array; size: number } {
  const label = new Int32Array(w * h);
  let best = 0;
  let bestSize = 0;
  let next = 1;
  const stack = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (!bin[i] || label[i]) continue;
    let sp = 0;
    stack[sp++] = i;
    label[i] = next;
    let size = 0;
    while (sp) {
      const j = stack[--sp];
      size++;
      const x = j % w;
      const y = (j - x) / w;
      if (x > 0 && bin[j - 1] && !label[j - 1]) { label[j - 1] = next; stack[sp++] = j - 1; }
      if (x < w - 1 && bin[j + 1] && !label[j + 1]) { label[j + 1] = next; stack[sp++] = j + 1; }
      if (y > 0 && bin[j - w] && !label[j - w]) { label[j - w] = next; stack[sp++] = j - w; }
      if (y < h - 1 && bin[j + w] && !label[j + w]) { label[j + w] = next; stack[sp++] = j + w; }
    }
    if (size > bestSize) {
      bestSize = size;
      best = next;
    }
    next++;
  }
  const mask = new Uint8Array(w * h);
  if (best) for (let i = 0; i < w * h; i++) mask[i] = label[i] === best ? 1 : 0;
  return { mask, size: bestSize };
}

// 8-neighbourhood, clockwise starting east (image y points down)
const DX = [1, 1, 0, -1, -1, -1, 0, 1];
const DY = [0, 1, 1, 1, 0, -1, -1, -1];

/** Outer boundary of a 0/1 mask (Moore-neighbour tracing), as ordered pixel centres. */
export function traceBoundary(mask: Uint8Array, w: number, h: number): Point[] {
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1;
  let sx = -1;
  let sy = -1;
  outer: for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { sx = x; sy = y; break outer; }
  if (sx < 0) return [];
  const out: Point[] = [{ x: sx, y: sy }];
  // the start pixel was reached from the west (scan order): that neighbour is background
  let cx = sx;
  let cy = sy;
  let bx = sx - 1;
  let by = sy;
  const startB = { x: bx, y: by };
  const maxLen = 8 * (w + h) * 4;
  for (let n = 0; n < maxLen; n++) {
    let dB = 0;
    for (let d = 0; d < 8; d++) if (cx + DX[d] === bx && cy + DY[d] === by) { dB = d; break; }
    let found = false;
    for (let k = 1; k <= 8; k++) {
      const d = (dB + k) % 8;
      const nx = cx + DX[d];
      const ny = cy + DY[d];
      if (at(nx, ny)) {
        const pd = (d + 7) % 8;
        bx = cx + DX[pd];
        by = cy + DY[pd];
        cx = nx;
        cy = ny;
        found = true;
        break;
      }
    }
    if (!found) break; // isolated pixel
    // Jacob's stopping criterion: back at the start, entered the same way
    if (cx === sx && cy === sy && bx === startB.x && by === startB.y) break;
    if (cx === sx && cy === sy && out.length > 2 && n > 4 * (w + h) * 2) break;
    out.push({ x: cx, y: cy });
  }
  return out;
}

/** Gaussian smoothing of an open polyline (σ in samples), edges clamped. */
export function smoothPolyline(pts: Point[], sigma: number): Point[] {
  if (sigma < 0.5 || pts.length < 3) return pts.map((p) => ({ ...p }));
  const r = Math.ceil(3 * sigma);
  const wts: number[] = [];
  for (let k = -r; k <= r; k++) wts.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  return pts.map((_, i) => {
    let x = 0;
    let y = 0;
    let s = 0;
    for (let k = -r; k <= r; k++) {
      const j = Math.min(pts.length - 1, Math.max(0, i + k));
      const wk = wts[k + r];
      x += pts[j].x * wk;
      y += pts[j].y * wk;
      s += wk;
    }
    return { x: x / s, y: y / s };
  });
}

/** Resamples a polyline at a fixed arc-length step. */
export function resample(pts: Point[], step: number): Point[] {
  if (pts.length < 2) return pts.slice();
  const out: Point[] = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    let t = step - carry;
    while (t <= seg) {
      out.push({ x: a.x + ((b.x - a.x) * t) / seg, y: a.y + ((b.y - a.y) * t) / seg });
      t += step;
    }
    carry = seg - (t - step);
  }
  return out;
}

/** Signed distance of p from the line a→b; positive on the side of `side` (a direction unit vector test point). */
function lineDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return ((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

// ------------------------------------------------------------------ detection

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Index in [i0, i1] whose point lies deepest behind the chord arc[i0]→arc[i1]
 * (`sign` = +1: posterior side for concavities; −1: anterior side for convexities).
 */
function deepest(arc: Point[], i0: number, i1: number, ax: 1 | -1, sign: 1 | -1): { i: number; depth: number } {
  const a = arc[i0];
  const b = arc[i1];
  // reference: a point posterior of the chord's midpoint defines the positive side
  const mid = { x: (a.x + b.x) / 2 - ax, y: (a.y + b.y) / 2 };
  const ref = Math.sign(lineDistance(mid, a, b)) || 1;
  let best = -1;
  let bestD = -Infinity;
  for (let i = i0 + 1; i < i1; i++) {
    const d = sign * ref * lineDistance(arc[i], a, b);
    if (d > bestD) {
      bestD = d;
      best = i;
    }
  }
  return { i: best, depth: bestD };
}

/** Local maxima of v[i] in [i0, i1] with a prominence ≥ minProm (relative to the lower neighbouring minimum). */
function localMaxima(v: number[], i0: number, i1: number, minProm: number): number[] {
  const out: number[] = [];
  for (let i = Math.max(i0 + 1, 1); i < Math.min(i1, v.length - 1); i++) {
    if (!(v[i] >= v[i - 1] && v[i] > v[i + 1])) continue;
    // prominence: descend left and right until a higher value or the range end
    let lmin = v[i];
    for (let j = i - 1; j >= i0; j--) {
      if (v[j] > v[i]) break;
      lmin = Math.min(lmin, v[j]);
    }
    let rmin = v[i];
    for (let j = i + 1; j <= i1; j++) {
      if (v[j] > v[i]) break;
      rmin = Math.min(rmin, v[j]);
    }
    if (v[i] - Math.max(lmin, rmin) >= minProm) out.push(i);
  }
  return out;
}

function argBest(i0: number, i1: number, f: (i: number) => number): number {
  let best = i0;
  let bv = -Infinity;
  for (let i = i0; i <= i1; i++) {
    const v = f(i);
    if (v > bv) {
      bv = v;
      best = i;
    }
  }
  return best;
}

/** Facing from the class map: face skin lies in front of the hair / head centre. */
function facingFromCategories(cat: ArrayLike<number>, mask: Uint8Array, w: number, y0: number, y1: number): "left" | "right" | null {
  let fx = 0;
  let fn = 0;
  let ax = 0;
  let an = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!mask[i]) continue;
      ax += x;
      an++;
      if (cat[i] === SEG_LABELS.faceSkin) {
        fx += x;
        fn++;
      }
    }
  }
  if (fn < 30 || an < 100) return null;
  const d = fx / fn - ax / an;
  if (Math.abs(d) < 0.02 * w) return null;
  return d > 0 ? "right" : "left";
}

/**
 * Facing from the silhouette alone: the face side carries the sharpest protrusion (the
 * nasal tip stands out against the rows above and below it); the back of the head is
 * smooth. The ear lies inside the silhouette on real photos.
 */
function facingFromShape(mask: Uint8Array, w: number, y0: number, y1: number): "left" | "right" {
  const left: number[] = [];
  const right: number[] = [];
  for (let y = y0; y < y1; y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (l < 0) l = x; r = x; }
    left.push(l >= 0 ? -l : NaN);
    right.push(r >= 0 ? r : NaN);
  }
  const k0 = Math.max(2, Math.round(0.03 * (y1 - y0)));
  const k1 = Math.max(k0 + 2, Math.round(0.1 * (y1 - y0)));
  const sharp = (v: number[]) => {
    let best = 0;
    for (let i = k1; i < v.length - k1; i++) {
      if (!Number.isFinite(v[i])) continue;
      let a = 0, na = 0, b = 0, nb = 0;
      for (let j = k0; j <= k1; j++) {
        if (Number.isFinite(v[i - j])) { a += v[i - j]; na++; }
        if (Number.isFinite(v[i + j])) { b += v[i + j]; nb++; }
      }
      if (!na || !nb) continue;
      best = Math.max(best, Math.min(v[i] - a / na, v[i] - b / nb));
    }
    return best;
  };
  return sharp(right) >= sharp(left) ? "right" : "left";
}

/**
 * Detects the profile landmarks. Returns `ok: false` with error issues when the image
 * is not a usable profile (no person, nose not found, chin not found …).
 */
export function detectProfileLandmarks(input: ProfileMaskInput): AutoProfileResult {
  const { width: w, height: h } = input;
  const scale = input.scale ?? 1;
  const off = input.offset ?? { x: 0, y: 0 };
  const toImg = (p: Point): Point => ({ x: off.x + (p.x + 0.5) * scale, y: off.y + (p.y + 0.5) * scale });
  const issues: AutoIssue[] = [];
  const diag: Record<string, number | number[] | string> = {};
  const fail = (code: AutoIssueCode, extra: Partial<AutoProfileResult> = {}): AutoProfileResult => ({
    version: SIDE_AUTO_VERSION, ok: false, facing: null, points: {}, sources: {}, confidence: {}, issues: [...issues, { code, severity: "error" }], contour: [], scalePx: null, diag, ...extra,
  });

  const bin = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) bin[i] = (input.foreground[i] ?? 0) >= 0.5 ? 1 : 0;
  const { mask, size } = largestComponent(bin, w, h);
  if (size < 0.02 * w * h) return fail("noPerson");

  // vertical extent of the person
  let yTop = h;
  let yBot = -1;
  for (let y = 0; y < h && yTop === h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { yTop = y; break; }
  for (let y = h - 1; y >= 0 && yBot < 0; y--) for (let x = 0; x < w; x++) if (mask[y * w + x]) { yBot = y; break; }
  if (yTop <= 1) issues.push({ code: "personCut", severity: "warning" }); // top of the head cut off: scale windows less reliable

  // ---- scale from the silhouette: head length (max. width of the head above the neck)
  // Row widths; the neck is the first pronounced narrowing below the widest head row.
  const span = yBot - yTop;
  const rowW = new Float32Array(h);
  for (let y = yTop; y <= yBot; y++) {
    let l = -1;
    let r = -1;
    for (let x = 0; x < w; x++) if (mask[y * w + x]) { if (l < 0) l = x; r = x; }
    rowW[y] = l >= 0 ? r - l + 1 : 0;
  }
  let headMax = 0;
  let yHeadMax = yTop;
  let yNeck = yBot;
  let neckW = Infinity;
  for (let y = yTop; y <= yBot; y++) {
    if (rowW[y] > headMax && neckW === Infinity) { headMax = rowW[y]; yHeadMax = y; }
    // (ignore narrow rows right below a provisional maximum, e.g. at the top of the hair)
    if (headMax > 0 && rowW[y] < 0.78 * headMax && y > yHeadMax + 0.2 * headMax) {
      // inside the narrowing: track the narrowest row until the width grows again (shoulders)
      if (rowW[y] < neckW) { neckW = rowW[y]; yNeck = y; }
      else if (rowW[y] > 1.25 * neckW) break;
    }
  }
  const cutSide = (() => {
    // head touching the left/right image border → its length is underestimated
    for (let y = yTop; y <= yNeck; y++) if (mask[y * w] || mask[y * w + w - 1]) return true;
    return false;
  })();
  // adult head length glabella–opisthocranion ≈ 19–20 cm; with the nose and hair ≈ 21 cm
  let cm = headMax / 21;
  Object.assign(diag, { headMax, yHeadMax, yNeck, cm, yTop, yBot });
  if (cutSide) issues.push({ code: "personCut", severity: "warning" });
  if (cm * 16 * scale < 150) issues.push({ code: "lowResolution", severity: "warning" });
  const yFaceEnd = yNeck > yHeadMax ? yNeck : Math.min(yBot, yTop + 0.75 * span);

  const cat = input.categories;
  const facing = (cat && facingFromCategories(cat, mask, w, yTop, Math.round(yFaceEnd))) || facingFromShape(mask, w, yTop, Math.round(yFaceEnd));
  const ax: 1 | -1 = facing === "left" ? -1 : 1;

  // ---- anterior arc: from the top of the head forward and down along the boundary
  const ring = traceBoundary(mask, w, h);
  if (ring.length < 50) return fail("noPerson");
  let iTop = 0;
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i];
    const q = ring[iTop];
    if (p.y < q.y || (p.y === q.y && ax * p.x > ax * q.x)) iTop = i;
  }
  const n = ring.length;
  const k = Math.min(30, Math.floor(n / 10));
  const fwd = ax * (ring[(iTop + k) % n].x - ring[(iTop - k + n) % n].x) > 0 ? 1 : -1;
  const raw: Point[] = [];
  for (let s = 0; s < n; s++) {
    const p = ring[(iTop + fwd * s + n) % n];
    raw.push(p);
    if (p.y >= yBot - 1 && s > 10) break;
  }
  const step = Math.max(0.5, cm / 40);
  const arc = resample(smoothPolyline(raw, Math.max(1, 0.08 * cm)), step);
  if (arc.length < 40) return fail("noPerson");
  const A = arc.map((p) => ax * p.x);
  const Y = arc.map((p) => p.y);
  const ds = step; // arc length per sample
  const L = (len: number) => Math.max(1, Math.round(len / ds)); // samples for a length (mask px)

  // ---- pronasale: the anterior extreme that stands out on both sides (nose); lips and
  // chin stand out only below (lips) or above (chin turning into the neck)
  const win = L(3 * cm);
  const sideMean = (i: number, dir: 1 | -1) => {
    let m = 0;
    let c = 0;
    for (let j = i + dir * L(0.8 * cm); dir > 0 ? j <= Math.min(arc.length - 1, i + win) : j >= Math.max(0, i - win); j += dir) {
      m += A[j];
      c++;
    }
    return c ? m / c : A[i];
  };
  const prom = (i: number) => Math.min(A[i] - sideMean(i, -1), A[i] - sideMean(i, 1));
  const lo = arc.findIndex((p) => p.y >= yTop + (cutSide ? 0 : 3 * cm));
  let hi = arc.findIndex((p) => p.y >= yFaceEnd - 4 * cm);
  if (hi < 0) hi = arc.length - 1;
  if (lo < 0 || hi - lo < 10) return fail("noNose", { facing });
  const iPrn = argBest(lo, hi, (i) => (A[i] >= A[Math.max(0, i - 1)] && A[i] >= A[Math.min(arc.length - 1, i + 1)] ? prom(i) : -Infinity));
  const prnProm = prom(iPrn);
  Object.assign(diag, { lo, hi, iPrn, yPrn: Y[iPrn], prnProm, facing });
  if (!(prnProm > 0.4 * cm)) return fail("noNose", { facing, contour: arc.filter((_, i) => i % 4 === 0).map(toImg) });
  // the vertex → nasal tip height (≈ 16 cm) is a second scale when the top of the head is in the image
  const S = Y[iPrn] - yTop;
  if (yTop > 1 && S > 8 * cm && S < 24 * cm) cm = Math.sqrt(cm * (S / 16));

  const conf: Partial<Record<SideLandmarkId, number>> = {};
  const idx: Partial<Record<SideLandmarkId, number>> = { pronasale: iPrn };
  conf.pronasale = clamp01(prnProm / (2 * cm));

  // ---- nasion / glabella (upwards from the nasal tip)
  const iUp = (dy: number) => {
    // first index going up from the nasal tip whose y is ≤ yPrn − dy
    for (let i = iPrn; i >= 0; i--) if (Y[i] <= Y[iPrn] - dy) return i;
    return 0;
  };
  const nLo = iUp(9 * cm);
  const nHi = iUp(1.6 * cm);
  let best = { n: -1, g: -1, depth: -Infinity };
  for (let iN = nLo; iN <= nHi; iN++) {
    // glabella candidate: most anterior point 0.4–3 cm above this nasion
    let gLo = iN;
    for (let i = iN; i >= 0; i--) if (Y[i] <= Y[iN] - 3 * cm) { gLo = i; break; }
    let gHi = iN;
    for (let i = iN; i >= 0; i--) if (Y[i] <= Y[iN] - 0.4 * cm) { gHi = i; break; }
    if (gHi <= gLo) continue;
    const iG = argBest(gLo, gHi, (i) => A[i]);
    // depth of the nasion behind the chord glabella → nasal tip (positive = posterior)
    const ref = Math.sign(lineDistance({ x: (arc[iG].x + arc[iPrn].x) / 2 - ax, y: (arc[iG].y + arc[iPrn].y) / 2 }, arc[iG], arc[iPrn])) || 1;
    const d = ref * lineDistance(arc[iN], arc[iG], arc[iPrn]);
    if (d > best.depth) best = { n: iN, g: iG, depth: d };
  }
  if (best.n < 0) return fail("noNose", { facing });
  idx.nasion = best.n;
  idx.glabella = best.g;
  conf.nasion = clamp01(best.depth / (0.5 * cm));
  conf.glabella = clamp01(best.depth / (0.5 * cm)) * 0.9;

  // ---- local scale for the lower face: the soft-tissue nasal length N–Prn (≈ 4.8 cm in
  // adults, Farkas 1994) is closer to the lips and chin than the head length
  {
    const nasal = Math.hypot(arc[iPrn].x - arc[idx.nasion].x, arc[iPrn].y - arc[idx.nasion].y);
    const cmNose = nasal / 4.8;
    diag.cmHead = cm;
    diag.cmNose = cmNose;
    if (cmNose / cm > 0.6 && cmNose / cm < 2.2) cm = cmNose;
    else issues.push({ code: "lowResolution", severity: "warning" });
  }

  // ---- rhinion: top of a dorsal hump, else 40 % of the dorsum
  {
    const iN = idx.nasion!;
    // hump search on the upper two thirds of the dorsum (the supratip bulge is not the rhinion)
    const hump = deepest(arc, iN, Math.round(iN + (2 / 3) * (iPrn - iN)), ax, -1);
    const nasal = Math.hypot(arc[iPrn].x - arc[iN].x, arc[iPrn].y - arc[iN].y);
    if (hump.i > 0 && hump.depth > 0.03 * nasal) {
      idx.rhinion = hump.i;
      conf.rhinion = clamp01(hump.depth / (0.06 * nasal));
    } else {
      idx.rhinion = Math.round(iN + 0.4 * (iPrn - iN));
      conf.rhinion = 0.5;
    }
  }

  // ---- frame for the lower face: lips and chin are anterior extremes. With a clearly
  // tilted head (glabella → subnasale more than 10° from the vertical) the frame follows
  // the face, so chin-up or chin-down photos do not move the extremes.
  const iX = Math.min(arc.length - 1, iPrn + L(3 * cm));
  const sn0 = deepest(arc, iPrn, iX, ax, 1).i;
  if (sn0 < 0) return fail("chinNotFound", { facing, scalePx: cm * scale });
  const G = arc[idx.glabella!];
  const dv = { x: arc[sn0].x - G.x, y: arc[sn0].y - G.y };
  const dl = Math.hypot(dv.x, dv.y) || 1;
  // the image vertical (natural head position) unless the head is clearly tilted (> 10°)
  const tiltDeg = (Math.atan2(ax * dv.x, dv.y) * 180) / Math.PI;
  diag.faceTiltDeg = tiltDeg;
  const down = Math.abs(tiltDeg) > 10 ? { x: dv.x / dl, y: dv.y / dl } : { x: 0, y: 1 };
  let ant = { x: -down.y, y: down.x };
  if ((arc[iPrn].x - arc[sn0].x) * ant.x + (arc[iPrn].y - arc[sn0].y) * ant.y < 0) ant = { x: -ant.x, y: -ant.y };
  const FA = arc.map((p) => (p.x - arc[sn0].x) * ant.x + (p.y - arc[sn0].y) * ant.y);
  const FD = arc.map((p) => (p.x - arc[sn0].x) * down.x + (p.y - arc[sn0].y) * down.y);
  const tangentBack = (i: number) => {
    const a = arc[Math.max(0, i - L(0.3 * cm))];
    const b = arc[Math.min(arc.length - 1, i + L(0.3 * cm))];
    const tx = b.x - a.x;
    const ty = b.y - a.y;
    const len = Math.hypot(tx, ty) || 1;
    return { back: -(tx * ant.x + ty * ant.y) / len, down: (tx * down.x + ty * down.y) / len };
  };

  // ---- chin turn: where the contour starts running backwards (submental line)
  let iQ = -1;
  const iStartChin = FD.findIndex((d, i) => i > sn0 && d >= 3 * cm);
  if (iStartChin > 0) {
    let run = 0;
    for (let i = iStartChin; i < arc.length && FD[i] < 11 * cm; i++) {
      // the submental line runs backwards for several centimetres; the underside of the
      // lower lip or a chin dimple only for a few millimetres
      if (tangentBack(i).back > 0.45) {
        run++;
        if (run >= L(1.5 * cm)) { iQ = i - run + 1; break; }
      } else run = 0;
    }
  }
  Object.assign(diag, { S, iPrn, yPrn: Y[iPrn], sn0, iStartChin, arcLen: arc.length });
  if (iQ < 0) return fail("chinNotFound", { facing, scalePx: cm * scale, contour: arc.filter((_, i) => i % 4 === 0).map(toImg) });
  diag.iQ = iQ;

  // ---- lips and chin between the subnasale and the chin turn (extremes in the face frame)
  const smoothA = smoothPolyline(FA.map((a, i) => ({ x: a, y: i })), Math.max(1, L(0.08 * cm))).map((p) => p.x);
  const maxima = localMaxima(smoothA, sn0, iQ, 0.08 * cm).filter((i) => i >= sn0 + L(0.3 * cm));
  diag.maxima = maxima.map((i) => Math.round(Y[i]));
  if (maxima.length < 2) return fail("chinNotFound", { facing, scalePx: cm * scale });
  idx.labrale_sup = maxima[0];
  idx.pogonion = maxima[maxima.length - 1];
  if (maxima.length >= 3) {
    // the lower lip is the most anterior maximum between the upper lip and the chin
    const mids = maxima.slice(1, -1);
    idx.labrale_inf = mids.reduce((a, b) => (smoothA[b] > smoothA[a] ? b : a), mids[0]);
    conf.labrale_inf = 0.8;
  } else {
    // lips merged into one bulge: the lower lip is the most convex point between the two maxima's notch
    issues.push({ code: "lipsMerged", severity: "warning" });
    const notch = deepest(arc, maxima[0], maxima[1], ax, 1).i;
    idx.labrale_inf = deepest(arc, maxima[0], notch, ax, -1).i;
    conf.labrale_inf = 0.4;
  }
  conf.labrale_sup = 0.8;
  conf.pogonion = 0.85;
  const sub = deepest(arc, iPrn, idx.labrale_sup, ax, 1);
  idx.subnasale = sub.i;
  conf.subnasale = clamp01(sub.depth / (0.4 * cm));
  const sto = deepest(arc, idx.labrale_sup, idx.labrale_inf, ax, 1);
  idx.stomion = sto.i > 0 ? sto.i : Math.round((idx.labrale_sup + idx.labrale_inf) / 2);
  conf.stomion = clamp01(sto.depth / (0.15 * cm)) * 0.8;
  const lm = deepest(arc, idx.labrale_inf, idx.pogonion, ax, 1);
  idx.labiomental = lm.i > 0 ? lm.i : Math.round((idx.labrale_inf + idx.pogonion) / 2);
  conf.labiomental = clamp01(lm.depth / (0.3 * cm));

  // ---- neck: follow the contour to below the chin
  let iE = -1;
  {
    let minA = Infinity;
    for (let i = iQ; i < arc.length; i++) {
      minA = Math.min(minA, A[i]);
      if (Y[i] >= Y[iQ] + 7 * cm) { iE = i; break; }
      if (A[i] - minA > 1.5 * cm && Y[i] > Y[iQ] + 1 * cm) { iE = i; break; } // chest/shoulder comes forward again
    }
  }
  if (iE > 0) {
    const cerv = deepest(arc, idx.pogonion, iE, ax, 1);
    diag.iE = iE;
    diag.cerv = [cerv.i, Math.round(cerv.depth / cm * 100) / 100];
    if (cerv.i > iQ - L(1 * cm) && cerv.depth > 0.5 * cm) {
      idx.cervical = cerv.i;
      conf.cervical = clamp01(cerv.depth / (2 * cm)) * 0.9;
      const me = deepest(arc, idx.pogonion, cerv.i, ax, -1);
      idx.menton = me.i;
      conf.menton = clamp01(me.depth / (0.5 * cm)) * 0.85;
      // neck point: 2.5 cm along the contour below the cervical point, on the neck front
      const target = cerv.i + L(2.5 * cm);
      if (target < iE) {
        idx.neck = target;
        conf.neck = 0.7;
      }
    }
  }
  if (idx.menton == null) {
    // chin found but the neck is hidden (collar, beard, cropping): menton = most convex chin point before the turn
    issues.push({ code: "neckNotFound", severity: "warning" });
    const end = Math.min(arc.length - 1, iQ + L(1.5 * cm));
    const me = deepest(arc, idx.pogonion, end, ax, -1);
    idx.menton = me.i > 0 ? me.i : iQ;
    conf.menton = 0.5;
  }

  const points: SidePointSet = {};
  const sources: Partial<Record<SideLandmarkId, SidePointSource>> = {};
  for (const [id, i] of Object.entries(idx) as [SideLandmarkId, number][]) {
    points[id] = toImg(arc[i]);
    sources[id] = id === "rhinion" && conf.rhinion === 0.5 ? "derived" : "contour";
  }

  // ---- soft-tissue gonion from the face-skin / body-skin border (multiclass only)
  if (cat && idx.menton != null) {
    const g = gonionFromSkinBorder(cat, mask, w, h, arc[idx.menton], arc[idx.subnasale!], ax, cm);
    if (g) {
      points.gonion = toImg(g.p);
      sources.gonion = "segment";
      conf.gonion = g.confidence;
    } else issues.push({ code: "gonionNotFound", severity: "info" });
  } else issues.push({ code: "gonionNotFound", severity: "info" });
  issues.push({ code: "offContourPoints", severity: "info" });

  const contour = arc.filter((_, i) => i % Math.max(1, Math.round(arc.length / 400)) === 0 && Y[i] <= Y[iE > 0 ? iE : iQ] + 1).map(toImg);
  return { version: SIDE_AUTO_VERSION, ok: true, facing, points, sources, confidence: conf, issues, contour, scalePx: cm * scale, diag };
}

/**
 * Corner of the border between face skin and neck (body) skin behind the chin. In a
 * profile the lower jaw border separates the two classes; its posterior bend is the
 * soft-tissue gonion. Returns null unless the border is long enough and the corner
 * lies where a gonion can be (behind and above the menton, below the subnasale).
 */
export function gonionFromSkinBorder(cat: ArrayLike<number>, mask: Uint8Array, w: number, h: number, me: Point, sn: Point, ax: 1 | -1, cm: number): { p: Point; confidence: number } | null {
  const pts: Point[] = [];
  for (let y = Math.max(1, Math.round(sn.y)); y < Math.min(h - 1, Math.round(me.y + 3 * cm)); y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (!mask[i] || cat[i] !== SEG_LABELS.faceSkin) continue;
      if (cat[i + w] === SEG_LABELS.bodySkin || cat[i - 1] === SEG_LABELS.bodySkin || cat[i + 1] === SEG_LABELS.bodySkin) {
        // only behind the menton
        if (ax * (x - me.x) < -1 * cm) pts.push({ x, y });
      }
    }
  }
  if (pts.length < 4 * cm) return null;
  // order along the anterior coordinate: from the chin backwards
  pts.sort((a, b) => ax * b.x - ax * a.x);
  // for every anterior position keep the lowest border pixel (lower jaw border), then the posterior branch upwards
  const front = pts[0];
  // farthest-from-chord corner between the chin end and the highest posterior border point
  let back = pts[0];
  for (const p of pts) if (p.y < back.y && ax * (p.x - me.x) < -3 * cm) back = p;
  if (back === pts[0]) return null;
  const ref = Math.sign(lineDistance({ x: (front.x + back.x) / 2 - ax, y: (front.y + back.y) / 2 + 1 }, front, back)) || 1;
  let corner = front;
  let depth = -Infinity;
  for (const p of pts) {
    const d = ref * lineDistance(p, front, back);
    if (d > depth) {
      depth = d;
      corner = p;
    }
  }
  const run = ax * (me.x - corner.x);
  const rise = me.y - corner.y;
  // plausibility: 5–13 cm behind the menton, not below it, at most 6 cm above it, corner distinct
  if (run < 5 * cm || run > 13 * cm || rise < -0.5 * cm || rise > 6 * cm || depth < 0.4 * cm) return null;
  return { p: corner, confidence: clamp01(depth / (1.5 * cm)) * 0.6 };
}
