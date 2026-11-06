/**
 * Pure image/pose/expression quality assessment. Pixel statistics are computed in
 * the browser (lib/vision/quality.ts); this module turns raw numbers into levels,
 * scores and user-facing issues.
 */
import { clamp } from "../geometry";
import type {
  AnalysisInput,
  ExpressionReport,
  HeadPose,
  LandmarkMap,
  QualityIssue,
  QualityLevel,
  QualityMetric,
  QualityReport,
} from "../types";

/** Euler angles (degrees) from a 4×4 facial transformation matrix (row- or column-major). */
export function eulerFromMatrix(data: number[] | null | undefined): HeadPose | null {
  if (!data || data.length !== 16 || data.some((v) => !Number.isFinite(v))) return null;
  // Translation lives in the last column (row-major: indices 3,7,11) or the last row (column-major: 12,13,14).
  const rowMajor = Math.abs(data[11]) >= Math.abs(data[14]);
  const m = (r: number, c: number) => (rowMajor ? data[r * 4 + c] : data[c * 4 + r]);
  const r00 = m(0, 0), r10 = m(1, 0), r20 = m(2, 0), r21 = m(2, 1), r22 = m(2, 2);
  const sy = Math.sqrt(r00 * r00 + r10 * r10);
  const toDeg = (v: number) => (v * 180) / Math.PI;
  return {
    pitch: toDeg(Math.atan2(r21, r22)),
    yaw: toDeg(Math.atan2(-r20, sy)),
    roll: toDeg(Math.atan2(r10, r00)),
  };
}

/** Landmark-based fallback: yaw from nose-tip offset vs. eye midpoint, pitch unknown. */
export function poseFromLandmarks(map: LandmarkMap, rollDeg: number): HeadPose {
  const pr = map.pupil_R?.aligned;
  const pl = map.pupil_L?.aligned;
  const tip = map.pronasale?.aligned;
  const zr = map.zygion_R?.aligned;
  const zl = map.zygion_L?.aligned;
  let yaw = 0;
  if (pr && pl && tip && zr && zl) {
    const mid = (pr.x + pl.x) / 2;
    const half = Math.abs(zl.x - zr.x) / 2;
    // ratio of the two half-widths (asymmetric foreshortening)
    const rightHalf = Math.abs(mid - Math.min(zr.x, zl.x));
    const leftHalf = Math.abs(Math.max(zr.x, zl.x) - mid);
    const asym = (leftHalf - rightHalf) / (half || 1);
    yaw = clamp(asym * 45, -60, 60);
  }
  return { yaw, pitch: 0, roll: rollDeg };
}

type Thresholds = { unusable: number; poor: number; acceptable: number; good: number };

/** Monotone metric: higher is better. Returns continuous score and level. */
function scoreHigher(value: number, t: Thresholds): { score: number; level: QualityLevel } {
  if (value >= t.good) return { score: 0.9 + 0.1 * clamp((value - t.good) / Math.max(t.good, 1e-9), 0, 1), level: "good" };
  if (value >= t.acceptable) return { score: 0.65 + (0.25 * (value - t.acceptable)) / (t.good - t.acceptable), level: "acceptable" };
  if (value >= t.poor) return { score: 0.35 + (0.3 * (value - t.poor)) / (t.acceptable - t.poor), level: "poor" };
  return { score: 0.1 + (0.25 * clamp(value - t.unusable, 0, t.poor - t.unusable)) / Math.max(t.poor - t.unusable, 1e-9), level: "unusable" };
}

/** Absolute-deviation metric (angles): lower is better. */
function scoreLower(value: number, t: Thresholds): { score: number; level: QualityLevel } {
  const v = Math.abs(value);
  if (v <= t.good) return { score: 1 - 0.1 * (v / Math.max(t.good, 1e-9)), level: "good" };
  if (v <= t.acceptable) return { score: 0.9 - (0.25 * (v - t.good)) / (t.acceptable - t.good), level: "acceptable" };
  if (v <= t.poor) return { score: 0.65 - (0.3 * (v - t.acceptable)) / (t.poor - t.acceptable), level: "poor" };
  return { score: Math.max(0.05, 0.35 - (0.3 * (v - t.poor)) / Math.max(t.unusable - t.poor, 1e-9)), level: "unusable" };
}

