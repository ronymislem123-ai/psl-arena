/**
 * German texts for the measurement database. English texts live in the engine
 * (`src/engine/ratios/database.ts`) and are the fallback for every language.
 */
import { ADDITIONAL_BY_ID, CATEGORY_META, RATIO_BY_ID } from "@/engine/ratios/database";
import type { AdditionalMeasurementId, CategoryId, DefinitionStatus, LandmarkNoteCode, RatioId, SemanticLandmarkId } from "@/engine/types";
import type { Lang } from "./index";

export interface RatioText {
  name: string;
  formula: string;
  methodology: string;
  limitations: string[];
}

const LIM_2D = "2D-Frontalfoto: keine Tiefen- oder Knocheninformation, nur Weichteil-Landmarks.";
const LIM_ZYG = "Das Zygion wird durch den breitesten Punkt der Weichteilkontur angenähert (geringe Präzision).";
const LIM_GON = "Das Gonion wird aus der glatten Mesh-Kontur konstruiert; frontale Kieferwinkel sind Näherungen.";
const LIM_HAIR = "Hängt vom Haaransatz (Trichion) ab, der aus dem Bild geschätzt wird und manuell korrigierbar ist.";
const LIM_EXPR = "Empfindlich gegenüber dem Gesichtsausdruck (Lächeln oder offener Mund verändern die Messung).";
const LIM_YAW = "Horizontale Breiten werden bei gedrehtem Kopf (Yaw) verkürzt.";

