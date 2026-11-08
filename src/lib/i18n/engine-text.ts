/**
 * Renders language-neutral engine codes as text. English always uses the engine's
 * own strings; German is rendered from the codes/params stored with the result.
 * Older results without codes fall back to their stored English text.
 */
import { RATIO_BY_ID } from "@/engine/ratios/database";
import { formatT1, formatValue, type RatioExplanation } from "@/engine/explain";
import type { AdditionalMeasurementResult, AnalysisResult, BattleResult, BattleRound, FeatureObservation, QualityIssue, QualityMetric, RatioResult, SemanticLandmark, SymmetryMetric, SymmetryResult } from "@/engine/types";
import type { Lang } from "./index";
import { landmarkLabel, ratioText, roundLabel, SOURCE_TEXT, STATUS_TEXT } from "./ratio-texts";

const n0 = (v: number) => v.toFixed(0);
const n1 = (v: number) => v.toFixed(1);
const n2 = (v: number) => v.toFixed(2);

// ---------------------------------------------------------------- quality
const ISSUE_DE: Record<NonNullable<QualityIssue["key"]>, (p: Record<string, number | string>) => string> = {
  "lowResolution.error": () => "Das Gesicht ist im Bild zu klein (weniger als ~110 px breit). Bitte ein näheres oder höher aufgelöstes Foto verwenden.",
  "lowResolution.warning": () => "Geringe Gesichtsauflösung; feine Landmarks (Augen, Lippen) sind weniger präzise.",
  "blurry.error": () => "Das Gesicht ist für eine zuverlässige Landmark-Erkennung zu unscharf.",
  "blurry.warning": () => "Weichzeichnung erkannt; die Landmark-Präzision ist reduziert.",
  tooDark: () => "Das Gesicht ist sehr dunkel; Schatten verdecken Konturen.",
  tooBright: () => "Das Gesicht ist überbelichtet; Konturen sind ausgewaschen.",
  "lowContrast.error": () => "Der Kontrast ist zu gering.",
  "lowContrast.warning": () => "Geringer Kontrast reduziert die Kantenpräzision.",
  "yaw.error": (p) => `Der Kopf ist um ${p.deg}° gedreht – Breiten sind stark verkürzt. Bitte ein Frontalfoto verwenden.`,
  "yaw.warning": (p) => `Kopf um ${p.deg}° gedreht; horizontale Messungen verlieren Präzision.`,
  "yaw.info": (p) => `Leichte Kopfdrehung (${p.deg}°).`,
  "pitch.error": (p) => `Der Kopf ist um ${p.deg}° nach oben/unten geneigt; vertikale Proportionen sind verzerrt.`,
  "pitch.warning": (p) => `Kopf nach oben/unten geneigt (${p.deg}°); vertikale Proportionen verlieren Präzision.`,
  "roll.error": () => "Der Kopf ist in der Bildebene zu stark gedreht.",
  "roll.warning": () => "Eine starke Kopfneigung wurde rechnerisch korrigiert; Restfehler möglich.",
  "roll.info": (p) => `Der Kopf ist in der Bildebene um ${p.deg}° gedreht; das wurde exakt korrigiert.`,
  "exposure.bright": (p) => `${p.pct} % des Gesichts sind weiß ausgefressen; Konturen gehen dort verloren.`,
  "exposure.dark": (p) => `${p.pct} % des Gesichts sind schwarz abgesoffen; Konturen gehen dort verloren.`,
  "lighting.sided": () => "Starkes Seitenlicht: Konturpunkte auf der Schattenseite (Wange, Kiefer) sind weniger zuverlässig.",
  compression: () => "Sichtbare JPEG-Kompressionsblöcke verringern die Präzision feiner Landmarks.",
  "editing.tag": (p) => `Die Datei wurde von einer Bearbeitungssoftware gespeichert (${p.software}). Beauty-Filter können Proportionen verändern; das lässt sich nicht erkennen.`,
  smoothing: () => "Auffällig glatte Hauttextur (möglicher Filter). Weichzeichnen allein verändert die Geometrie kaum, verformende Filter schon; diese sind nicht erkennbar.",
  "perspective.close": (p) => `Nahaufnahme (etwa ${p.cm} cm): Zentrale Merkmale wie die Nase wirken im Verhältnis zur Gesichtsbreite um etwa ${p.pct} % größer; perspektivempfindliche Verhältnisse haben verringerte Konfidenz.`,
  "perspective.info": (p) => `Geschätzter Kameraabstand etwa ${p.cm} cm (aus EXIF-Brennweite und Irisgröße; ±26 %).`,
  eyesClosed: () => "Die Augen scheinen geschlossen; Augenmessungen sind unmöglich.",
  "mouthOpen.error": () => "Der Mund ist weit geöffnet; Messungen des unteren Drittels und der Lippen sind ungültig.",
  "mouthOpen.parted": () => "Die Lippen sind geöffnet; Lippenhöhen und Messungen des unteren Drittels sind weniger zuverlässig.",
  "expression.smile": (p) => `Ein Lächeln wurde erkannt (${p.pct} %). Mund-, Lippen- und Augenöffnungsmessungen sind betroffen; die Konfidenz ist reduziert.`,
  "expression.mild": () => "Leichter Gesichtsausdruck erkannt; ein neutraler Ausdruck verbessert die Genauigkeit.",
  faceCutOff: () => "Das Gesicht berührt den Bildrand; Haaransatz oder Kinn könnten abgeschnitten sein.",
  multipleFaces: (p) => `${p.n} Gesichter erkannt; das ausgewählte Gesicht wird analysiert.`,
  hairlineNotFound: () => "Der Haaransatz konnte nicht geschätzt werden. Bitte manuell setzen, um Haaransatz-basierte Verhältnisse (Drittel, TFWHR, LFF, FWHF) zu aktivieren.",
  selfie: () => "Nahaufnahme-Perspektive (Selfie) vergrößert die Nase und verschmälert das Gesicht; tiefenabhängige Verhältnisse haben reduzierte Konfidenz.",
};

