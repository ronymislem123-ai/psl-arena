"use client";

export interface LoadedImage {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  /** JPEG data URL (max 1600 px on the long edge) used for preview & optional storage. */
  dataUrl: string;
  originalName: string;
  mime: string;
}

export const MAX_EDGE = 1600;

export async function loadImageFile(file: File | Blob, originalName = "image"): Promise<LoadedImage> {
  if (!/^image\/(jpeg|png|webp|heic|heif|bmp)$/i.test(file.type) && !/\.(jpe?g|png|webp)$/i.test(originalName)) {
    throw new Error("Unsupported file type. Please use a JPEG, PNG or WebP image.");
  }
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("The file could not be decoded as an image."));
      };
      img.src = url;
    });
  }
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  if (!srcW || !srcH) throw new Error("The image has no dimensions.");
  const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.drawImage(bitmap, 0, 0, w, h);
  if ("close" in bitmap) bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  return { canvas, width: w, height: h, dataUrl, originalName, mime: "image/jpeg" };
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