export function expressionFromBlendshapes(bs: Record<string, number>): ExpressionReport {
  const g = (k: string) => clamp(bs[k] ?? 0, 0, 1);
  const smile = Math.max(g("mouthSmileLeft"), g("mouthSmileRight"));
  const jawOpen = g("jawOpen");
  const blink = Math.max(g("eyeBlinkLeft"), g("eyeBlinkRight"));
  const browRaise = Math.max(g("browInnerUp"), g("browOuterUpLeft"), g("browOuterUpRight"));
  const browDown = Math.max(g("browDownLeft"), g("browDownRight"));
  const pucker = Math.max(g("mouthPucker"), g("mouthFunnel"));
  const squint = Math.max(g("eyeSquintLeft"), g("eyeSquintRight"));
  const other = Math.max(g("cheekPuff"), g("mouthStretchLeft"), g("mouthStretchRight"), g("mouthPressLeft") * 0.6, g("mouthPressRight") * 0.6, g("noseSneerLeft"), g("noseSneerRight"), g("eyeWideLeft") * 0.5, g("eyeWideRight") * 0.5);
  const deviation = Math.max(smile, jawOpen, blink * 0.9, browRaise * 0.6, browDown * 0.5, pucker * 0.7, squint * 0.5, other * 0.8);
  const neutrality = clamp(1 - deviation, 0, 1);
  const level: QualityLevel = neutrality >= 0.7 ? "good" : neutrality >= 0.45 ? "acceptable" : "poor";
  return { smile, jawOpen, blink, browRaise, browDown, pucker, squint, neutrality, level };
}

