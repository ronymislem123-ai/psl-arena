import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AnalysisInput, Point, RawQualityMetrics } from "@/engine/types";
import { DEFAULT_CONFIG } from "@/engine/analysis";

export interface Fixture {
  name: string;
  width: number;
  height: number;
  mesh: ([number, number] | [number, number, number])[];
  blendshapes: Record<string, number>;
  matrix: number[];
}

export function loadFixture(name: string): Fixture {
  return JSON.parse(readFileSync(join(__dirname, "..", "fixtures", `${name}.json`), "utf8")) as Fixture;
}

export function faceBox(mesh: Point[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of mesh) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function inputFromFixture(f: Fixture, overrides: Partial<AnalysisInput> = {}, rawOverrides: Partial<RawQualityMetrics> = {}): AnalysisInput {
  const mesh = f.mesh.map((p) => (p.length === 3 ? { x: p[0], y: p[1], z: p[2] } : { x: p[0], y: p[1] }));
  const box = faceBox(mesh);
  const rawQuality: RawQualityMetrics = {
    imageWidth: f.width,
    imageHeight: f.height,
    faceWidthPx: box.w,
    faceHeightPx: box.h,
    sharpness: 180,
    brightness: 120,
    contrast: 45,
    faceBox: box,
    faceCount: 1,
    ...rawOverrides,
  };
  // a plausible hairline: 0.95 × IPD above the mesh top (synthetic for tests)
  const ipd = Math.hypot(mesh[468].x - mesh[473].x, mesh[468].y - mesh[473].y);
  const top = mesh[10];
  return {
    mesh,
    trichion: { point: { x: top.x, y: top.y - 0.45 * ipd }, source: "manual", confidence: 1 },
    neck: null,
    blendshapes: f.blendshapes,
    transformMatrix: f.matrix,
    rawQuality,
    config: { ...DEFAULT_CONFIG, uncertaintySamples: 12 },
    ...overrides,
  };
}

/**
 * Real analysis inputs captured from the app (engine 3.1): the detection of the
 * unchanged photo plus the verification passes (mirrored, rotated ±5°, zoomed,
 * zoomed + mirrored), as the browser sends them. Public-domain portraits A/B and
 * the synthetic ideal-example render (tests/fixtures/verification/README.md).
 */
export function loadVerifiedInput(name: string): AnalysisInput {
  return (JSON.parse(readFileSync(join(__dirname, "..", "fixtures", "verification", `${name}.json`), "utf8")) as { input: AnalysisInput }).input;
}
