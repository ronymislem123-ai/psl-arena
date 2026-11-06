/**
 * Measurement formulas for the 42 core ratios. All distances are computed in the
 * roll-normalised ("aligned") frame. Midline heights use vertical distances.
 */
import { angleAt, dist, tiltDeg } from "../geometry";
import { frontalGonialAngle } from "../landmarks/mesh-map";
import type { LandmarkMap, Point, RatioId, SemanticLandmarkId } from "../types";

export interface MeasureContext {
  map: LandmarkMap;
  ipd: number;
}

export interface MeasureOutput {
  value: number;
  intermediate: Record<string, number>;
}

type Formula = (ctx: MeasureContext) => MeasureOutput | null;

const P = (ctx: MeasureContext, id: SemanticLandmarkId): Point | null => ctx.map[id]?.aligned ?? null;
const vdist = (a: Point, b: Point) => Math.abs(a.y - b.y);

function need(ctx: MeasureContext, ...ids: SemanticLandmarkId[]): Point[] | null {
  const pts: Point[] = [];
  for (const id of ids) {
    const p = P(ctx, id);
    if (!p) return null;
    pts.push(p);
  }
  return pts;
}

const safeDiv = (a: number, b: number): number | null => (Math.abs(b) < 1e-9 ? null : a / b);

function out(value: number | null, intermediate: Record<string, number>): MeasureOutput | null {
  if (value === null || !Number.isFinite(value)) return null;
  return { value, intermediate };
}

// --- shared measurements ------------------------------------------------
export function basics(ctx: MeasureContext) {
  const m = ctx.map;
  const g = (id: SemanticLandmarkId) => m[id]?.aligned;
  const pr = g("pupil_R");
  const pl = g("pupil_L");
  const zr = g("zygion_R");
  const zl = g("zygion_L");
  const enr = g("endocanthion_R");
  const enl = g("endocanthion_L");
  const exr = g("exocanthion_R");
  const exl = g("exocanthion_L");
  return {
    ipd: pr && pl ? dist(pr, pl) : null,
    byz: zr && zl ? dist(zr, zl) : null,
    icd: enr && enl ? dist(enr, enl) : null,
    ocd: exr && exl ? dist(exr, exl) : null,
    pflR: exr && enr ? dist(exr, enr) : null,
    pflL: exl && enl ? dist(exl, enl) : null,
  };
}

