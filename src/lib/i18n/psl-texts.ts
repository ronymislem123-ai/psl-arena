/** German names/definitions for the rubric criteria, areas and tournament categories (English comes from the engine). */
import { AREA_META, CRITERION_BY_ID, type CriterionId, type RubricArea } from "@/engine/psl/rubric";
import type { ScaleIssue } from "@/engine/psl/scale";
import { DEFAULT_CATEGORIES } from "@/engine/tournament/categories";
import type { Lang } from "./index";
import { ADDITIONAL_BY_ID, RATIO_BY_ID } from "@/engine/ratios/database";
import { SIDE_BY_ID, type SideMeasurementId } from "@/engine/side-view";
import type { AdditionalMeasurementId, RatioId } from "@/engine/types";
import { additionalText, ratioText } from "./ratio-texts";
import { sideMeasurementText } from "./side-texts";
import { symmetryMetricLabelById } from "./engine-text";
import { CRITERION_DETAILS_DE } from "./criterion-details-de";

export const CRITERION_TEXTS_DE: Record<CriterionId, { name: string; definition: string }> = {
  canthalTilt: { name: "Kanthale Neigung", definition: "Neigung der Augenachse (äußerer relativ zum inneren Augenwinkel)." },
  eyeSpacing: { name: "Augenabstand", definition: "Pupillen-, äußerer und innerer Augenwinkelabstand relativ zu Gesicht und Lidspalte." },
  fissureProportions: { name: "Lidspalten-Proportionen", definition: "Augen-Seitenverhältnis und Lidspaltenlänge relativ zur Gesichtsbreite." },
  browArea: { name: "Brauenlänge", definition: "Brauenlänge relativ zum Pupillenabstand. Brauenneigung und ihre Übereinstimmung mit der kanthalen Neigung werden angezeigt, aber nicht bewertet (die Winkelkonvention passt nicht zur Referenz)." },
  upperLidExposure: { name: "Oberlidposition (MRD1)", definition: "Margin-Reflex-Distanz 1: Abstand vom Iriszentrum zum Oberlidrand in Millimetern (Irisdurchmesser = 11,7 mm). Normal 4–5 mm; kleinere Werte = tief stehendes (hängendes) Lid, größere = zurückgezogenes Lid mit Sklera über der Iris. Die sichtbare Lidhaut bis zur Lidfalte ist kein Netzpunkt und wird nicht gemessen." },
  scleralShow: { name: "Sklera-Show", definition: "Sichtbare Sklera zwischen unterem Irisrand und Unterlidrand in Millimetern (Irisdurchmesser = 11,7 mm). Das Unterlid liegt normalerweise am unteren Limbus (keine Sklera sichtbar); mehr als 1 mm gilt als Unterlidretraktion." },
  eyeShape: { name: "Augenform", definition: "Gesamtform der Lidspalte (mandelförmig, rund, hängend …) als visueller Eindruck." },
  midfaceRatio: { name: "Mittelgesichts-Verhältnis", definition: "Mittelgesichtshöhe relativ zum Pupillenabstand." },
  facialThirds: { name: "Mittleres & unteres Drittel", definition: "Mittleres und unteres Drittel der Gesichtshöhe gegenüber ihren Referenzbereichen (das obere Drittel gehört zur Kategorie Stirn)." },
  fwhr: { name: "Breiten-Höhen-Verhältnis (FWHR)", definition: "Bizygomatische Breite über Brauen-Oberlippen-Höhe (Rubrik 1.0; seit 2.0 nur beschreibend, nicht bewertet)." },
  faceShape: { name: "Gesichtsform-Proportionen", definition: "Gesamthöhe zu Breite, Untergesichtsanteil und Übereinstimmung von Stirn- und Kieferbreite." },
  cheekbonePosition: { name: "Wangenknochen-Position", definition: "Höhe des breitesten Gesichtspunkts relativ zum Mittelgesicht." },
  eyeMouthGeometry: { name: "Augen-Mund-Geometrie", definition: "Winkel des Augen-Mund-Augen-Dreiecks." },
  eyeMouthLength: { name: "Augen–Mund-Längenverhältnis", definition: "Vertikaler Abstand Pupillenlinie → Mund über Haaransatz → Kinn (Pallett et al. 2010: bevorzugt 0,36–0,37)." },
  lowerThirdProportions: { name: "Untergesichts-Proportionen", definition: "Anteil der Oberlippe am unteren Drittel (Subnasale → Stomion über Subnasale → Menton)." },
  facialFifths: { name: "Gesichtsfünftel", definition: "Abweichung der fünf horizontalen Fünftel von gleicher Breite (neoklassischer Kanon)." },
  jawWidth: { name: "Kieferbreite", definition: "Bigoniale Breite relativ zur bizygomatischen Breite." },
  jawHeightRatio: { name: "Kiefer-Breiten-Höhen-Verhältnis", definition: "Bigoniale Breite über Untergesichtshöhe (Rubrik 1.0; in 2.0 entfernt, weil die rekonstruierte Konstruktion den Referenzbereich nicht reproduziert)." },
  jawAngularityFrontal: { name: "Kieferwinkligkeit (frontal)", definition: "Frontale Projektion des Kieferwinkels (Rubrik 2.0–2.1; seit 2.2 nur angezeigt, nicht bewertet, weil alle Testgesichter über dem Referenzbereich liegen – die Netz-Konvention weicht von der Quelle ab)." },
  gonialAngle: { name: "Kieferwinkel (Profil)", definition: "Weichteil-Kieferwinkel zwischen Ast und Kieferkörper." },
  mandibularPlane: { name: "Unterkieferebene (Profil)", definition: "Neigung der Weichteil-Kieferlinie (Gonion → Menton) gegenüber der Referenzhorizontalen." },
  midfaceProjection: { name: "Mittelgesichtsprojektion (Profil)", definition: "Vorlage des Subnasale gegenüber der Glabella-Vertikalen." },
  chinProjection: { name: "Kinnprojektion (Profil)", definition: "Kinnposition relativ zu Lippen, Gesichtslinie und Glabella-Vertikaler (Z-Winkel, H-Winkel, Pg zur Glabella-Vertikalen)." },
  neckChinDefinition: { name: "Hals-Kinn-Definition", definition: "Zervikomentaler und mentozervikaler Winkel; frontal die Halsbreite bei gesetzten Halspunkten." },
  chinWidthShape: { name: "Kinnbreite", definition: "Mundbreite relativ zur Kinnbreite." },
  cheekboneProjection: { name: "Wangenknochen-Projektion", definition: "Sichtbare Prominenz der Jochbeine (3D-Projektion)." },
  jawlineDefinition: { name: "Kieferlinien-Definition", definition: "Sichtbare Schärfe der Unterkieferkante." },
  noseWidth: { name: "Nasenbreite", definition: "Flügelbreite relativ zur bizygomatischen Breite (der Vergleich mit dem inneren Augenwinkelabstand wird angezeigt, aber nicht bewertet)." },
  noseHeightWidth: { name: "Nasenhöhe zu -breite", definition: "Nasenhöhe über Flügelbreite." },
  noseProjection: { name: "Nasenprojektion (Profil)", definition: "Goode-Verhältnis von Spitzenprojektion zu Nasenlänge." },
  nasalAngles: { name: "Nasenwinkel (Profil)", definition: "Nasofrontaler, nasofazialer und nasomentaler Winkel." },
  mouthWidth: { name: "Mundbreite", definition: "Mundbreite relativ zu IPD, Nase und Kiefer." },
  lipProportions: { name: "Lippenproportionen", definition: "Unter- zu Oberlippenhöhe und Lippen-Breiten-Höhen-Verhältnis." },
  nasolabialAngle: { name: "Nasolabialer Winkel (Profil)", definition: "Winkel zwischen Nasensteg und Oberlippe." },
  lipChinVertical: { name: "Lippen-Kinn-Höhe", definition: "Unterlippen- und Kinnhöhe relativ zum Philtrum (frontales Kinn-Philtrum-Verhältnis)." },
  neckWidth: { name: "Halsbreite (frontal)", definition: "Halsbreite relativ zur Gesichtsbreite aus manuell gesetzten Halspunkten." },
  lipShape: { name: "Lippenform", definition: "Form und Fülle des Lippenrots als visueller Eindruck." },
  eyeSymmetry: { name: "Augen- & Brauensymmetrie", definition: "Links-rechts-Übereinstimmung von Augenöffnung, Lidspaltenlänge, kanthaler Neigung, Augenwinkelhöhe, Brauenhöhe und -neigung." },
  noseSymmetry: { name: "Nasensymmetrie", definition: "Nasenspitze und Flügelbasis relativ zur Mittellinie." },
  mouthSymmetry: { name: "Mundsymmetrie", definition: "Mundwinkelhöhen und Abstände zur Mittellinie." },
  jawChinSymmetry: { name: "Kiefer- & Kinnsymmetrie", definition: "Übereinstimmung von Gonion-Breite/-Höhe, Wangenbreite und Kinnabweichung." },
  areaBalance: { name: "Balance der Bereiche", definition: "Streuung der Bereichswerte (Rubrik 1.0; entfernt, weil gleichmäßig schwache Gesichter belohnt wurden)." },
  verticalBalance: { name: "Vertikale Balance", definition: "Gleichheit der drei Drittel (Rubrik 1.0; entfernt, weil die Drittel doppelt bewertet wurden)." },
  profileConvexity: { name: "Profilkonvexität", definition: "Gesichtskonvexitätswinkel G–Sn–Pg." },
  lowerFaceHarmony: { name: "Untergesichtshöhe (Profil)", definition: "Anteil der Untergesichtshöhe (Sn–Me / G–Me) im anatomischen Bezugssystem." },
  foreheadHeight: { name: "Stirnhöhe", definition: "Oberes Drittel der Gesichtshöhe und Stirnhöhe relativ zur Gesichtsbreite." },
  foreheadWidth: { name: "Stirnbreite", definition: "Bitemporale Breite relativ zur bizygomatischen Breite." },
};

