import { describe, expect, it } from "vitest";
import { RATIO_BY_ID } from "@/engine/ratios/database";
import { assignTier, indexFromDeviation } from "@/engine/scoring/tiers";

describe("T1 scoring", () => {
  it("awards +10 inside T1 and leaves the tier undetermined outside", () => {
    const esr = RATIO_BY_ID.ESR;
    expect(assignTier(esr, 46).tier).toBe("T1");
    expect(assignTier(esr, 46).points).toBe(10);
    const out = assignTier(esr, 50);
    expect(out.inT1).toBe(false);
    expect(out.tier).toBeNull();
    expect(out.points).toBeNull();
    expect(out.deviation).toBeCloseTo(2.1);
    expect(out.note).toMatch(/not defined/);
  });
  it("handles one-sided ranges", () => {
    const cbs = RATIO_BY_ID.CBS;
    expect(assignTier(cbs, 95).tier).toBe("T1");
    expect(assignTier(cbs, 70).deviation).toBeCloseTo(-10);
  });
  it("uses verified boundaries when present", () => {
    const def = { ...RATIO_BY_ID.ESR, tierBoundaries: { t2: 1, t3: 2, t4: 3 } };
    expect(assignTier(def, 48.5).tier).toBe("T2");
    expect(assignTier(def, 49.5).tier).toBe("T3");
    expect(assignTier(def, 50.5).tier).toBe("T4");
    expect(assignTier(def, 60).tier).toBe("T5");
    expect(assignTier(def, 60).points).toBe(-5);
  });
  it("harmony index halves per tolerance unit", () => {
    expect(indexFromDeviation(0, 2)).toBe(100);
    expect(indexFromDeviation(2, 2)).toBeCloseTo(50);
    expect(indexFromDeviation(4, 2)).toBeCloseTo(25);
  });
});
