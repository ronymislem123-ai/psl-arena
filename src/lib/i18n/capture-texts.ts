import type { CaptureBasis, CaptureItem, CaptureItemId } from "@/engine/types";
import type { Lang } from "./index";

type P = Record<string, number | string>;
type Values = Record<string, (p: P) => string>;

export const CAPTURE_LABELS: Record<Lang, Record<CaptureItemId, string>> = {
  en: { view: "View", tilt: "Head tilt (in-plane)", elevation: "Vertical angle", framing: "Framing", distance: "Camera distance", selfie: "Selfie", mirror: "Mirror selfie", photographer: "Taken by another person", setting: "Setting", editing: "Editing traces", smoothing: "Skin smoothing", compression: "Compression", exposure: "Exposure", lighting: "Lighting", occlusion: "Occlusion" },
  de: { view: "Ansicht", tilt: "Kopfneigung (Bildebene)", elevation: "Vertikaler Winkel", framing: "Bildausschnitt", distance: "Kameraabstand", selfie: "Selfie", mirror: "Spiegelselfie", photographer: "Von anderer Person aufgenommen", setting: "Umgebung", editing: "Bearbeitungsspuren", smoothing: "Hautglättung", compression: "Kompression", exposure: "Belichtung", lighting: "Beleuchtung", occlusion: "Verdeckung" },
};

export const BASIS_LABELS: Record<Lang, Record<CaptureBasis, string>> = {
  en: { measured: "measured", derived: "derived", inferred: "inferred", undeterminable: "not determinable" },
  de: { measured: "gemessen", derived: "abgeleitet", inferred: "vermutet", undeterminable: "nicht bestimmbar" },
};

const EN: Record<CaptureItemId, Values> = {
  view: { frontal: (p) => `frontal (yaw ${p.yaw}°)`, slightlyTurned: (p) => `slightly turned (yaw ${p.yaw}°)`, turned: (p) => `turned (yaw ${p.yaw}°)`, threeQuarter: (p) => `three-quarter view (yaw ${p.yaw}°)`, profile: (p) => `profile (yaw ${p.yaw}°)` },
  tilt: { upright: (p) => `upright (${p.roll}°)`, slight: (p) => `slightly tilted (${p.roll}°)`, tilted: (p) => `tilted (${p.roll}°), corrected`, rotated: (p) => `strongly rotated (${p.roll}°), corrected` },
  elevation: { level: (p) => `level (pitch ${p.pitch}°)`, chinUp: (p) => `chin raised or camera below (pitch ${p.pitch}°) — the two cannot be told apart`, chinDown: (p) => `chin lowered or camera above (pitch ${p.pitch}°) — the two cannot be told apart` },
  framing: { closeUp: (p) => `close-up (face ${p.share} % of the image height)`, portrait: (p) => `head-and-shoulders portrait (${p.share} %)`, upperBody: (p) => `upper body (${p.share} %)`, distant: (p) => `distant / full body (${p.share} %)` },
  distance: {
    armLength: (p) => `about ${p.cm} cm (${p.low}–${p.high}), arm's length: nose appears ≈ ${p.inflation} % wider`,
    close: (p) => `about ${p.cm} cm (${p.low}–${p.high}): noticeable perspective (≈ ${p.inflation} %)`,
    portraitDistance: (p) => `about ${p.cm} cm (${p.low}–${p.high}): little perspective (≈ ${p.inflation} %)`,
    far: (p) => `about ${p.cm} cm (${p.low}–${p.high}): negligible perspective`,
    unknown: (p) => (p.reason === "noFocalLength" ? "unknown (no focal length in the file's EXIF data)" : "unknown (iris not measurable)"),
  },
  selfie: { likely: () => "likely (arm's-length distance)", unlikely: () => "unlikely (distance beyond arm's length)", possible: () => "possible (close-up framing; distance unknown)", unknown: () => "unknown" },
  mirror: { unknown: () => "not determinable from the face alone (no phone/mirror detection)" },
  photographer: { unknown: () => "not determinable from one photo" },
  setting: { studioLike: (p) => `studio-like (plain backdrop, even light; spread ${p.spread})`, plainBackdrop: (p) => `plain backdrop (spread ${p.spread})`, natural: (p) => `everyday surroundings (spread ${p.spread})`, unknown: () => "unknown" },
  editing: { editorTag: (p) => `saved by editing software: ${p.software}`, softwareTag: (p) => `software tag: ${p.software}`, noTag: () => "no software tag in the file (not proof of an unedited photo)" },
  smoothing: { suspected: (p) => `possible (texture ${p.texture}; heuristic, not validated)`, notSuspected: (p) => `not noticeable (texture ${p.texture}; heuristic)` },
  compression: { visible: (p) => `visible block artefacts (ratio ${p.ratio})`, fine: (p) => `no visible blocking (ratio ${p.ratio})`, unknown: () => "not measurable (image was resized or is not a JPEG)" },
  exposure: { ok: (p) => `fine (dark ${p.dark} %, bright ${p.bright} %)`, overexposed: (p) => `overexposed areas (${p.bright} % clipped white)`, underexposed: (p) => `underexposed areas (${p.dark} % clipped black)` },
  lighting: { even: (p) => `even (asymmetry ${p.asym} %)`, sided: (p) => `side lighting (asymmetry ${p.asym} %)`, stronglySided: (p) => `strong side lighting (asymmetry ${p.asym} %): shadow-side contours less reliable` },
  occlusion: { eyesClosed: () => "eyes closed", foreheadUnclear: () => "forehead/hairline not visible (hair, hat or image border)", noneDetected: () => "none detected (hands, glasses or objects are not checked)" },
};

