/**
 * Texts for the side-view (profile) module. English texts for the measurements live
 * in the engine (`src/engine/side-view.ts`); everything else is defined here for
 * both languages so the two stay in one place.
 */
import { SIDE_BY_ID, type SideAssumptionCode, type SideIssueCode, type SideLandmarkId, type SideMeasurementId, type SideSource } from "@/engine/side-view";
import type { Lang } from "./index";

export interface SideLandmarkText {
  name: string;
  /** where to click */
  hint: string;
}

export const SIDE_LANDMARK_TEXTS: Record<Lang, Record<SideLandmarkId, SideLandmarkText>> = {
  en: {
    glabella: { name: "Glabella", hint: "Most prominent point of the forehead between the eyebrows." },
    nasion: { name: "Nasion (soft tissue)", hint: "Deepest point of the nasal bridge between the eyes." },
    rhinion: { name: "Rhinion", hint: "Point on the nasal dorsum where bone meets cartilage — usually the top of a hump; on a straight nose the middle of the dorsum." },
    pronasale: { name: "Pronasale (nasal tip)", hint: "Most anterior point of the nasal tip." },
    subnasale: { name: "Subnasale", hint: "Point where the columella meets the upper lip." },
    alar_crease: { name: "Alar crease", hint: "Deepest point of the groove where the nostril wing meets the cheek." },
    labrale_sup: { name: "Labrale superius", hint: "Most anterior point of the upper lip (vermilion border)." },
    stomion: { name: "Stomion", hint: "Contact point of the closed lips." },
    labrale_inf: { name: "Labrale inferius", hint: "Most anterior point of the lower lip." },
    labiomental: { name: "Labiomental fold", hint: "Deepest point of the groove between the lower lip and the chin." },
    pogonion: { name: "Pogonion (soft tissue)", hint: "Most anterior point of the chin." },
    menton: { name: "Menton (soft tissue)", hint: "Lowest point of the chin." },
    cervical: { name: "Cervical point", hint: "Deepest point between chin and neck — the angle under the chin." },
    neck: { name: "Neck point", hint: "A point on the straight front of the neck, about 2–3 cm below the cervical point." },
    gonion: { name: "Gonion (soft tissue)", hint: "Angle of the jaw: where the jawline turns up towards the ear." },
    tragion: { name: "Tragion", hint: "Notch at the upper edge of the tragus of the ear (entrance of the ear canal)." },
  },
  de: {
    glabella: { name: "Glabella", hint: "Vorderster Punkt der Stirn zwischen den Augenbrauen." },
    nasion: { name: "Nasion (Weichteil)", hint: "Tiefster Punkt des Nasenrückens zwischen den Augen." },
    rhinion: { name: "Rhinion", hint: "Punkt am Nasenrücken, wo Knochen in Knorpel übergeht – meist die Spitze eines Höckers; bei gerader Nase die Mitte des Rückens." },
    pronasale: { name: "Pronasale (Nasenspitze)", hint: "Vorderster Punkt der Nasenspitze." },
    subnasale: { name: "Subnasale", hint: "Punkt, an dem der Nasensteg in die Oberlippe übergeht." },
    alar_crease: { name: "Nasenflügelfurche", hint: "Tiefster Punkt der Furche, wo der Nasenflügel auf die Wange trifft." },
    labrale_sup: { name: "Labrale superius", hint: "Vorderster Punkt der Oberlippe (Lippenrot-Grenze)." },
    stomion: { name: "Stomion", hint: "Berührungspunkt der geschlossenen Lippen." },
    labrale_inf: { name: "Labrale inferius", hint: "Vorderster Punkt der Unterlippe." },
    labiomental: { name: "Lippen-Kinn-Furche", hint: "Tiefster Punkt der Furche zwischen Unterlippe und Kinn." },
    pogonion: { name: "Pogonion (Weichteil)", hint: "Vorderster Punkt des Kinns." },
    menton: { name: "Menton (Weichteil)", hint: "Tiefster Punkt des Kinns." },
    cervical: { name: "Zervikalpunkt", hint: "Tiefster Punkt zwischen Kinn und Hals – der Winkel unter dem Kinn." },
    neck: { name: "Halspunkt", hint: "Ein Punkt auf der geraden Vorderseite des Halses, etwa 2–3 cm unter dem Zervikalpunkt." },
    gonion: { name: "Gonion (Weichteil)", hint: "Kieferwinkel: wo die Kieferlinie zum Ohr hin nach oben abknickt." },
    tragion: { name: "Tragion", hint: "Kerbe am oberen Rand des Tragus (Ohrknorpel vor dem Gehörgang)." },
  },
};

