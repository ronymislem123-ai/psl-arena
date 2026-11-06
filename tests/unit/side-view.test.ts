import { describe, expect, it } from "vitest";
import { analyzeSideView, detectFacing, findIssues, formatSideRange, formatSideValue, SIDE_BY_ID, SIDE_DEFINITIONS, SIDE_LANDMARK_ORDER, toleranceFor, type SideMeasurementId, type SidePoints } from "@/engine/side-view";

/** Synthetic profile facing right (anterior = +x, image y grows downwards). */
export const PROFILE: SidePoints = {
  glabella: { x: 500, y: 300 },
  nasion: { x: 490, y: 360 },
  rhinion: { x: 520, y: 410 },
  pronasale: { x: 560, y: 470 },
  subnasale: { x: 516, y: 500 },
  alar_crease: { x: 500, y: 480 },
  labrale_sup: { x: 522, y: 540 },
  stomion: { x: 510, y: 565 },
  labrale_inf: { x: 518, y: 585 },
  labiomental: { x: 500, y: 615 },
  pogonion: { x: 514, y: 660 },
  menton: { x: 490, y: 700 },
  cervical: { x: 430, y: 730 },
  neck: { x: 430, y: 800 },
  gonion: { x: 380, y: 640 },
  tragion: { x: 330, y: 420 },
};

const value = (r: ReturnType<typeof analyzeSideView>, id: SideMeasurementId) => r.measurements.find((m) => m.id === id)!.value!;
const mirror = (p: SidePoints, width = 1000): SidePoints => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { x: width - v.x, y: v.y }])) as SidePoints;
const transform = (p: SidePoints, f: (q: { x: number; y: number }) => { x: number; y: number }): SidePoints => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, f(v)])) as SidePoints;

describe("side-view database", () => {
  it("has 16 measurements: 13 scored, 3 descriptive, every range sourced", () => {
    expect(SIDE_DEFINITIONS).toHaveLength(16);
    const scored = SIDE_DEFINITIONS.filter((d) => d.range && d.weight > 0);
    const descriptive = SIDE_DEFINITIONS.filter((d) => !d.range);
    expect(scored).toHaveLength(13);
    expect(descriptive).toHaveLength(3);
    for (const d of descriptive) expect(d.weight).toBe(0);
    for (const d of SIDE_DEFINITIONS) {
      expect(d.reference.length, d.id).toBeGreaterThan(10);
      expect(d.landmarks.length, d.id).toBeGreaterThanOrEqual(3);
      for (const l of d.landmarks) expect(SIDE_LANDMARK_ORDER).toContain(l);
      if (d.source === "guide") expect(d.reference).toMatch(/guide/i);
      if (d.source === "literature") expect(d.reference).toMatch(/\d{4}/); // carries a year
    }
    expect(SIDE_BY_ID.GA.source).toBe("guide");
    expect(SIDE_BY_ID.GA.range).toEqual({ min: 115, max: 130 });
  });

  it("applies the app tolerance rule (10 % of the midpoint or half the width)", () => {
    expect(toleranceFor({ min: 115, max: 130 })).toBeCloseTo(12.25, 5);
    expect(toleranceFor({ min: 7, max: 15 })).toBe(4);
    expect(toleranceFor({ min: 50, max: 50 })).toBe(5); // point target
    expect(toleranceFor({ min: 0.55, max: 0.6 })).toBeCloseTo(0.0575, 5);
  });

  it("formats values and ranges by unit", () => {
    expect(formatSideValue("GA", 123.456)).toBe("123.5°");
    expect(formatSideValue("LFH", 50.04)).toBe("50.0 %");
    expect(formatSideValue("GOODE", 0.5678)).toBe("0.57");
    expect(formatSideValue("GA", null)).toBe("—");
    expect(formatSideRange("GA")).toBe("115–130°");
    expect(formatSideRange("LFH")).toBe("≈ 50 %");
    expect(formatSideRange("LCR")).toBe("≈ 2.00");
    expect(formatSideRange("DORSUM")).toBe("—");
  });
});

