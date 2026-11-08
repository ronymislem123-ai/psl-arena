import { describe, expect, it } from "vitest";
import { ADDITIONAL_DEFINITIONS, RATIO_DEFINITIONS, toleranceFor } from "@/engine/ratios/database";
import { FORMULAS } from "@/engine/ratios/formulas";

describe("ratio database", () => {
  it("contains exactly the 42 core ratios numbered 1..42 and 8 additional measurements", () => {
    expect(RATIO_DEFINITIONS).toHaveLength(42);
    expect(new Set(RATIO_DEFINITIONS.map((d) => d.number)).size).toBe(42);
    expect(Math.min(...RATIO_DEFINITIONS.map((d) => d.number))).toBe(1);
    expect(Math.max(...RATIO_DEFINITIONS.map((d) => d.number))).toBe(42);
    expect(ADDITIONAL_DEFINITIONS).toHaveLength(8);
  });
  it("flags the incompletely defined measurements and never invents outer tiers", () => {
    const incomplete = RATIO_DEFINITIONS.filter((d) => d.status === "incomplete").map((d) => d.id).sort();
    expect(incomplete).toEqual(["DEV_IAA_JFA", "EBS", "EYS", "IAA", "JFA", "NBR_ALA"]);
    const reconstructed = RATIO_DEFINITIONS.filter((d) => d.status === "reconstructed").map((d) => d.id).sort();
    expect(reconstructed).toEqual(["FWHF", "GS", "ICD_N", "JWHR", "M_C", "OCD"]);
    for (const d of RATIO_DEFINITIONS) expect(d.tierBoundaries).toBeNull();
  });
  it("stores the T1 ranges from the material", () => {
    const by = Object.fromEntries(RATIO_DEFINITIONS.map((d) => [d.id, d]));
    expect(by.ESR.t1).toEqual({ min: 45, max: 47.9 });
    expect(by.EME.t1).toEqual({ min: 47, max: 48 });
    expect(by.CBS.t1).toEqual({ min: 80, max: null });
    expect(by.FT_U.t1).toEqual({ min: 30, max: 32 });
    expect(by.NW.t1).toEqual({ min: 90, max: 98 });
  });
  it("derives tolerances by the documented rule", () => {
    expect(toleranceFor({ min: 45, max: 47.9 })).toBeCloseTo(4.645);
    expect(toleranceFor({ min: 0, max: 3 })).toBeCloseTo(1.5);
    expect(toleranceFor({ min: 80, max: null })).toBeCloseTo(8);
  });
  it("has a formula entry for every ratio and no formula for incomplete ones", () => {
    for (const d of RATIO_DEFINITIONS) {
      expect(typeof FORMULAS[d.id]).toBe("function");
      if (d.status === "incomplete") expect(FORMULAS[d.id]({ map: {}, ipd: 1 })).toBeNull();
    }
  });
});
