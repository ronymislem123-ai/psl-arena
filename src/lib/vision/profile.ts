"use client";
/**
 * Automatic side view in the browser: quality check → person segmentation (MediaPipe
 * Image Segmenter, multiclass selfie model, served from this origin) → profile
 * landmarks from the silhouette (engine/side-auto.ts). The photo never leaves the
 * device for this step.
 *
 * Two passes: the segmenter works on a 256 × 256 input, so after a first pass over
 * the whole photo the head region is cropped and segmented again — the contour is
 * then traced at several times the resolution.
 */
import type { ImageSegmenter } from "@mediapipe/tasks-vision";
import { detectProfileLandmarks, type AutoProfileResult } from "@/engine/side-auto";
import { withBase } from "@/lib/base-path";
import { WASM_BASE } from "./landmarker";
import { detectFaces } from "./detect";

export const SEGMENTER_MODEL_PATH = withBase("/models/selfie_multiclass_256x256.tflite");

let segmenter: Promise<ImageSegmenter> | null = null;

export function getSegmenter(): Promise<ImageSegmenter> {
  if (!segmenter) {
    segmenter = (async () => {
      const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      return ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: SEGMENTER_MODEL_PATH, delegate: "CPU" },
        runningMode: "IMAGE",
        outputCategoryMask: true,
        outputConfidenceMasks: true,
      });
    })().catch((e) => {
      segmenter = null;
      throw e;
    });
  }
  return segmenter;
}

export function warmUpSegmenter() {
  if (typeof window === "undefined") return;
  void getSegmenter().catch(() => undefined);
}

interface Masks {
  width: number;
  height: number;
  foreground: Float32Array;
  categories: Uint8Array;
}

/** Segments a canvas region, downscaled so that its longer edge is at most `maxEdge`. */
async function segment(src: HTMLCanvasElement, region: { x: number; y: number; w: number; h: number }, maxEdge: number): Promise<Masks & { scale: number }> {
  const seg = await getSegmenter();
  const scale = Math.max(1, Math.max(region.w, region.h) / maxEdge);
  const w = Math.max(16, Math.round(region.w / scale));
  const h = Math.max(16, Math.round(region.h / scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(src, region.x, region.y, region.w, region.h, 0, 0, w, h);
  const res = seg.segment(c);
  try {
    const bg = res.confidenceMasks![0].getAsFloat32Array();
    const foreground = new Float32Array(bg.length);
    for (let i = 0; i < bg.length; i++) foreground[i] = 1 - bg[i];
    const categories = new Uint8Array(res.categoryMask!.getAsUint8Array());
    return { width: res.categoryMask!.width, height: res.categoryMask!.height, foreground, categories, scale: region.w / res.categoryMask!.width };
  } finally {
    res.close();
  }
}

export interface ProfileQuality {
  /** frontal-ish face found by the face landmarker (yaw below ~50°): not a profile photo */
  frontalFaceYawDeg: number | null;
  faceHeightPx: number | null;
  brightness: number;
}

export interface AutoProfileRun {
  result: AutoProfileResult;
  quality: ProfileQuality;
  /** milliseconds */
  timing: number;
}

function meanBrightness(canvas: HTMLCanvasElement): number {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(canvas, 0, 0, 64, 64);
  const d = ctx.getImageData(0, 0, 64, 64).data;
  let s = 0;
  for (let i = 0; i < d.length; i += 4) s += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return s / (d.length / 4);
}

/** Yaw (degrees) of the largest face the landmarker finds, or null when none is found. */
async function frontalYaw(canvas: HTMLCanvasElement): Promise<number | null> {
  try {
    const faces = await detectFaces(canvas);
    const f = faces[0];
    if (!f) return null;
    // yaw from the nose tip's horizontal position between the outer eye corners (scale-free)
    const r = f.mesh[33];
    const l = f.mesh[263];
    const tip = f.mesh[1];
    const t = (tip.x - r.x) / (l.x - r.x || 1); // 0.5 = frontal
    return Math.min(90, Math.abs((Math.asin(Math.max(-1, Math.min(1, (t - 0.5) * 2))) * 180) / Math.PI));
  } catch {
    return null;
  }
}

export async function detectProfile(canvas: HTMLCanvasElement): Promise<AutoProfileRun> {
  const t0 = performance.now();
  const W = canvas.width;
  const H = canvas.height;
  const [yaw, first] = await Promise.all([frontalYaw(canvas), segment(canvas, { x: 0, y: 0, w: W, h: H }, 512)]);
  const quality: ProfileQuality = { frontalFaceYawDeg: yaw, faceHeightPx: null, brightness: meanBrightness(canvas) };

  // pass 1 → head region; pass 2 on the crop at a higher effective resolution
  let result = detectProfileLandmarks({ ...first, scale: first.scale });
  if (result.ok && result.scalePx) {
    const pts = Object.values(result.points);
    const minY = Math.min(...pts.map((p) => p.y));
    const maxY = Math.max(...pts.map((p) => p.y));
    const cm = result.scalePx;
    const y0 = Math.max(0, Math.round(minY - 14 * cm));
    const y1 = Math.min(H, Math.round(maxY + 8 * cm));
    const xs = pts.map((p) => p.x);
    const xc = (Math.min(...xs) + Math.max(...xs)) / 2;
    const half = Math.max((y1 - y0) / 2, 14 * cm);
    const x0 = Math.max(0, Math.round(xc - half));
    const x1 = Math.min(W, Math.round(xc + half));
    if ((x1 - x0) * (y1 - y0) < 0.8 * W * H) {
      const second = await segment(canvas, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, 768);
      const refined = detectProfileLandmarks({ ...second, scale: second.scale, offset: { x: x0, y: y0 } });
      if (refined.ok) {
        // the crop of pass 2 may cut the back of the head on purpose: only the full photo decides "cut off"
        const cutInPhoto = result.issues.some((i) => i.code === "personCut");
        result = cutInPhoto ? refined : { ...refined, issues: refined.issues.filter((i) => i.code !== "personCut") };
      }
    }
  }
  if (result.ok && result.points.glabella && result.points.menton) quality.faceHeightPx = Math.abs(result.points.menton.y - result.points.glabella.y);
  return { result, quality, timing: performance.now() - t0 };
}

/** True when the photo is clearly not a profile (a face turned less than 50° was found). */
export function looksFrontal(q: ProfileQuality): boolean {
  return q.frontalFaceYawDeg != null && q.frontalFaceYawDeg < 50;
}
