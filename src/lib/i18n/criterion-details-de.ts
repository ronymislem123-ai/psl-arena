/**
 * German "how it is measured" (requirements) and limitations of the rubric criteria,
 * shown in the criterion detail dialog. Same order and number of entries as the
 * English source in src/engine/psl/rubric.ts (checked by tests/unit/i18n.test.ts).
 */
import type { CriterionId } from "@/engine/psl/rubric";

const LIM_T1 = "Bewertet gegen die Referenzbereiche der Frontal-Verhältnisdatenbank, in Einheiten der natürlichen Streuung zwischen Personen.";
const LIM_PROFILE = "Benötigt eine Seitenansicht-Analyse (automatisch aus einem Profilfoto, optional korrigiert).";
const LIM_VISUAL = "Aus 2D-Landmarks nicht bewertbar (keine Referenzbereiche); bewertet durch ein visuelles Modell (visueller Eindruck, keine Messung), wenn eines eingerichtet ist und dem Senden des Fotos zugestimmt wurde, oder durch die eigene Selbsteinschätzung (halbe Gewichtung); sonst als nicht beurteilbar ausgewiesen.";
const LIM_EYELID = "Lidränder und Iris aus dem Gesichtsnetz mit Iris-Verfeinerung (der Irisdurchmesser, im Mittel 11,7 mm, legt den Millimetermaßstab fest; Rüfer et al. 2005); Wimpernschatten und Make-up verschieben den Lidrand.";
const LIM_JAW = "Frontale Kieferpunkte sind Weichteilkonstruktionen mit geringer Zuverlässigkeit (2D-Bigonialbreite ICC .16, Lim et al. 2022); entsprechend gewichtet.";
const REQ_VISUAL = "Visuelles Modell (mit Einwilligung) oder die gekennzeichnete Selbsteinschätzung; beschreibende Messwerte aus dem Foto werden angezeigt, aber nicht bewertet.";
const REQ_SIDE = "Seitenansicht-Analyse.";