export interface SideMeasurementText {
  name: string;
  description: string;
  methodology: string;
  limitations: string[];
  reference: string;
}

const LIM_MANUAL_DE = "Hängt von der manuellen Punktsetzung ab (typisch ±1–2 px).";
const LIM_VERTICAL_DE = "Nutzt die Bildvertikale als wahre Vertikale; ein geneigter Kopf verschiebt den Wert.";
const LIM_SOFT_DE = "Weichteil-Ersatz für eine kephalometrische (knöcherne) Messung.";

export const SIDE_MEASUREMENT_TEXTS_DE: Record<SideMeasurementId, SideMeasurementText> = {
  GA: {
    name: "Kieferwinkel (Weichteil)", description: "Winkel des Kiefers zwischen aufsteigendem Ast und Kieferkörper.",
    methodology: "Winkel am Gonion zwischen dem Strahl zum Tragion (Richtung des Astes) und dem Strahl zum Menton (Richtung des Körpers).",
    limitations: [LIM_SOFT_DE, "Der Ast wird durch die Linie Gonion–Tragion, der Körper durch Gonion–Menton angenähert; der echte kephalometrische Winkel nutzt knöcherne Tangenten.", LIM_MANUAL_DE],
    reference: "Bereitgestellter Leitfaden: älterer Referenzbereich 115–130°.",
  },
  CMA: {
    name: "Zervikomentaler Winkel", description: "Winkel unter dem Kinn zwischen Submental-Linie und Halsvorderseite.",
    methodology: "Winkel am Zervikalpunkt zwischen dem Strahl zum Menton und dem Strahl zum Halspunkt.",
    limitations: ["Empfindlich gegenüber Kopfbeugung/-streckung und submentalem Fett.", LIM_MANUAL_DE],
    reference: "Ellenbogen & Karlin 1980: ästhetischer zervikomentaler Winkel 105–120°.",
  },
  MCA: {
    name: "Mentozervikaler Winkel", description: "Winkel zwischen Gesichtsebene und Submental-Linie.",
    methodology: "Winkel zwischen der Richtung Glabella → Pogonion und der Richtung Menton → Zervikalpunkt.",
    limitations: ["Hängt vom Kinn und von der Kopfhaltung ab.", LIM_MANUAL_DE],
    reference: "Powell & Humphreys 1984 (ästhetisches Dreieck): mentozervikaler Winkel 80–95°.",
  },
  NFA: {
    name: "Nasofrontaler Winkel", description: "Winkel am Nasion zwischen Stirn und Nasenrücken.",
    methodology: "Winkel am Nasion zwischen dem Strahl zur Glabella und dem Strahl zum Pronasale.",
    limitations: ["Die Glabella ist ein Weichteilpunkt; Brauenwulst und Haaransatz verschieben sie.", LIM_MANUAL_DE],
    reference: "Powell & Humphreys 1984: nasofrontaler Winkel 115–130°.",
  },
  NFC: {
    name: "Nasofazialer Winkel", description: "Neigung des Nasenrückens gegenüber der Gesichtsebene.",
    methodology: "Winkel zwischen der Linie Glabella–Pogonion und der Linie Nasion–Pronasale.",
    limitations: ["Die Kinnposition verändert die Gesichtsebene und damit den Winkel.", LIM_MANUAL_DE],
    reference: "Powell & Humphreys 1984: nasofazialer Winkel 30–40°.",
  },
  NMA: {
    name: "Nasomentaler Winkel", description: "Winkel an der Nasenspitze zwischen Nasenrücken und der Linie zum Kinn.",
    methodology: "Winkel am Pronasale zwischen dem Strahl zum Nasion und dem Strahl zum Pogonion.",
    limitations: ["Kombiniert Nasenprojektion und Kinnprojektion.", LIM_MANUAL_DE],
    reference: "Powell & Humphreys 1984: nasomentaler Winkel 120–132°.",
  },
  NLA: {
    name: "Nasolabialer Winkel", description: "Winkel zwischen Nasensteg und Oberlippe.",
    methodology: "Winkel am Subnasale zwischen dem Strahl zum Pronasale (Stegrichtung) und dem Strahl zum Labrale superius.",
    limitations: ["Der Nasensteg wird durch die Linie Pronasale–Subnasale angenähert.", "Die Lippenhaltung verändert den Wert.", LIM_MANUAL_DE],
    reference: "Powell & Humphreys 1984 / Legan & Burstone 1980: nasolabialer Winkel ≈ 90–110°.",
  },
  MLA: {
    name: "Mentolabialer Winkel", description: "Tiefe der Furche zwischen Unterlippe und Kinn.",
    methodology: "Winkel an der Lippen-Kinn-Furche zwischen dem Strahl zum Labrale inferius und dem Strahl zum Pogonion.",
    limitations: ["Kein einheitlicher Referenzbereich; nicht bewertet.", LIM_MANUAL_DE],
    reference: "Publizierte Werte streuen stark (≈ 110–130°), daher nur beschreibend.",
  },
  FCA: {
    name: "Gesichtskonvexität (G–Sn–Pg)", description: "Gesamtkonvexität des Profils von der Stirn über die Nasenbasis zum Kinn.",
    methodology: "Innenwinkel am Subnasale zwischen dem Strahl zur Glabella und dem Strahl zum Pogonion (180° = gerades Profil).",
    limitations: [LIM_SOFT_DE, LIM_MANUAL_DE],
    reference: "Legan & Burstone 1980: Konvexitätswinkel 12° ± 4° ⇒ Innenwinkel G–Sn–Pg 164–172°.",
  },
  HANG: {
    name: "Holdaway-H-Winkel", description: "Prominenz der Oberlippe relativ zur Weichteil-Gesichtslinie.",
    methodology: "Winkel am Pogonion zwischen dem Strahl zum Nasion und dem Strahl zum Labrale superius (H-Linie).",
    limitations: ["Holdaway bezieht den Idealwert auf den skelettalen ANB-Winkel, den ein Foto nicht liefern kann.", LIM_SOFT_DE, LIM_MANUAL_DE],
    reference: "Holdaway 1983: H-Winkel 7–15°.",
  },
  ZANG: {
    name: "Merrifield-Z-Winkel", description: "Neigung der Profillinie (Kinn zur vorstehendsten Lippe) gegenüber der Horizontalen.",
    methodology: "Winkel zwischen der nach hinten zeigenden Horizontalen und der Linie von der vorstehendsten Lippe zum Pogonion; 90° = senkrecht, kleiner = Kinn hinter den Lippen.",
    limitations: ["Merrifield nutzt die Frankfurter Horizontale; hier wird die Bildhorizontale verwendet.", LIM_VERTICAL_DE, LIM_MANUAL_DE],
    reference: "Merrifield 1966: Z-Winkel 80° ± 9° (Erwachsene).",
  },
  LFH: {
    name: "Untergesichtshöhe (Sn–Me / G–Me)", description: "Anteil des Untergesichts an der Höhe Glabella–Menton.",
    methodology: "Vertikaler Abstand Subnasale–Menton geteilt durch den vertikalen Abstand Glabella–Menton, in Prozent.",
    limitations: [LIM_VERTICAL_DE, LIM_MANUAL_DE],
    reference: "Legan & Burstone 1980: G–Sn : Sn–Me' = 1 : 1 (Punktziel; Toleranz nach App-Regel).",
  },
  LCR: {
    name: "Vertikales Lippen-Kinn-Verhältnis (Stm–Me / Sn–Stm)", description: "Höhe von Unterlippe plus Kinn im Verhältnis zur Oberlippenhöhe.",
    methodology: "Vertikaler Abstand Stomion–Menton geteilt durch den vertikalen Abstand Subnasale–Stomion.",
    limitations: ["Erfordert geschlossene Lippen (Stomion).", LIM_VERTICAL_DE, LIM_MANUAL_DE],
    reference: "Legan & Burstone 1980: Sn–Stm : Stm–Me' = 1 : 2 (Punktziel; Toleranz nach App-Regel).",
  },
  GOODE: {
    name: "Nasenprojektion (Goode)", description: "Wie weit die Nasenspitze im Verhältnis zur Nasenlänge vorsteht.",
    methodology: "Senkrechter Abstand des Pronasale von der Linie Nasion–Nasenflügelfurche, geteilt durch den Abstand Nasion–Pronasale.",
    limitations: ["Die Nasenflügelfurche ist ein Weichteilpunkt, der schwer präzise zu setzen ist.", LIM_MANUAL_DE],
    reference: "Goode-Methode (in Powell & Humphreys 1984): Projektion / Länge 0,55–0,60.",
  },
  DORSUM: {
    name: "Nasenrückenprofil", description: "Abweichung des Nasenrückens von einer geraden Linie.",
    methodology: "Vorzeichenbehafteter senkrechter Abstand des Rhinion von der Linie Nasion–Pronasale in Prozent der Nasenlänge (nach vorn = positiv).",
    limitations: ["Nur beschreibend; nicht bewertet.", LIM_MANUAL_DE],
    reference: "Kein Zielwert: positiv = Höcker, negativ = Sattel, 0 = gerader Rücken.",
  },
  CHIN_MERIDIAN: {
    name: "Kinnposition (Null-Meridian)", description: "Horizontale Lage des Kinns relativ zur Vertikalen durch das Nasion.",
    methodology: "Vorwärtiger Versatz des Pogonion gegenüber der Vertikalen durch das Nasion in Prozent der Höhe Nasion–Menton (positiv = Kinn vorn).",
    limitations: ["Nur beschreibend; nicht bewertet.", LIM_VERTICAL_DE, LIM_MANUAL_DE],
    reference: "Null-Meridian nach Gonzalez-Ulloa: Vertikale durch das Nasion; kein Zahlenziel im Material.",
  },
  MPA: {
    name: "Unterkieferebenen-Winkel (Weichteil)", description: "Neigung des Unterkieferrands gegenüber der Horizontalen; hohe Werte = steiler (langer, zurückliegender) Unterkiefer, niedrige = flacher.",
    methodology: "Winkel zwischen der Linie Weichteil-Gonion → Weichteil-Menton und der Referenzhorizontalen (Frankfurter Horizontale, wenn Tragion und Orbitale gesetzt sind, sonst die Bildhorizontale).",
    limitations: [LIM_SOFT_DE, LIM_VERTICAL_DE, "Die knöcherne Mandibularebene verläuft einige Grad steiler als die Weichteil-Kieferlinie; das Weichteil-Gonion ist rekonstruiert."],
    reference: "Frankfurt-Mandibularebenen-Winkel 25° ± 5° (Tweed 1954); Weichteil-Näherung gegen die Referenzhorizontale.",
  },
  MFP: {
    name: "Mittelgesichtsprojektion (Sn zur Glabella-Vertikalen)", description: "Wie weit die Oberlippenbasis (Subnasale) vor der Stirn liegt, d. h. die Vorlage von Oberkiefer/Mittelgesicht.",
    methodology: "Horizontaler Abstand Subnasale − Glabella in Blickrichtung im Referenzsystem, in Prozent der vertikalen Höhe Glabella–Menton.",
    limitations: [LIM_VERTICAL_DE, "Die Millimeternorm wird mit einer mittleren Gesichtshöhe in Prozent umgerechnet (± 8 %).", LIM_SOFT_DE],
    reference: "Legan & Burstone 1980: Subnasale 6 ± 3 mm vor der Glabella-Vertikalen; umgerechnet mit einer Weichteilhöhe G–Me' von 125 mm (Farkas 1994: Mittelwerte Erwachsener 115–135 mm).",
  },
  CHP: {
    name: "Kinnprojektion (Pg zur Glabella-Vertikalen)", description: "Vorwärtige (positiv) oder rückwärtige (negativ) Lage des Kinns relativ zur Stirn.",
    methodology: "Horizontaler Abstand Pogonion − Glabella in Blickrichtung im Referenzsystem, in Prozent der vertikalen Höhe Glabella–Menton.",
    limitations: [LIM_VERTICAL_DE, "Die Millimeternorm wird mit einer mittleren Gesichtshöhe in Prozent umgerechnet (± 8 %)."],
    reference: "Legan & Burstone 1980: Weichteil-Pogonion 0 ± 4 mm zur Glabella-Vertikalen; umgerechnet mit G–Me' = 125 mm.",
  },
};