export const AREA_TEXTS_DE: Record<RubricArea, { name: string; description: string }> = {
  eye: { name: "Augenpartie", description: "Kanthale Neigung, Augenabstand, Lidspalten-Proportionen, Brauenlänge, Oberlidposition (MRD1) und Sklera-Show; die Augenform nur mit visuellem Modell oder Selbsteinschätzung." },
  harmonySymmetry: { name: "Gesichtsharmonie & Symmetrie", description: "Vertikale und horizontale Proportionen (Drittel, Stirnhöhe, Gesichtsform, Fünftel, Augen–Mund-Länge) und Links-rechts-Symmetrie von Augen/Brauen, Nase, Mund und Kiefer/Kinn." },
  midfaceFront: { name: "Mittelgesicht", description: "Mittelgesichtshöhe relativ zum Pupillenabstand und Augen-Mund-Augen-Winkel (Kompaktheit des Mittelgesichts)." },
  nose: { name: "Nase", description: "Nasenflügelbreite relativ zum Gesicht und Nasenhöhe zu -breite, aus der Frontalansicht." },
  lowerThird: { name: "Unteres Drittel & Kinnform", description: "Oberlippenanteil am unteren Drittel, Kinn-Philtrum-Höhe, Kinnbreite, Mundbreite und Lippenproportionen; die Lippenform nur mit visuellem Modell oder Selbsteinschätzung." },
  jawline: { name: "Kieferlinie & frontale Unterkieferdefinition", description: "Frontale Kieferbreite relativ zu den Wangenknochen und Halsbreite (manuelle Halspunkte); die Kieferlinien-Definition nur mit visuellem Modell oder Selbsteinschätzung." },
  cheekbonesWidth: { name: "Wangenknochen & Gesichtsbreite", description: "Höhe der breitesten Gesichtsstelle und Stirn- zu Wangenknochenbreite; die Wangenknochen-Projektion nur als visueller Eindruck (keine 3D-Tiefe aus einem Frontalfoto)." },
  proportions: { name: "Gesichtsproportionen (Rubrik 2.x)", description: "Bereich der Rubrik 2.x (Front + Profil)." },
  bone: { name: "Knochenstruktur (Rubrik 2.x)", description: "Bereich der Rubrik 2.x (Front + Profil)." },
  mouth: { name: "Lippen & Mund (Rubrik 2.x)", description: "Bereich der Rubrik 2.x (Front + Profil)." },
  symmetry: { name: "Symmetrie (Rubrik 2.x)", description: "Bereich der Rubrik 2.x." },
  forehead: { name: "Stirn & Haaransatz (Rubrik 2.x)", description: "Bereich der Rubrik 2.x." },
  midface: { name: "Mittelgesicht & Proportionen", description: "Bereich der Rubrik 1.0 (jetzt aufgeteilt in Proportionen, Knochenstruktur und Stirn)." },
  harmony: { name: "Gesichtsharmonie", description: "Bereich der Rubrik 1.0 (ersetzt durch den Balance-Term der Aggregation)." },
};