export function issueText(i: QualityIssue, lang: Lang): string {
  if (lang !== "de" || !i.key) return i.message;
  return ISSUE_DE[i.key]?.(i.params ?? {}) ?? i.message;
}

const METRIC_DE: Record<string, { label: string; hint: string; unit?: string }> = {
  resolution: { label: "Gesichtsauflösung", hint: "≥ 300 px Gesichtsbreite empfohlen", unit: "px Gesichtsbreite" },
  sharpness: { label: "Schärfe", hint: "≥ 50 akzeptabel, ≥ 120 gut", unit: "Laplace-Varianz" },
  brightness: { label: "Helligkeit", hint: "70–190 ideal", unit: "/255" },
  contrast: { label: "Kontrast", hint: "≥ 25 akzeptabel", unit: "σ Luminanz" },
  yaw: { label: "Kopfdrehung (Yaw)", hint: "≤ 8° gut, ≤ 15° akzeptabel" },
  pitch: { label: "Kopfneigung (Pitch)", hint: "≤ 8° gut, ≤ 15° akzeptabel" },
  roll: { label: "Kopfneigung (Roll)", hint: "automatisch korrigiert; ≤ 10° ideal" },
  expression: { label: "Neutraler Ausdruck", hint: "≥ 70 % gut", unit: "% neutral" },
};

export function metricText(m: QualityMetric, lang: Lang): { label: string; hint: string; unit: string } {
  if (lang === "de" && METRIC_DE[m.id]) return { label: METRIC_DE[m.id].label, hint: METRIC_DE[m.id].hint, unit: METRIC_DE[m.id].unit ?? m.unit };
  return { label: m.label, hint: m.hint, unit: m.unit };
}

