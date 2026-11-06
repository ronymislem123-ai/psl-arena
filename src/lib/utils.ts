import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmt = {
  score: (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(digits)),
  pct: (v: number | null | undefined, digits = 0) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(digits)} %`),
  date: (iso: string, locale = "en") => {
    try {
      return new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
    } catch {
      return iso;
    }
  },
  signed: (v: number, digits = 0) => `${v > 0 ? "+" : ""}${v.toFixed(digits)}`,
};

export function scoreTone(v: number | null | undefined): "mint" | "cyan" | "accent" | "amber" | "rose" | "muted" {
  if (v == null) return "muted";
  if (v >= 85) return "mint";
  if (v >= 70) return "cyan";
  if (v >= 55) return "accent";
  if (v >= 40) return "amber";
  return "rose";
}

export function scoreLabel(v: number | null | undefined, t: (k: string) => string): string {
  if (v == null) return t("score.na");
  if (v >= 85) return t("score.exceptional");
  if (v >= 70) return t("score.high");
  if (v >= 55) return t("score.balanced");
  if (v >= 40) return t("score.mixed");
  return t("score.outside");
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