/** German reasons for the measures that are shown but not scored (rubric 2.0). */
export const DESCRIPTIVE_REASONS_DE: Record<string, string> = {
  FWHR: "Nicht bewertet, weil die Studienlage der Referenz widerspricht: Ein höheres Breiten-Höhen-Verhältnis wird im Mittel als weniger attraktiv eingeschätzt (Geniole et al. 2015). Es hängt außerdem vom Körpergewicht und vom Kameraabstand ab.",
  JWHR: "Nicht bewertet: Mit dieser Messweise liegen alle geprüften Gesichter über dem Referenzbereich – die Quelle hat offenbar anders gemessen, ein Vergleich wäre unfair.",
  ET: "Nicht bewertet: Mit dieser Messweise (Linie Brauenkopf → Brauenende) liegen alle geprüften Gesichter unter dem Referenzbereich – die Quelle hat den Winkel offenbar anders definiert.",
  DEV_CT_ET: "Nicht bewertet: Differenz aus kanthaler Neigung und Brauenneigung; übernimmt die abweichende Brauen-Messweise.",
  ICD_N: "Nicht bewertet: Alle geprüften Gesichter liegen unter dem Referenzbereich, und das Verhältnis unterscheidet sich systematisch zwischen Bevölkerungsgruppen (Farkas et al. 2005) – ein einzelner enger Bereich wäre keine faire Referenz.",
  GS: "Nicht bewertet: Das Gesichtsnetz rundet die Kieferecke ab, deshalb liegt der frontale Kieferwinkel bei allen geprüften Gesichtern über dem Referenzbereich (meist 145–160°).",
};

