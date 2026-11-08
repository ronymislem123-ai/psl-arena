/**
 * Head pose and pose normalisation from 3D landmarks.
 *
 * MediaPipe returns, per landmark, image x/y and a relative depth z (same scale as
 * x). The head rotation is estimated by a weighted rigid fit (Horn's quaternion
 * method) of the 33 stable landmarks MediaPipe itself uses for its Procrustes
 * solve onto the canonical face model. Rotating the 3D landmarks back by that
 * rotation and dropping z gives a pose-normalised frontal 2D landmark set in which
 * all measurements are taken.
 *
 * Limits (stated in every result): x/y are perspective projections while z is a
 * learned estimate, so the correction is a weak-perspective approximation, not a
 * full 3D reconstruction; points hidden at larger yaw are model predictions.
 */
import { CANONICAL_VERTICES } from "./canonical";
import type { Point } from "../types";

export type Point3 = { x: number; y: number; z: number };
export type Mat3 = [number, number, number, number, number, number, number, number, number]; // row-major

/** Landmark ids and weights of MediaPipe's procrustes basis (geometry_pipeline_metadata_landmarks.pbtxt, Apache-2.0). */
export const PROCRUSTES_BASIS: [number, number][] = [
  [4, 0.0709099], [6, 0.0321001], [10, 0.00844655], [33, 0.0587242], [54, 0.00766708], [67, 0.00907806], [117, 0.00979194],
  [119, 0.0145654], [121, 0.0185914], [127, 0.00519799], [129, 0.120625], [132, 0.00556002], [133, 0.0532862], [136, 0.0668905],
  [143, 0.0148165], [147, 0.0142628], [198, 0.0254622], [205, 0.0472523], [263, 0.0587242], [284, 0.00766708], [297, 0.00907806],
  [346, 0.00979194], [348, 0.0145654], [350, 0.0185914], [356, 0.00519799], [358, 0.120625], [361, 0.00556002], [362, 0.0532862],
  [365, 0.0668905], [372, 0.0148165], [376, 0.0142628], [420, 0.0254622], [425, 0.0472523],
];

/** Canonical vertex in the image orientation (x right, y down, z away from the camera). */
export function canonicalImageFrame(i: number): Point3 {
  return { x: CANONICAL_VERTICES[3 * i], y: -CANONICAL_VERTICES[3 * i + 1], z: -CANONICAL_VERTICES[3 * i + 2] };
}

