/** German names/definitions for the rubric criteria, areas and tournament categories (English comes from the engine). */
import { AREA_META, CRITERION_BY_ID, type CriterionId, type RubricArea } from "@/engine/psl/rubric";
import type { ScaleIssue } from "@/engine/psl/scale";
import { DEFAULT_CATEGORIES } from "@/engine/tournament/categories";
import type { Lang } from "./index";

export const CRITERION_TEXTS_DE: Record<CriterionId, { name: string; definition: string }> = {
  canthalTilt: { name: "Kanthale Neigung", definition: "Neigung der Augenachse (äußerer relativ zum inneren Augenwinkel)." },
  eyeSpacing: { name: "Augenabstand", definition: "Pupillen-, äußerer und innerer Augenwinkelabstand relativ zu Gesicht und Lidspalte." },
  fissureProportions: { name: "Lidspalten-Proportionen", definition: "Augen-Seitenverhältnis und Lidspaltenlänge relativ zur Gesichtsbreite." },
  browArea: { name: "Brauenposition & -form", definition: "Brauenneigung, ihre Übereinstimmung mit der kanthalen Neigung und die Brauenlänge." },
  upperLidExposure: { name: "Oberlid-Exposition", definition: "Sichtbares Oberlid zwischen Wimpernkranz und Braue." },
  scleralShow: { name: "Sklera-Show", definition: "Sichtbare Sklera unterhalb der Iris bei entspanntem Blick." },
  eyeShape: { name: "Augenform", definition: "Gesamtform der Lidspalte (mandelförmig, rund, hängend …) als visueller Eindruck." },
  midfaceRatio: { name: "Mittelgesichts-Verhältnis", definition: "Mittelgesichtshöhe relativ zum Pupillenabstand." },
  facialThirds: { name: "Gesichtsdrittel", definition: "Oberes, mittleres und unteres Drittel gegenüber ihren Referenzbereichen." },
  fwhr: { name: "Breiten-Höhen-Verhältnis (FWHR)", definition: "Bizygomatische Breite über Brauen-Oberlippen-Höhe." },
  faceShape: { name: "Gesichtsform-Proportionen", definition: "Gesamthöhe zu Breite, Untergesichtsanteil und Stirnproportion." },
  cheekbonePosition: { name: "Wangenknochen-Position", definition: "Höhe des breitesten Gesichtspunkts relativ zum Mittelgesicht." },
  eyeMouthGeometry: { name: "Augen-Mund-Geometrie", definition: "Winkel des Augen-Mund-Augen-Dreiecks." },
  lowerThirdProportions: { name: "Untergesichts-Proportionen", definition: "Anteil des unteren Drittels und Kinn-zu-Philtrum-Verhältnis." },
  facialFifths: { name: "Gesichtsfünftel", definition: "Abweichung der fünf horizontalen Fünftel von gleicher Breite (neoklassischer Kanon)." },
  jawWidth: { name: "Kieferbreite", definition: "Bigoniale und bitemporale Breite relativ zur bizygomatischen Breite und ihre Übereinstimmung." },
  jawHeightRatio: { name: "Kiefer-Breiten-Höhen-Verhältnis", definition: "Bigoniale Breite über Untergesichtshöhe." },
  jawAngularityFrontal: { name: "Kieferwinkligkeit (frontal)", definition: "Frontale Projektion des Kieferwinkels." },
  gonialAngle: { name: "Kieferwinkel (Profil)", definition: "Weichteil-Kieferwinkel zwischen Ast und Kieferkörper." },
  chinProjection: { name: "Kinnprojektion (Profil)", definition: "Kinnposition relativ zu Lippen und Gesichtslinie (Z-Winkel, H-Winkel)." },
  neckChinDefinition: { name: "Hals-Kinn-Definition", definition: "Zervikomentaler und mentozervikaler Winkel; frontal die Halsbreite bei gesetzten Halspunkten." },
  chinWidthShape: { name: "Kinnbreite", definition: "Mundbreite relativ zur Kinnbreite." },
  cheekboneProjection: { name: "Wangenknochen-Projektion", definition: "Sichtbare Prominenz der Jochbeine (3D-Projektion)." },
  jawlineDefinition: { name: "Kieferlinien-Definition", definition: "Sichtbare Schärfe der Unterkieferkante." },
  noseWidth: { name: "Nasenbreite", definition: "Flügelbreite relativ zu Gesicht und innerem Augenwinkelabstand." },
  noseHeightWidth: { name: "Nasenhöhe zu -breite", definition: "Nasenhöhe über Flügelbreite." },
  noseProjection: { name: "Nasenprojektion (Profil)", definition: "Goode-Verhältnis von Spitzenprojektion zu Nasenlänge." },
  nasalAngles: { name: "Nasenwinkel (Profil)", definition: "Nasofrontaler, nasofazialer und nasomentaler Winkel." },
  mouthWidth: { name: "Mundbreite", definition: "Mundbreite relativ zu IPD, Nase und Kiefer." },
  lipProportions: { name: "Lippenproportionen", definition: "Unter- zu Oberlippenhöhe und Lippen-Breiten-Höhen-Verhältnis." },
  nasolabialAngle: { name: "Nasolabialer Winkel (Profil)", definition: "Winkel zwischen Nasensteg und Oberlippe." },
  lipChinVertical: { name: "Lippen-Kinn-Höhe (Profil)", definition: "Vertikales Lippen-Kinn-Verhältnis (Sn–Stm : Stm–Me)." },
  lipShape: { name: "Lippenform", definition: "Form und Fülle des Lippenrots als visueller Eindruck." },
  eyeSymmetry: { name: "Augen- & Brauensymmetrie", definition: "Links-rechts-Übereinstimmung von Augenöffnung, Lidspaltenlänge, kanthaler Neigung, Augenwinkelhöhe, Brauenhöhe und -neigung." },
  noseSymmetry: { name: "Nasensymmetrie", definition: "Nasenspitze und Flügelbasis relativ zur Mittellinie." },
  mouthSymmetry: { name: "Mundsymmetrie", definition: "Mundwinkelhöhen und Abstände zur Mittellinie." },
  jawChinSymmetry: { name: "Kiefer- & Kinnsymmetrie", definition: "Übereinstimmung von Gonion-Breite/-Höhe, Wangenbreite und Kinnabweichung." },
  areaBalance: { name: "Balance der Bereiche", definition: "Wie gleichmäßig Augen-, Mittelgesichts-, Knochen-, Nasen-, Mund- und Symmetriebereich abschneiden (geringe Streuung = harmonisch)." },
  verticalBalance: { name: "Vertikale Balance", definition: "Gleichheit der drei Gesichtsdrittel (größte Abweichung von einem Drittel)." },
  profileConvexity: { name: "Profilkonvexität", definition: "Gesichtskonvexitätswinkel G–Sn–Pg." },
  lowerFaceHarmony: { name: "Untergesichts-Harmonie (Profil)", definition: "Anteil der Untergesichtshöhe (Sn–Me / G–Me)." },
};