// ---------------------------------------------------------------- ratios
export function unavailableText(r: RatioResult, lang: Lang): string {
  const fallback = r.unavailableReason ?? (lang === "de" ? "Nicht verfügbar." : "Not available.");
  if (lang !== "de" || !r.unavailableCode) return fallback;
  switch (r.unavailableCode) {
    case "incomplete":
      return "Die Messkonvention ist im bereitgestellten Material unvollständig; nicht gemessen und nicht bewertet.";
    case "hairline":
      return "Haaransatz (Trichion) nicht verfügbar – Schätzung fehlgeschlagen oder nicht bestätigt; manuell setzen, um dieses Verhältnis zu aktivieren.";
    case "neck":
      return "Halsrandpunkte sind nicht gesetzt (manuelle Punkte erforderlich).";
    case "landmarks":
      return `Erforderliche Landmarks fehlen: ${(r.missingLandmarks ?? []).map((id) => landmarkLabel(id, lang, id)).join(", ")}.`;
    case "computation":
      return "Die Messung konnte aus der erkannten Geometrie nicht berechnet werden.";
    case "excluded":
      return "Rekonstruierte Messung durch die Konfiguration ausgeschlossen.";
  }
}

export function tierText(r: RatioResult, lang: Lang): string {
  if (lang !== "de" || !r.tierCode) return r.tierNote;
  switch (r.tierCode) {
    case "inT1":
      return "Innerhalb des T1-Zielbereichs (+10 Punkte).";
    case "outsideUndetermined":
      return "Außerhalb des T1-Bereichs. T2–T5-Grenzen sind im bereitgestellten Material nicht definiert, daher werden keine Stufenpunkte vergeben (unbestimmte Stufe).";
    case "verifiedTier":
      return `Außerhalb T1 um ${formatValue(Math.abs(r.deviation ?? 0), RATIO_BY_ID[r.id].unit)}; Stufe ${r.tier} (${r.tierPoints} Punkte) aus verifizierten Grenzen.`;
    case "notScoredIncomplete":
      return "Nicht bewertet (unvollständige Definition).";
    case "notScoredLandmarks":
      return "Nicht bewertet (Landmarks nicht verfügbar).";
    case "notScoredComputation":
      return "Nicht bewertet (Berechnung fehlgeschlagen).";
    case "excluded":
      return "Durch die Konfiguration vom Scoring ausgeschlossen.";
  }
}

