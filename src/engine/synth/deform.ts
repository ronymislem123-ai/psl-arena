/**
 * Controlled, smooth deformations of a 478-point MediaPipe face mesh.
 *
 * Used to build test faces with known geometric changes (validation suite) and
 * to shape the parametric reference head of the "ideal example". Every operator
 * works in the face's own frame (pupil line horizontal, origin at the
 * inter-pupillary midpoint, unit = IPD), moves a region with a smooth Gaussian
 * fall-off and is mirrored so both sides change equally unless stated otherwise.
 * z (depth) is carried along unchanged.
 */
import { MIRROR } from "../landmarks/canonical";
import { BROW_LOWER_L, BROW_LOWER_R, BROW_UPPER_L, BROW_UPPER_R, EYE_RING_L, EYE_RING_R, LIPS_INNER, LIPS_OUTER } from "../landmarks/mesh-map";
import type { Point } from "../types";

export type MeshPoint = Point & { z?: number };

export type DeformationId =
  | "eyeSpacing" // + moves the eyes apart (fraction of IPD/2 per side)
  | "eyeSize" // + enlarges the eye region (scale − 1)
  | "canthalTilt" // + raises the lateral canthi (degrees)
  | "browHeight" // + raises the brows (fraction of IPD)
  | "noseWidth" // + widens the alar base (scale − 1)
  | "noseLength" // + lengthens the nose downwards (fraction of IPD)
  | "mouthWidth" // + widens the mouth (scale − 1)
  | "lipFullness" // + increases lip height (scale − 1)
  | "faceWidth" // + widens the cheek/zygomatic contour (scale − 1)
  | "jawWidth" // + widens the jaw angles (scale − 1)
  | "chinHeight" // + lengthens the chin below the lower lip (fraction of IPD)
  | "midfaceHeight" // + lengthens the midface (nasion→upper lip) (fraction of IPD)
  | "foreheadHeight" // + raises the upper face contour (fraction of IPD)
  | "asymmetryEye"; // + raises the subject's right eye only (fraction of IPD)

export interface Deformation {
  id: DeformationId;
  amount: number;
}

interface Frame {
  cx: number;
  cy: number;
  cos: number;
  sin: number;
  ipd: number;
}

function frameOf(mesh: MeshPoint[]): Frame {
  const r = mesh[468];
  const l = mesh[473];
  const ang = Math.atan2(l.y - r.y, l.x - r.x); // subject right → left, any orientation
  return { cx: (r.x + l.x) / 2, cy: (r.y + l.y) / 2, cos: Math.cos(ang), sin: Math.sin(ang), ipd: Math.hypot(l.x - r.x, l.y - r.y) || 1 };
}

/** Image → face frame (x towards the subject's left, y downwards, unit IPD). */
function toFace(p: MeshPoint, f: Frame): MeshPoint {
  const dx = p.x - f.cx;
  const dy = p.y - f.cy;
  return { x: (dx * f.cos + dy * f.sin) / f.ipd, y: (-dx * f.sin + dy * f.cos) / f.ipd, z: p.z };
}

function fromFace(p: MeshPoint, f: Frame): MeshPoint {
  const x = p.x * f.ipd;
  const y = p.y * f.ipd;
  return { x: f.cx + x * f.cos - y * f.sin, y: f.cy + x * f.sin + y * f.cos, ...(p.z !== undefined ? { z: p.z } : {}) };
}

const gauss = (d: number, r: number) => Math.exp(-(d * d) / (2 * r * r));
const centroidOf = (pts: MeshPoint[], idx: number[]) => {
  let x = 0;
  let y = 0;
  for (const i of idx) {
    x += pts[i].x;
    y += pts[i].y;
  }
  return { x: x / idx.length, y: y / idx.length };
};

const EYE_R = [...EYE_RING_R, 468, 469, 470, 471, 472];
const EYE_L = [...EYE_RING_L, 473, 474, 475, 476, 477];
const BROW_R = [...BROW_UPPER_R, ...BROW_LOWER_R];
const BROW_L = [...BROW_UPPER_L, ...BROW_LOWER_L];
const LIPS = [...LIPS_OUTER, ...LIPS_INNER];

