"use client";
/**
 * Lazy singleton around the MediaPipe Face Landmarker (runs fully in the browser;
 * the image never leaves the device). WASM runtime and model are served from this
 * origin (/mediapipe/wasm, /models) so no third-party request is made.
 */
import type { FaceLandmarker } from "@mediapipe/tasks-vision";

export const WASM_BASE = "/mediapipe/wasm";
export const MODEL_PATH = "/models/face_landmarker.task";

let instance: Promise<FaceLandmarker> | null = null;
let loadedDelegate: "GPU" | "CPU" | null = null;

export function getLoadedDelegate() {
  return loadedDelegate;
}

async function create(delegate: "GPU" | "CPU"): Promise<FaceLandmarker> {
  const { FilesetResolver, FaceLandmarker } = await import("@mediapipe/tasks-vision");
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const lm = await FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: "IMAGE",
    numFaces: 5,
    minFaceDetectionConfidence: 0.5,
    minFacePresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
  });
  loadedDelegate = delegate;
  return lm;
}

export function getLandmarker(preferred: "GPU" | "CPU" = "CPU"): Promise<FaceLandmarker> {
  if (!instance) {
    instance = create(preferred).catch(async (err) => {
      if (preferred === "GPU") {
        console.warn("[landmarker] GPU delegate failed, falling back to CPU", err);
        return create("CPU");
      }
      instance = null;
      throw err;
    });
  }
  return instance;
}

/** Preload in the background (e.g. when the battle page mounts). */
export function warmUpLandmarker() {
  if (typeof window === "undefined") return;
  void getLandmarker().catch(() => undefined);
}
