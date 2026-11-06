import { clamp } from "../geometry";
import type { AnalysisConfig, LandmarkMap, QualityReport, RatioDefinition, RatioResult } from "../types";
import { RATIO_DEFINITIONS } from "./database";
import { FORMULAS } from "./formulas";
import { assignTier, indexFromDeviation } from "../scoring/tiers";

export const UNCERTAIN_THRESHOLD = 0.5;

const STATUS_FACTOR: Record<RatioDefinition["status"], number> = { defined: 1, reconstructed: 0.85, incomplete: 0 };

export function ratioConfidence(def: RatioDefinition, map: LandmarkMap, quality: QualityReport, config: AnalysisConfig): number {
  let conf = STATUS_FACTOR[def.status];
  // landmark localisation confidence (weakest link)
  let lm = 1;
  for (const id of def.landmarks) {
    const l = map[id];
    if (!l) return 0;
    lm = Math.min(lm, l.confidence);
  }
  conf *= lm;
  // image quality
  conf *= 0.6 + 0.4 * clamp(quality.score, 0, 1);
  // head pose
  const yaw = Math.abs(quality.pose.yaw);
  const pitch = Math.abs(quality.pose.pitch);
  if (def.sensitivity.yaw) conf *= 1 - clamp((yaw - 4) / 35, 0, 0.6);
  else conf *= 1 - clamp((yaw - 8) / 50, 0, 0.3);
  conf *= 1 - clamp((pitch - 5) / 40, 0, 0.5);
  // expression
  const e = quality.expression;
  for (const region of def.sensitivity.expression) {
    if (region === "mouth") conf *= 1 - 0.5 * clamp(Math.max(e.smile, e.jawOpen, e.pucker), 0, 1);
    if (region === "eyes") conf *= 1 - 0.5 * clamp(Math.max(e.blink, e.squint), 0, 1);
    if (region === "brows") conf *= 1 - 0.4 * clamp(Math.max(e.browRaise, e.browDown), 0, 1);
    if (region === "jaw") conf *= 1 - 0.5 * clamp(e.jawOpen, 0, 1);
  }
  // capture distance / perspective
  if (def.sensitivity.depth) {
    conf *= config.captureDistance === "selfie" ? 0.8 : config.captureDistance === "unknown" ? 0.95 : 1;
  }
  return clamp(conf, 0, 1);
}

export function evaluateRatios(map: LandmarkMap, quality: QualityReport, config: AnalysisConfig): RatioResult[] {
  const ipd = map.pupil_R && map.pupil_L ? Math.hypot(map.pupil_R.aligned.x - map.pupil_L.aligned.x, map.pupil_R.aligned.y - map.pupil_L.aligned.y) : 0;
  const ctx = { map, ipd };
  return RATIO_DEFINITIONS.map((def): RatioResult => {
    const base: RatioResult = {
      id: def.id,
      value: null,
      availability: "unavailable",
      confidence: 0,
      uncertain: true,
      inT1: null,
      deviation: null,
      normalizedDeviation: null,
      tier: null,
      tierPoints: null,
      tierNote: "",
      index: null,
      intermediate: {},
    };
    if (def.status === "incomplete") {
      return { ...base, unavailableReason: "Measurement convention is incomplete in the provided material; not measured and not scored.", tierNote: "Not scored (incomplete definition)." };
    }
    const missing = def.landmarks.filter((id) => !map[id]);
    if (missing.length) {
      const reason =
        missing.includes("trichion")
          ? "Hairline (trichion) not available — estimate failed or not confirmed; place it manually to enable this ratio."
          : missing.includes("neck_R") || missing.includes("neck_L")
            ? "Neck edge points are not placed (manual points required)."
            : `Required landmarks missing: ${missing.join(", ")}.`;
      return { ...base, unavailableReason: reason, tierNote: "Not scored (landmarks unavailable)." };
    }
    const m = FORMULAS[def.id](ctx);
    if (!m) {
      return { ...base, unavailableReason: "Measurement could not be computed from the detected geometry.", tierNote: "Not scored (computation failed)." };
    }
    if (def.status === "reconstructed" && !config.includeReconstructed) {
      return { ...base, value: m.value, intermediate: m.intermediate, availability: "excluded", unavailableReason: "Reconstructed measurement excluded by configuration.", tierNote: "Excluded from scoring by configuration.", confidence: 0 };
    }
    const confidence = ratioConfidence(def, map, quality, config);
    const tier = assignTier(def, m.value);
    const absDev = Math.abs(tier.deviation);
    return {
      ...base,
      value: m.value,
      intermediate: m.intermediate,
      availability: "available",
      confidence,
      uncertain: confidence < UNCERTAIN_THRESHOLD,
      inT1: tier.inT1,
      deviation: tier.deviation,
      normalizedDeviation: absDev / def.tolerance,
      tier: tier.tier,
      tierPoints: tier.points,
      tierNote: tier.note,
      index: indexFromDeviation(absDev, def.tolerance),
    };
  });
}
