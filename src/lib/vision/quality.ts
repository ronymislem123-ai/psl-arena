"use client";
import type { RawQualityMetrics } from "@/engine/types";
import type { DetectedFace } from "./detect";

/** Pixel statistics on a normalised 256-px-wide grayscale crop of the face. */
export function computeRawQuality(canvas: HTMLCanvasElement, face: DetectedFace, faceCount: number): RawQualityMetrics {
  const pad = 0.1;
  const x0 = Math.max(0, Math.floor(face.box.x - face.box.w * pad));
  const y0 = Math.max(0, Math.floor(face.box.y - face.box.h * pad));
  const x1 = Math.min(canvas.width, Math.ceil(face.box.x + face.box.w * (1 + pad)));
  const y1 = Math.min(canvas.height, Math.ceil(face.box.y + face.box.h * (1 + pad)));
  const cw = Math.max(1, x1 - x0);
  const ch = Math.max(1, y1 - y0);
  const targetW = 256;
  const scale = targetW / cw;
  const tw = targetW;
  const th = Math.max(8, Math.round(ch * scale));
  const off = document.createElement("canvas");
  off.width = tw;
  off.height = th;
  const ctx = off.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(canvas, x0, y0, cw, ch, 0, 0, tw, th);
  const { data } = ctx.getImageData(0, 0, tw, th);
  const gray = new Float32Array(tw * th);
  let sum = 0;
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    gray[j] = g;
    sum += g;
  }
  const n = tw * th;
  const mean = sum / n;
  let varSum = 0;
  for (let j = 0; j < n; j++) varSum += (gray[j] - mean) ** 2;
  const contrast = Math.sqrt(varSum / n);
  // variance of Laplacian
  let lapSum = 0;
  let lapSq = 0;
  let cnt = 0;
  for (let y = 1; y < th - 1; y++) {
    for (let x = 1; x < tw - 1; x++) {
      const i = y * tw + x;
      const l = gray[i - tw] + gray[i + tw] + gray[i - 1] + gray[i + 1] - 4 * gray[i];
      lapSum += l;
      lapSq += l * l;
      cnt++;
    }
  }
  const lapMean = lapSum / Math.max(1, cnt);
  const sharpness = lapSq / Math.max(1, cnt) - lapMean * lapMean;
  return {
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    faceWidthPx: face.box.w,
    faceHeightPx: face.box.h,
    sharpness,
    brightness: mean,
    contrast,
    faceBox: face.box,
    faceCount,
  };
}
