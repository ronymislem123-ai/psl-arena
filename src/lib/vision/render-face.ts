"use client";
/**
 * Shaded rendering of a 478-point face mesh (ideal example). Not photorealistic:
 * flat-shaded triangles of the canonical topology with a neutral skin tone, eyes,
 * brows, lips and a hair cap above the hairline — enough for the MediaPipe face
 * landmarker to detect the face again, so the rendered geometry can be re-measured.
 */
import { CANONICAL_TRIANGLES } from "@/engine/landmarks/canonical";
import { BROW_LOWER_L, BROW_LOWER_R, BROW_UPPER_L, BROW_UPPER_R, EYE_RING_L, EYE_RING_R, FACE_OVAL, LIPS_INNER, LIPS_OUTER } from "@/engine/landmarks/mesh-map";
import type { Point } from "@/engine/types";

export type RenderPoint = { x: number; y: number; z: number };

const SKIN = [214, 172, 146];
const LIGHT = (() => {
  const v = [-0.35, -0.45, -0.82]; // direction towards the light: upper left, in front of the face (image frame: y down, z away from the camera)
  const n = Math.hypot(v[0], v[1], v[2]);
  return v.map((x) => x / n);
})();

const path = (ctx: CanvasRenderingContext2D, pts: Point[]) => {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
};