/** Eigen-decomposition of a symmetric matrix (cyclic Jacobi). Returns eigenvalues and column eigenvectors. */
export function jacobiEigen(a: number[][]): { values: number[]; vectors: number[][] } {
  const n = a.length;
  const A = a.map((r) => [...r]);
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
    if (off < 1e-22) break;
    for (let p = 0; p < n; p++) {
      for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < n; k++) {
          const akp = A[k][p];
          const akq = A[k][q];
          A[k][p] = c * akp - s * akq;
          A[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = A[p][k];
          const aqk = A[q][k];
          A[p][k] = c * apk - s * aqk;
          A[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = V[k][p];
          const vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  return { values: A.map((r, i) => r[i]), vectors: V };
}

export interface RigidFit {
  /** rotation taking the template (image orientation) onto the detected points */
  R: Mat3;
  scale: number;
  /** weighted centroids */
  cTemplate: Point3;
  cDetected: Point3;
  /** weighted RMS residual relative to the fitted template, in detected units */
  rms: number;
}

/** Weighted similarity fit (Horn 1987, unit quaternions): detected ≈ scale·R·template + t. */
export function fitRigid(template: Point3[], detected: Point3[], weights: number[]): RigidFit {
  let W = 0;
  const ct = { x: 0, y: 0, z: 0 };
  const cd = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < template.length; i++) {
    const w = weights[i];
    W += w;
    ct.x += w * template[i].x; ct.y += w * template[i].y; ct.z += w * template[i].z;
    cd.x += w * detected[i].x; cd.y += w * detected[i].y; cd.z += w * detected[i].z;
  }
  for (const c of [ct, cd]) {
    c.x /= W; c.y /= W; c.z /= W;
  }
  // cross-covariance S = Σ w (t − ct)(d − cd)ᵀ
  const S = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  let tt = 0;
  for (let i = 0; i < template.length; i++) {
    const w = weights[i];
    const a = [template[i].x - ct.x, template[i].y - ct.y, template[i].z - ct.z];
    const b = [detected[i].x - cd.x, detected[i].y - cd.y, detected[i].z - cd.z];
    tt += w * (a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) S[r * 3 + c] += w * a[r] * b[c];
  }
  const [Sxx, Sxy, Sxz, Syx, Syy, Syz, Szx, Szy, Szz] = S;
  const N = [
    [Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx],
    [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
    [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy],
    [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz],
  ];
  const { values, vectors } = jacobiEigen(N);
  let k = 0;
  for (let i = 1; i < 4; i++) if (values[i] > values[k]) k = i;
  const [q0, qx, qy, qz] = [vectors[0][k], vectors[1][k], vectors[2][k], vectors[3][k]];
  const R: Mat3 = [
    q0 * q0 + qx * qx - qy * qy - qz * qz, 2 * (qx * qy - q0 * qz), 2 * (qx * qz + q0 * qy),
    2 * (qy * qx + q0 * qz), q0 * q0 - qx * qx + qy * qy - qz * qz, 2 * (qy * qz - q0 * qx),
    2 * (qz * qx - q0 * qy), 2 * (qz * qy + q0 * qx), q0 * q0 - qx * qx - qy * qy + qz * qz,
  ];
  // optimal scale and residual
  let num = 0;
  for (let i = 0; i < template.length; i++) {
    const a = [template[i].x - ct.x, template[i].y - ct.y, template[i].z - ct.z];
    const b = [detected[i].x - cd.x, detected[i].y - cd.y, detected[i].z - cd.z];
    const ra = [R[0] * a[0] + R[1] * a[1] + R[2] * a[2], R[3] * a[0] + R[4] * a[1] + R[5] * a[2], R[6] * a[0] + R[7] * a[1] + R[8] * a[2]];
    num += weights[i] * (ra[0] * b[0] + ra[1] * b[1] + ra[2] * b[2]);
  }
  const scale = num / (tt || 1);
  let res = 0;
  for (let i = 0; i < template.length; i++) {
    const a = [template[i].x - ct.x, template[i].y - ct.y, template[i].z - ct.z];
    const b = [detected[i].x - cd.x, detected[i].y - cd.y, detected[i].z - cd.z];
    const ra = [R[0] * a[0] + R[1] * a[1] + R[2] * a[2], R[3] * a[0] + R[4] * a[1] + R[5] * a[2], R[6] * a[0] + R[7] * a[1] + R[8] * a[2]];
    res += weights[i] * ((scale * ra[0] - b[0]) ** 2 + (scale * ra[1] - b[1]) ** 2 + (scale * ra[2] - b[2]) ** 2);
  }
  return { R, scale, cTemplate: ct, cDetected: cd, rms: Math.sqrt(res / W) };
}

export interface HeadPose3D {
  /** + = head turned towards the subject's left (face points to image right) */
  yaw: number;
  /** + = chin up (face points upwards) */
  pitch: number;
  /** + = head tilted so that the subject's left eye is lower in the image (clockwise on screen) */
  roll: number;
}

/**
 * Pose angles of R (template → detected, image orientation): R = Rz(roll)·Ry(yaw)·Rx(pitch).
 * Sign conventions are fixed by unit tests with known synthetic rotations.
 */
export function poseFromRotation(R: Mat3): HeadPose3D {
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const yaw = Math.asin(Math.max(-1, Math.min(1, -R[6])));
  const pitch = Math.atan2(R[7], R[8]);
  const roll = Math.atan2(R[3], R[0]);
  return { yaw: -toDeg(yaw), pitch: -toDeg(pitch), roll: toDeg(roll) };
}

export const applyMat = (R: Mat3, v: Point3): Point3 => ({
  x: R[0] * v.x + R[1] * v.y + R[2] * v.z,
  y: R[3] * v.x + R[4] * v.y + R[5] * v.z,
  z: R[6] * v.x + R[7] * v.y + R[8] * v.z,
});
export const transpose = (R: Mat3): Mat3 => [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]];

/** Rotation matrix from pose angles (inverse of poseFromRotation), used by tests and the reference head renderer. */
export function rotationFromPose(p: HeadPose3D): Mat3 {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = r(-p.yaw);
  const x = r(-p.pitch);
  const z = r(p.roll);
  const Rx: Mat3 = [1, 0, 0, 0, Math.cos(x), -Math.sin(x), 0, Math.sin(x), Math.cos(x)];
  const Ry: Mat3 = [Math.cos(y), 0, Math.sin(y), 0, 1, 0, -Math.sin(y), 0, Math.cos(y)];
  const Rz: Mat3 = [Math.cos(z), -Math.sin(z), 0, Math.sin(z), Math.cos(z), 0, 0, 0, 1];
  const mul = (A: Mat3, B: Mat3): Mat3 => {
    const o = [0, 0, 0, 0, 0, 0, 0, 0, 0] as Mat3;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
    return o;
  };
  return mul(Rz, mul(Ry, Rx));
}

export function hasDepth(mesh: (Point & { z?: number })[]): mesh is Point3[] {
  return mesh.length >= 478 && mesh.every((p) => typeof p.z === "number" && Number.isFinite(p.z));
}

export interface PoseNormalisation {
  fit: RigidFit;
  pose: HeadPose3D;
  /** pose-normalised 2D points (pixels, same scale and centroid as the input) */
  frontal: Point[];
  /** RMS of the rigid-fit residual relative to the inter-pupillary distance */
  residualIpd: number;
}

/** Fits the head rotation and rotates the 3D landmarks back to a frontal view. */
export function normaliseHeadPose(mesh: Point3[]): PoseNormalisation {
  const template = PROCRUSTES_BASIS.map(([i]) => canonicalImageFrame(i));
  const detected = PROCRUSTES_BASIS.map(([i]) => mesh[i]);
  const weights = PROCRUSTES_BASIS.map(([, w]) => w);
  const fit = fitRigid(template, detected, weights);
  const Rt = transpose(fit.R);
  const c = fit.cDetected;
  const frontal = mesh.map((p) => {
    const v = applyMat(Rt, { x: p.x - c.x, y: p.y - c.y, z: p.z - c.z });
    return { x: c.x + v.x, y: c.y + v.y };
  });
  const ipd = Math.hypot(mesh[468].x - mesh[473].x, mesh[468].y - mesh[473].y, mesh[468].z - mesh[473].z) || 1;
  return { fit, pose: poseFromRotation(fit.R), frontal, residualIpd: fit.rms / ipd };
}

/** Frontal position of an extra 2D point (hairline, neck) whose depth is interpolated from the nearest mesh points. */
export function normalisePoint(p: Point, mesh: Point3[], norm: PoseNormalisation, k = 6): Point {
  const near = mesh
    .map((m, i) => ({ i, d: Math.hypot(m.x - p.x, m.y - p.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, k);
  let wz = 0;
  let W = 0;
  for (const n of near) {
    const w = 1 / (n.d + 1e-3);
    wz += w * mesh[n.i].z;
    W += w;
  }
  const z = wz / W;
  const c = norm.fit.cDetected;
  const v = applyMat(transpose(norm.fit.R), { x: p.x - c.x, y: p.y - c.y, z: z - c.z });
  return { x: c.x + v.x, y: c.y + v.y };
}