export function sideMeasurementText(id: SideMeasurementId, lang: Lang): SideMeasurementText {
  if (lang === "de") return SIDE_MEASUREMENT_TEXTS_DE[id];
  const d = SIDE_BY_ID[id];
  return { name: d.name, description: d.description, methodology: d.methodology, limitations: d.limitations, reference: d.reference };
}

export function sideLandmarkText(id: SideLandmarkId, lang: Lang): SideLandmarkText {
  return SIDE_LANDMARK_TEXTS[lang]?.[id] ?? SIDE_LANDMARK_TEXTS.en[id];
}

export const SIDE_ISSUE_TEXTS: Record<Lang, Record<SideIssueCode, string>> = {
  en: {
    verticalOrder: "The midline points are not in top-to-bottom order (glabella → nasion → nasal tip → subnasale → lips → chin). Check the placement.",
    anteriorOrder: "The nasal tip must be the most anterior point of the nose (ahead of nasion, rhinion and subnasale). Check the facing direction and the placement.",
    neckOrder: "The cervical point must lie below the menton and the neck point below the cervical point.",
    tragionLevel: "The tragion usually lies between brow and upper-lip level; the gonial angle may be off.",
    gonionLevel: "The gonion usually lies between nose base and cervical level; the gonial angle may be off.",
    lowResolution: "The face is small in the image (less than 150 px from glabella to menton); placement errors weigh heavily.",
    missingCore: "Not all midline points (glabella to menton) are available; no values are computed.",
  },
  de: {
    verticalOrder: "Die Mittellinienpunkte liegen nicht von oben nach unten (Glabella → Nasion → Nasenspitze → Subnasale → Lippen → Kinn). Bitte die Platzierung prüfen.",
    anteriorOrder: "Die Nasenspitze muss der vorderste Punkt der Nase sein (vor Nasion, Rhinion und Subnasale). Blickrichtung und Platzierung prüfen.",
    neckOrder: "Der Zervikalpunkt muss unter dem Menton und der Halspunkt unter dem Zervikalpunkt liegen.",
    tragionLevel: "Das Tragion liegt normalerweise zwischen Brauen- und Oberlippenhöhe; der Kieferwinkel kann abweichen.",
    gonionLevel: "Das Gonion liegt normalerweise zwischen Nasenbasis und Zervikalhöhe; der Kieferwinkel kann abweichen.",
    lowResolution: "Das Gesicht ist im Bild klein (unter 150 px von Glabella bis Menton); Platzierungsfehler wiegen schwer.",
    missingCore: "Nicht alle Mittellinienpunkte (Glabella bis Menton) sind vorhanden; es werden keine Werte berechnet.",
  },
};

