"use client";
import type { Point } from "@/engine/types";
import { getLandmarker } from "./landmarker";

export interface DetectedFace {
  index: number;
  /** 478 mesh points in image pixels */
  mesh: Point[];
  box: { x: number; y: number; w: number; h: number };
  blendshapes: Record<string, number>;
  matrix: number[] | null;
}

export async function detectFaces(canvas: HTMLCanvasElement): Promise<DetectedFace[]> {
  const lm = await getLandmarker();
  const res = lm.detect(canvas);
  const W = canvas.width;
  const H = canvas.height;
  const faces: DetectedFace[] = res.faceLandmarks.map((pts, i) => {
    const mesh = pts.map((p) => ({ x: p.x * W, y: p.y * H }));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of mesh) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const bs: Record<string, number> = {};
    for (const c of res.faceBlendshapes?.[i]?.categories ?? []) bs[c.categoryName] = c.score;
    const m = res.facialTransformationMatrixes?.[i]?.data;
    return { index: i, mesh, box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY }, blendshapes: bs, matrix: m && m.length === 16 ? Array.from(m) : null };
  });
  faces.sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
  return faces.map((f, i) => ({ ...f, index: i }));
}