export const RATIO_TEXTS_DE: Record<RatioId, RatioText> = {
  ESR: { name: "Augenabstands-Verhältnis", formula: "IPD / bizygomatische Breite × 100", methodology: "Abstand der Pupillenmitten geteilt durch den Abstand der Zygion-Ersatzpunkte.", limitations: [LIM_ZYG, LIM_YAW] },
  OCD: { name: "Äußerer Augenwinkelabstand", formula: "äußerer Augenwinkelabstand / bizygomatische Breite × 100", methodology: "Abstand der lateralen Augenwinkel geteilt durch die bizygomatische Breite. Der Nenner wurde aus der visuellen Vorlage rekonstruiert.", limitations: ["Nenner bzw. Messkonvention aus der visuellen Vorlage rekonstruiert.", LIM_ZYG, LIM_YAW] },
  ICD: { name: "Intercanthaler Abstand zu Lidspaltenlänge", formula: "intercanthaler Abstand / mittlere Lidspaltenlänge", methodology: "Abstand der medialen Augenwinkel geteilt durch den Mittelwert beider Lidspaltenlängen (lateraler bis medialer Augenwinkel).", limitations: [LIM_2D] },
  EAR: { name: "Augen-Seitenverhältnis", formula: "Lidspaltenlänge / Augenhöhe (Mittel beider Augen)", methodology: "Pro Auge: Lidspaltenlänge geteilt durch die vertikale Öffnung an der Pupille (Ober- zu Unterlid). Beide Verhältnisse werden gemittelt.", limitations: ["Die Augenöffnung ändert sich beim Zusammenkneifen, Blinzeln und Lächeln.", LIM_EXPR] },
  PFL_BYZGO: { name: "Lidspaltenlänge zu bizygomatischer Breite", formula: "mittlere Lidspaltenlänge / bizygomatische Breite × 100", methodology: "Mittlere Lidspaltenlänge geteilt durch die bizygomatische Breite.", limitations: [LIM_ZYG, LIM_YAW] },
  M_IPD: { name: "Mundbreite zu IPD", formula: "Mundbreite / IPD × 100", methodology: "Abstand der Mundwinkel geteilt durch den Pupillenabstand.", limitations: [LIM_EXPR] },
  EBL: { name: "Augenbrauenlänge", formula: "Augenbrauenlänge / IPD × 100 (Mittel beider Brauen)", methodology: "Abstand von Brauenkopf zu Brauenschwanz (Endpunkte der Mesh-Brauenkontur) geteilt durch die IPD.", limitations: ["Die Brauenendpunkte hängen von Pflege und Haardichte ab; die Mesh-Brauenenden sind Näherungen."] },
  EBS: { name: "Augenbrauen-Abstand", formula: "Augenhöhe / Abstand Pupille–Braue (gemäß Vorlage)", methodology: "Nicht gemessen: Die wörtliche Formel im Text reproduziert den angegebenen Zielbereich nicht, die genaue Konvention benötigt die visuelle Vorlage.", limitations: ["Messkonvention in der Quelle (Community-Leitfaden) unvollständig; nicht bewertet."] },
  ICD_N: { name: "Intercanthaler Abstand zu Nasenbreite", formula: "intercanthaler Abstand / Nasenbreite (Flügelbreite)", methodology: "Medialer Augenwinkel zu medialem Augenwinkel geteilt durch die Flügelbasisbreite (lateralste Flügelpunkte). Endpunkte durch diese Implementierung festgelegt.", limitations: ["Endpunkte wurden durch diese Implementierung festgelegt (mediale Augenwinkel; Flügelbasispunkte).", LIM_YAW] },
  EME: { name: "Auge–Mund–Auge-Winkel", formula: "Winkel am Mundzentrum (Stomion) zwischen den Strahlen zu beiden Pupillenmitten", methodology: "Dreieck Pupille–Stomion–Pupille mit Scheitel am Mundzentrum (E–M–E). Ein größerer Pupillen-Mund-Abstand ergibt einen kleineren Winkel.", limitations: ["Das Stomion wandert mit dem Ausdruck (Lächeln, offener Mund)."] },
  IAA: { name: "Ipsilateraler Flügelwinkel", formula: "gemäß Vorlage (textlich nicht definiert)", methodology: "Nicht gemessen: Die Winkelkonstruktion ist nur in der visuellen Vorlage definiert.", limitations: ["Winkelkonstruktion in der Quelle (Community-Leitfaden) unvollständig; nicht bewertet."] },
  JFA: { name: "Frontaler Kieferwinkel", formula: "gemäß Vorlage (textlich nicht definiert)", methodology: "Nicht gemessen: Die exakte Winkelkonstruktion benötigt die visuelle Vorlage.", limitations: ["Winkelkonstruktion in der Quelle (Community-Leitfaden) unvollständig; nicht bewertet."] },
  DEV_IAA_JFA: { name: "Abweichung IAA/JFA", formula: "|IAA − JFA|", methodology: "Nicht gemessen: hängt von IAA und JFA ab, die unvollständig sind.", limitations: ["Hängt von unvollständigen Messungen ab; nicht bewertet."] },
  BIT: { name: "Bitemporale Breite", formula: "bitemporale Breite / bizygomatische Breite × 100", methodology: "Schläfenkonturpunkte auf Brauenhöhe geteilt durch die bizygomatische Breite.", limitations: ["Schläfenpunkte sind Weichteil-Konturpunkte und können von Haaren verdeckt sein.", LIM_ZYG, LIM_YAW] },
  DEV_BIT_BIG: { name: "Abweichung BIT/BIG", formula: "|BIT − BIG|", methodology: "Absolute Differenz der beiden Prozentwerte.", limitations: [LIM_GON, LIM_ZYG] },
  BIG: { name: "Bigoniale Breite", formula: "bigoniale Breite / bizygomatische Breite × 100", methodology: "Abstand der konstruierten Gonien geteilt durch die bizygomatische Breite.", limitations: [LIM_GON, LIM_ZYG, LIM_YAW] },
  JWHR: { name: "Kiefer-Breiten-Höhen-Verhältnis", formula: "bigoniale Breite / Höhe Stomion–Menton", methodology: "Vertikale Grenzen durch diese Implementierung festgelegt: Stomion (Lippenlinie) bis Menton. Alternative Konventionen (Subnasale–Menton) ergeben systematisch kleinere Werte.", limitations: ["Die vertikalen Messgrenzen sind in der Quelle nicht eindeutig (rekonstruiert).", LIM_GON, LIM_EXPR] },
  M_BIG: { name: "Mundbreite zu bigonialer Breite", formula: "Mundbreite / bigoniale Breite × 100", methodology: "Mundwinkelabstand geteilt durch die konstruierte bigoniale Breite.", limitations: [LIM_GON, LIM_EXPR] },
  GS: { name: "Gonialer Winkel (Frontalprojektion)", formula: "Winkel am Gonion zwischen Ramus-Linie und Unterkieferkörper-Linie (Mittel beider Seiten)", methodology: "Frontalprojektion des Kieferwinkels aus der Gesichtskontur. Das ist NICHT der laterale Gonialwinkel.", limitations: ["Die Mesh-Kontur ist um den Kieferwinkel glatt, daher fallen die Werte größer aus als der anatomische Winkel.", LIM_GON, LIM_2D] },
  M_N: { name: "Mundbreite zu Nasenbreite", formula: "Mundbreite / Nasenbreite (Flügelbreite)", methodology: "Mundwinkelabstand geteilt durch die Flügelbasisbreite.", limitations: [LIM_EXPR, LIM_YAW] },
  MF: { name: "Mittelgesichts-Verhältnis", formula: "IPD / Höhe Nasion–Oberlippe", methodology: "IPD geteilt durch den vertikalen Abstand vom Weichteil-Nasion zum oberen Lippenrot-Rand.", limitations: ["Weichteil-Nasion aus dem Mesh (mittlere Präzision).", "Pitch (Kopfneigung nach oben/unten) verkürzt vertikale Abstände."] },
  FWHR: { name: "Gesichts-Breiten-Höhen-Verhältnis", formula: "bizygomatische Breite / Höhe Braue–Oberlippe", methodology: "Bizygomatische Breite geteilt durch den vertikalen Abstand von der Brauenlinie (Unterkante der Brauen) zum oberen Lippenrot-Rand.", limitations: ["Die Brauenreferenz ist die Unterkante der Brauen in Brauenmitte (Konvention in der Doku).", LIM_ZYG, LIM_YAW] },
  TFWHR: { name: "Gesamt-Breiten-Höhen-Verhältnis", formula: "Gesamtgesichtshöhe / bizygomatische Breite", methodology: "Höhe Haaransatz–Menton geteilt durch die bizygomatische Breite.", limitations: [LIM_HAIR, LIM_ZYG, LIM_YAW] },
  CBS: { name: "Wangenknochenposition", formula: "Abstand Wangenknochen–Lippe / Abstand Pupillenebene–Lippe × 100", methodology: "Vertikaler Abstand von der Zygion-Höhe zur Lippenlinie geteilt durch den vertikalen Abstand von der Pupillenlinie zur Lippenlinie.", limitations: ["Nur eine Untergrenze (> 80 %) ist definiert.", "Lippenreferenz als Stomion (Lippenlinie) festgelegt.", LIM_ZYG] },
  N_H: { name: "Nasenhöhe zu Nasenbreite", formula: "Nasenhöhe / Nasenbreite", methodology: "Vertikaler Abstand Nasion–Subnasale geteilt durch die Flügelbasisbreite.", limitations: ["Pitch verkürzt die vertikale Nasenhöhe.", LIM_YAW] },
  M_C: { name: "Mundbreite zu Kinnbreite", formula: "Mundbreite / Kinnbreite", methodology: "Kinnbreite zwischen den lateralen Kinnpolster-Konturpunkten (Mesh 176/400), die bei neutralem Gesicht unter den Mundwinkeln liegen.", limitations: ["Kinnmesspunkte rekonstruiert (visuelle Referenz nicht verfügbar).", LIM_EXPR] },
  NBR_ALA: { name: "Nasenrücken / Flügelmessung", formula: "gemäß Vorlage (Endpunkte textlich nicht definiert)", methodology: "Nicht gemessen: Die Endpunkte sind im Text nicht vollständig definiert.", limitations: ["Endpunkte in der Quelle (Community-Leitfaden) unvollständig; nicht bewertet."] },
  N_BYZGO: { name: "Nasenbreite zu bizygomatischer Breite", formula: "Nasenbreite / bizygomatische Breite × 100", methodology: "Flügelbasisbreite geteilt durch die bizygomatische Breite.", limitations: ["Stark von Nahaufnahme-Perspektive (Selfie) beeinflusst, die die Nase vergrößert.", LIM_ZYG, LIM_YAW] },
  CT: { name: "Kanthale Neigung (Canthal Tilt)", formula: "Winkel der Linie medialer–lateraler Augenwinkel gegenüber der Pupillenhorizontalen (Mittel beider Augen)", methodology: "Positiv, wenn der laterale Augenwinkel höher liegt als der mediale. Gemessen nach Roll-Normalisierung.", limitations: ["Yaw verschiebt die scheinbaren Augenwinkelpositionen; Zusammenkneifen verändert den Tilt."] },
  ET: { name: "Augenbrauen-Tilt", formula: "Winkel der Linie Brauenkopf–Brauenschwanz gegenüber der Horizontalen (Mittel beider Brauen)", methodology: "Positiv, wenn der Brauenschwanz höher liegt als der Brauenkopf.", limitations: ["Brauenenden sind Näherungen; der Brauenausdruck verändert den Tilt."] },
  DEV_CT_ET: { name: "Abweichung Kanthal-/Brauenneigung", formula: "|CT − ET|", methodology: "Absolute Differenz zwischen kanthaler Neigung und Brauenneigung.", limitations: ["Übernimmt die Einschränkungen von CT und ET."] },
  FWHF: { name: "Stirnhöhe zu Gesichtsbreite", formula: "Stirnhöhe / Referenz-Gesichtsbreite × 100", methodology: "Referenz-Gesichtsbreite durch diese Implementierung als bizygomatische Breite festgelegt. Stirnhöhe = Haaransatz bis Glabella.", limitations: ["Die Referenz-Gesichtsbreite musste vor der Berechnung festgelegt werden (rekonstruiert).", LIM_HAIR, LIM_ZYG] },
  LL_UL: { name: "Unter- zu Oberlippenhöhe", formula: "Unterlippenhöhe / Oberlippenhöhe", methodology: "Lippenrot-Höhen auf der Mittellinie (Lippenrot-Rand bis innere Lippenkante).", limitations: [LIM_EXPR, "Lippenrot-Ränder sind Landmarks mittlerer Präzision."] },
  L3P: { name: "Proportion des unteren Drittels", formula: "Nasenbasis–Mund / Nasenbasis–Kinn × 100", methodology: "Höhe Subnasale–Stomion geteilt durch die Höhe Subnasale–Menton.", limitations: ["Offener Mund oder Lächeln verschieben das Stomion.", "Pitch verändert vertikale Proportionen leicht."] },
  LFF: { name: "Untergesicht zu Gesicht", formula: "Nasion–Kinn / Haaransatz–Kinn × 100", methodology: "Vertikale Höhe Nasion–Menton geteilt durch die Höhe Trichion–Menton.", limitations: [LIM_HAIR] },
  C_P: { name: "Kinn-zu-Philtrum-Verhältnis", formula: "Höhe Unterlippe–Kinn / Höhe Subnasale–Oberlippe", methodology: "Kinnhöhe (unterer Lippenrot-Rand bis Menton) geteilt durch die Philtrumlänge (Subnasale bis oberer Lippenrot-Rand).", limitations: ["„Lippenmittelpunkt“ als oberer Lippenrot-Rand auf der Mittellinie interpretiert.", LIM_EXPR] },
  FT_L: { name: "Gesichtsdrittel – unten", formula: "unteres Drittel (Subnasale–Menton) / Gesamtgesichtshöhe × 100", methodology: "Subnasale–Menton geteilt durch Trichion–Menton.", limitations: [LIM_HAIR, "Ein offener Mund verlängert das untere Drittel."] },
  FT_M: { name: "Gesichtsdrittel – Mitte", formula: "mittleres Drittel (Glabella–Subnasale) / Gesamtgesichtshöhe × 100", methodology: "Glabella (mittlere Brauenreferenz) bis Subnasale geteilt durch Trichion–Menton.", limitations: [LIM_HAIR] },
  FT_U: { name: "Gesichtsdrittel – oben", formula: "oberes Drittel (Trichion–Glabella) / Gesamtgesichtshöhe × 100", methodology: "Trichion bis Glabella geteilt durch Trichion–Menton.", limitations: [LIM_HAIR] },
  LIP_WHR: { name: "Lippen-Breiten-Höhen-Verhältnis", formula: "Mundbreite / Gesamtlippenhöhe", methodology: "Mundwinkelabstand geteilt durch die vertikale Höhe vom oberen zum unteren Lippenrot-Rand.", limitations: [LIM_EXPR, "Ein offener Mund vergrößert die Gesamtlippenhöhe."] },
  NW: { name: "Halsbreite", formula: "Halsbreite / bigoniale Breite × 100", methodology: "Benötigt manuell gesetzte Halsrandpunkte (das Landmark-Modell deckt den Hals nicht ab).", limitations: ["Halspunkte müssen manuell gesetzt werden; Kleidung und Haare verdecken den Hals oft.", LIM_GON] },
  EYS: { name: "EYS", formula: "in der Quelle nicht definiert", methodology: "Nicht gemessen: Die Messmethode ist in der Quelle (Community-Leitfaden) nicht definiert.", limitations: ["Undefinierte Messung; nicht bewertet."] },
};

