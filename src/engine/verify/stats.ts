/**
 * Robust statistics for the landmark verification (engine 3.1). A single bad
 * detection pass must neither move the verified position (median) nor make a
 * stable landmark look unstable (trimmed spread drops the largest residual).
 */
import type { Point } from "../types";

export function median(values: number[]): number {
  const a = values.filter((v) => Number.isFinite(v)).sort((x, y) => x - y);
  if (!a.length) return NaN;
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Component-wise median of corresponding points of several meshes. */
export function consensusMesh(meshes: Point[][]): Point[] {
  const n = meshes[0].length;
  const out: Point[] = [];
  const hasZ = meshes.every((m) => m[0]?.z !== undefined);
  for (let i = 0; i < n; i++) {
    const p: Point = { x: median(meshes.map((m) => m[i].x)), y: median(meshes.map((m) => m[i].y)) };
    if (hasZ) p.z = median(meshes.map((m) => m[i].z ?? 0));
    out.push(p);
  }
  return out;
}

export function medianPoint(points: Point[]): Point {
  return { x: median(points.map((p) => p.x)), y: median(points.map((p) => p.y)) };
}

/**
 * Root-mean-square distance of the points from `c`, leaving out the largest
 * distance when at least four points are available (one outlier pass does not
 * count as instability; it is reported as a correction instead).
 */
export function trimmedSpread(points: Point[], c: Point): number {
  const d2 = points.map((p) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2).sort((a, b) => a - b);
  const used = d2.length >= 4 ? d2.slice(0, -1) : d2;
  if (!used.length) return NaN;
  return Math.sqrt(used.reduce((s, v) => s + v, 0) / used.length);
}

/** The same for scalar values around their median (robust standard deviation over the passes). */
export function trimmedSd(values: number[]): number {
  const v = values.filter((x) => Number.isFinite(x));
  if (v.length < 2) return NaN;
  const m = median(v);
  const d2 = v.map((x) => (x - m) ** 2).sort((a, b) => a - b);
  const used = d2.length >= 4 ? d2.slice(0, -1) : d2;
  return Math.sqrt(used.reduce((s, x) => s + x, 0) / used.length);
}