/** Localised version of explainRatio(). */
export function localizedExplanation(r: RatioResult, landmarks: SemanticLandmark[], lang: Lang): RatioExplanation {
  const def = RATIO_BY_ID[r.id];
  const tx = ratioText(r.id, lang);
  const lmLabels = def.landmarks.map((id) => landmarkLabel(id, lang, landmarks.find((l) => l.id === id)?.label ?? id));
  const inter = Object.entries(r.intermediate)
    .map(([k, v]) => `${k} = ${Number.isFinite(v) ? v.toFixed(1) : "—"}`)
    .join(", ");
  const status = STATUS_TEXT[lang][def.status];
  const de = lang === "de";
  const reliability =
    r.availability === "available"
      ? de
        ? `Konfidenz ${(r.confidence * 100).toFixed(0)} %${r.uncertain ? " (unsicher)" : ""}${r.valueSigma != null ? `, ±${formatValue(r.valueSigma, def.unit)} (1σ Landmark-Jitter)` : ""}. ${status}`
        : `Confidence ${(r.confidence * 100).toFixed(0)} %${r.uncertain ? " (uncertain)" : ""}${r.valueSigma != null ? `, ±${formatValue(r.valueSigma, def.unit)} (1σ landmark jitter)` : ""}. ${status}`
      : `${unavailableText(r, lang)} ${status}`;
  const measured =
    r.value != null
      ? de
        ? `Gemessen ${formatValue(r.value, def.unit)}${r.deviation ? ` – ${r.deviation > 0 ? "über" : "unter"} dem T1-Bereich um ${formatValue(Math.abs(r.deviation), def.unit)}` : r.inT1 ? " – innerhalb T1" : ""}.`
        : `Measured ${formatValue(r.value, def.unit)}${r.deviation ? ` — ${r.deviation > 0 ? "above" : "below"} the T1 range by ${formatValue(Math.abs(r.deviation), def.unit)}` : r.inT1 ? " — inside T1" : ""}.`
      : de
        ? "Kein Wert."
        : "No value.";
  return {
    what: `${tx.name} (${def.abbreviation}): ${tx.formula}.`,
    how: tx.methodology,
    target: de ? `T1-Zielbereich: ${formatT1(def)}${def.target != null ? ` (Mittelpunkt ${formatValue(def.target, def.unit)})` : ""}.` : `T1 target range: ${formatT1(def)}${def.target != null ? ` (midpoint ${formatValue(def.target, def.unit)})` : ""}.`,
    measured,
    reliability,
    limitations: tx.limitations,
    points: tierText(r, lang),
    index:
      r.index != null
        ? de
          ? `Harmonie-Index ${r.index.toFixed(0)}/100: 100 innerhalb T1, halbiert sich je Toleranzeinheit (${formatValue(def.tolerance, def.unit)}) außerhalb.`
          : `Harmony index ${r.index.toFixed(0)}/100: 100 inside T1, halving for every tolerance unit (${formatValue(def.tolerance, def.unit)}) outside.`
        : de
          ? "Kein Index (nicht auswertbar)."
          : "No index (not evaluable).",
    formulaWithValues: inter ? `${tx.formula} → ${inter}` : tx.formula,
    landmarkLabels: lmLabels,
  };
}

export function sourceText(lang: Lang): string {
  return SOURCE_TEXT[lang];
}

// ---------------------------------------------------------------- features
const FEATURE_LABEL_DE: Record<string, string> = {
  canthalTilt: "Canthal Tilt", eyeSpacing: "Augenabstand", eyeShape: "Augenform (geometrisch)", eyeSymmetry: "Augensymmetrie", eyeAspectRatio: "Augen-Seitenverhältnis",
  browPosition: "Brauenposition", browToEye: "Abstand Braue–Auge", browDensity: "Brauendichte", browShape: "Brauenform (Bogen)", browTilt: "Augenbrauen-Tilt",
  midfaceLength: "Mittelgesichtslänge", midfaceRatio: "Mittelgesichts-Verhältnis", zygomaticWidth: "Jochbeinbreite", cheekboneDefinition: "Sichtbare Wangenknochendefinition", highCheekbones: "Wangenknochenposition (Höhe)", midfaceHarmony: "Mittelgesichtsharmonie", facialWidth: "Gesichts-Breiten-Höhen-Verhältnis",
  jawlineDefinition: "Kieferliniendefinition", jawWidth: "Kieferbreite (bigonial / bizygomatisch)", bigonialWidth: "Bigoniale Breite", gonialAngle: "Gonialwinkel (nur Frontalprojektion)", jawAngularity: "Kieferwinkligkeit (frontal)", jawlineSymmetry: "Kieferliniensymmetrie", chinProjection: "Kinnprojektion", chinWidth: "Kinnbreite (Mund/Kinn)", chinPhiltrum: "Kinn-zu-Philtrum-Verhältnis", lowerThirdProportions: "Proportion des unteren Drittels", mandibularDefinition: "Sichtbare Unterkieferdefinition",
  noseWidth: "Nasenbreite", noseHeight: "Nasenhöhe zu Nasenbreite", noseSymmetry: "Nasensymmetrie", nasalBridge: "Nasenrücken-Erscheinung", mouthWidth: "Mundbreite", lipWHR: "Lippen-Breiten-Höhen-Verhältnis", upperLowerLip: "Unter- zu Oberlippen-Verhältnis", lipSymmetry: "Lippensymmetrie", mouthNose: "Mund-zu-Nase-Verhältnis",
  facialHarmony: "Gesichtsharmonie", facialSymmetry: "Gesichtssymmetrie", overallBalance: "Gesamtbalance des Gesichts", facialDefinition: "Gesichtsdefinition", facialContours: "Gesichtskonturen", featureHarmony: "Harmonie der Einzelmerkmale", proportionalConsistency: "Proportionale Konsistenz", skinAppearance: "Sichtbares Hautbild",
};