describe("side-view measurements (hand-computed on the synthetic profile)", () => {
  const r = analyzeSideView(PROFILE);

  it("detects the facing direction and is analyzable", () => {
    expect(r.facing).toBe("right");
    expect(detectFacing(mirror(PROFILE))).toBe("left");
    expect(r.analyzable).toBe(true);
    expect(r.issues).toHaveLength(0);
    expect(r.scoredCount).toBe(13);
    expect(r.measurements).toHaveLength(16);
  });

  it("matches angles computed by hand", () => {
    const expected: Partial<Record<SideMeasurementId, number>> = {
      NFA: 138.06, // at N: (10,−60) vs (70,110)
      CMA: 116.57, // at C: (60,−30) vs (0,70)
      NLA: 115.76, // at Sn: (44,−30) vs (6,40)
      FCA: 174.71, // at Sn: (−16,−200) vs (−2,160)
      HANG: 8.38, // at Pg: (−24,−300) vs (8,−120)
      ZANG: 86.19, // lip Ls (522 ≥ 518): Pg−Ls = (−8,120) vs posterior (−1,0)
      GA: 131.43, // at Go: (−50,−220) vs (110,60)
      MCA: 65.66, // (14,360) vs (−60,30)
      NFC: 30.23, // (14,360) vs (70,110)
      NMA: 133.92, // at Prn: (−70,−110) vs (−46,190)
      MLA: 131.76, // at Lm: (18,−30) vs (14,45)
    };
    for (const [id, v] of Object.entries(expected)) expect(Math.abs(value(r, id as SideMeasurementId) - v!), id).toBeLessThan(0.05);
  });

  it("matches ratios computed by hand", () => {
    expect(value(r, "LFH")).toBeCloseTo(50, 5); // 200 / 400
    expect(value(r, "LCR")).toBeCloseTo(135 / 65, 5);
    expect(value(r, "GOODE")).toBeCloseTo(60.623 / 130.384, 3); // perpendicular from Prn to N–AC over N–Prn
    expect(value(r, "DORSUM")).toBeCloseTo(-1.176, 2); // rhinion slightly behind the N–Prn line
    expect(value(r, "CHIN_MERIDIAN")).toBeCloseTo((24 / 340) * 100, 3);
  });

  it("scores only ranged measurements and leaves descriptive ones unscored", () => {
    for (const m of r.measurements) {
      const def = SIDE_BY_ID[m.id];
      if (!def.range) {
        expect(m.index, m.id).toBeNull();
        expect(m.inRange, m.id).toBeNull();
        expect(m.value, m.id).not.toBeNull();
      } else {
        expect(m.index, m.id).not.toBeNull();
        expect(m.inRange, m.id).toBe(m.deviation === 0);
        if (m.inRange) expect(m.index).toBe(100);
        else expect(m.index!).toBeLessThan(100);
      }
    }
    const lfh = r.measurements.find((m) => m.id === "LFH")!;
    expect(lfh.inRange).toBe(true); // exactly the 1:1 point target
    const scored = r.measurements.filter((m) => m.index != null);
    const mean = scored.reduce((s, m) => s + m.index!, 0) / scored.length;
    expect(r.score).toBeCloseTo(mean, 6);
    expect(r.score!).toBeGreaterThan(0);
    expect(r.score!).toBeLessThanOrEqual(100);
  });

  it("is invariant to mirroring, translation and scale; angles are invariant to rotation", () => {
    const m = analyzeSideView(mirror(PROFILE));
    expect(m.facing).toBe("left");
    for (const id of SIDE_DEFINITIONS.map((d) => d.id)) expect(value(m, id), id).toBeCloseTo(value(r, id), 6);
    const ts = analyzeSideView(transform(PROFILE, (p) => ({ x: p.x * 1.7 + 123, y: p.y * 1.7 + 45 })));
    for (const id of SIDE_DEFINITIONS.map((d) => d.id)) expect(value(ts, id), id).toBeCloseTo(value(r, id), 6);
    const a = (7 * Math.PI) / 180;
    const rot = analyzeSideView(transform(PROFILE, (p) => ({ x: 500 + (p.x - 500) * Math.cos(a) - (p.y - 500) * Math.sin(a), y: 500 + (p.x - 500) * Math.sin(a) + (p.y - 500) * Math.cos(a) })));
    for (const id of ["GA", "CMA", "MCA", "NFA", "NFC", "NMA", "NLA", "MLA", "FCA", "HANG", "GOODE", "DORSUM"] as SideMeasurementId[]) expect(value(rot, id), id).toBeCloseTo(value(r, id), 4);
    // vertical-dependent measures change with rotation (documented assumption)
    expect(Math.abs(value(rot, "ZANG") - value(r, "ZANG"))).toBeGreaterThan(5);
  });

  it("reports deterministic placement sensitivity", () => {
    expect(r.uncertainty.samples).toBe(40);
    expect(r.uncertainty.sigmaPx).toBeCloseTo(1.6, 5); // 0.004 × 400 px face height
    expect(r.scoreSigma!).toBeGreaterThan(0);
    for (const m of r.measurements) expect(m.valueSigma!, m.id).toBeGreaterThan(0);
    const again = analyzeSideView(PROFILE);
    expect(again.scoreSigma).toBe(r.scoreSigma);
    expect(again.measurements.map((m) => m.valueSigma)).toEqual(r.measurements.map((m) => m.valueSigma));
    const off = analyzeSideView(PROFILE, { uncertaintySamples: 0 });
    expect(off.uncertainty.samples).toBe(0);
    expect(off.scoreSigma).toBeNull();
    expect(off.measurements.every((m) => m.valueSigma === null)).toBe(true);
    // short angle arms are more sensitive than long ones
    const nla = r.measurements.find((m) => m.id === "NLA")!.valueSigma!;
    const hang = r.measurements.find((m) => m.id === "HANG")!.valueSigma!;
    expect(nla).toBeGreaterThan(hang);
  });
});

