import { describe, expect, it } from "vitest";
import { assignTier, buildStandardScale, exportScale, formatTierRange, isScaleValid, newTierId, roundBound, snapshotScale, tierGroups, validateScale, type PslTier } from "@/engine/psl/scale";

const mk = (id: string, min: number, max: number, order: number, extra: Partial<PslTier> = {}): PslTier => ({ id, name: id, short: id, group: null, min, max, order, description: "", color: "#4f7cff", percentile: null, images: [], notes: "", ...extra });

describe("standard PSL scale", () => {
  const s = buildStandardScale();
  it("has 7 groups and 21 tiers covering 0–10 exactly as specified", () => {
    expect(s.tiers).toHaveLength(21);
    expect(validateScale(s)).toEqual([]);
    const groups = tierGroups(s.tiers);
    expect(groups.map((g) => g.group)).toEqual(["Lowest Tiers", "Low Tier Normie", "Mid Tier Normie", "High Tier Normie", "Chadlite", "Chad", "Adam Tier"]);
    expect(groups.map((g) => [g.min, g.max])).toEqual([[0, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10]]);
    const t = Object.fromEntries(s.tiers.map((x) => [x.id, x]));
    expect([t.sub1.min, t.sub1.max, t.sub4.min, t.sub4.max]).toEqual([0, 1, 3, 4]);
    expect([t.lltn.min, t.lltn.max]).toEqual([4, roundBound(4 + 1 / 3)]);
    expect([t.mltn.min, t.mltn.max]).toEqual([roundBound(4 + 1 / 3), roundBound(4 + 2 / 3)]);
    expect([t.hltn.min, t.hltn.max]).toEqual([roundBound(4 + 2 / 3), 5]);
    expect([t.chad_high.min, t.chad_high.max]).toEqual([roundBound(8 + 2 / 3), 9]);
    expect([t.adamlite.min, t.adamlite.max, t.adam.min, t.adam.max]).toEqual([9, 9.5, 9.5, 10]);
    // adjacent tiers share exactly the same stored boundary (no gaps from float arithmetic)
    const sorted = [...s.tiers].sort((a, b) => a.order - b.order);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].min).toBe(sorted[i - 1].max);
  });

  it("assigns tiers on the unrounded value: lower bound inclusive, upper exclusive, top inclusive", () => {
    expect(assignTier(s, 0)!.id).toBe("sub1");
    expect(assignTier(s, 0.999999)!.id).toBe("sub1");
    expect(assignTier(s, 1)!.id).toBe("sub2");
    expect(assignTier(s, 4)!.id).toBe("lltn");
    expect(assignTier(s, 4.3333)!.id).toBe("lltn");
    expect(assignTier(s, 4.333334)!.id).toBe("mltn");
    expect(assignTier(s, 4.6666)!.id).toBe("mltn"); // displays as 4.67 but stays mltn
    expect(assignTier(s, 4.666667)!.id).toBe("hltn");
    expect(assignTier(s, 7)!.id).toBe("chadlite_low");
    expect(assignTier(s, 8.999)!.id).toBe("chad_high");
    expect(assignTier(s, 9.5)!.id).toBe("adam");
    expect(assignTier(s, 10)!.id).toBe("adam"); // only the top bound is inclusive
    expect(assignTier(s, 10.01)).toBeNull();
    expect(assignTier(s, -0.01)).toBeNull();
    expect(assignTier(s, Number.NaN)).toBeNull();
  });

  it("snapshots and exports without images and keeps the order", () => {
    const snap = snapshotScale(s, "2026-01-01T00:00:00.000Z");
    expect(snap.tiers).toHaveLength(21);
    expect(snap.tiers[0]).not.toHaveProperty("images");
    expect(assignTier(snap, 5.5)!.id).toBe("mmtn");
    const ex = exportScale(s, "2026-01-01T00:00:00.000Z");
    expect(ex.format).toBe("psl-arena-scale");
    expect(ex.scale.tiers.every((t) => !("images" in t))).toBe(true);
    expect(formatTierRange(s.tiers[5])).toBe("4.33–4.67");
    expect(formatTierRange(s.tiers[0])).toBe("0–1");
  });
});

describe("scale validation", () => {
  it("detects overlaps, gaps, bad bounds, duplicates, order and range problems", () => {
    const base = { name: "X", rangeMin: 0, rangeMax: 10 };
    expect(validateScale({ ...base, tiers: [mk("a", 0, 5, 0), mk("b", 5, 10, 1)] })).toEqual([]);
    expect(validateScale({ ...base, tiers: [mk("a", 0, 6, 0), mk("b", 5, 10, 1)] }).map((i) => i.code)).toContain("overlap");
    expect(validateScale({ ...base, tiers: [mk("a", 0, 4, 0), mk("b", 5, 10, 1)] }).map((i) => i.code)).toContain("gap");
    expect(validateScale({ ...base, tiers: [mk("a", 0, 5, 0), mk("b", 5, 9, 1)] }).map((i) => i.code)).toContain("gap");
    expect(validateScale({ ...base, tiers: [mk("a", 1, 5, 0), mk("b", 5, 10, 1)] }).map((i) => i.code)).toContain("gap");
    expect(validateScale({ ...base, tiers: [mk("a", 5, 5, 0)] }).map((i) => i.code)).toContain("invalidBounds");
    expect(validateScale({ ...base, tiers: [mk("a", 0, 5, 0), mk("a", 5, 10, 1)] }).map((i) => i.code)).toContain("duplicateId");
    expect(validateScale({ ...base, tiers: [mk("a", 0, 5, 1), mk("b", 5, 10, 0)] }).map((i) => i.code)).toContain("orderMismatch");
    expect(validateScale({ ...base, tiers: [mk("a", 0, 5, 0, { name: " " }), mk("b", 5, 10, 1)] }).map((i) => i.code)).toContain("tierEmptyName");
    expect(validateScale({ ...base, tiers: [mk("a", 0, 10, 0, { color: "blue" })] }).map((i) => i.code)).toContain("badColor");
    expect(validateScale({ ...base, tiers: [mk("a", 0, 10, 0, { images: [{ imageId: "nope", caption: "" }] })] }).map((i) => i.code)).toContain("imageInvalid");
    expect(validateScale({ ...base, name: "", tiers: [] }).map((i) => i.code)).toEqual(expect.arrayContaining(["emptyName", "noTiers"]));
    expect(validateScale({ ...base, rangeMax: 0, tiers: [mk("a", 0, 1, 0)] }).map((i) => i.code)).toContain("invalidRange");
    expect(isScaleValid({ ...base, tiers: [mk("a", 0, 10, 0)] })).toBe(true);
  });
  it("generates fresh tier ids", () => {
    expect(newTierId([mk("tier_1", 0, 1, 0)])).toBe("tier_2");
    expect(newTierId([mk("tier_2", 0, 1, 0)])).toBe("tier_1");
  });
});