export const CRITERION_DETAILS_DE: Record<CriterionId, { requirements: string; limitations: string[] }> = {
  canthalTilt: { requirements: "Frontalfoto, Augen offen, Gieren ≤ 15°.", limitations: [LIM_T1, "Zusammenkneifen der Augen und verbleibendes Nicken verändern die gemessene Neigung."] },
  eyeSpacing: { requirements: "Frontalfoto mit sichtbaren Augenwinkeln.", limitations: [LIM_T1, "Das Verhältnis Pupillenabstand/Gesichtsbreite ist hier das einzige Maß mit veröffentlichten Präferenzdaten (Pallett et al. 2010)."] },
  fissureProportions: { requirements: "Neutraler Ausdruck, Augen offen.", limitations: [LIM_T1, "Die Augenöffnung ändert sich mit Ausdruck und Müdigkeit."] },
  browArea: { requirements: "Brauen sichtbar (kein Pony).", limitations: [LIM_T1, "Zupfen/Formen verändert die Brauenenden."] },
  upperLidExposure: { requirements: "Frontalfoto, Augen offen, Blick geradeaus.", limitations: [LIM_EYELID, "Normalbereich 4–5 mm (Putterman 2012; Bacharach et al. 2016)."] },
  scleralShow: { requirements: "Frontalfoto, entspannter Blick geradeaus.", limitations: [LIM_EYELID, "Referenz: Unterlid am unteren Limbus, Sklera-Show > 1 mm = Retraktion (Bartley 1996)."] },
  eyeShape: { requirements: REQ_VISUAL, limitations: [LIM_VISUAL] },
  midfaceRatio: { requirements: "Frontalfoto, Nicken ≤ 15°.", limitations: [LIM_T1, "Verbleibendes Nicken verkürzt/verlängert das Mittelgesicht."] },
  facialThirds: { requirements: "Haaransatz sichtbar/bestätigt.", limitations: [LIM_T1, "Hängt vom geschätzten oder bestätigten Haaransatz ab.", "Gleiche Drittel als Kanon treffen auf reale Gesichter selten zu (Jayaratne et al. 2012)."] },
  faceShape: { requirements: "Haaransatz sichtbar/bestätigt.", limitations: [LIM_T1, "Hängt vom Haaransatz und von der Weichteilkontur des Gesichts ab."] },
  eyeMouthGeometry: { requirements: "Neutraler Mund.", limitations: [LIM_T1, "Der Mundspalt (Stomion) bewegt sich mit dem Ausdruck."] },
  eyeMouthLength: { requirements: "Haaransatz sichtbar/bestätigt, neutraler Mund.", limitations: ["Präferenzdaten nur von weißen weiblichen Gesichtern (Pallett et al. 2010); das Optimum kann für andere Gruppen abweichen.", "Hängt vom Haaransatz ab."] },
  lowerThirdProportions: { requirements: "Lippen geschlossen.", limitations: [LIM_T1] },
  facialFifths: { requirements: "Frontalfoto, Gieren ≤ 15°.", limitations: ["Gleiche Fünftel sind ein historischer Kanon, den die meisten Gesichter nicht erfüllen (Farkas; Jayaratne et al. 2012); bewertet mit einer Streuungseinheit von 3 Prozentpunkten."] },
  profileConvexity: { requirements: REQ_SIDE, limitations: [LIM_PROFILE] },
  lowerFaceHarmony: { requirements: REQ_SIDE, limitations: [LIM_PROFILE] },
  jawWidth: { requirements: "Kieferlinie sichtbar (kein Bart/Haar über den Kieferwinkeln).", limitations: [LIM_T1, LIM_JAW] },
  chinWidthShape: { requirements: "Frontalfoto.", limitations: [LIM_T1, "Rekonstruierte Kinnecken."] },
  cheekbonePosition: { requirements: "Frontalfoto.", limitations: [LIM_T1, "Die Weichteilkontur steht stellvertretend für den Jochbogen (2D-bizygomatisch ICC .66, Lim et al. 2022)."] },
  gonialAngle: { requirements: REQ_SIDE, limitations: [LIM_PROFILE, "Weichteil-Näherung mit dem Tragion als Bezug für den Unterkieferast."] },
  mandibularPlane: { requirements: "Seitenansicht-Analyse mit Weichteil-Gonion.", limitations: [LIM_PROFILE, "Weichteil-Näherung des Frankfurt-Mandibularebenen-Winkels; benötigt das Gonion, das nicht auf der Silhouette liegt."] },
  midfaceProjection: { requirements: REQ_SIDE, limitations: [LIM_PROFILE, "Millimeter-Norm über eine durchschnittliche Gesichtshöhe umgerechnet."] },
  chinProjection: { requirements: REQ_SIDE, limitations: [LIM_PROFILE, "Z-Winkel gegen die anatomische Bezugsachse (Frankfurter Horizontale, wenn das Orbitale gesetzt ist)."] },
  neckChinDefinition: { requirements: "Seitenansicht-Analyse oder manuell gesetzte Halspunkte.", limitations: [LIM_PROFILE, "Unterkinnfett und Kopfbeugung verändern die Winkel."] },
  cheekboneProjection: { requirements: REQ_VISUAL, limitations: [LIM_VISUAL, "Licht und Körperfett prägen den Eindruck am stärksten."] },
  jawlineDefinition: { requirements: REQ_VISUAL, limitations: [LIM_VISUAL] },
  noseWidth: { requirements: "Frontalfoto, Standardabstand.", limitations: [LIM_T1, "Ein geringer Kameraabstand verbreitert die Nase (≈ +30 % bei 30 cm, Ward et al. 2018)."] },
  noseHeightWidth: { requirements: "Frontalfoto.", limitations: [LIM_T1] },
  noseProjection: { requirements: REQ_SIDE, limitations: [LIM_PROFILE] },
  nasalAngles: { requirements: REQ_SIDE, limitations: [LIM_PROFILE] },
  mouthWidth: { requirements: "Neutraler Mund.", limitations: [LIM_T1, "Lächeln verbreitert den Mund."] },
  lipProportions: { requirements: "Lippen geschlossen, entspannt.", limitations: [LIM_T1] },
  lipChinVertical: { requirements: "Frontalfoto, Lippen geschlossen.", limitations: [LIM_T1] },
  neckWidth: { requirements: "Frontalfoto mit manuell gesetzten Halsrändern.", limitations: [LIM_T1, "Nur mit manuell gesetzten Halspunkten; Kleidung und Kopfhaltung verändern die sichtbare Halsbreite."] },
  nasolabialAngle: { requirements: REQ_SIDE, limitations: [LIM_PROFILE] },
  lipShape: { requirements: REQ_VISUAL, limitations: [LIM_VISUAL] },
  eyeSymmetry: { requirements: "Frontalfoto, Gieren ≤ 10°.", limitations: ["Verbleibendes Gieren vergrößert die scheinbare Asymmetrie; gemessen wird nach 3D-Lagenormalisierung, wenn Tiefe verfügbar ist."] },
  noseSymmetry: { requirements: "Frontalfoto.", limitations: ["Die Nasenspitze verschiebt sich bei verbleibendem Gieren um ≈ 21·sin(Gieren) mm."] },
  mouthSymmetry: { requirements: "Neutraler Mund.", limitations: ["Der Ausdruck verändert die Mundsymmetrie."] },
  jawChinSymmetry: { requirements: "Frontalfoto.", limitations: ["Konstruierte Gonion-Punkte und Weichteil-Zygion-Punkte.", LIM_JAW] },
  foreheadHeight: { requirements: "Haaransatz sichtbar/bestätigt.", limitations: [LIM_T1, "Der Haaransatz wird aus dem Farbwechsel geschätzt oder manuell gesetzt; automatische Haaransatz-Punkte haben große Fehler."] },
  foreheadWidth: { requirements: "Schläfen sichtbar (kein Haar über den Schläfen).", limitations: [LIM_T1, "Schläfen-Konturpunkte sind Weichteil-Stellvertreter."] },
  // rubric 1.0 (only for stored ratings)
  jawAngularityFrontal: { requirements: "Frontalfoto.", limitations: [] },
  fwhr: { requirements: "Frontalfoto.", limitations: [] },
  jawHeightRatio: { requirements: "—", limitations: [] },
  areaBalance: { requirements: "—", limitations: [] },
  verticalBalance: { requirements: "—", limitations: [] },
};
