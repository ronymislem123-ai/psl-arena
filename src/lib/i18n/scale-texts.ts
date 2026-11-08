/**
 * German display texts of the built-in "PSL Standard" scale. The stored scale data
 * (and every snapshot taken from it) stays unchanged; only the exact built-in
 * English texts are shown translated. User-written texts pass through as they are.
 */
import type { Lang } from "./index";

const DE: Record<string, string> = {
  "Pre-configured community scale (0–10): sub1–sub4, Low/Mid/High Tier Normie, Chadlite, Chad, Adam tier. A configurable community convention, not a validated attractiveness scale.":
    "Vorkonfigurierte Community-Skala (0–10): sub1–sub4, Low/Mid/High Tier Normie, Chadlite, Chad, Adam-Tier. Eine konfigurierbare Community-Konvention, keine validierte Attraktivitätsskala.",
  "Lowest band of the community scale.": "Unterstes Band der Community-Skala.",
  "Second band of the lowest tiers.": "Zweites Band der untersten Tiers.",
  "Third band of the lowest tiers.": "Drittes Band der untersten Tiers.",
  "Upper band of the lowest tiers.": "Oberes Band der untersten Tiers.",
  "Lower low-tier normie.": "Unterer Low-Tier-Normie.",
  "Mid low-tier normie.": "Mittlerer Low-Tier-Normie.",
  "Upper low-tier normie.": "Oberer Low-Tier-Normie.",
  "Lower mid-tier normie.": "Unterer Mid-Tier-Normie.",
  "Mid mid-tier normie — the centre of the scale.": "Mittlerer Mid-Tier-Normie – die Mitte der Skala.",
  "Upper mid-tier normie.": "Oberer Mid-Tier-Normie.",
  "Lower high-tier normie.": "Unterer High-Tier-Normie.",
  "Mid high-tier normie.": "Mittlerer High-Tier-Normie.",
  "Upper high-tier normie.": "Oberer High-Tier-Normie.",
  "Entry band of the Chadlite group: very pronounced visual facial features within the chosen community rating system.":
    "Einstiegsband der Chadlite-Gruppe: sehr ausgeprägte visuelle Gesichtsmerkmale innerhalb des gewählten Community-Bewertungssystems.",
  "Mid Chadlite.": "Mittlerer Chadlite.",
  "Upper Chadlite.": "Oberer Chadlite.",
  "Entry band of the Chad group.": "Einstiegsband der Chad-Gruppe.",
  "Mid Chad.": "Mittlerer Chad.",
  "Upper Chad.": "Oberer Chad.",
  "Entry band of the Adam tier.": "Einstiegsband des Adam-Tiers.",
  "Top of the scale.": "Spitze der Skala.",
};

/** Built-in scale text in the UI language; any other text unchanged. */
export function scaleText(text: string | null | undefined, lang: Lang): string {
  if (!text) return "";
  return lang === "de" ? (DE[text] ?? text) : text;
}
