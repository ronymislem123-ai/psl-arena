/**
 * Capture-condition analysis: what kind of photo this is and how it was taken.
 *
 * Every item states its basis — "measured" (read directly from the data),
 * "derived" (computed from measured values with a documented model), "inferred"
 * (a plausible interpretation that could be wrong) or "undeterminable" (the app
 * cannot know it from one photo). These items describe the photo, never the face:
 * they change the reliability of measurements, not the score.
 */
import type { CaptureItem, CaptureReport, HeadPose, Point, RawQualityMetrics } from "../types";

/** Mean horizontal visible iris diameter of adults (mm), the constant MediaPipe Iris uses for depth. */
export const IRIS_DIAMETER_MM = 11.7;
/** Relative error band of photo-based camera-distance estimates (Healy & Stephan 2023: 11 % DSLR … 26 % smartphone). */
export const DISTANCE_REL_ERROR = 0.26;
/**
 * Depth offset (mm) between the nasal base and the plane of the face width that
 * reproduces the perspective model of Ward et al. 2018 (nasal width +30 % at 30 cm
 * relative to the bizygomatic width): inflation ≈ Δ / D with Δ ≈ 91 mm.
 */
export const PERSPECTIVE_DEPTH_MM = 91;

const EDITORS = /photoshop|lightroom|snapseed|facetune|picsart|vsco|meitu|beautycam|beauty ?plus|airbrush|gimp|afterlight|remini|perfect365|youcam|retouch|faceapp/i;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Horizontal iris diameter in pixels (mean of both eyes, corrected for yaw foreshortening). */
export function irisDiameterPx(mesh: Point[], yawDeg: number): number | null {
  if (mesh.length < 478) return null;
  const r = dist(mesh[469], mesh[471]);
  const l = dist(mesh[474], mesh[476]);
  if (!(r > 0 && l > 0)) return null;
  const c = Math.max(0.5, Math.cos((Math.min(Math.abs(yawDeg), 60) * Math.PI) / 180));
  // the eye nearer to the camera is less foreshortened; use the larger one, then undo the remaining cos(yaw)
  return Math.max(r, l) / c;
}

export function estimateDistance(rq: RawQualityMetrics, mesh: Point[], yawDeg: number): CaptureReport["distanceCm"] {
  const f35 = rq.focalLength35mm;
  if (!f35 || !(f35 > 5 && f35 < 400)) return null;
  const iris = irisDiameterPx(mesh, yawDeg);
  if (!iris) return null;
  const diag = Math.hypot(rq.imageWidth, rq.imageHeight);
  const fPx = (f35 * diag) / 43.27; // 35 mm frame diagonal
  const mm = (fPx * IRIS_DIAMETER_MM) / iris;
  const cm = mm / 10;
  return { estimate: cm, low: cm * (1 - DISTANCE_REL_ERROR), high: cm * (1 + DISTANCE_REL_ERROR) };
}

