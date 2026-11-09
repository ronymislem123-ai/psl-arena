/**
 * Interpretation bands of the 0–10 scale (rubric 3.0, front profile). The band
 * follows the value as displayed (one decimal), so a shown "3.0" is never labelled
 * as the band below: 0–2.9 very weak, 3.0–4.9 below average, 5.0–6.9 average,
 * 7.0–8.9 above average, 9.0–10 exceptional. A description against the rubric's own
 * criteria — not a medical or anthropometric norm.
 */
export type PslBand = "veryWeak" | "belowAverage" | "average" | "aboveAverage" | "exceptional";

export const PSL_BANDS: { id: PslBand; min: number; max: number }[] = [
  { id: "veryWeak", min: 0, max: 3 },
  { id: "belowAverage", min: 3, max: 5 },
  { id: "average", min: 5, max: 7 },
  { id: "aboveAverage", min: 7, max: 9 },
  { id: "exceptional", min: 9, max: 10 },
];

export function pslBand(score: number | null | undefined): PslBand | null {
  if (score == null || !Number.isFinite(score)) return null;
  const v = Math.round(score * 10) / 10;
  return v < 3 ? "veryWeak" : v < 5 ? "belowAverage" : v < 7 ? "average" : v < 9 ? "aboveAverage" : "exceptional";
}
