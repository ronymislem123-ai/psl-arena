"use client";
import type { AnalysisConfig, AnalysisInput, Point } from "@/engine/types";
import { detectFaces, type DetectedFace } from "./detect";
import { estimateHairline, type HairlineEstimate } from "./hairline";
import { loadImageFile, type LoadedImage } from "./image";
import { computeRawQuality } from "./quality";

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
    blendshapes: face.blendshapes,
    transformMatrix: face.matrix,
    rawQuality: computeRawQuality(prep.image.canvas, face, prep.faces.length),
    config,
  };
}
