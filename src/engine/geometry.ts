import type { Point } from "./types";

export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export const centroid = (pts: Point[]): Point => {
  const n = pts.length || 1;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / n,
    y: pts.reduce((s, p) => s + p.y, 0) / n,
  };
};

export const toDeg = (rad: number): number => (rad * 180) / Math.PI;
export const toRad = (deg: number): number => (deg * Math.PI) / 180;

/** Rotate `p` around `pivot` by `deg` degrees (image space: y down). */
export function rotateAround(p: Point, pivot: Point, deg: number): Point {
  const r = toRad(deg);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return { x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c };
}

/**
 * Tilt of the line from `medial` to `lateral` relative to the horizontal.
 * Positive when the lateral point is HIGHER (smaller y) than the medial point.
 * Works for both sides because only the vertical rise over the horizontal run is used.
 */
export function tiltDeg(medial: Point, lateral: Point): number {
  const run = Math.abs(lateral.x - medial.x);
  const rise = medial.y - lateral.y; // image y grows downwards
  return toDeg(Math.atan2(rise, run));
}

/** Interior angle (degrees) at vertex `b` of the polyline a-b-c. */
export function angleAt(a: Point, b: Point, c: Point): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const d = v1.x * v2.x + v1.y * v2.y;
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (m === 0) return 0;
  return toDeg(Math.acos(Math.max(-1, Math.min(1, d / m))));
}

/** Orthogonal least-squares line through points: returns a point and a unit direction. */
export function fitLine(pts: Point[]): { p: Point; d: Point } {
  const c = centroid(pts);
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pts) {
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  // principal eigenvector of the 2x2 covariance
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { p: c, d: { x: Math.cos(theta), y: Math.sin(theta) } };
}

/** Intersection of two infinite lines (point + direction). Returns null when parallel. */
export function intersectLines(l1: { p: Point; d: Point }, l2: { p: Point; d: Point }): Point | null {
  const det = l1.d.x * l2.d.y - l1.d.y * l2.d.x;
  if (Math.abs(det) < 1e-9) return null;
  const dx = l2.p.x - l1.p.x;
  const dy = l2.p.y - l1.p.y;
  const t = (dx * l2.d.y - dy * l2.d.x) / det;
  return { x: l1.p.x + l1.d.x * t, y: l1.p.y + l1.d.y * t };
}

/** Angle in degrees between two directions (0..180). */
export function angleBetween(d1: Point, d2: Point): number {
  const dot = d1.x * d2.x + d1.y * d2.y;
  const m = Math.hypot(d1.x, d1.y) * Math.hypot(d2.x, d2.y);
  if (m === 0) return 0;
  return toDeg(Math.acos(Math.max(-1, Math.min(1, dot / m))));
}

/** Horizontal intersection of a polyline with the line y = yLevel. Returns the first crossing. */
export function polylineAtY(poly: Point[], yLevel: number): Point | null {
  for (let i = 0; i < poly.length - 1; i++) {
    const a = poly[i];
    const b = poly[i + 1];
    if ((a.y <= yLevel && b.y >= yLevel) || (a.y >= yLevel && b.y <= yLevel)) {
      if (a.y === b.y) return { x: (a.x + b.x) / 2, y: yLevel };
      const t = (yLevel - a.y) / (b.y - a.y);
      return { x: a.x + (b.x - a.x) * t, y: yLevel };
    }
  }
  return null;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export const stddev = (xs: number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

export const round = (v: number, digits = 2): number => {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
};

/** Deterministic PRNG (mulberry32). */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal sample via Box–Muller using the provided uniform RNG. */
export function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