const DE: Record<CaptureItemId, Values> = {
  view: { frontal: (p) => `frontal (Gieren ${p.yaw}°)`, slightlyTurned: (p) => `leicht gedreht (Gieren ${p.yaw}°)`, turned: (p) => `gedreht (Gieren ${p.yaw}°)`, threeQuarter: (p) => `Dreiviertelansicht (Gieren ${p.yaw}°)`, profile: (p) => `Profil (Gieren ${p.yaw}°)` },
  tilt: { upright: (p) => `aufrecht (${p.roll}°)`, slight: (p) => `leicht geneigt (${p.roll}°)`, tilted: (p) => `geneigt (${p.roll}°), korrigiert`, rotated: (p) => `stark gedreht (${p.roll}°), korrigiert` },
  elevation: { level: (p) => `waagerecht (Nicken ${p.pitch}°)`, chinUp: (p) => `Kinn angehoben oder Kamera tiefer (Nicken ${p.pitch}°) – beides ist nicht unterscheidbar`, chinDown: (p) => `Kinn gesenkt oder Kamera höher (Nicken ${p.pitch}°) – beides ist nicht unterscheidbar` },
  framing: { closeUp: (p) => `Nahaufnahme (Gesicht ${p.share} % der Bildhöhe)`, portrait: (p) => `Kopf-Schulter-Porträt (${p.share} %)`, upperBody: (p) => `Oberkörper (${p.share} %)`, distant: (p) => `entfernt / Ganzkörper (${p.share} %)` },
  distance: {
    armLength: (p) => `etwa ${p.cm} cm (${p.low}–${p.high}), Armlänge: Nase wirkt ≈ ${p.inflation} % breiter`,
    close: (p) => `etwa ${p.cm} cm (${p.low}–${p.high}): merkliche Perspektive (≈ ${p.inflation} %)`,
    portraitDistance: (p) => `etwa ${p.cm} cm (${p.low}–${p.high}): geringe Perspektive (≈ ${p.inflation} %)`,
    far: (p) => `etwa ${p.cm} cm (${p.low}–${p.high}): vernachlässigbare Perspektive`,
    unknown: (p) => (p.reason === "noFocalLength" ? "unbekannt (keine Brennweite in den EXIF-Daten)" : "unbekannt (Iris nicht messbar)"),
  },
  selfie: { likely: () => "wahrscheinlich (Abstand auf Armlänge)", unlikely: () => "unwahrscheinlich (Abstand größer als Armlänge)", possible: () => "möglich (Nahaufnahme; Abstand unbekannt)", unknown: () => "unbekannt" },
  mirror: { unknown: () => "aus dem Gesicht allein nicht bestimmbar (keine Handy-/Spiegelerkennung)" },
  photographer: { unknown: () => "aus einem Foto nicht bestimmbar" },
  setting: { studioLike: (p) => `studioähnlich (ruhiger Hintergrund, gleichmäßiges Licht; Streuung ${p.spread})`, plainBackdrop: (p) => `ruhiger Hintergrund (Streuung ${p.spread})`, natural: (p) => `Alltagsumgebung (Streuung ${p.spread})`, unknown: () => "unbekannt" },
  editing: { editorTag: (p) => `von Bearbeitungssoftware gespeichert: ${p.software}`, softwareTag: (p) => `Software-Eintrag: ${p.software}`, noTag: () => "kein Software-Eintrag in der Datei (kein Beweis für ein unbearbeitetes Foto)" },
  smoothing: { suspected: (p) => `möglich (Textur ${p.texture}; Heuristik, nicht validiert)`, notSuspected: (p) => `nicht auffällig (Textur ${p.texture}; Heuristik)` },
  compression: { visible: (p) => `sichtbare Blockartefakte (Verhältnis ${p.ratio})`, fine: (p) => `keine sichtbaren Blöcke (Verhältnis ${p.ratio})`, unknown: () => "nicht messbar (Bild verkleinert oder kein JPEG)" },
  exposure: { ok: (p) => `in Ordnung (dunkel ${p.dark} %, hell ${p.bright} %)`, overexposed: (p) => `überbelichtete Bereiche (${p.bright} % ausgefressen)`, underexposed: (p) => `unterbelichtete Bereiche (${p.dark} % abgesoffen)` },
  lighting: { even: (p) => `gleichmäßig (Asymmetrie ${p.asym} %)`, sided: (p) => `Seitenlicht (Asymmetrie ${p.asym} %)`, stronglySided: (p) => `starkes Seitenlicht (Asymmetrie ${p.asym} %): Konturen auf der Schattenseite weniger zuverlässig` },
  occlusion: { eyesClosed: () => "Augen geschlossen", foreheadUnclear: () => "Stirn/Haaransatz nicht sichtbar (Haare, Mütze oder Bildrand)", noneDetected: () => "nichts erkannt (Hände, Brillen oder Gegenstände werden nicht geprüft)" },
};

export function captureText(item: CaptureItem, lang: Lang): string {
  const table = lang === "de" ? DE : EN;
  const fn = table[item.id]?.[item.value];
  return fn ? fn(item.params ?? {}) : item.value;
}
