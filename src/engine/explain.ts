import { RATIO_BY_ID } from "./ratios/database";
import type { RatioResult, SemanticLandmark } from "./types";

export interface RatioExplanation {
  what: string;
  how: string;
  target: string;
  measured: string;
  reliability: string;
  limitations: string[];
  points: string;
  index: string;
  formulaWithValues: string;
  landmarkLabels: string[];
}

/** toFixed without a negative zero ("-0.0") for values that round to zero. */
export function fixed(v: number, digits: number): string {
  const s = v.toFixed(digits);
  return Number(s) === 0 ? (0).toFixed(digits) : s;
}

export function formatValue(v: number | null | undefined, unit: "percent" | "ratio" | "degrees"): string {
  if (v == null || !Number.isFinite(v)) return "—";
  if (unit === "percent") return `${fixed(v, 1)}\u00a0%`;
  if (unit === "degrees") return `${fixed(v, 1)}°`;
  return fixed(v, 2);
}

export function formatT1(def: { t1: { min: number | null; max: number | null }; unit: "percent" | "ratio" | "degrees" }): string {
  const { min, max } = def.t1;
  const f = (v: number) => formatValue(v, def.unit);
  if (min !== null && max !== null) return `${f(min)} – ${f(max)}`;
  if (min !== null) return `≥ ${f(min)}`;
  if (max !== null) return `≤ ${f(max)}`;
  return "—";
}

export function explainRatio(result: RatioResult, landmarks: SemanticLandmark[]): RatioExplanation {
  const def = RATIO_BY_ID[result.id];
  const lmLabels = def.landmarks.map((id) => landmarks.find((l) => l.id === id)?.label ?? id);
  const inter = Object.entries(result.intermediate)
    .map(([k, v]) => `${k} = ${Number.isFinite(v) ? v.toFixed(1) : "—"}`)
    .join(", ");
  const statusText =
    def.status === "defined"
      ? "Fully defined in the source material."
      : def.status === "reconstructed"
        ? "Measurement convention reconstructed by this implementation (flagged)."
        : "Incomplete in the source material; not measured.";
  const reliability =
    result.availability === "available"
      ? `Confidence ${(result.confidence * 100).toFixed(0)} %${result.uncertain ? " (uncertain)" : ""}${result.valueSigma != null ? `, ±${formatValue(result.valueSigma, def.unit)} (1σ landmark jitter)` : ""}. ${statusText}`
      : `${result.unavailableReason ?? "Not available."} ${statusText}`;
  return {
    what: `${def.name} (${def.abbreviation}): ${def.formula}.`,
    how: def.methodology,
    target: `T1 target range: ${formatT1(def)}${def.target != null ? ` (midpoint ${formatValue(def.target, def.unit)})` : ""}.`,
    measured:
      result.value != null
        ? `Measured ${formatValue(result.value, def.unit)}${result.deviation ? ` — ${Math.abs(result.deviation) > 0 ? `${result.deviation > 0 ? "above" : "below"} the T1 range by ${formatValue(Math.abs(result.deviation), def.unit)}` : ""}` : result.inT1 ? " — inside T1" : ""}.`
        : "No value.",
    reliability,
    limitations: def.limitations,
    points: result.tierNote,
    index:
      result.index != null
        ? `Harmony index ${result.index.toFixed(0)}/100: 100 inside T1; outside, a Gaussian fall-off in units of the natural spread (${formatValue(def.tolerance, def.unit)}): 61 at one unit, 14 at two — averaged over the measurement uncertainty of the value.`
        : "No index (not evaluable).",
    formulaWithValues: inter ? `${def.formula} → ${inter}` : def.formula,
    landmarkLabels: lmLabels,
  };
}