export const SIDE_ASSUMPTION_TEXTS: Record<Lang, Record<SideAssumptionCode, string>> = {
  en: {
    manualPlacement: "Landmarks were placed manually; precision depends on the placement (the σ values show the sensitivity).",
    automaticPlacement: "Landmarks were detected automatically from the profile silhouette (person segmentation); points not on the silhouette (alar crease, tragion, gonion) are only used when they could be derived and are otherwise reported as not determinable. The σ values assume a detection error of 0.6 % of the face height.",
    imageVertical: "The image vertical is used as the true vertical (natural head position assumed) for the Z angle, the height ratios and the chin meridian. Place the orbitale or rotate the reference axis if the head is tilted.",
    frankfortHorizontal: "The soft-tissue Frankfort horizontal (tragion → orbitale) is the horizontal reference for the Z angle, the height ratios and the chin meridian; it lies a few degrees from the bony Frankfort plane.",
    manualAxis: "The reference axis was rotated manually; the Z angle, the height ratios and the chin meridian are measured against it.",
    proxies: "The posterior ramus is approximated by the gonion–tragion line and the columella by the pronasale–subnasale line.",
    separateFromFrontal: "The gonial angle uses the range of the provided guide; all other ranges are published literature norms. Nothing here enters the 42-ratio frontal score.",
  },
  de: {
    manualPlacement: "Die Landmarks wurden manuell gesetzt; die Präzision hängt von der Platzierung ab (die σ-Werte zeigen die Empfindlichkeit).",
    automaticPlacement: "Die Landmarks wurden automatisch aus der Profilsilhouette (Personensegmentierung) bestimmt; Punkte außerhalb der Silhouette (Nasenflügelfurche, Tragion, Gonion) werden nur verwendet, wenn sie sich ableiten ließen, sonst als nicht bestimmbar ausgewiesen. Die σ-Werte nehmen einen Erkennungsfehler von 0,6 % der Gesichtshöhe an.",
    imageVertical: "Die Bildvertikale gilt als wahre Vertikale (natürliche Kopfhaltung vorausgesetzt) für Z-Winkel, Höhenverhältnisse und Kinnmeridian. Bei geneigtem Kopf Orbitale setzen oder die Referenzachse drehen.",
    frankfortHorizontal: "Die Weichteil-Frankfurter-Horizontale (Tragion → Orbitale) ist die horizontale Referenz für Z-Winkel, Höhenverhältnisse und Kinnmeridian; sie weicht um wenige Grad von der knöchernen Frankfurter Ebene ab.",
    manualAxis: "Die Referenzachse wurde manuell gedreht; Z-Winkel, Höhenverhältnisse und Kinnmeridian werden daran gemessen.",
    proxies: "Der aufsteigende Ast wird durch die Linie Gonion–Tragion, der Nasensteg durch Pronasale–Subnasale angenähert.",
    separateFromFrontal: "Der Kieferwinkel nutzt den Bereich des bereitgestellten Leitfadens; alle anderen Bereiche sind publizierte Literaturnormen. Nichts davon fließt in den 42-Verhältnis-Frontalscore ein.",
  },
};

export const SIDE_SOURCE_TEXTS: Record<Lang, Record<SideSource, string>> = {
  en: { guide: "Guide range", literature: "Literature norm", descriptive: "Descriptive" },
  de: { guide: "Leitfaden-Bereich", literature: "Literaturnorm", descriptive: "Beschreibend" },
};