export const CATEGORY_TEXTS_DE: Record<CategoryId, { label: string; description: string }> = {
  eyeArea: { label: "Augenpartie", description: "Augenabstand, Lidspaltenproportionen, Canthal- und Brauen-Tilt, Brauenlänge." },
  midface: { label: "Mittelgesicht", description: "Kompaktheit des Mittelgesichts, Wangenknochenposition, Auge–Mund-Geometrie, FWHR." },
  nose: { label: "Nase", description: "Nasenbreite und -höhe relativ zu Augen und Gesicht." },
  lips: { label: "Lippen", description: "Mundbreite und Lippenproportionen." },
  jawline: { label: "Kieferlinie", description: "Bigoniale/bitemporale Breiten, Kieferwinkel-Projektion, Kieferhöhen-Verhältnis." },
  lowerThird: { label: "Unteres Drittel", description: "Proportionen des unteren Drittels, Kinn- und Philtrum-Relationen." },
  structure: { label: "Gesichtsstruktur", description: "Vertikale Drittel, Gesamthöhe zu Breite, Stirnproportion." },
};

export const ADDITIONAL_TEXTS_DE: Record<AdditionalMeasurementId, { name: string; description: string; methodology: string; limitations: string[]; referenceValue: string | null }> = {
  CMA: { name: "Zervikomentaler Winkel", description: "Winkel zwischen Kinnunterseite und Halslinie (submentaler Bereich).", methodology: "Benötigt ein seitliches Profilfoto; aus einem Frontalbild nicht messbar.", limitations: ["In der 2D-Frontalansicht nicht messbar."], referenceValue: null },
  GA: { name: "Gonialwinkel", description: "Winkel am Gonion zwischen Unterkieferkörper und aufsteigendem Ast.", methodology: "Der echte Gonialwinkel ist eine Messung der Seitenansicht. Die Frontalprojektion wird separat als GS ausgewiesen und ist nicht dieselbe Größe.", limitations: ["In der 2D-Frontalansicht nicht messbar; siehe GS für die Frontalprojektion."], referenceValue: "115–130° (älterer Referenzwert)" },
  FH_FINGER: { name: "Stirnhöhe (Finger-Regel)", description: "Grobe visuelle Faustregel: Die Stirn (Haaransatz bis Braue) ist etwa drei Fingerbreiten hoch.", methodology: "Ausgewiesen als Stirnhöhe relativ zum mittleren Drittel und zur IPD; ein absoluter Maßstab ist im Foto nicht verfügbar.", limitations: ["Nicht-metrische Faustregel; keine Bewertung.", "Hängt vom geschätzten Haaransatz ab."], referenceValue: "≈ drei Fingerbreiten (Faustregel)" },
  FIFTHS: { name: "Gesichtsfünftel", description: "Horizontale Teilung des Gesichts in fünf Segmente: Außenkontur–lateraler Augenwinkel, Auge, intercanthal, Auge, lateraler Augenwinkel–Außenkontur.", methodology: "Segmentbreiten zwischen den Zygion-Ersatzpunkten und den Augenwinkeln, in % der Gesamtbreite.", limitations: ["Die äußeren Segmente hängen von der Weichteil-Gesichtskontur ab.", "Nicht Teil des 42-Verhältnis-Kernscorings."], referenceValue: "≈ 20 % je Segment" },
  BYZ_BIG: { name: "Bizygomatisch / Bigonial", description: "Älteres Verhältnis aus dem Messatlas. Das Ausgangsmaterial ist widersprüchlich (BIG = 85–92 % impliziert 1,09–1,18).", methodology: "Rohwert bizygomatisch ÷ bigonial nur zur Referenz; keine Bewertung.", limitations: ["Formel/Bezeichnungen im Ausgangsmaterial widersprüchlich; nicht bewerten."], referenceValue: "1,35 (älterer Atlaswert)" },
  EAR_ANGLE: { name: "Ohrwinkel", description: "Ohrwinkel/-verhältnis aus der visuellen Vorlage; kein Zielbereich definiert.", methodology: "Nicht messbar: Das Gesichts-Landmark-Modell hat keine Ohr-Landmarks und es ist kein Ziel definiert.", limitations: ["Keine Ohr-Landmarks; kein definiertes Ziel."], referenceValue: null },
  NOSE_CHIN: { name: "Nase–Kinn", description: "Zusätzliche visuelle Messung; nur Rohwerte dokumentiert.", methodology: "Rohabstand Nasenspitze → Menton relativ zur IPD und zum unteren Drittel; keine Formel und kein Ziel definiert, keine Bewertung.", limitations: ["Formel und Ziel undefiniert; nur Rohwert."], referenceValue: null },
  EML: { name: "Augen–Mund-Längenverhältnis", description: "Vertikaler Abstand von der Pupillenlinie zum Mund (Stomion) im Verhältnis zur Gesichtslänge vom Haaransatz bis zum Kinn.", methodology: "Lage-normalisiertes Bezugssystem; Höhe Pupillenmittelpunkt → Stomion geteilt durch Höhe Trichion → Menton. In Rubrik 2.0 bewertet (Kriterium Augen–Mund-Längenverhältnis) mit der publizierten Streuung 0,017.", limitations: ["Präferenzdaten nur von Gesichtern weißer Frauen (Pallett et al. 2010).", "Hängt vom geschätzten oder bestätigten Haaransatz ab.", "Ein geöffneter Mund verschiebt das Stomion."], referenceValue: "0,36–0,37 (Pallett et al. 2010)" },
  MRD1: { name: "Oberlidposition (MRD1)", description: "Margin-Reflex-Distanz 1: Abstand Iriszentrum → Oberlidrand in Millimetern.", methodology: "Lage-normalisiertes Netz; vertikaler Abstand vom Iriszentrum (468/473) zur Oberlidkontur in der Spalte des Iriszentrums, skaliert über den horizontalen Irisdurchmesser (Ringpunkte) = 11,7 mm (Rüfer et al. 2005); Mittel beider Augen. In Rubrik 2.1 bewertet (Kriterium Oberlidposition).", limitations: ["Die Lidränder sind Konturpunkte des Netzes; Wimpern, Make-up und Lidschatten verschieben sie.", "Individuelle Irisdurchmesser schwanken um ± 0,4 mm (± 4 %)."], referenceValue: "4–5 mm (Putterman 2012)" },
  SSI: { name: "Skleraanzeige unterhalb der Iris", description: "Sichtbare Sklera zwischen dem unteren Irisrand und dem Unterlidrand, in Millimetern.", methodology: "Lage-normalisiertes Netz; Unterlidkontur in der Spalte des Iriszentrums minus unterer Irisrand (Zentrum + horizontaler Irisradius), skaliert über den Irisdurchmesser = 11,7 mm; Mittel beider Augen. Negativ = das Lid bedeckt den unteren Irisrand. In Rubrik 2.1 bewertet (Kriterium Sklera-Show).", limitations: ["Die Lidränder sind Konturpunkte des Netzes; Wimpern und Make-up verschieben sie.", "Die Blickrichtung verändert den Wert: Blick nach oben legt Sklera unter der Iris frei."], referenceValue: "≤ 0 mm; > 1 mm = Unterlidretraktion (Bartley 1996)" },
};

