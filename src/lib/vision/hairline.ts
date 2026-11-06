"use client";
import type { Point } from "@/engine/types";

export interface HairlineEstimate {
  point: Point;
  confidence: number;
  /** Distance scanned above the mesh top, in IPD units. */
  distanceIpd: number;
}

/**
 * Estimates the trichion (hairline) by scanning upward from the mesh top along the
 * facial midline and looking for a sustained colour change away from forehead skin.
 * Returns null when no transition is found (bald, hat, image border, …).
 */
export function estimateHairline(canvas: HTMLCanvasElement, mesh: Point[]): HairlineEstimate | null {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const W = canvas.width;
  const H = canvas.height;
  const top = mesh[10];
  const upperForehead = mesh[151];
  const menton = mesh[152];
  const ipd = Math.hypot(mesh[468].x - mesh[473].x, mesh[468].y - mesh[473].y);
  if (!ipd) return null;
  // midline direction (chin → forehead), unit vector
  const dx = top.x - menton.x;
  const dy = top.y - menton.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // perpendicular for the sampling window
  const px = -uy;
  const py = ux;

  const sampleMean = (cx: number, cy: number, half: number, step = 1) => {
    let r = 0, g = 0, b = 0, n = 0;
    const vals: number[] = [];
    for (let t = -half; t <= half; t += step) {
      const x = Math.round(cx + px * t);
      const y = Math.round(cy + py * t);
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const d = ctx.getImageData(x, y, 1, 1).data;
      r += d[0]; g += d[1]; b += d[2]; n++;
      vals.push(0.299 * d[0] + 0.587 * d[1] + 0.114 * d[2]);
    }
    if (!n) return null;
    return { r: r / n, g: g / n, b: b / n, n, lum: vals.reduce((a, v) => a + v, 0) / n };
  };

  // reference skin: window across the upper forehead (between mesh 151 and 10)
  const refCx = (top.x + upperForehead.x) / 2;
  const refCy = (top.y + upperForehead.y) / 2;
  const half = Math.max(3, Math.round(ipd * 0.12));
  const refSamples: { r: number; g: number; b: number }[] = [];
  for (let s = -3; s <= 3; s++) {
    const m = sampleMean(refCx + ux * s * 2, refCy + uy * s * 2, half, 2);
    if (m) refSamples.push(m);
  }
  if (!refSamples.length) return null;
  const ref = {
    r: refSamples.reduce((a, s) => a + s.r, 0) / refSamples.length,
    g: refSamples.reduce((a, s) => a + s.g, 0) / refSamples.length,
    b: refSamples.reduce((a, s) => a + s.b, 0) / refSamples.length,
  };
  const refSpread = Math.sqrt(refSamples.reduce((a, s) => a + (s.r - ref.r) ** 2 + (s.g - ref.g) ** 2 + (s.b - ref.b) ** 2, 0) / refSamples.length);
  const threshold = Math.max(38, 3 * refSpread);

  const maxDist = ipd * 1.1;
  const step = Math.max(1, Math.round(ipd / 120));
  let streak = 0;
  let found: Point | null = null;
  let foundDist = 0;
  let strength = 0;
  for (let d = 0; d <= maxDist; d += step) {
    const cx = top.x + ux * d;
    const cy = top.y + uy * d;
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) break;
    const m = sampleMean(cx, cy, half, 2);
    if (!m) break;
    const diff = Math.sqrt((m.r - ref.r) ** 2 + (m.g - ref.g) ** 2 + (m.b - ref.b) ** 2);
    if (diff > threshold) {
      streak++;
      if (streak >= 3 && !found) {
        const back = d - step * 2;
        found = { x: top.x + ux * back, y: top.y + uy * back };
        foundDist = back;
        strength = diff / threshold;
      }
      if (streak >= 6) break;
    } else {
      streak = 0;
      found = null;
    }
  }
  if (!found) return null;
  let confidence = Math.min(0.9, 0.45 + 0.2 * Math.min(2, strength - 1));
  if (foundDist < ipd * 0.08) confidence *= 0.6; // transition right at the mesh edge (bangs?)
  if (foundDist > ipd * 0.95) confidence *= 0.7; // very high forehead or scan limit
  return { point: found, confidence, distanceIpd: foundDist / ipd };
}