/** Applies one deformation in the face frame. */
function applyOne(P: MeshPoint[], d: Deformation): MeshPoint[] {
  const a = d.amount;
  if (a === 0) return P;
  const out = P.map((p) => ({ ...p }));
  const eyeR = centroidOf(P, EYE_R);
  const eyeL = centroidOf(P, EYE_L);
  const mouth = centroidOf(P, LIPS);
  const mouthHalf = Math.abs(P[291].x - P[61].x) / 2;
  const alarR = P[48];
  const alarL = P[278];
  const subnasaleY = P[2].y;
  const nasionY = P[168].y;
  const stomionY = (P[13].y + P[14].y) / 2;
  const lowerLipY = P[17].y;
  const mentonY = P[152].y;
  const topY = P[10].y;

  const eachSide = (centerR: Point, centerL: Point, radius: number, fn: (p: MeshPoint, w: number, side: 1 | -1, c: Point) => void) => {
    P.forEach((p, i) => {
      const dR = Math.hypot(p.x - centerR.x, p.y - centerR.y);
      const dL = Math.hypot(p.x - centerL.x, p.y - centerL.y);
      const side: 1 | -1 = dR <= dL ? -1 : 1; // face frame: subject right has x < 0
      const c = side === -1 ? centerR : centerL;
      const w = gauss(Math.min(dR, dL), radius);
      if (w > 1e-4) fn(out[i], w, side, c);
    });
  };

  switch (d.id) {
    case "eyeSpacing":
      eachSide(eyeR, eyeL, 0.22, (q, w, side) => {
        q.x += side * a * 0.5 * w;
      });
      break;
    case "eyeSize":
      eachSide(eyeR, eyeL, 0.2, (q, w, _s, c) => {
        q.x += (q.x - c.x) * a * w;
        q.y += (q.y - c.y) * a * w;
      });
      break;
    case "canthalTilt": {
      const rad = (a * Math.PI) / 180;
      eachSide(eyeR, eyeL, 0.22, (q, w, side, c) => {
        // lateral canthus up: rotate the right eye clockwise and the left eye counter-clockwise (face frame, y down)
        const ang = -side * rad * w;
        const dx = q.x - c.x;
        const dy = q.y - c.y;
        q.x = c.x + dx * Math.cos(ang) - dy * Math.sin(ang);
        q.y = c.y + dx * Math.sin(ang) + dy * Math.cos(ang);
      });
      break;
    }
    case "browHeight": {
      const bR = centroidOf(P, BROW_R);
      const bL = centroidOf(P, BROW_L);
      eachSide(bR, bL, 0.18, (q, w) => {
        q.y -= a * w;
      });
      break;
    }
    case "noseWidth":
      eachSide(alarR, alarL, 0.12, (q, w) => {
        q.x += q.x * a * w;
      });
      break;
    case "noseLength":
      P.forEach((p, i) => {
        // stretch the band between the nasion and the upper lip downwards, carrying everything below with it
        const t = Math.max(0, Math.min(1, (p.y - nasionY) / Math.max(subnasaleY - nasionY, 1e-6)));
        const below = p.y > subnasaleY ? 1 : t;
        const lateral = gauss(Math.abs(p.x), 0.45);
        out[i].y += a * below * (p.y > subnasaleY ? 1 : lateral);
      });
      break;
    case "mouthWidth":
      P.forEach((p, i) => {
        const w = gauss(Math.hypot((p.x - mouth.x) / (mouthHalf * 1.25 || 1), (p.y - mouth.y) / 0.12), 1);
        out[i].x += (p.x - mouth.x) * a * w;
      });
      break;
    case "lipFullness":
      P.forEach((p, i) => {
        const w = gauss(Math.hypot((p.x - mouth.x) / (mouthHalf * 1.2 || 1), (p.y - stomionY) / 0.3), 1);
        out[i].y += (p.y - stomionY) * a * w;
      });
      break;
    case "faceWidth": {
      const zyY = (P[234].y + P[454].y) / 2;
      P.forEach((p, i) => {
        // lateral of the outer canthi only (|x| ≳ 0.8 IPD), so the eyes stay unchanged
        const lat = Math.max(0, Math.min(1, (Math.abs(p.x) - 0.8) / 0.22));
        const w = lat * gauss(p.y - zyY, 0.5);
        out[i].x += p.x * a * w;
      });
      break;
    }
    case "jawWidth": {
      const goY = (P[172].y + P[397].y) / 2;
      P.forEach((p, i) => {
        // lateral of the mouth corners, around the gonial level
        const lat = Math.max(0, Math.min(1, (Math.abs(p.x) - 0.5) / 0.25));
        const w = lat * gauss(p.y - goY, 0.35) * (p.y > subnasaleY ? 1 : 0);
        out[i].x += p.x * a * w;
      });
      break;
    }
    case "chinHeight":
      P.forEach((p, i) => {
        const t = Math.max(0, Math.min(1, (p.y - lowerLipY) / Math.max(mentonY - lowerLipY, 1e-6)));
        out[i].y += a * t;
      });
      break;
    case "midfaceHeight":
      P.forEach((p, i) => {
        const t = Math.max(0, Math.min(1, (p.y - nasionY) / Math.max(stomionY - nasionY, 1e-6)));
        out[i].y += a * t;
      });
      break;
    case "foreheadHeight":
      P.forEach((p, i) => {
        const t = Math.max(0, Math.min(1, (nasionY - p.y) / Math.max(nasionY - topY, 1e-6)));
        out[i].y -= a * t;
      });
      break;
    case "asymmetryEye":
      P.forEach((p, i) => {
        if (p.x > 0) return;
        out[i].y -= a * gauss(Math.hypot(p.x - eyeR.x, p.y - eyeR.y), 0.22);
      });
      break;
  }
  return out;
}

/** Applies deformations in order; returns a new mesh in image coordinates. */
export function deformMesh(mesh: MeshPoint[], deformations: Deformation[]): MeshPoint[] {
  const f = frameOf(mesh);
  let P = mesh.map((p) => toFace(p, f));
  for (const d of deformations) P = applyOne(P, d);
  return P.map((p) => fromFace(p, f));
}

/**
 * Mirror-averaged (perfectly symmetric) version of a mesh: every point is
 * averaged with the reflection of its counterpart (canonical-model mirror map)
 * across the face's vertical midline.
 */
export function symmetrizeMesh(mesh: MeshPoint[]): MeshPoint[] {
  const f = frameOf(mesh);
  const P = mesh.map((p) => toFace(p, f));
  const mid = P.filter((_, i) => MIRROR[i] === i);
  const midX = mid.reduce((s, p) => s + p.x, 0) / Math.max(1, mid.length);
  return P.map((p, i) => {
    const m = P[MIRROR[i]];
    const z = p.z !== undefined && m.z !== undefined ? (p.z + m.z) / 2 : p.z;
    return fromFace({ x: (p.x + (2 * midX - m.x)) / 2, y: (p.y + m.y) / 2, z }, f);
  });
}