export const LANDMARK_LABELS_DE: Record<SemanticLandmarkId, string> = {
  pupil_R: "Pupillenmitte (rechts)", pupil_L: "Pupillenmitte (links)",
  endocanthion_R: "Medialer Augenwinkel (rechts)", endocanthion_L: "Medialer Augenwinkel (links)",
  exocanthion_R: "Lateraler Augenwinkel (rechts)", exocanthion_L: "Lateraler Augenwinkel (links)",
  palpebrale_sup_R: "Oberlid-Scheitel (rechts)", palpebrale_sup_L: "Oberlid-Scheitel (links)",
  palpebrale_inf_R: "Unterlid (rechts)", palpebrale_inf_L: "Unterlid (links)",
  brow_medial_R: "Brauenkopf (rechts)", brow_medial_L: "Brauenkopf (links)",
  brow_lateral_R: "Brauenschwanz (rechts)", brow_lateral_L: "Brauenschwanz (links)",
  brow_apex_R: "Brauenbogen-Scheitel (rechts)", brow_apex_L: "Brauenbogen-Scheitel (links)",
  brow_lower_mid_R: "Brauenunterkante, Mitte (rechts)", brow_lower_mid_L: "Brauenunterkante, Mitte (links)",
  brow_line: "Brauenlinie (Unterkante, Mittellinie)",
  nasion: "Nasion / Sellion (Weichteil)", nose_bridge: "Nasenrücken", pronasale: "Nasenspitze", subnasale: "Subnasale",
  alare_R: "Nasenflügelbasis (rechts)", alare_L: "Nasenflügelbasis (links)",
  cheilion_R: "Mundwinkel (rechts)", cheilion_L: "Mundwinkel (links)",
  labrale_sup: "Oberer Lippenrot-Rand", labrale_inf: "Unterer Lippenrot-Rand",
  stomion_sup: "Innere Oberlippenkante", stomion_inf: "Innere Unterlippenkante", stomion: "Stomion (Lippenkontaktpunkt)",
  trichion: "Trichion (Haaransatz)", glabella: "Glabella (mittlere Brauenreferenz)", menton: "Menton (Kinnunterkante)",
  chin_corner_R: "Kinnecke (rechts)", chin_corner_L: "Kinnecke (links)",
  gonion_R: "Gonion (rechts, Frontalkonstruktion)", gonion_L: "Gonion (links, Frontalkonstruktion)",
  zygion_R: "Zygion (rechts, Weichteil-Ersatz)", zygion_L: "Zygion (links, Weichteil-Ersatz)",
  frontotemporale_R: "Frontotemporale (rechts)", frontotemporale_L: "Frontotemporale (links)",
  ramus_upper_R: "Ramus-Kontur (rechts)", ramus_upper_L: "Ramus-Kontur (links)",
  mandible_body_R: "Unterkieferkörper-Kontur (rechts)", mandible_body_L: "Unterkieferkörper-Kontur (links)",
  forehead_top: "Mesh-Oberkante (nicht der Haaransatz)",
  neck_R: "Halsrand (rechts)", neck_L: "Halsrand (links)",
};