export function assessQuality(input: AnalysisInput, map: LandmarkMap, rollDeg: number): QualityReport {
  const rq = input.rawQuality;
  const metrics: QualityMetric[] = [];
  const issues: QualityIssue[] = [];

  const posed = eulerFromMatrix(input.transformMatrix) ?? poseFromLandmarks(map, rollDeg);
  const pose: HeadPose = { yaw: posed.yaw, pitch: posed.pitch, roll: rollDeg };

  // resolution
  const res = scoreHigher(rq.faceWidthPx, { unusable: 60, poor: 110, acceptable: 180, good: 300 });
  metrics.push({ id: "resolution", label: "Face resolution", value: Math.round(rq.faceWidthPx), unit: "px face width", score: res.score, level: res.level, hint: "≥ 300 px face width recommended" });
  if (res.level === "unusable") issues.push({ key: "lowResolution.error", code: "low-resolution", severity: "error", message: "The face is too small in the image (fewer than ~110 px wide). Use a closer or higher-resolution photo." });
  else if (res.level === "poor") issues.push({ key: "lowResolution.warning", code: "low-resolution", severity: "warning", message: "Low face resolution; fine landmarks (eyes, lips) are less precise." });

  // sharpness
  const sh = scoreHigher(rq.sharpness, { unusable: 8, poor: 20, acceptable: 50, good: 120 });
  metrics.push({ id: "sharpness", label: "Sharpness", value: Math.round(rq.sharpness), unit: "Laplacian var.", score: sh.score, level: sh.level, hint: "≥ 50 acceptable, ≥ 120 good" });
  if (sh.level === "unusable") issues.push({ key: "blurry.error", code: "blurry", severity: "error", message: "The face is too blurry for reliable landmark detection." });
  else if (sh.level === "poor") issues.push({ key: "blurry.warning", code: "blurry", severity: "warning", message: "Soft focus detected; landmark precision is reduced." });

  // brightness (two-sided)
  const bDev = Math.max(0, Math.abs(rq.brightness - 130) - 60); // 70..190 ideal
  const br = scoreLower(bDev, { good: 0, acceptable: 25, poor: 45, unusable: 70 });
  metrics.push({ id: "brightness", label: "Brightness", value: Math.round(rq.brightness), unit: "/255", score: br.score, level: br.level, hint: "70–190 ideal" });
  if (br.level === "unusable" || br.level === "poor") {
    issues.push({ key: rq.brightness < 130 ? "tooDark" : "tooBright", code: rq.brightness < 130 ? "too-dark" : "too-bright", severity: br.level === "unusable" ? "error" : "warning", message: rq.brightness < 130 ? "The face is very dark; shadows hide contours." : "The face is over-exposed; contours are washed out." });
  }

  // contrast
  const ct = scoreHigher(rq.contrast, { unusable: 8, poor: 15, acceptable: 25, good: 40 });
  metrics.push({ id: "contrast", label: "Contrast", value: Math.round(rq.contrast), unit: "σ luminance", score: ct.score, level: ct.level, hint: "≥ 25 acceptable" });
  if (ct.level === "unusable") issues.push({ key: "lowContrast.error", code: "low-contrast", severity: "error", message: "Contrast is too low." });
  else if (ct.level === "poor") issues.push({ key: "lowContrast.warning", code: "low-contrast", severity: "warning", message: "Low contrast reduces edge precision." });

  // pose
  const yaw = scoreLower(pose.yaw, { good: 8, acceptable: 15, poor: 25, unusable: 40 });
  metrics.push({ id: "yaw", label: "Head turn (yaw)", value: Math.round(pose.yaw * 10) / 10, unit: "°", score: yaw.score, level: yaw.level, hint: "≤ 8° good, ≤ 15° acceptable" });
  const yawDeg = Math.round(Math.abs(pose.yaw));
  if (yaw.level === "unusable") issues.push({ key: "yaw.error", params: { deg: yawDeg }, code: "yaw", severity: "error", message: `The head is turned ${yawDeg}° — widths are strongly foreshortened. Use a frontal photo.` });
  else if (yaw.level === "poor") issues.push({ key: "yaw.warning", params: { deg: yawDeg }, code: "yaw", severity: "warning", message: `Head turned ${yawDeg}°; horizontal measurements lose precision.` });
  else if (yaw.level === "acceptable") issues.push({ key: "yaw.info", params: { deg: yawDeg }, code: "yaw", severity: "info", message: `Slight head turn (${yawDeg}°).` });

  const pitch = scoreLower(pose.pitch, { good: 8, acceptable: 15, poor: 25, unusable: 40 });
  metrics.push({ id: "pitch", label: "Head tilt (pitch)", value: Math.round(pose.pitch * 10) / 10, unit: "°", score: pitch.score, level: pitch.level, hint: "≤ 8° good, ≤ 15° acceptable" });
  if (pitch.level === "unusable") issues.push({ key: "pitch.error", params: { deg: Math.round(Math.abs(pose.pitch)) }, code: "pitch", severity: "error", message: `The head is tilted up/down by ${Math.abs(pose.pitch).toFixed(0)}°; vertical proportions are distorted.` });
  else if (pitch.level === "poor") issues.push({ key: "pitch.warning", params: { deg: Math.round(Math.abs(pose.pitch)) }, code: "pitch", severity: "warning", message: `Head tilted up/down (${Math.abs(pose.pitch).toFixed(0)}°); vertical proportions lose precision.` });

  const roll = scoreLower(pose.roll, { good: 10, acceptable: 20, poor: 35, unusable: 60 });
  metrics.push({ id: "roll", label: "Head roll", value: Math.round(pose.roll * 10) / 10, unit: "°", score: roll.score, level: roll.level, hint: "corrected automatically; ≤ 10° ideal" });
  if (roll.level === "unusable") issues.push({ key: "roll.error", code: "roll", severity: "error", message: "The head is rotated too far in the image plane." });
  else if (roll.level === "poor") issues.push({ key: "roll.warning", code: "roll", severity: "warning", message: "Strong head roll was corrected numerically; residual errors possible." });

  // expression
  const expression = expressionFromBlendshapes(input.blendshapes);
  const ex = { score: expression.neutrality >= 0.7 ? 0.9 + 0.1 * (expression.neutrality - 0.7) / 0.3 : expression.neutrality >= 0.45 ? 0.65 + (0.25 * (expression.neutrality - 0.45)) / 0.25 : 0.2 + 0.45 * (expression.neutrality / 0.45), level: expression.level };
  metrics.push({ id: "expression", label: "Neutral expression", value: Math.round(expression.neutrality * 100), unit: "% neutral", score: ex.score, level: ex.level, hint: "≥ 70 % good" });
  if (expression.blink > 0.65) issues.push({ key: "eyesClosed", code: "eyes-closed", severity: "error", message: "Eyes appear closed; eye measurements are impossible." });
  if (expression.jawOpen > 0.5) issues.push({ key: "mouthOpen.error", code: "mouth-open", severity: "error", message: "The mouth is wide open; lower-third and lip measurements are invalid." });
  else if (expression.smile > 0.45) issues.push({ key: "expression.smile", params: { pct: Math.round(expression.smile * 100) }, code: "expression", severity: "warning", message: `A smile was detected (${Math.round(expression.smile * 100)} %). Mouth, lip and eye-opening measurements are affected; confidence is reduced.` });
  else if (expression.level === "acceptable") issues.push({ key: "expression.mild", code: "expression", severity: "info", message: "Mild facial expression detected; a neutral expression improves accuracy." });

  // mouth gap from landmarks
  const su = map.stomion_sup?.aligned;
  const si = map.stomion_inf?.aligned;
  const ls = map.labrale_sup?.aligned;
  const li = map.labrale_inf?.aligned;
  if (su && si && ls && li) {
    const gap = Math.abs(si.y - su.y);
    const total = Math.abs(li.y - ls.y) || 1;
    if (gap / total > 0.25 && expression.jawOpen <= 0.5) {
      issues.push({ key: "mouthOpen.parted", code: "mouth-open", severity: "warning", message: "The lips are parted; lip-height and lower-third measurements are less reliable." });
    }
  }

  // framing
  const fb = rq.faceBox;
  const margin = 0.02;
  if (fb.x <= rq.imageWidth * margin || fb.y <= rq.imageHeight * margin || fb.x + fb.w >= rq.imageWidth * (1 - margin) || fb.y + fb.h >= rq.imageHeight * (1 - margin)) {
    issues.push({ key: "faceCutOff", code: "face-cut-off", severity: "warning", message: "The face touches the image border; the hairline or chin may be cut off." });
  }
  if (rq.faceCount > 1) issues.push({ key: "multipleFaces", params: { n: rq.faceCount }, code: "multiple-faces", severity: "info", message: `${rq.faceCount} faces detected; the selected face is analysed.` });
  if (!input.trichion) issues.push({ key: "hairlineNotFound", code: "hairline-not-found", severity: "warning", message: "The hairline could not be estimated. Place it manually to enable hairline-based ratios (thirds, TFWHR, LFF, FWHF)." });
  if (input.config.captureDistance === "selfie") issues.push({ key: "selfie", code: "selfie-perspective", severity: "info", message: "Close-range (selfie) perspective enlarges the nose and narrows the face; depth-sensitive ratios carry reduced confidence." });

  const weights: Record<string, number> = { resolution: 0.2, sharpness: 0.2, brightness: 0.1, contrast: 0.1, yaw: 0.15, pitch: 0.1, roll: 0.0, expression: 0.15 };
  let score = metrics.reduce((s, m) => s + (weights[m.id] ?? 0) * m.score, 0) / Object.values(weights).reduce((a, b) => a + b, 0);
  const hasError = issues.some((i) => i.severity === "error");
  if (hasError) score = Math.min(score, 0.2);
  const level: QualityLevel = hasError ? "unusable" : score < 0.5 ? "poor" : score < 0.75 ? "acceptable" : "good";

  return {
    level,
    score: clamp(score, 0, 1),
    metrics,
    issues,
    pose,
    expression,
    captureDistance: input.config.captureDistance,
    faceCount: rq.faceCount,
    faceWidthPx: rq.faceWidthPx,
    analyzable: !hasError,
  };
}
