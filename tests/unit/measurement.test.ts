import { describe, expect, it } from "vitest";
import { DISPERSION, expectedIndex, plateauIndex } from "@/engine/scoring/measurement";
import { RATIO_DEFINITIONS } from "@/engine/ratios/database";

describe("measurement model", () => {
  const t1 = { min: 45, max: 47.9 };
  it("plateau index: 100 inside, 61 at 1 s, 14 at 2 s, symmetric on both sides, continuous at the bounds", () => {
    expect(plateauIndex(46, t1, 2)).toBe(100);
    expect(plateauIndex(45, t1, 2)).toBe(100);
    expect(plateauIndex(43, t1, 2)).toBeCloseTo(100 * Math.exp(-0.5), 9);
    expect(plateauIndex(51.9, t1, 2)).toBeCloseTo(100 * Math.exp(-2), 9);
    expect(plateauIndex(47.9 + 1e-9, t1, 2)).toBeCloseTo(100, 6);
  });
  it("expected index matches the closed form for a one-sided range and reduces to the point index for σ = 0", () => {
    const one = { min: 80, max: null };
    const s = 4;
    for (const [x, sigma] of [[78, 1.5], [70, 3], [85, 2]] as const) {
      // E over N(x, σ²) of 100·[1 if v ≥ 80 else exp(−(v−80)²/(2s²))]: inside part Φ, outside part via completing the square
      const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
      const inside = 1 - Phi((80 - x) / sigma);
      const k = s / Math.sqrt(s * s + sigma * sigma);
      const m = (x * s * s + 80 * sigma * sigma) / (s * s + sigma * sigma);
      const sd = (s * sigma) / Math.sqrt(s * s + sigma * sigma);
      const outside = k * Math.exp(-((x - 80) ** 2) / (2 * (s * s + sigma * sigma))) * Phi((80 - m) / sd);
      expect(expectedIndex(x, sigma, one, s)).toBeCloseTo(100 * (inside + outside), 3);
    }
    expect(expectedIndex(70, 0, one, s)).toBe(plateauIndex(70, one, s));
  });
  it("is smooth: small value changes give small index changes (no jump at the range edge)", () => {
    const steps = Array.from({ length: 200 }, (_, i) => 43 + i * 0.02).map((x) => expectedIndex(x, 0.4, t1, 2));
    for (let i = 1; i < steps.length; i++) expect(Math.abs(steps[i] - steps[i - 1])).toBeLessThan(1.5);
  });
  it("every scorable ratio has a positive dispersion unit", () => {
    for (const d of RATIO_DEFINITIONS) if (d.status !== "incomplete") expect(DISPERSION[d.id]?.s ?? 0, d.id).toBeGreaterThan(0);
  });
});

function erf(x: number): number {
  // Abramowitz–Stegun 7.1.26 is too coarse for 4 digits; use a series/continued-fraction hybrid
  const t = Math.abs(x);
  if (t < 3) {
    let sum = 0;
    let term = t;
    for (let n = 0; n < 80; n++) {
      sum += term / (2 * n + 1);
      term *= (-t * t) / (n + 1);
    }
    return Math.sign(x) * (2 / Math.sqrt(Math.PI)) * sum;
  }
  return Math.sign(x) * (1 - Math.exp(-t * t) / (t * Math.sqrt(Math.PI)) * (1 - 1 / (2 * t * t)));
}