export const LANDMARK_NOTES_DE: Record<LandmarkNoteCode, string> = {
  nasion: "Tiefster Mittellinienpunkt zwischen den Augen (Mesh 168).",
  alare: "Laterale Kante des Nasenflügels an der Flügelfurche (Mesh 48/278).",
  glabella: "Mittellinienpunkt auf Brauenhöhe (Mesh 9).",
  meshTop: "Obere Begrenzung des Mesh; der Haaransatz liegt darüber.",
  chinCorner: "Laterale Kante des Kinnpolsters (Mesh 176/400).",
  frontotemporale: "Schläfenkontur auf Brauenhöhe (Mesh 21/251).",
  zygion: "Breitester Punkt der Gesichtskontur; Weichteil-Näherung des Jochbogens.",
  gonionConstructed: "Konstruiert als Schnittpunkt der Ramus- und Unterkieferkörper-Konturlinien.",
  gonionFallback: "Die Konturlinien schnitten sich nicht nahe dem Kieferwinkel; Rückfall auf den Kontur-Eckpunkt.",
  trichionManual: "Manuell gesetzt.",
  trichionEstimated: "Geschätzt durch Abtasten der Stirn nach dem Haut/Haar-Übergang; bei Bedarf korrigieren.",
  neckManual: "Manuell gesetzt.",
  browLine: "Horizontale durch die Unterkante beider Brauen in Brauenmitte; obere Grenze des FWHR.",
};