export function classifyCapture(rq: RawQualityMetrics, pose: HeadPose, mesh: Point[], blink = 0, hairlineFound = true): CaptureReport {
  const items: CaptureItem[] = [];
  const yaw = Math.abs(pose.yaw);
  const pitch = pose.pitch;
  const roll = Math.abs(((((pose.roll % 360) + 540) % 360) - 180)); // |roll| folded into 0…180

  // view (measured from the head pose)
  const view = yaw <= 10 ? "frontal" : yaw <= 20 ? "slightlyTurned" : yaw <= 30 ? "turned" : yaw <= 60 ? "threeQuarter" : "profile";
  items.push({ id: "view", value: view, basis: "measured", confidence: 1, params: { yaw: Math.round(pose.yaw * 10) / 10 } });
  // in-plane tilt (measured)
  const tilt = roll <= 5 ? "upright" : roll <= 15 ? "slight" : roll <= 45 ? "tilted" : "rotated";
  items.push({ id: "tilt", value: tilt, basis: "measured", confidence: 1, params: { roll: Math.round(roll * 10) / 10 } });
  // vertical angle: head pitch and camera height cannot be told apart in one photo
  const elevation = Math.abs(pitch) <= 8 ? "level" : pitch > 0 ? "chinUp" : "chinDown";
  items.push({ id: "elevation", value: elevation, basis: Math.abs(pitch) <= 8 ? "measured" : "inferred", confidence: Math.abs(pitch) <= 8 ? 1 : 0.6, params: { pitch: Math.round(pitch * 10) / 10 } });

  // framing from the face height share
  const faceH = mesh.length >= 478 ? dist(mesh[10], mesh[152]) : rq.faceHeightPx;
  const imgH = Math.max(rq.imageHeight, rq.imageWidth) || 1;
  const share = faceH / imgH;
  const framing = share > 0.5 ? "closeUp" : share > 0.25 ? "portrait" : share > 0.1 ? "upperBody" : "distant";
  items.push({ id: "framing", value: framing, basis: "measured", confidence: 1, params: { share: Math.round(share * 100) } });

  // distance (derived: EXIF focal length + iris constant)
  const distanceCm = estimateDistance(rq, mesh, pose.yaw);
  let perspectiveInflation: number | null = null;
  if (distanceCm) {
    perspectiveInflation = PERSPECTIVE_DEPTH_MM / (distanceCm.estimate * 10);
    const d = distanceCm.estimate;
    const value = d < 45 ? "armLength" : d < 90 ? "close" : d < 150 ? "portraitDistance" : "far";
    items.push({ id: "distance", value, basis: "derived", confidence: 0.7, params: { cm: Math.round(d), low: Math.round(distanceCm.low), high: Math.round(distanceCm.high), inflation: Math.round(perspectiveInflation * 100) } });
  } else {
    items.push({ id: "distance", value: "unknown", basis: "undeterminable", confidence: 0, params: { reason: rq.focalLength35mm ? "iris" : "noFocalLength" } });
  }

  // selfie (inferred): arm's length is the strongest cue; framing alone is weak
  if (distanceCm) {
    const likely = distanceCm.estimate < 60;
    items.push({ id: "selfie", value: likely ? "likely" : "unlikely", basis: "inferred", confidence: likely ? 0.7 : 0.6 });
  } else {
    items.push({ id: "selfie", value: framing === "closeUp" ? "possible" : "unknown", basis: framing === "closeUp" ? "inferred" : "undeterminable", confidence: framing === "closeUp" ? 0.3 : 0 });
  }
  // things a single photo without object detection cannot reveal
  items.push({ id: "mirror", value: "unknown", basis: "undeterminable", confidence: 0 });
  items.push({ id: "photographer", value: "unknown", basis: "undeterminable", confidence: 0 });

  // setting (inferred): plain backdrop + even light suggest a studio-like set-up
  const plain = rq.backgroundSpread != null && rq.backgroundSpread < 14;
  const even = rq.lightingAsymmetry != null && rq.lightingAsymmetry < 0.08;
  if (rq.backgroundSpread == null) items.push({ id: "setting", value: "unknown", basis: "undeterminable", confidence: 0 });
  else items.push({ id: "setting", value: plain && even ? "studioLike" : plain ? "plainBackdrop" : "natural", basis: "inferred", confidence: plain && even ? 0.5 : 0.4, params: { spread: Math.round(rq.backgroundSpread) } });

  // editing traces
  if (rq.editingSoftware) {
    items.push({ id: "editing", value: EDITORS.test(rq.editingSoftware) ? "editorTag" : "softwareTag", basis: "measured", confidence: 1, params: { software: rq.editingSoftware.slice(0, 40) } });
  } else items.push({ id: "editing", value: "noTag", basis: "measured", confidence: 1 });
  if (rq.skinTexture != null) {
    const smooth = rq.skinTexture < 0.12;
    items.push({ id: "smoothing", value: smooth ? "suspected" : "notSuspected", basis: "inferred", confidence: smooth ? 0.4 : 0.3, params: { texture: Math.round(rq.skinTexture * 100) / 100 } });
  }
  if (rq.blockiness != null) {
    items.push({ id: "compression", value: rq.blockiness > 1.3 ? "visible" : "fine", basis: "measured", confidence: 1, params: { ratio: Math.round(rq.blockiness * 100) / 100 } });
  } else items.push({ id: "compression", value: "unknown", basis: "undeterminable", confidence: 0 });

  // exposure and lighting (measured)
  if (rq.clipDark != null && rq.clipBright != null) {
    const v = rq.clipBright > 0.05 ? "overexposed" : rq.clipDark > 0.05 ? "underexposed" : "ok";
    items.push({ id: "exposure", value: v, basis: "measured", confidence: 1, params: { dark: Math.round(rq.clipDark * 100), bright: Math.round(rq.clipBright * 100) } });
  }
  if (rq.lightingAsymmetry != null) {
    const a = rq.lightingAsymmetry;
    items.push({ id: "lighting", value: a > 0.25 ? "stronglySided" : a > 0.12 ? "sided" : "even", basis: "measured", confidence: 1, params: { asym: Math.round(a * 100) } });
  }
  // occlusion: only what the data shows
  const occl = blink > 0.65 ? "eyesClosed" : !hairlineFound ? "foreheadUnclear" : "noneDetected";
  items.push({ id: "occlusion", value: occl, basis: occl === "noneDetected" ? "inferred" : "measured", confidence: occl === "noneDetected" ? 0.5 : 0.8 });

  return { items, distanceCm, perspectiveInflation };
}
