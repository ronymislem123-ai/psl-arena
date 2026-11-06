import { describe, expect, it } from "vitest";
import { analyzeFace } from "@/engine/analysis";
import { resolveBattle } from "@/engine/battle";
import { MESH_INDEX } from "@/engine/landmarks/mesh-map";
import { ADDITIONAL_DEFINITIONS, CATEGORY_ORDER, RATIO_DEFINITIONS } from "@/engine/ratios/database";
import { additionalNote, battleSummary, featureSummary, issueText, localizedExplanation, metricText, symmetryMetricLabel, tierText, unavailableText, verdictReason, warningTexts } from "@/lib/i18n/engine-text";
import { ADDITIONAL_TEXTS_DE, CATEGORY_TEXTS_DE, LANDMARK_LABELS_DE, RATIO_TEXTS_DE, ratioText } from "@/lib/i18n/ratio-texts";
import { SIDE_DEFINITIONS, SIDE_LANDMARK_ORDER } from "@/engine/side-view";
import { SIDE_ASSUMPTION_TEXTS, SIDE_ISSUE_TEXTS, SIDE_LANDMARK_TEXTS, SIDE_MEASUREMENT_TEXTS_DE, sideMeasurementText } from "@/lib/i18n/side-texts";
import { inputFromFixture, loadFixture } from "./helpers";

describe("side-view texts", () => {
  it("cover every measurement, landmark, issue and assumption in both languages", () => {
    for (const d of SIDE_DEFINITIONS) {
      const de = SIDE_MEASUREMENT_TEXTS_DE[d.id];
      expect(de, d.id).toBeTruthy();
      expect(de.name).not.toBe(d.name);
      expect(de.methodology.length).toBeGreaterThan(10);
      expect(de.limitations.length).toBe(d.limitations.length);
      expect(sideMeasurementText(d.id, "en").name).toBe(d.name);
      expect(sideMeasurementText(d.id, "de").name).toBe(de.name);
    }
    for (const id of SIDE_LANDMARK_ORDER) {
      expect(SIDE_LANDMARK_TEXTS.en[id].hint.length).toBeGreaterThan(10);
      expect(SIDE_LANDMARK_TEXTS.de[id].hint.length).toBeGreaterThan(10);
    }
    for (const lang of ["en", "de"] as const) {
      expect(Object.keys(SIDE_ISSUE_TEXTS[lang]).sort()).toEqual(["anteriorOrder", "gonionLevel", "lowResolution", "neckOrder", "tragionLevel", "verticalOrder"]);
      expect(Object.keys(SIDE_ASSUMPTION_TEXTS[lang]).sort()).toEqual(["imageVertical", "manualPlacement", "proxies", "separateFromFrontal"]);
    }
  });
});

describe("German measurement texts", () => {
  it("cover every ratio, category, additional measurement and landmark", () => {
    for (const d of RATIO_DEFINITIONS) {
      const tx = RATIO_TEXTS_DE[d.id];
      expect(tx, d.id).toBeTruthy();
      expect(tx.name.length).toBeGreaterThan(2);
      expect(tx.formula.length).toBeGreaterThan(2);
      expect(tx.methodology.length).toBeGreaterThan(10);
      expect(tx.limitations.length).toBeGreaterThan(0);
    }
    for (const c of CATEGORY_ORDER) expect(CATEGORY_TEXTS_DE[c].label.length).toBeGreaterThan(2);
    for (const a of ADDITIONAL_DEFINITIONS) expect(ADDITIONAL_TEXTS_DE[a.id].name.length).toBeGreaterThan(2);
    const res = analyzeFace(inputFromFixture(loadFixture("ai-face")));
    for (const l of res.landmarks) expect(LANDMARK_LABELS_DE[l.id], l.id).toBeTruthy();
    for (const id of Object.keys(MESH_INDEX)) expect(LANDMARK_LABELS_DE[id as keyof typeof LANDMARK_LABELS_DE], id).toBeTruthy();
    // English falls back to the database itself
    expect(ratioText("ESR", "en").name).toBe("Eye Spacing Ratio");
    expect(ratioText("ESR", "de").name).toBe("Augenabstands-Verhältnis");
  });

  it("renders every engine message in German from codes, never falling back to English", () => {
    const res = analyzeFace(inputFromFixture(loadFixture("obama"), { trichion: null }));
    for (const r of res.ratios) {
      expect(r.tierCode, r.id).toBeTruthy();
      const de = tierText(r, "de");
      expect(de).not.toBe(r.tierNote);
      if (r.availability !== "available") {
        expect(r.unavailableCode, r.id).toBeTruthy();
        expect(unavailableText(r, "de")).not.toBe(r.unavailableReason);
      }
      const ex = localizedExplanation(r, res.landmarks, "de");
      expect(ex.how).toBe(RATIO_TEXTS_DE[r.id].methodology);
    }
    expect(res.quality.issues.length).toBeGreaterThan(0);
    for (const i of res.quality.issues) {
      expect(i.key, i.code).toBeTruthy();
      expect(issueText(i, "de")).not.toBe(i.message);
      expect(issueText(i, "en")).toBe(i.message);
    }
    for (const m of res.quality.metrics) expect(metricText(m, "de").label).not.toBe(m.label);
    for (const f of res.features) {
      expect(f.code, f.id).toBeTruthy();
      const de = featureSummary(f, "de", res.symmetry.metrics);
      expect(de.length).toBeGreaterThan(0);
      // purely numeric summaries (e.g. "1.90× IPD") are language-neutral by design
      if (/[a-z]{3,}/i.test(f.summary.replace(/IPD|EAR/g, ""))) expect(de, f.id).not.toBe(f.summary);
    }
    for (const m of res.symmetry.metrics) expect(symmetryMetricLabel(m, "de")).not.toBe(m.label);
    for (const a of res.additional) {
      expect(a.noteCode, a.id).toBeTruthy();
      expect(additionalNote(a, "de")).not.toBe(a.note);
    }
    expect(res.warningCodes?.length).toBe(res.warnings.length);
    const w = warningTexts(res, "de");
    expect(w).toHaveLength(res.warnings.length);
    expect(w.join(" ")).not.toBe(res.warnings.join(" "));
  });

  it("localises battle verdicts and summaries", () => {
    const a = analyzeFace(inputFromFixture(loadFixture("ai-face")));
    const b = analyzeFace(inputFromFixture(loadFixture("biden")));
    const r = resolveBattle(a, b);
    expect(r.verdictCode).toBeTruthy();
    expect(verdictReason(r, "de")).not.toBe(r.verdictReason);
    expect(verdictReason(r, "en")).toBe(r.verdictReason);
    const de = battleSummary(r, { a: "Alpha", b: "Bravo" }, "de");
    expect(de).toMatch(/Runden: \d+ – \d+/);
    expect(battleSummary(r, { a: "Alpha", b: "Bravo" }, "en")).toBe(r.summary);
    const inconclusive = resolveBattle(a, analyzeFace(inputFromFixture(loadFixture("ai-upper"))));
    expect(verdictReason(inconclusive, "de")).toMatch(/Qualitätsprüfung/);
  });
});