describe("side-view placement check", () => {
  it("rejects a wrong vertical order without producing values", () => {
    const bad = { ...PROFILE, subnasale: { x: 516, y: 350 } }; // above the nasal tip
    const r = analyzeSideView(bad);
    expect(r.analyzable).toBe(false);
    expect(r.issues).toContainEqual({ code: "verticalOrder", severity: "error" });
    expect(r.score).toBeNull();
    expect(r.scoredCount).toBe(0);
    expect(r.measurements.every((m) => m.value === null && m.index === null)).toBe(true);
  });

  it("rejects a nasal tip that is not the most anterior nose point", () => {
    const bad = { ...PROFILE, pronasale: { x: 505, y: 470 } };
    expect(findIssues(bad, "right").map((i) => i.code)).toContain("anteriorOrder");
  });

  it("rejects neck points above the chin", () => {
    const bad = { ...PROFILE, cervical: { x: 430, y: 690 } };
    expect(findIssues(bad, "right")).toContainEqual({ code: "neckOrder", severity: "error" });
  });

  it("warns about implausible tragion/gonion levels and small faces but stays analyzable", () => {
    const odd = { ...PROFILE, tragion: { x: 330, y: 250 }, gonion: { x: 380, y: 760 } };
    const r = analyzeSideView(odd);
    expect(r.analyzable).toBe(true);
    expect(r.issues.map((i) => i.code).sort()).toEqual(["gonionLevel", "tragionLevel"]);
    const tiny = analyzeSideView(transform(PROFILE, (p) => ({ x: p.x * 0.3, y: p.y * 0.3 })));
    expect(tiny.issues).toContainEqual({ code: "lowResolution", severity: "warning" });
    expect(tiny.uncertainty.sigmaPx).toBe(1.5); // floor
  });
});
