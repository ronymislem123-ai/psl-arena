"use client";
import type { AnalysisConfig, AnalysisCorrections, AnalysisInput, Point } from "@/engine/types";
import { detectFaces, type DetectedFace } from "./detect";
import { estimateHairline, type HairlineEstimate } from "./hairline";
import { loadImageFile, type LoadedImage } from "./image";
import { computeRawQuality } from "./quality";
import { measureImageAppearance, type AppearanceImageInput } from "@/engine/appearance";

/** Image-based appearance measures (jaw edge, cheekbone shading) from the photo pixels; never leaves the device. */
function imageAppearance(canvas: HTMLCanvasElement, mesh: Point[]): AppearanceImageInput | null {
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    const W = canvas.width;
    const H = canvas.height;
    const d = ctx.getImageData(0, 0, W, H).data;
    return measureImageAppearance(mesh, (x, y) => {
      const xi = Math.round(x);
      const yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= W || yi >= H) return null;
      const k = (yi * W + xi) * 4;
      return 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2];
    });
  } catch {
    return null;
  }
}

export interface PreparedImage {
  image: LoadedImage;
  faces: DetectedFace[];
  hairline: (HairlineEstimate | null)[];
}

export async function prepareImage(file: File | Blob, name?: string): Promise<PreparedImage> {
  const image = await loadImageFile(file, name ?? (file instanceof File ? file.name : "image"));
  const faces = await detectFaces(image.canvas);
  const hairline = faces.map((f) => estimateHairline(image.canvas, f.mesh));
  return { image, faces, hairline };
}

export interface ManualAdjustments {
  trichion?: Point | null; // user-confirmed/adjusted hairline (raw pixels)
  trichionConfirmed?: boolean;
  neck?: { right: Point; left: Point } | null;
  /** engine 2.0: user-moved landmarks and reference-axis adjustment */
  corrections?: AnalysisCorrections | null;
}

export function buildAnalysisInput(prep: PreparedImage, faceIndex: number, config: AnalysisConfig, manual: ManualAdjustments = {}): AnalysisInput {
  const face = prep.faces[faceIndex];
  if (!face) throw new Error("No face selected");
  const est = prep.hairline[faceIndex];
  let trichion: AnalysisInput["trichion"] = null;
  if (manual.trichion) {
    trichion = { point: manual.trichion, source: manual.trichionConfirmed ? "manual" : "estimated", confidence: manual.trichionConfirmed ? 1 : (est?.confidence ?? 0.6) };
  } else if (manual.trichion === undefined && est) {
    trichion = { point: est.point, source: manual.trichionConfirmed ? "manual" : "estimated", confidence: manual.trichionConfirmed ? 1 : est.confidence };
  }
  return {
    mesh: face.mesh,
    trichion,
    neck: manual.neck ? { ...manual.neck, source: "manual" } : null,
    corrections: manual.corrections && (Object.keys(manual.corrections.landmarks ?? {}).length || manual.corrections.axisAdjustDeg) ? manual.corrections : null,
    blendshapes: face.blendshapes,
    transformMatrix: face.matrix,
    rawQuality: computeRawQuality(prep.image.canvas, face, prep.faces.length, prep.image),
    appearanceImage: imageAppearance(prep.image.canvas, face.mesh),
    config,
  };
}
