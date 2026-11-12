"use client";
/**
 * Landmark verification passes (engine 3.1). The photo is detected again under
 * controlled changes and every detection is mapped back to the photo's pixels:
 *
 *   mirror      – horizontally mirrored (point i ↔ its mirror vertex)
 *   rotPlus     – rotated +5° about the face centre
 *   rotMinus    – rotated −5°
 *   zoom        – square face crop with margin, enlarged (re-detection on a zoomed view)
 *   zoomMirror  – the zoomed crop, mirrored
 *
 * The engine takes the median of all passes as the verified position of every
 * landmark and checks each landmark, measurement and the final result against the
 * passes (src/engine/verify). Everything runs on this device; nothing is uploaded.
 */
import { MIRROR } from "@/engine/landmarks/canonical";
import type { Point, VerificationInput, VerificationPassInput } from "@/engine/types";
import { detectFaces, type DetectedFace } from "./detect";
import { estimateHairline } from "./hairline";

type PassId = VerificationPassInput["id"];
export const PASS_IDS: PassId[] = ["mirror", "rotPlus", "rotMinus", "zoom", "zoomMirror"];
export const ROTATION_DEG = 5;
const ZOOM_MARGIN = 0.35; // margin around the face box (share of its larger side) for the zoomed crop
const ZOOM_TARGET = 1024; // pixels of the zoomed crop (only enlarged, never reduced below the crop)

interface Variant {
  canvas: HTMLCanvasElement;
  /** variant pixel → photo pixel */
  toPhoto: (p: Point) => Point;
  /** z scale variant → photo */
  zScale: number;
  mirrored: boolean;
}

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.fillStyle = "#7f7f7f";
  ctx.fillRect(0, 0, c.width, c.height);
  return { c, ctx };
}

function center(mesh: Point[]): Point {
  let x = 0;
  let y = 0;
  for (const p of mesh) {
    x += p.x;
    y += p.y;
  }
  return { x: x / mesh.length, y: y / mesh.length };
}

function makeVariant(id: PassId, src: HTMLCanvasElement, face: DetectedFace): Variant {
  const W = src.width;
  const H = src.height;
  const c0 = center(face.mesh);
  if (id === "mirror") {
    const { c, ctx } = canvasOf(W, H);
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(src, 0, 0);
    return { canvas: c, toPhoto: (p) => ({ x: W - p.x, y: p.y }), zScale: 1, mirrored: true };
  }
  if (id === "rotPlus" || id === "rotMinus") {
    const a = ((id === "rotPlus" ? 1 : -1) * ROTATION_DEG * Math.PI) / 180;
    const { c, ctx } = canvasOf(W, H);
    ctx.translate(c0.x, c0.y);
    ctx.rotate(a);
    ctx.translate(-c0.x, -c0.y);
    ctx.drawImage(src, 0, 0);
    const co = Math.cos(a);
    const si = Math.sin(a);
    // variant = R(a)·(photo − c0) + c0  ⇒  photo = R(−a)·(variant − c0) + c0
    return { canvas: c, toPhoto: (p) => ({ x: c0.x + co * (p.x - c0.x) + si * (p.y - c0.y), y: c0.y - si * (p.x - c0.x) + co * (p.y - c0.y) }), zScale: 1, mirrored: false };
  }
  // zoomed crop (optionally mirrored)
  const side = Math.max(face.box.w, face.box.h) * (1 + 2 * ZOOM_MARGIN);
  const ox = c0.x - side / 2;
  const oy = c0.y - side / 2;
  const out = Math.max(side, ZOOM_TARGET);
  const k = out / side;
  const { c, ctx } = canvasOf(out, out);
  const mirrored = id === "zoomMirror";
  if (mirrored) {
    ctx.translate(out, 0);
    ctx.scale(-1, 1);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(src, ox, oy, side, side, 0, 0, out, out);
  return { canvas: c, toPhoto: (p) => ({ x: ox + (mirrored ? out - p.x : p.x) / k, y: oy + p.y / k }), zScale: 1 / k, mirrored };
}

/** Maps a detection on a variant back to the photo (index order of the unchanged photo). */
function mapBack(face: DetectedFace, v: Variant): Point[] {
  const m = face.mesh;
  return m.map((_, i) => {
    const q = m[v.mirrored ? MIRROR[i] : i];
    const p = v.toPhoto(q);
    return q.z !== undefined ? { x: p.x, y: p.y, z: q.z * v.zScale } : p;
  });
}

export interface VerificationProgress {
  done: number;
  total: number;
}

/**
 * Runs the verification passes for one detected face. Faces of a pass are matched
 * by their centre; a pass without a matching face is reported as failed.
 */
export async function runVerificationPasses(src: HTMLCanvasElement, face: DetectedFace, onProgress?: (p: VerificationProgress) => void): Promise<VerificationInput> {
  const passes: VerificationPassInput[] = [];
  const failed: PassId[] = [];
  const c0 = center(face.mesh);
  const maxOff = 0.35 * Math.max(face.box.w, face.box.h);
  let done = 0;
  onProgress?.({ done, total: PASS_IDS.length });
  for (const id of PASS_IDS) {
    try {
      const v = makeVariant(id, src, face);
      const found = await detectFaces(v.canvas);
      let best: Point[] | null = null;
      let bestD = Infinity;
      for (const f of found) {
        const mesh = mapBack(f, v);
        const c = center(mesh);
        const d = Math.hypot(c.x - c0.x, c.y - c0.y);
        if (d < bestD) {
          bestD = d;
          best = mesh;
        }
      }
      v.canvas.width = 0; // release the pixels right away (phones)
      if (best && bestD <= maxOff) {
        const hair = estimateHairline(src, best);
        passes.push({ id, mesh: best.map((p) => ({ x: round2(p.x), y: round2(p.y), ...(p.z !== undefined ? { z: round2(p.z) } : {}) })), trichion: hair ? { x: round2(hair.point.x), y: round2(hair.point.y) } : null });
      } else failed.push(id);
    } catch {
      failed.push(id);
    }
    done++;
    onProgress?.({ done, total: PASS_IDS.length });
    // let the page breathe between detections
    await new Promise((r) => setTimeout(r, 0));
  }
  return { passes, failed };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
