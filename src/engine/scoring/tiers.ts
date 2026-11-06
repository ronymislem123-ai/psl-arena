/**
 * Original T1–T5 point system from the source material.
 * Only T1 ranges were provided, so outer tiers can only be assigned when a
 * verified `tierBoundaries` entry exists for a ratio (none do by default).
 */
import type { RatioDefinition, Tier } from "../types";

export const TIER_POINTS: Record<Tier, number> = { T1: 10, T2: 5, T3: 2.5, T4: 0, T5: -5 };
export const THEORETICAL_MAX = 420 as const;

export interface TierAssignment {
  inT1: boolean;
  /** signed distance outside the T1 range (0 inside) */
  deviation: number;
  tier: Tier | null;
  points: number | null;
  note: string;
}

export function assignTier(def: RatioDefinition, value: number): TierAssignment {
  const { min, max } = def.t1;
  let deviation = 0;
  if (min !== null && value < min) deviation = value - min;
  else if (max !== null && value > max) deviation = value - max;

  if (deviation === 0) {
    return { inT1: true, deviation: 0, tier: "T1", points: TIER_POINTS.T1, note: "Within the T1 target range (+10 points)." };
  }
  const abs = Math.abs(deviation);
  const tb = def.tierBoundaries;
  if (tb) {
    const tier: Tier = abs <= tb.t2 ? "T2" : abs <= tb.t3 ? "T3" : abs <= tb.t4 ? "T4" : "T5";
    return { inT1: false, deviation, tier, points: TIER_POINTS[tier], note: `Outside T1 by ${abs.toFixed(2)}; tier ${tier} (${TIER_POINTS[tier]} points) from verified boundaries.` };
  }
  return {
    inT1: false,
    deviation,
    tier: null,
    points: null,
    note: "Outside the T1 range. T2–T5 boundaries are not defined in the provided material, so no tier points are assigned (undetermined tier).",
  };
}

/** PSL ARENA harmony index: 100 inside T1, halves for every tolerance unit outside. */
export function indexFromDeviation(absDeviation: number, tolerance: number): number {
  if (absDeviation <= 0) return 100;
  const z = absDeviation / Math.max(tolerance, 1e-9);
  return 100 * Math.pow(2, -z);
}