const FEATURE_GROUP: Record<Lang, Record<FeatureObservation["group"], string>> = {
  en: { eyesBrows: "A · Eyes & Brows", midface: "B · Midface & Cheekbones", jawChin: "C · Jaw & Chin", noseLips: "D · Nose & Lips", overall: "E · Overall Facial Structure" },
  de: { eyesBrows: "A · Augen & Brauen", midface: "B · Mittelgesicht & Wangenknochen", jawChin: "C · Kiefer & Kinn", noseLips: "D · Nase & Lippen", overall: "E · Gesamte Gesichtsstruktur" },
};

export function featureGroupLabel(g: FeatureObservation["group"], lang: Lang): string {
  return FEATURE_GROUP[lang][g];
}

export function featureLabel(f: FeatureObservation, lang: Lang): string {
  return lang === "de" ? (FEATURE_LABEL_DE[f.id] ?? f.label) : f.label;
}

const FEATURE_NOTE_DE: Record<NonNullable<FeatureObservation["noteCode"]>, string> = {
  aspectOnly: "Formbeschreibung nur aus dem Seitenverhältnis abgeleitet.",
  noReference: "Rohmessung; kein Referenzbereich im Material.",
  softTissueZygion: "Verwendet die Weichteil-Zygion-Höhe.",
  constructedGonions: "Konstruierte Gonien.",
  needsProfile: "Der echte Gonialwinkel benötigt ein Profilfoto.",
  reconstructedChin: "Rekonstruierte Kinnpunkte.",
};

export function featureNote(f: FeatureObservation, lang: Lang): string | undefined {
  if (lang === "de" && f.noteCode) return FEATURE_NOTE_DE[f.noteCode] ?? f.note;
  return f.note;
}

const fmtUnit = (v: number, unit: string) => (unit === "percent" ? `${n1(v)} %` : unit === "degrees" ? `${n1(v)}°` : n2(v));