export const AREA_TEXTS_DE: Record<RubricArea, { name: string; description: string }> = {
  eye: { name: "Augenpartie", description: "Kanthale Neigung, Abstand, Lidspalten-Proportionen, Brauen; Lid-Exposition und Sklera-Show nur mit visueller Bewertung." },
  midface: { name: "Mittelgesicht & Proportionen", description: "Mittelgesichts-Verhältnis, Drittel, FWHR, Gesichtsform, Wangenknochen-Position, Augen-Mund-Geometrie, Untergesicht, Fünftel." },
  bone: { name: "Knochenstruktur", description: "Kieferbreiten und -winkel, Kieferwinkel und Kinnprojektion (Profil), Halsdefinition, Kinn; visuelle Definition nur mit visueller Bewertung." },
  nose: { name: "Nase", description: "Breite und Höhe frontal, Projektion und Winkel aus dem Profil." },
  mouth: { name: "Lippen & Mund", description: "Mundbreite, Lippenproportionen, nasolabialer Winkel und Lippen-Kinn-Höhe aus dem Profil." },
  symmetry: { name: "Symmetrie", description: "Links-rechts-Übereinstimmung von Augen/Brauen, Nase, Mund und Kiefer/Kinn im roll-normalisierten Rahmen." },
  harmony: { name: "Gesichtsharmonie", description: "Balance über die Bereiche, vertikale Balance der Drittel, Profilkonvexität und Untergesichts-Harmonie." },
};

export const CATEGORY_NAMES_DE: Record<string, string> = {
  overallFace: "Bestes Gesamtgesicht", jawline: "Beste Kieferlinie", cheekbones: "Beste Wangenknochen", eyeArea: "Beste Augenpartie", harmony: "Beste Gesichtsharmonie", symmetry: "Beste Symmetrie",
  proportions: "Beste Gesichtsproportionen", midface: "Bestes Mittelgesicht", chin: "Bestes Kinn", profile: "Bestes Profil", noseHarmony: "Beste Nasenharmonie", boneStructure: "Beste Knochenstruktur",
};

export function criterionName(id: CriterionId, lang: Lang): string {
  return lang === "de" ? CRITERION_TEXTS_DE[id]?.name ?? CRITERION_BY_ID[id].name : CRITERION_BY_ID[id].name;
}
export function criterionDefinition(id: CriterionId, lang: Lang): string {
  return lang === "de" ? CRITERION_TEXTS_DE[id]?.definition ?? CRITERION_BY_ID[id].definition : CRITERION_BY_ID[id].definition;
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
