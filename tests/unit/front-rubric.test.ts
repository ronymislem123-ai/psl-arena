import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { CATEGORY_WEIGHTS, CRITERIA, isFrontOnlyRubric, MIN_SCORABLE_COVERAGE, RUBRIC_AREAS, RUBRIC_VERSION } from "@/engine/psl/rubric";
import { PSL_BANDS, pslBand } from "@/engine/psl/bands";
import { buildReportText } from "@/lib/psl-report";
import { de } from "@/lib/i18n/de";
import { rateFace } from "@/engine/psl/rating";
import { buildStandardScale, snapshotScale } from "@/engine/psl/scale";
import { aggregateHierarchy, measureKeys, type MeasureMap } from "@/engine/scoring/hierarchy";
import { inputFromFixture, loadFixture, loadVerifiedInput } from "./helpers";

const scale = snapshotScale(buildStandardScale());

/** every criterion of an area gets one measure with the given index (reliability and confidence 1) */
function measuresFor(values: Partial<Record<string, number>>): MeasureMap {
  const m: MeasureMap = new Map();
  for (const c of CRITERIA) {
    const v = values[c.area];
    if (v == null) continue;
    const key = measureKeys(c)[0];
    m.set(key, { index: v, confidence: 1, reliability: 1, weight: 1, source: c.method === "visual" ? "visual" : "frontal" });
  }
  return m;
}