export function featureSummary(f: FeatureObservation, lang: Lang, symmetryMetrics: SymmetryMetric[] = []): string {
  if (lang !== "de" || !f.code) return f.summary;
  const p = f.params ?? {};
  switch (f.code) {
    case "ratioValue":
      return `${fmtUnit(f.value ?? 0, String(p.unit ?? f.unit ?? "ratio"))} – ${p.inT1 ? "innerhalb" : "außerhalb"} des T1-Bereichs`;
    case "ratioUnavailable":
      return unavailableText({ unavailableCode: p.unavailableCode as RatioResult["unavailableCode"], unavailableReason: f.summary } as RatioResult, lang);
    case "eyeShape":
      return `${f.descriptor === "elongated" ? "länglich geschnittene Lidspalte" : f.descriptor === "round" ? "rundere/offenere Lidspalte" : "ausgewogene Lidspalte"} (EAR ${n2(f.value ?? 0)})`;
    case "symmetrySub": {
      const ids = String(p.metricIds ?? "").split(",").filter(Boolean);
      const names = ids.map((id) => symmetryMetricLabelById(id, lang, symmetryMetrics.find((m) => m.id === id)?.label ?? id));
      return `Symmetrie-Teilscore ${n0(Number(p.score ?? f.value ?? 0))}/100 (${names.join(", ")})`;
    }
    case "browPosition":
      return `Die Brauenunterkante liegt ${n2(f.value ?? 0)}× IPD über den Pupillen`;
    case "browToEye":
      return `${n2(f.value ?? 0)}× IPD vom Oberlid zur Brauenkante`;
    case "browShape":
      return `${f.descriptor === "pronounced" ? "ausgeprägter Bogen" : f.descriptor === "soft" ? "weicher Bogen" : "gerade Braue"} (Bogenhöhe ${n2(f.value ?? 0)}× IPD)`;
    case "midfaceLength":
      return `Nasion → Oberlippe = ${n2(f.value ?? 0)}× IPD`;
    case "zygomaticWidth":
      return `${n2(f.value ?? 0)}× IPD (Weichteilkontur)`;
    case "categoryIndex":
      return `Kategorie-Index ${n0(f.value ?? 0)}/100`;
    case "bigonialWidth":
      return `${n2(f.value ?? 0)}× IPD`;
    case "jawAngularity":
      return f.descriptor === "angular" ? "winklige Kieferprojektion" : f.descriptor === "moderate" ? "mäßig winklig" : "runde Kieferprojektion";
    case "scoreValue":
      return `${p.kind === "harmony" ? "Harmonie-Index" : p.kind === "symmetry" ? "Symmetrie-Score" : "Proportions-Score"} ${n0(f.value ?? 0)}/100`;
    case "featureHarmony":
      return `${f.descriptor === "consistent" ? "konsistent" : f.descriptor === "varied" ? "mäßig unterschiedlich" : "uneinheitlich"} über die Kategorien (Streuung ±${n0(f.value ?? 0)})`;
    case "proportionalConsistency":
      return `${p.inT1} von ${p.evaluable} auswertbaren Verhältnissen innerhalb T1`;
    case "visualProperty":
      return "Visuelle Eigenschaft; wird nicht aus der Geometrie abgeleitet.";
    case "requires3D":
      return "Erfordert visuelle/3D-Beurteilung; wird nicht aus 2D-Landmarks abgeleitet.";
    case "requiresProfile":
      return "Erfordert ein Profilfoto; frontal nicht messbar.";
    case "landmarksUnavailable":
      return "Landmarks nicht verfügbar.";
    case "notEnoughCoverage":
      return "Nicht genügend Kategorieabdeckung.";
    case "notAssessed":
      return "Nicht bewertet – außerhalb des Umfangs der geometrischen Analyse.";
  }
}

// ---------------------------------------------------------------- symmetry
const SYM_LABEL_DE: Record<string, string> = {
  eyeHeight: "Augenöffnung (R vs L)", pfl: "Lidspaltenlänge (R vs L)", canthalTilt: "Canthal Tilt (R vs L)", canthusHeight: "Höhe medialer Augenwinkel", browHeight: "Höhe Brauenscheitel", browTilt: "Brauen-Tilt (R vs L)",
  mouthCornerHeight: "Höhe Mundwinkel", mouthCornerWidth: "Mundwinkelabstand zur Mittellinie", noseTip: "Abweichung Nasenspitze von der Mittellinie", alar: "Flügelbasis-Abstand zur Mittellinie", chin: "Kinnabweichung von der Mittellinie", gonionWidth: "Gonion-Abstand zur Mittellinie", gonionHeight: "Gonion-Höhe", zygion: "Wangenbreite zur Mittellinie",
};

export function symmetryMetricLabelById(id: string, lang: Lang, fallback: string): string {
  return lang === "de" ? (SYM_LABEL_DE[id] ?? fallback) : fallback;
}

export function symmetryMetricLabel(m: SymmetryMetric, lang: Lang): string {
  return symmetryMetricLabelById(m.id, lang, m.label);
}

