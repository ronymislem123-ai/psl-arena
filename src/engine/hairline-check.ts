/**
 * Plausibility of a hairline (trichion) point.
 *
 * Hair hanging over the forehead (fringe, curls) makes the skin/hair transition — and
 * any point placed on it — land far below the real hairline. The forehead then looks
 * implausibly short and every hairline-based measure (upper/middle/lower third,
 * forehead height, TFWHR, lower-face fraction, eye–mouth length) is wrong.
 *
 * Test: the upper-third share (trichion–glabella over trichion–menton, along the
 * facial midline). The app's reference centre is 31 % with a between-person spread
 * s ≈ 2.6 pp (forehead-height CV .098, Fang et al. 2011, propagated with the face
 * height, see scoring/measurement.ts). A share more than 3 s below the centre (≈ 23 %)
 * is outside the natural range for practical purposes: the hairline is treated as
 * covered — an estimated point is not used, a manually placed one is flagged.
 */
import type { Point } from "./types";
import { DISPERSION } from "./scoring/measurement";

export const HAIRLINE_UPPER_CENTRE = 31;
export const HAIRLINE_COVERED_SD = 3;

/** Threshold (percent) below which the upper third is treated as covered by hair. */
export function hairlineCoveredThreshold(): number {
  const s = DISPERSION.FT_U?.s ?? 2.6;
  return HAIRLINE_UPPER_CENTRE - HAIRLINE_COVERED_SD * s;
}

/** Upper-third share (percent) of a hairline point, measured along the mesh midline (mesh 9 = glabella, 152 = menton, 10 = mesh top). */
export function upperThirdShare(mesh: Point[], trichion: Point): number | null {
  const gl = mesh[9];
  const me = mesh[152];
  const top = mesh[10];
  if (!gl || !me || !top) return null;
  const dx = top.x - me.x;
  const dy = top.y - me.y;
  const len = Math.hypot(dx, dy);
  if (!(len > 0)) return null;
  const up = (p: Point) => ((p.x - me.x) * dx + (p.y - me.y) * dy) / len;
  const tTr = up(trichion);
  const tGl = up(gl);
  if (!(tTr > tGl) || !(tTr > 0)) return 0;
  return ((tTr - tGl) / tTr) * 100;
}

export interface HairlineCheck {
  share: number | null;
  covered: boolean;
}

export function checkHairline(mesh: Point[], trichion: Point | null | undefined): HairlineCheck {
  if (!trichion) return { share: null, covered: false };
  const share = upperThirdShare(mesh, trichion);
  return { share, covered: share != null && share < hairlineCoveredThreshold() };
}