export function renderFace(canvas: HTMLCanvasElement, mesh: RenderPoint[], trichion: Point) {
  const ctx = canvas.getContext("2d")!;
  const W = canvas.width;
  const H = canvas.height;
  const ipd = Math.hypot(mesh[473].x - mesh[468].x, mesh[473].y - mesh[468].y);
  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#c9ccd1");
  bg.addColorStop(1, "#a9adb3");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const oval = FACE_OVAL.map((i) => mesh[i]);
  const cx = (mesh[234].x + mesh[454].x) / 2;
  const faceW = Math.abs(mesh[454].x - mesh[234].x);
  const chin = mesh[152];
  const shade = (k: number) => `rgb(${SKIN.map((x) => Math.min(255, Math.round(x * k))).join(",")})`;
  // shoulders (well below the chin so the neck and the jaw edge stay visible)
  ctx.fillStyle = "#3d4a5c";
  ctx.beginPath();
  ctx.ellipse(cx, H + ipd * 1.25, faceW * 1.3, ipd * 1.6, 0, Math.PI, 2 * Math.PI);
  ctx.fill();
  // neck, darker under the jaw (cast shadow)
  const neckTop = chin.y - ipd * 0.9;
  const neck = ctx.createLinearGradient(0, chin.y - ipd * 0.2, 0, chin.y + ipd * 0.5);
  neck.addColorStop(0, shade(0.55));
  neck.addColorStop(1, shade(0.8));
  ctx.fillStyle = neck;
  ctx.beginPath();
  ctx.moveTo(cx - faceW * 0.3, neckTop);
  ctx.lineTo(cx + faceW * 0.3, neckTop);
  ctx.quadraticCurveTo(cx + faceW * 0.3, H - ipd * 0.5, cx + faceW * 0.38, H);
  ctx.lineTo(cx - faceW * 0.38, H);
  ctx.quadraticCurveTo(cx - faceW * 0.3, H - ipd * 0.5, cx - faceW * 0.3, neckTop);
  ctx.fill();
  // ears
  ctx.fillStyle = shade(0.88);
  for (const [i, sd] of [[234, -1], [454, 1]] as const) {
    ctx.beginPath();
    ctx.ellipse(mesh[i].x + sd * ipd * 0.06, mesh[i].y + ipd * 0.15, ipd * 0.16, ipd * 0.36, sd * 0.12, 0, 2 * Math.PI);
    ctx.fill();
  }
  // hair (behind the face): a cap above the hairline plus side hair down to the temples
  const top = mesh[10];
  ctx.fillStyle = "#2b2119";
  ctx.beginPath();
  ctx.ellipse(cx, trichion.y + ipd * 0.05, faceW * 0.6, ipd * 1.2, 0, Math.PI, 2 * Math.PI);
  ctx.lineTo(cx + faceW * 0.6, mesh[454].y - ipd * 0.25);
  ctx.lineTo(cx - faceW * 0.6, mesh[234].y - ipd * 0.25);
  ctx.closePath();
  ctx.fill();
  // forehead skin between the top of the mesh and the hairline: the upper face outline,
  // lifted towards the hairline in the middle (the mesh ends below the hairline)
  const lift = top.y - trichion.y;
  const upper = FACE_OVAL.map((i) => mesh[i]).filter((p) => p.y < mesh[168].y);
  const halfW = faceW / 2;
  ctx.fillStyle = shade(0.97);
  ctx.beginPath();
  upper
    .map((p) => {
      const w = Math.max(0, 1 - ((p.x - cx) / (halfW * 0.95)) ** 2);
      return { x: p.x, y: p.y - lift * w };
    })
    .sort((a, b) => Math.atan2(a.y - mesh[168].y, a.x - cx) - Math.atan2(b.y - mesh[168].y, b.x - cx))
    .forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.lineTo(cx, mesh[168].y);
  ctx.closePath();
  ctx.fill();

  // face triangles, far to near, flat Lambert shading
  const tris: { i: number; z: number; shade: number }[] = [];
  for (let t = 0; t < CANONICAL_TRIANGLES.length; t += 3) {
    const a = mesh[CANONICAL_TRIANGLES[t]];
    const b = mesh[CANONICAL_TRIANGLES[t + 1]];
    const c = mesh[CANONICAL_TRIANGLES[t + 2]];
    const u = [b.x - a.x, b.y - a.y, b.z - a.z];
    const v = [c.x - a.x, c.y - a.y, c.z - a.z];
    let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    n = n.map((x) => x / len);
    if (n[2] > 0) n = n.map((x) => -x); // face the camera (−z)
    const d = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    tris.push({ i: t, z: (a.z + b.z + c.z) / 3, shade: 0.5 + 0.55 * d });
  }
  tris.sort((p, q) => q.z - p.z);
  for (const tr of tris) {
    const a = mesh[CANONICAL_TRIANGLES[tr.i]];
    const b = mesh[CANONICAL_TRIANGLES[tr.i + 1]];
    const c = mesh[CANONICAL_TRIANGLES[tr.i + 2]];
    const col = SKIN.map((x) => Math.min(255, Math.round(x * tr.shade)));
    ctx.fillStyle = `rgb(${col[0]},${col[1]},${col[2]})`;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // soften facets inside the face outline
  ctx.save();
  path(ctx, oval);
  ctx.clip();
  ctx.filter = "blur(2px)";
  ctx.drawImage(canvas, 0, 0);
  ctx.restore();
  ctx.filter = "none";

  // brows
  ctx.fillStyle = "#3a2a20";
  for (const [up, low] of [[BROW_UPPER_R, BROW_LOWER_R], [BROW_UPPER_L, BROW_LOWER_L]] as const) {
    path(ctx, [...up.map((i) => mesh[i]), ...[...low].reverse().map((i) => mesh[i])]);
    ctx.fill();
  }
  // eyes: sclera, iris, pupil, highlight, lid line
  for (const [ring, c0] of [[EYE_RING_R, 468], [EYE_RING_L, 473]] as const) {
    ctx.save();
    path(ctx, ring.map((i) => mesh[i]));
    ctx.fillStyle = "#ece9e4";
    ctx.fill();
    ctx.clip();
    const ir = Math.hypot(mesh[c0 + 1].x - mesh[c0 + 3].x, mesh[c0 + 1].y - mesh[c0 + 3].y) / 2 || ipd * 0.09;
    ctx.fillStyle = "#5a3d28";
    ctx.beginPath();
    ctx.arc(mesh[c0].x, mesh[c0].y, ir, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(mesh[c0].x, mesh[c0].y, ir * 0.42, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = "#ffffffcc";
    ctx.beginPath();
    ctx.arc(mesh[c0].x - ir * 0.3, mesh[c0].y - ir * 0.3, ir * 0.16, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#2a1c14";
    ctx.lineWidth = Math.max(1.5, ipd * 0.012);
    path(ctx, ring.map((i) => mesh[i]));
    ctx.stroke();
  }
  // nostrils
  ctx.fillStyle = "rgba(70,40,35,0.75)";
  for (const i of [98, 327]) {
    ctx.beginPath();
    ctx.ellipse(mesh[i].x + (i === 98 ? ipd * 0.025 : -ipd * 0.025), mesh[i].y - ipd * 0.01, ipd * 0.04, ipd * 0.022, 0, 0, 2 * Math.PI);
    ctx.fill();
  }
  // lips
  ctx.fillStyle = "rgb(176,98,96)";
  ctx.beginPath();
  LIPS_OUTER.forEach((i, k) => (k ? ctx.lineTo(mesh[i].x, mesh[i].y) : ctx.moveTo(mesh[i].x, mesh[i].y)));
  ctx.closePath();
  [...LIPS_INNER].reverse().forEach((i, k) => (k ? ctx.lineTo(mesh[i].x, mesh[i].y) : ctx.moveTo(mesh[i].x, mesh[i].y)));
  ctx.closePath();
  ctx.fill("evenodd");
  ctx.strokeStyle = "rgba(90,40,40,0.8)";
  ctx.lineWidth = Math.max(1, ipd * 0.008);
  path(ctx, LIPS_INNER.map((i) => mesh[i]));
  ctx.stroke();
}