export function symmetryNote(s: SymmetryResult, lang: Lang): string {
  if (lang !== "de" || !s.noteCode) return s.note;
  return s.noteCode === "pupilsMissing" ? "Pupillen nicht verfügbar." : s.noteCode === "yawInflates" ? "Die Kopfdrehung vergrößert die scheinbare Asymmetrie; Symmetrie-Konfidenz reduziert." : "Beidseitiger Landmark-Vergleich nach Roll-Normalisierung, relativ zu einer angepassten Gesichtsmittellinie.";
}

// ---------------------------------------------------------------- warnings
export function warningTexts(r: AnalysisResult, lang: Lang): string[] {
  if (lang !== "de" || !r.warningCodes) return r.warnings;
  return r.warningCodes.map((w) => {
    const p = w.params ?? {};
    switch (w.code) {
      case "unusable":
        return "Die Bildqualität ist unbrauchbar; Ergebnisse werden nur zur Transparenz gezeigt und dürfen nicht zum Vergleich verwendet werden.";
      case "lowCoverage":
        return `Nur ${p.evaluable} von ${p.total} Verhältnissen sind auswertbar; die Scores sind coverage-adjustiert und weniger vergleichbar.`;
      case "uncertainRatios":
        return `${p.n} auswertbare Verhältnis(se) haben geringe Konfidenz.`;
      case "noHairline":
        return "Haaransatz nicht verfügbar: Drittel, TFWHR, LFF und FWHF werden nicht ausgewertet.";
      case "corrected":
        return `Manuell korrigiert: ${p.n} Landmark(s)${p.axis ? `, Referenzachse ${p.axis > 0 ? "+" : ""}${Number(p.axis).toFixed(1).replace(".", ",")}°` : ""}. Die Ergebnisse hängen von der manuellen Platzierung ab.`;
      case "smile":
        return "Lächeln erkannt: Mund-, Lippen-, Augenöffnungs- und Untergesichtsmessungen haben reduzierte Konfidenz.";
    }
  });
}

// ---------------------------------------------------------------- additional measurements
export function additionalNote(m: AdditionalMeasurementResult, lang: Lang): string {
  if (lang !== "de" || !m.noteCode) return m.note;
  const v = m.values ?? {};
  switch (m.noteCode) {
    case "requiresProfile":
      return "Benötigt ein seitliches Profilfoto; aus einem Frontalbild nicht messbar.";
    case "requiresProfileSeeGS":
      return "Der echte Gonialwinkel benötigt eine Seitenansicht. Die Frontalprojektion wird als GS ausgewiesen und ist nicht mit dem Referenzwert 115–130° vergleichbar.";
    case "fingerRule":
      return `Die Stirnhöhe beträgt das ${n2(v.foreheadOverMiddleThird ?? 0)}-Fache des mittleren Drittels und das ${n2(v.foreheadOverIpd ?? 0)}-Fache der IPD. Die „Drei-Finger-Regel“ ist eine nicht-metrische Faustregel und wird nicht bewertet.`;
    case "fifths":
      return `Fünftel (links→rechts): ${[v.outer1, v.eye1, v.intercanthal, v.eye2, v.outer2].map((x) => `${n1(x ?? 0)} %`).join(" · ")}. Mittlere Abweichung von 20 % = ${n1(v.meanDeviation ?? 0)} Prozentpunkte. In Rubrik 2.0 bewertet (Gesichtsfünftel), nicht Teil der 42 Verhältnisse.`;
    case "byzBig":
      return `Rohwert bizygomatisch ÷ bigonial = ${n2(v.ratio ?? m.value ?? 0)} (älteres Atlas-Ziel 1,35). Widerspricht BIG ${Number.isFinite(v.big) ? `${n1(v.big)} %` : ""} (85–92 % ⇒ 1,09–1,18); nur zur Referenz, nicht bewertet.`;
    case "noEarLandmarks":
      return "Keine Ohr-Landmarks im Gesichtsmodell und kein definierter Zielbereich.";
    case "noseChin":
      return `Nasenspitze → Menton = ${n2(v.noseTipToMentonOverIpd ?? 0)}× IPD (${n2(v.noseTipToMentonOverLowerThird ?? 0)}× unteres Drittel). Nur Rohwert – keine Formel und kein Ziel definiert.`;
    case "eyeMouthLength":
      return `Pupillenlinie → Mund = ${n1((v.ratio ?? m.value ?? 0) * 100)} % von Haaransatz → Kinn (bevorzugt 0,36–0,37 bei Pallett et al. 2010, Gesichter weißer Frauen).`;
    case "hairlineMissing":
      return "Haaransatz nicht verfügbar.";
    case "landmarksMissing":
      return "Erforderliche Landmarks fehlen.";
  }
}