export function descriptiveReason(id: string, fallback: string, lang: Lang): string {
  return lang === "de" ? DESCRIPTIVE_REASONS_DE[id] ?? fallback : fallback;
}

export const CATEGORY_NAMES_DE: Record<string, string> = {
  overallFace: "Bestes Gesamtgesicht", jawline: "Beste Kieferlinie", cheekbones: "Beste Wangenknochen", eyeArea: "Beste Augenpartie", harmony: "Beste Gesichtsharmonie", symmetry: "Beste Symmetrie",
  proportions: "Beste Gesichtsproportionen", midface: "Bestes Mittelgesicht", chin: "Bestes Kinn", lowerThird: "Bestes unteres Drittel", profile: "Bestes Profil", noseHarmony: "Beste Nasenharmonie", boneStructure: "Beste Knochenstruktur",
};

export function criterionName(id: CriterionId, lang: Lang): string {
  return lang === "de" ? CRITERION_TEXTS_DE[id]?.name ?? CRITERION_BY_ID[id].name : CRITERION_BY_ID[id].name;
}
export function criterionDefinition(id: CriterionId, lang: Lang): string {
  return lang === "de" ? CRITERION_TEXTS_DE[id]?.definition ?? CRITERION_BY_ID[id].definition : CRITERION_BY_ID[id].definition;
}
export function criterionRequirements(id: CriterionId, lang: Lang): string {
  return lang === "de" ? CRITERION_DETAILS_DE[id]?.requirements ?? CRITERION_BY_ID[id].requirements : CRITERION_BY_ID[id].requirements;
}
export function criterionLimitations(id: CriterionId, lang: Lang): string[] {
  return lang === "de" ? CRITERION_DETAILS_DE[id]?.limitations ?? CRITERION_BY_ID[id].limitations : CRITERION_BY_ID[id].limitations;
}
export function areaName(id: RubricArea, lang: Lang): string {
  return lang === "de" ? AREA_TEXTS_DE[id].name : AREA_META[id].name;
}
export function areaDescription(id: RubricArea, lang: Lang): string {
  return lang === "de" ? AREA_TEXTS_DE[id].description : AREA_META[id].description;
}
export function categoryName(id: string, fallback: string, lang: Lang): string {
  const builtIn = DEFAULT_CATEGORIES.find((c) => c.id === id);
  if (!builtIn) return fallback;
  return lang === "de" ? CATEGORY_NAMES_DE[id] ?? fallback : builtIn.name;
}
export function scaleIssueText(issue: ScaleIssue, t: (k: string, v?: Record<string, string | number>) => string): string {
  return t(`scales.issue.${issue.code}`, issue.params ?? {});
}

/**
 * Readable name of a criterion input: used inputs are stored as "CT", "EML",
 * "sym:eyeHeight", "side:FCA", "visual:<provider>" or "self-assessment"; missing ones as
 * hierarchy keys "r:CT", "a:EML", "s:eyeHeight", "p:FCA", "v:eyeShape".
 */
export function criterionInputLabel(key: string, lang: Lang): string {
  const de = lang === "de";
  const [prefix, rest] = key.includes(":") ? [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)] : ["", key];
  if (key === "self-assessment") return de ? "Selbsteinschätzung" : "self-assessment";
  if (prefix === "visual" || prefix === "v") return de ? "visuelles Modell" : "vision model";
  if (prefix === "side" || prefix === "p") {
    const d = SIDE_BY_ID[rest as SideMeasurementId];
    return d ? `${sideMeasurementText(d.id, lang).name} (${de ? "Profil" : "profile"})` : rest;
  }
  if (prefix === "sym" || prefix === "s") return symmetryMetricLabelById(rest, lang, rest);
  const id = rest;
  if (RATIO_BY_ID[id as RatioId]) return `${RATIO_BY_ID[id as RatioId].abbreviation} · ${ratioText(id as RatioId, lang).name}`;
  if (ADDITIONAL_BY_ID[id as AdditionalMeasurementId]) return additionalText(id as AdditionalMeasurementId, lang).name;
  return id;
}