describe("PSL Score – Front Profile (rubric 3.0)", () => {
  it("uses only frontal criteria in seven categories whose weights sum to exactly 100 %", () => {
    expect(RUBRIC_VERSION).toBe("3.0.0");
    expect(RUBRIC_AREAS).toEqual(["eye", "harmonySymmetry", "midfaceFront", "nose", "lowerThird", "jawline", "cheekbonesWidth"]);
    expect(CATEGORY_WEIGHTS).toEqual({ eye: 20, harmonySymmetry: 20, midfaceFront: 15, nose: 15, lowerThird: 15, jawline: 10, cheekbonesWidth: 5 });
    expect(RUBRIC_AREAS.reduce((s, a) => s + (CATEGORY_WEIGHTS[a] ?? 0), 0)).toBe(100);
    for (const c of CRITERIA) {
      expect(c.method, c.id).not.toBe("profile");
      expect(c.view, c.id).not.toBe("profile");
      expect(c.inputs.side ?? [], c.id).toHaveLength(0);
      expect(RUBRIC_AREAS, c.id).toContain(c.area);
    }
    for (const a of RUBRIC_AREAS) expect(CRITERIA.some((c) => c.area === a), a).toBe(true);
  });

  it("PSL = Σ Sᵢ·Wᵢ: worked example with known category scores", () => {
    // category indices (0–100) → S (0–10): eye 8, harmony 6, midface 7, nose 5, lower third 9, jaw 4, cheekbones 10
    const h = aggregateHierarchy(measuresFor({ eye: 80, harmonySymmetry: 60, midfaceFront: 70, nose: 50, lowerThird: 90, jawline: 40, cheekbonesWidth: 100 }));
    // 0.20·8 + 0.20·6 + 0.15·7 + 0.15·5 + 0.15·9 + 0.10·4 + 0.05·10 = 6.85
    expect(h.overall! / 10).toBeCloseTo(6.85, 10);
    for (const c of h.categories) expect(c.index).not.toBeNull();
    expect(h.compensationPenalty).toBeCloseTo(0, 10);
  });

  it("missing categories are not counted as 0: the remaining weights are renormalised", () => {
    const h = aggregateHierarchy(measuresFor({ eye: 80, harmonySymmetry: 60, midfaceFront: 70, nose: 50, lowerThird: 90 }));
    expect(h.categories.find((c) => c.id === "jawline")!.index).toBeNull();
    // (0.20·8 + 0.20·6 + 0.15·7 + 0.15·5 + 0.15·9) / 0.85 = 7.0
    expect(h.overall! / 10).toBeCloseTo(5.95 / 0.85, 10);
  });

  it("always between 0 and 10", () => {
    expect(aggregateHierarchy(measuresFor({ eye: 0, harmonySymmetry: 0, midfaceFront: 0, nose: 0, lowerThird: 0, jawline: 0, cheekbonesWidth: 0 })).overall).toBe(0);
    expect(aggregateHierarchy(measuresFor({ eye: 100, harmonySymmetry: 100, midfaceFront: 100, nose: 100, lowerThird: 100, jawline: 100, cheekbonesWidth: 100 })).overall).toBe(100);
  });

  it("a real frontal rating: frontal sources only, score in range, consistent with the category formula", () => {
    const frontal = analyzeFace(loadVerifiedInput("portrait-a"));
    const r = rateFace({ frontal, scale });
    expect(r.rubricVersion).toBe("3.0.0");
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThanOrEqual(0);
    expect(r.score!).toBeLessThanOrEqual(10);
    expect(r.quality.sideUsed).toBe(false);
    expect(r.warningCodes).not.toContain("noProfile");
    for (const c of r.criteria) expect(["frontal", "visual-model", "self-assessment"], c.id).toContain(c.source);
    const scored = r.areas.filter((a) => a.score != null);
    const wsum = scored.reduce((s, a) => s + a.weight, 0);
    expect(r.score!).toBeCloseTo(scored.reduce((s, a) => s + a.score! * a.weight, 0) / wsum, 9);
    // a full frontal photo with hairline covers (almost) the whole frontal rubric
    expect(r.coverage).toBeGreaterThan(0.9);
    expect(r.valid).toBe(true);
  });

  it("no overall score when too much is missing", () => {
    const frontal = analyzeFace(inputFromFixture(loadFixture("ai-face")));
    const keep = new Set(["CT", "ESR"]);
    const thin = { ...frontal, ratios: frontal.ratios.map((x) => (keep.has(x.id) ? x : { ...x, availability: "unavailable" as const, value: null, index: null })), symmetry: { ...frontal.symmetry, metrics: [] }, additional: [] };
    const r = rateFace({ frontal: thin, scale });
    expect(r.coverage).toBeLessThan(MIN_SCORABLE_COVERAGE);
    expect(r.score).toBeNull();
    expect(r.tier).toBeNull();
    expect(r.warningCodes).toContain("insufficientData");
  });

  it("interpretation bands follow the displayed value (one decimal)", () => {
    expect(PSL_BANDS.map((b) => [b.min, b.max])).toEqual([[0, 3], [3, 5], [5, 7], [7, 9], [9, 10]]);
    const cases: [number, string][] = [[0, "veryWeak"], [2.94, "veryWeak"], [2.95, "belowAverage"], [3, "belowAverage"], [4.9, "belowAverage"], [5, "average"], [6.85, "average"], [6.95, "aboveAverage"], [8.9, "aboveAverage"], [9, "exceptional"], [10, "exceptional"]];
    for (const [v, band] of cases) expect(pslBand(v), String(v)).toBe(band);
    expect(pslBand(null)).toBeNull();
    expect(pslBand(Number.NaN)).toBeNull();
  });

  it("report: new ratings are labelled “PSL Score – Front Profile” with the note; old ones as the old method", () => {
    const lookup = (key: string): string => key.split(".").reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], de) as string;
    const t = (key: string, vars?: Record<string, string | number>) => Object.entries(vars ?? {}).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), lookup(key) ?? key);
    const r = rateFace({ frontal: analyzeFace(inputFromFixture(loadFixture("ai-face"))), scale });
    const text = buildReportText(r, "Test", "de", t);
    expect(text).toContain(`PSL Score – Front Profile: ${r.score!.toFixed(1)}`);
    expect(text).toContain("Die Bewertung basiert ausschließlich auf der frontalen Gesichtsansicht. Merkmale, die eine seitliche Perspektive erfordern, werden nicht in den Gesamtscore einbezogen.");
    expect(text).toContain(`Einordnung: ${t(`rater.result.band.${pslBand(r.score)}`)}`);
    expect(text).toContain("Σ (Sᵢ × Wᵢ)");
    expect(text).not.toMatch(/Profilansicht|Seitenansicht|Potenzmittel/);
    expect(isFrontOnlyRubric(r.rubricVersion)).toBe(true);
    // a stored rubric 2.2 rating keeps its score but is not shown as a front-profile score
    const old = { ...r, rubricVersion: "2.2.0", aggregation: { ...r.aggregation!, p: 0.5, compensationPenalty: 1.2 } };
    const oldText = buildReportText(old, "Test", "de", t);
    expect(isFrontOnlyRubric("2.2.0")).toBe(false);
    expect(oldText).toContain("PSL-Score (alte Methode)");
    expect(oldText).not.toContain("PSL Score – Front Profile:");
    expect(oldText).toContain("früheren Bewertungsmethode");
    // insufficient data: no score, the reason is stated
    const keep = new Set(["CT", "ESR"]);
    const f = analyzeFace(inputFromFixture(loadFixture("ai-face")));
    const thin = rateFace({ frontal: { ...f, ratios: f.ratios.map((x) => (keep.has(x.id) ? x : { ...x, availability: "unavailable" as const, value: null, index: null })), symmetry: { ...f.symmetry, metrics: [] }, additional: [] }, scale });
    const thinText = buildReportText(thin, "Test", "de", t);
    expect(thinText).toContain("PSL Score – Front Profile: —");
    expect(thinText).toContain("Eine zuverlässige Gesamtbewertung ist nicht möglich");
  });
});