// ---------------------------------------------------------------- battle
export function battleRoundLabel(r: BattleRound, lang: Lang): string {
  return roundLabel(r.id, lang);
}

export function verdictReason(b: BattleResult, lang: Lang): string {
  if (lang !== "de" || !b.verdictCode) return b.verdictReason;
  const p = b.verdictParams ?? {};
  switch (b.verdictCode) {
    case "qualityFailed":
      return "Mindestens ein Bild hat die Qualitätsprüfung nicht bestanden; kein Urteil möglich.";
    case "engineMismatch":
      return "Die Analysen stammen aus verschiedenen Engine-Generationen, deren Scores nicht vergleichbar sind; das ältere Foto bitte neu analysieren.";
    case "noOverall":
      return "Für mindestens eine Person konnte kein Gesamtscore berechnet werden.";
    case "lowCoverage":
      return `Die Scoring-Abdeckung ist zu gering (${p.covA} % vs ${p.covB} %; mindestens ${p.min} % erforderlich).`;
    case "lowConfidence":
      return "Die Messkonfidenz ist für ein eindeutiges Ergebnis zu gering (Bildqualität, Kopfhaltung oder Ausdruck).";
    case "draw":
      return `Die Gesamtdifferenz (${n1(p.diff ?? 0)} Punkte) liegt innerhalb der Messunsicherheit (±${n1(p.margin ?? 0)}).`;
    case "winner":
      return `Die Gesamtdifferenz von ${n1(p.diff ?? 0)} Punkten überschreitet die Unsicherheitsmarge von ±${n1(p.margin ?? 0)}.`;
  }
}

export function battleSummary(b: BattleResult, labels: { a: string; b: string }, lang: Lang): string {
  if (lang !== "de") return b.summary;
  const parts: string[] = [];
  const oa = b.overallA ?? 0;
  const ob = b.overallB ?? 0;
  if (b.verdict === "A") parts.push(`${labels.a} gewinnt die Battle ${n1(oa)} : ${n1(ob)}.`);
  else if (b.verdict === "B") parts.push(`${labels.b} gewinnt die Battle ${n1(ob)} : ${n1(oa)}.`);
  else if (b.verdict === "draw") parts.push(`Unentschieden – ${n1(oa)} : ${n1(ob)} liegt innerhalb der Unsicherheitsmarge.`);
  else parts.push("Kein eindeutiges Ergebnis.");
  parts.push(`Runden: ${b.roundWinsA} – ${b.roundWinsB} (${b.roundDraws} unentschieden).`);
  if (b.keyDifferences.length) {
    parts.push(
      "Entscheidende Verhältnisse: " +
        b.keyDifferences
          .slice(0, 3)
          .map((k) => `${RATIO_BY_ID[k.ratioId].abbreviation} spricht für ${k.favours === "A" ? labels.a : labels.b} (${k.delta > 0 ? "+" : ""}${n0(k.delta)})`)
          .join("; ") +
        ".",
    );
  }
  return parts.join(" ");
}

export function landmarkDisplayLabel(l: SemanticLandmark, lang: Lang): string {
  return landmarkLabel(l.id, lang, l.label);
}