export const FORMULAS: Record<RatioId, Formula> = {
  ESR: (ctx) => {
    const b = basics(ctx);
    if (b.ipd === null || b.byz === null) return null;
    return out(safeDiv(b.ipd * 100, b.byz), { ipd: b.ipd, bizygomatic: b.byz });
  },
  OCD: (ctx) => {
    const b = basics(ctx);
    if (b.ocd === null || b.byz === null) return null;
    return out(safeDiv(b.ocd * 100, b.byz), { outerCanthal: b.ocd, bizygomatic: b.byz });
  },
  ICD: (ctx) => {
    const b = basics(ctx);
    if (b.icd === null || b.pflR === null || b.pflL === null) return null;
    const pfl = (b.pflR + b.pflL) / 2;
    return out(safeDiv(b.icd, pfl), { intercanthal: b.icd, pflRight: b.pflR, pflLeft: b.pflL, pflMean: pfl });
  },
  EAR: (ctx) => {
    const pts = need(ctx, "exocanthion_R", "endocanthion_R", "palpebrale_sup_R", "palpebrale_inf_R", "exocanthion_L", "endocanthion_L", "palpebrale_sup_L", "palpebrale_inf_L");
    if (!pts) return null;
    const [exr, enr, usr, lsr, exl, enl, usl, lsl] = pts;
    const pflR = dist(exr, enr);
    const pflL = dist(exl, enl);
    const hR = dist(usr, lsr);
    const hL = dist(usl, lsl);
    const rR = safeDiv(pflR, hR);
    const rL = safeDiv(pflL, hL);
    if (rR === null || rL === null) return null;
    return out((rR + rL) / 2, { pflRight: pflR, pflLeft: pflL, eyeHeightRight: hR, eyeHeightLeft: hL, earRight: rR, earLeft: rL });
  },
  PFL_BYZGO: (ctx) => {
    const b = basics(ctx);
    if (b.pflR === null || b.pflL === null || b.byz === null) return null;
    const pfl = (b.pflR + b.pflL) / 2;
    return out(safeDiv(pfl * 100, b.byz), { pflMean: pfl, bizygomatic: b.byz });
  },
  M_IPD: (ctx) => {
    const pts = need(ctx, "cheilion_R", "cheilion_L", "pupil_R", "pupil_L");
    if (!pts) return null;
    const mw = dist(pts[0], pts[1]);
    const ipd = dist(pts[2], pts[3]);
    return out(safeDiv(mw * 100, ipd), { mouthWidth: mw, ipd });
  },
  EBL: (ctx) => {
    const pts = need(ctx, "brow_medial_R", "brow_lateral_R", "brow_medial_L", "brow_lateral_L", "pupil_R", "pupil_L");
    if (!pts) return null;
    const lR = dist(pts[0], pts[1]);
    const lL = dist(pts[2], pts[3]);
    const ipd = dist(pts[4], pts[5]);
    return out(safeDiv(((lR + lL) / 2) * 100, ipd), { browLengthRight: lR, browLengthLeft: lL, ipd });
  },
  EBS: () => null,
  ICD_N: (ctx) => {
    const pts = need(ctx, "endocanthion_R", "endocanthion_L", "alare_R", "alare_L");
    if (!pts) return null;
    const icd = dist(pts[0], pts[1]);
    const nw = dist(pts[2], pts[3]);
    return out(safeDiv(icd, nw), { intercanthal: icd, noseWidth: nw });
  },
  EME: (ctx) => {
    const pts = need(ctx, "pupil_R", "pupil_L", "stomion");
    if (!pts) return null;
    const [pr, pl, s] = pts;
    // vertex at the mouth centre (E–M–E): angle between the rays to the two pupils
    const angle = angleAt(pr, s, pl);
    return out(angle, { angleAtMouth: angle, pupilToMouth: vdist({ x: 0, y: (pr.y + pl.y) / 2 }, s), ipd: dist(pr, pl) });
  },
  IAA: () => null,
  JFA: () => null,
  DEV_IAA_JFA: () => null,
  BIT: (ctx) => {
    const pts = need(ctx, "frontotemporale_R", "frontotemporale_L", "zygion_R", "zygion_L");
    if (!pts) return null;
    const bit = dist(pts[0], pts[1]);
    const byz = dist(pts[2], pts[3]);
    return out(safeDiv(bit * 100, byz), { bitemporal: bit, bizygomatic: byz });
  },
  DEV_BIT_BIG: (ctx) => {
    const bit = FORMULAS.BIT(ctx);
    const big = FORMULAS.BIG(ctx);
    if (!bit || !big) return null;
    return out(Math.abs(bit.value - big.value), { bit: bit.value, big: big.value });
  },
  BIG: (ctx) => {
    const pts = need(ctx, "gonion_R", "gonion_L", "zygion_R", "zygion_L");
    if (!pts) return null;
    const big = dist(pts[0], pts[1]);
    const byz = dist(pts[2], pts[3]);
    return out(safeDiv(big * 100, byz), { bigonial: big, bizygomatic: byz });
  },
  JWHR: (ctx) => {
    const pts = need(ctx, "gonion_R", "gonion_L", "stomion", "menton");
    if (!pts) return null;
    const big = dist(pts[0], pts[1]);
    const h = vdist(pts[2], pts[3]);
    return out(safeDiv(big, h), { bigonial: big, stomionToMenton: h });
  },
  M_BIG: (ctx) => {
    const pts = need(ctx, "cheilion_R", "cheilion_L", "gonion_R", "gonion_L");
    if (!pts) return null;
    const mw = dist(pts[0], pts[1]);
    const big = dist(pts[2], pts[3]);
    return out(safeDiv(mw * 100, big), { mouthWidth: mw, bigonial: big });
  },
  GS: (ctx) => {
    const aR = frontalGonialAngle(ctx.map, "R");
    const aL = frontalGonialAngle(ctx.map, "L");
    if (aR === null || aL === null) return null;
    return out((aR + aL) / 2, { angleRight: aR, angleLeft: aL });
  },
  M_N: (ctx) => {
    const pts = need(ctx, "cheilion_R", "cheilion_L", "alare_R", "alare_L");
    if (!pts) return null;
    const mw = dist(pts[0], pts[1]);
    const nw = dist(pts[2], pts[3]);
    return out(safeDiv(mw, nw), { mouthWidth: mw, noseWidth: nw });
  },
  MF: (ctx) => {
    const pts = need(ctx, "pupil_R", "pupil_L", "nasion", "labrale_sup");
    if (!pts) return null;
    const ipd = dist(pts[0], pts[1]);
    const h = vdist(pts[2], pts[3]);
    return out(safeDiv(ipd, h), { ipd, nasionToUpperLip: h });
  },
  FWHR: (ctx) => {
    const pts = need(ctx, "zygion_R", "zygion_L", "brow_line", "labrale_sup");
    if (!pts) return null;
    const byz = dist(pts[0], pts[1]);
    const h = vdist(pts[2], pts[3]);
    return out(safeDiv(byz, h), { bizygomatic: byz, browToUpperLip: h });
  },
  TFWHR: (ctx) => {
    const pts = need(ctx, "trichion", "menton", "zygion_R", "zygion_L");
    if (!pts) return null;
    const h = vdist(pts[0], pts[1]);
    const byz = dist(pts[2], pts[3]);
    return out(safeDiv(h, byz), { totalFacialHeight: h, bizygomatic: byz });
  },
  CBS: (ctx) => {
    const pts = need(ctx, "zygion_R", "zygion_L", "pupil_R", "pupil_L", "stomion");
    if (!pts) return null;
    const zy = (pts[0].y + pts[1].y) / 2;
    const py = (pts[2].y + pts[3].y) / 2;
    const ly = pts[4].y;
    const cheekToLip = ly - zy;
    const pupilToLip = ly - py;
    return out(safeDiv(cheekToLip * 100, pupilToLip), { cheekboneToLip: cheekToLip, pupilPlaneToLip: pupilToLip });
  },
  N_H: (ctx) => {
    const pts = need(ctx, "nasion", "subnasale", "alare_R", "alare_L");
    if (!pts) return null;
    const h = vdist(pts[0], pts[1]);
    const w = dist(pts[2], pts[3]);
    return out(safeDiv(h, w), { noseHeight: h, noseWidth: w });
  },
  M_C: (ctx) => {
    const pts = need(ctx, "cheilion_R", "cheilion_L", "chin_corner_R", "chin_corner_L");
    if (!pts) return null;
    const mw = dist(pts[0], pts[1]);
    const cw = dist(pts[2], pts[3]);
    return out(safeDiv(mw, cw), { mouthWidth: mw, chinWidth: cw });
  },
  NBR_ALA: () => null,
  N_BYZGO: (ctx) => {
    const pts = need(ctx, "alare_R", "alare_L", "zygion_R", "zygion_L");
    if (!pts) return null;
    const nw = dist(pts[0], pts[1]);
    const byz = dist(pts[2], pts[3]);
    return out(safeDiv(nw * 100, byz), { noseWidth: nw, bizygomatic: byz });
  },
  CT: (ctx) => {
    const pts = need(ctx, "endocanthion_R", "exocanthion_R", "endocanthion_L", "exocanthion_L");
    if (!pts) return null;
    const tR = tiltDeg(pts[0], pts[1]);
    const tL = tiltDeg(pts[2], pts[3]);
    return out((tR + tL) / 2, { tiltRight: tR, tiltLeft: tL });
  },
  ET: (ctx) => {
    const pts = need(ctx, "brow_medial_R", "brow_lateral_R", "brow_medial_L", "brow_lateral_L");
    if (!pts) return null;
    const tR = tiltDeg(pts[0], pts[1]);
    const tL = tiltDeg(pts[2], pts[3]);
    return out((tR + tL) / 2, { tiltRight: tR, tiltLeft: tL });
  },
  DEV_CT_ET: (ctx) => {
    const ct = FORMULAS.CT(ctx);
    const et = FORMULAS.ET(ctx);
    if (!ct || !et) return null;
    return out(Math.abs(ct.value - et.value), { ct: ct.value, et: et.value });
  },
  FWHF: (ctx) => {
    const pts = need(ctx, "trichion", "glabella", "zygion_R", "zygion_L");
    if (!pts) return null;
    const fh = vdist(pts[0], pts[1]);
    const byz = dist(pts[2], pts[3]);
    return out(safeDiv(fh * 100, byz), { foreheadHeight: fh, bizygomatic: byz });
  },
  LL_UL: (ctx) => {
    const pts = need(ctx, "labrale_sup", "stomion_sup", "stomion_inf", "labrale_inf");
    if (!pts) return null;
    const ul = vdist(pts[0], pts[1]);
    const ll = vdist(pts[2], pts[3]);
    return out(safeDiv(ll, ul), { upperLipHeight: ul, lowerLipHeight: ll });
  },
  L3P: (ctx) => {
    const pts = need(ctx, "subnasale", "stomion", "menton");
    if (!pts) return null;
    const a = vdist(pts[0], pts[1]);
    const b = vdist(pts[0], pts[2]);
    return out(safeDiv(a * 100, b), { subnasaleToStomion: a, subnasaleToMenton: b });
  },
  LFF: (ctx) => {
    const pts = need(ctx, "nasion", "menton", "trichion");
    if (!pts) return null;
    const a = vdist(pts[0], pts[1]);
    const b = vdist(pts[2], pts[1]);
    return out(safeDiv(a * 100, b), { nasionToMenton: a, trichionToMenton: b });
  },
  C_P: (ctx) => {
    const pts = need(ctx, "labrale_inf", "menton", "subnasale", "labrale_sup");
    if (!pts) return null;
    const chin = vdist(pts[0], pts[1]);
    const phil = vdist(pts[2], pts[3]);
    return out(safeDiv(chin, phil), { chinHeight: chin, philtrumLength: phil });
  },
  FT_L: (ctx) => {
    const pts = need(ctx, "subnasale", "menton", "trichion");
    if (!pts) return null;
    const lower = vdist(pts[0], pts[1]);
    const total = vdist(pts[2], pts[1]);
    return out(safeDiv(lower * 100, total), { lowerThird: lower, totalFacialHeight: total });
  },
  FT_M: (ctx) => {
    const pts = need(ctx, "glabella", "subnasale", "trichion", "menton");
    if (!pts) return null;
    const mid = vdist(pts[0], pts[1]);
    const total = vdist(pts[2], pts[3]);
    return out(safeDiv(mid * 100, total), { middleThird: mid, totalFacialHeight: total });
  },
  FT_U: (ctx) => {
    const pts = need(ctx, "trichion", "glabella", "menton");
    if (!pts) return null;
    const upper = vdist(pts[0], pts[1]);
    const total = vdist(pts[0], pts[2]);
    return out(safeDiv(upper * 100, total), { upperThird: upper, totalFacialHeight: total });
  },
  LIP_WHR: (ctx) => {
    const pts = need(ctx, "cheilion_R", "cheilion_L", "labrale_sup", "labrale_inf");
    if (!pts) return null;
    const mw = dist(pts[0], pts[1]);
    const h = vdist(pts[2], pts[3]);
    return out(safeDiv(mw, h), { mouthWidth: mw, totalLipHeight: h });
  },
  NW: (ctx) => {
    const pts = need(ctx, "neck_R", "neck_L", "gonion_R", "gonion_L");
    if (!pts) return null;
    const nw = dist(pts[0], pts[1]);
    const big = dist(pts[2], pts[3]);
    return out(safeDiv(nw * 100, big), { neckWidth: nw, bigonial: big });
  },
  EYS: () => null,
};