export const STATUS_TEXT: Record<Lang, Record<DefinitionStatus, string>> = {
  en: { defined: "Fully defined in the source material.", reconstructed: "Measurement convention reconstructed by this implementation (flagged).", incomplete: "Incomplete in the source material; not measured." },
  de: { defined: "Im Quellmaterial vollständig definiert.", reconstructed: "Messkonvention durch diese Implementierung rekonstruiert (gekennzeichnet).", incomplete: "Im Quellmaterial unvollständig; nicht gemessen." },
};

export const SOURCE_TEXT: Record<Lang, string> = {
  en: "Ultimate Facial Harmony guide (community reference, as provided)",
  de: "Ultimate-Facial-Harmony-Leitfaden (Community-Referenz, wie bereitgestellt)",
};

export function ratioText(id: RatioId, lang: Lang): RatioText {
  const d = RATIO_BY_ID[id];
  if (lang === "de") return RATIO_TEXTS_DE[id];
  return { name: d.name, formula: d.formula, methodology: d.methodology, limitations: d.limitations };
}

export function categoryText(id: CategoryId, lang: Lang): { label: string; description: string } {
  return lang === "de" ? CATEGORY_TEXTS_DE[id] : { label: CATEGORY_META[id].label, description: CATEGORY_META[id].description };
}

export function additionalText(id: AdditionalMeasurementId, lang: Lang) {
  const d = ADDITIONAL_BY_ID[id];
  return lang === "de" ? ADDITIONAL_TEXTS_DE[id] : { name: d.name, description: d.description, methodology: d.methodology, limitations: d.limitations, referenceValue: d.referenceValue };
}

export function landmarkLabel(id: SemanticLandmarkId, lang: Lang, fallback: string): string {
  return lang === "de" ? (LANDMARK_LABELS_DE[id] ?? fallback) : fallback;
}

export function landmarkNote(code: LandmarkNoteCode | undefined, lang: Lang, fallback: string | undefined): string | undefined {
  if (lang === "de" && code) return LANDMARK_NOTES_DE[code] ?? fallback;
  return fallback;
}

export function roundLabel(id: CategoryId | "harmony" | "symmetry", lang: Lang): string {
  if (id === "harmony") return lang === "de" ? "Gesichtsharmonie" : "Facial Harmony";
  if (id === "symmetry") return lang === "de" ? "Symmetrie" : "Symmetry";
  return categoryText(id, lang).label;
}
