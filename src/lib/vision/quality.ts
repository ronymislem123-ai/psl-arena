"use client";
import type { RawQualityMetrics } from "@/engine/types";
import type { DetectedFace } from "./detect";
import type { LoadedImage } from "./image";

type ImageMeta = Pick<LoadedImage, "sourceWidth" | "sourceHeight" | "exif" | "sourceMime">;

/**
 * Pixel statistics on a normalised 256-px-wide grayscale crop of the face, plus
 * capture metrics (exposure clipping, side lighting, skin texture, JPEG blocking,
 * backdrop uniformity) and the EXIF focal length / software tag.
 */
export function computeRawQuality(canvas: HTMLCanvasElement, face: DetectedFace, faceCount: number, meta?: ImageMeta): RawQualityMetrics {
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

  // --- capture metrics ---------------------------------------------------------
  const toCrop = (i: number) => ({ x: (face.mesh[i].x - x0) * scale, y: (face.mesh[i].y - y0) * scale });
  const patch = (i: number, r: number) => {
    const c = toCrop(i);
    let sumL = 0, sumHP = 0, n = 0;
    for (let y = Math.max(1, Math.round(c.y - r)); y <= Math.min(th - 2, Math.round(c.y + r)); y++) {
      for (let x = Math.max(1, Math.round(c.x - r)); x <= Math.min(tw - 2, Math.round(c.x + r)); x++) {
        const k = y * tw + x;
        sumL += gray[k];
        sumHP += Math.abs(gray[k - tw] + gray[k + tw] + gray[k - 1] + gray[k + 1] - 4 * gray[k]);
        n++;
      }
    }
    return n ? { l: sumL / n, hp: sumHP / n } : null;
  };
  const pr = Math.max(4, Math.round(tw * 0.045));
  const cheekR = patch(50, pr), cheekL = patch(280, pr), forehead = patch(151, pr), eyeR = patch(159, pr), eyeL = patch(386, pr);
  const lightingAsymmetry = cheekR && cheekL ? Math.abs(cheekR.l - cheekL.l) / Math.max(1, (cheekR.l + cheekL.l) / 2) : undefined;
  const skinHP = [cheekR, cheekL, forehead].filter(Boolean).map((p) => p!.hp);
  const eyeHP = [eyeR, eyeL].filter(Boolean).map((p) => p!.hp);
  const skinTexture = skinHP.length && eyeHP.length ? skinHP.reduce((a, b) => a + b, 0) / skinHP.length / Math.max(1e-6, eyeHP.reduce((a, b) => a + b, 0) / eyeHP.length) : null;
  let dark = 0, bright = 0, inEllipse = 0;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const ex = (x - tw / 2) / (tw * 0.38);
      const ey = (y - th / 2) / (th * 0.42);
      if (ex * ex + ey * ey > 1) continue;
      const g = gray[y * tw + x];
      inEllipse++;
      if (g <= 4) dark++;
      else if (g >= 251) bright++;
    }
  }
  const downscaled = !!meta && (meta.sourceWidth !== canvas.width || meta.sourceHeight !== canvas.height);
  const isJpeg = !!meta && /jpe?g/i.test(meta.sourceMime);
  const blockiness = meta && !downscaled && isJpeg ? jpegBlockiness(canvas, face.box) : null;
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
    sourceWidth: meta?.sourceWidth,
    sourceHeight: meta?.sourceHeight,
    focalLength35mm: meta?.exif?.focalLength35mm ?? null,
    editingSoftware: meta?.exif?.software ?? null,
    clipDark: inEllipse ? dark / inEllipse : 0,
    clipBright: inEllipse ? bright / inEllipse : 0,
    lightingAsymmetry,
    blockiness,
    skinTexture,
    backgroundSpread: borderSpread(canvas),
  };
}

/** Ratio of the mean gradient across 8-px block boundaries to the mean gradient elsewhere (≈ 1 for clean images). */
function jpegBlockiness(canvas: HTMLCanvasElement, box: { x: number; y: number; w: number; h: number }): number | null {
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const w = Math.min(canvas.width - x0, Math.ceil(box.w), 640);
  const h = Math.min(canvas.height - y0, Math.ceil(box.h), 640);
  if (w < 32 || h < 32) return null;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const { data } = ctx.getImageData(x0, y0, w, h);
  const g = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };
  let bSum = 0, bN = 0, oSum = 0, oN = 0;
  for (let y = 0; y < h; y += 2) {
    for (let x = 1; x < w; x++) {
      const d = Math.abs(g(x, y) - g(x - 1, y));
      if ((x0 + x) % 8 === 0) { bSum += d; bN++; } else { oSum += d; oN++; }
    }
  }
  for (let x = 0; x < w; x += 2) {
    for (let y = 1; y < h; y++) {
      const d = Math.abs(g(x, y) - g(x, y - 1));
      if ((y0 + y) % 8 === 0) { bSum += d; bN++; } else { oSum += d; oN++; }
    }
  }
  if (!bN || !oN) return null;
  return bSum / bN / Math.max(1e-6, oSum / oN);
}

/** Luminance standard deviation along the image border (outer 8 %), on a 96-px-wide thumbnail. */
function borderSpread(canvas: HTMLCanvasElement): number | null {
  const tw = 96;
  const th = Math.max(8, Math.round((canvas.height / canvas.width) * tw));
  const off = document.createElement("canvas");
  off.width = tw;
  off.height = th;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(canvas, 0, 0, tw, th);
  const { data } = ctx.getImageData(0, 0, tw, th);
  const bx = Math.max(1, Math.round(tw * 0.08));
  const by = Math.max(1, Math.round(th * 0.08));
  const vals: number[] = [];
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      if (x >= bx && x < tw - bx && y >= by && y < th - by) continue;
      const i = (y * tw + x) * 4;
      vals.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    }
  }
  if (!vals.length) return null;
  const m = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
}
