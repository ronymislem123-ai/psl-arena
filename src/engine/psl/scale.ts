/**
 * PSL scales: configurable tier ladders that map a 0–10 rating to a named tier.
 *
 * Assignment rules (see docs/SCALES.md):
 * - the lower bound belongs to the tier, the upper bound to the following tier;
 * - only the highest bound of the whole scale is inclusive;
 * - assignment uses the UNROUNDED value, display rounding never changes the tier;
 * - an active scale must cover its whole range without gaps or overlaps.
 *
 * The built-in standard scale is a configurable community convention, not a
 * validated attractiveness scale.
 */

export interface PslTierImage {
  /** id in the encrypted image store (owner-scoped) */
  imageId: string;
  caption: string;
}

export interface PslTier {
  id: string;
  name: string;
  short: string;
  /** optional parent group label (e.g. "Chad" for "Mid Chad") */
  group: string | null;
  min: number;
  max: number;
  order: number;
  description: string;
  color: string;
  /** free text such as "top 1 %" — a claim of the scale's author, never computed */
  percentile: string | null;
  images: PslTierImage[];
  notes: string;
}

export interface PslScale {
  id: string;
  name: string;
  description: string;
  rangeMin: number;
  rangeMax: number;
  tiers: PslTier[];
  version: number;
  builtIn: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Immutable copy stored with every rating/tournament so later edits never change finished results. */
export interface PslScaleSnapshot {
  scaleId: string;
  name: string;
  version: number;
  rangeMin: number;
  rangeMax: number;
  tiers: Omit<PslTier, "images" | "notes">[];
  snapshotAt: string;
}

export const SCALE_EPSILON = 1e-6;
export const BUILTIN_SCALE_ID = "scale_builtin_psl_standard";

/** Rounds to 6 decimals so equal boundaries compare equal after arithmetic. */
export const roundBound = (v: number) => Math.round(v * 1e6) / 1e6;

export const TIER_PALETTE = ["#6b7280", "#7c8798", "#8b95a7", "#9aa3b5", "#60a5fa", "#4f7cff", "#3b6cf2", "#22d3ee", "#19b8d2", "#12a0b8", "#34d399", "#2bbf86", "#22a874", "#f5b547", "#f0a83c", "#eb9a2f", "#f0506e", "#e4405f", "#d63053", "#a78bfa", "#8b5cf6", "#7c3aed"];

interface TierSpec {
  id: string;
  name: string;
  short: string;
  group: string | null;
  min: number;
  max: number;
  description: string;
  color: string;
  percentile: string | null;
}

function evenSplit(group: string, groupMin: number, groupMax: number, parts: { id: string; name: string; short: string; description: string; color: string; percentile?: string }[]): TierSpec[] {
  const n = parts.length;
  return parts.map((p, i) => ({
    id: p.id, name: p.name, short: p.short, group,
    min: roundBound(groupMin + ((groupMax - groupMin) * i) / n),
    max: roundBound(groupMin + ((groupMax - groupMin) * (i + 1)) / n),
    description: p.description, color: p.color, percentile: p.percentile ?? null,
  }));
}

/** The pre-configured standard PSL scale (0.0–10.0, 7 main groups, 22 tiers). */
export function buildStandardScale(now = "2025-11-06T00:00:00.000Z"): PslScale {
  const specs: TierSpec[] = [
    ...evenSplit("Lowest Tiers", 0, 4, [
      { id: "sub1", name: "sub1", short: "sub1", description: "Lowest band of the community scale.", color: "#4b5160" },
      { id: "sub2", name: "sub2", short: "sub2", description: "Second band of the lowest tiers.", color: "#5a6070" },
      { id: "sub3", name: "sub3", short: "sub3", description: "Third band of the lowest tiers.", color: "#6b7280" },
      { id: "sub4", name: "sub4", short: "sub4", description: "Upper band of the lowest tiers.", color: "#7c8798" },
    ]),
    ...evenSplit("Low Tier Normie", 4, 5, [
      { id: "lltn", name: "Low LTN", short: "lltn", description: "Lower low-tier normie.", color: "#8fa0c4" },
      { id: "mltn", name: "Mid LTN", short: "mltn", description: "Mid low-tier normie.", color: "#7f93c0" },
      { id: "hltn", name: "High LTN", short: "hltn", description: "Upper low-tier normie.", color: "#6f86bd" },
    ]),
    ...evenSplit("Mid Tier Normie", 5, 6, [
      { id: "lmtn", name: "Low MTN", short: "lmtn", description: "Lower mid-tier normie.", color: "#5f8fff" },
      { id: "mmtn", name: "Mid MTN", short: "mmtn", description: "Mid mid-tier normie — the centre of the scale.", color: "#4f7cff" },
      { id: "hmtn", name: "High MTN", short: "hmtn", description: "Upper mid-tier normie.", color: "#3f6cf0" },
    ]),
    ...evenSplit("High Tier Normie", 6, 7, [
      { id: "lhtn", name: "Low HTN", short: "lhtn", description: "Lower high-tier normie.", color: "#39c9e0" },
      { id: "mhtn", name: "Mid HTN", short: "mhtn", description: "Mid high-tier normie.", color: "#22d3ee" },
      { id: "hhtn", name: "High HTN", short: "hhtn", description: "Upper high-tier normie.", color: "#17b9d3" },
    ]),
    ...evenSplit("Chadlite", 7, 8, [
      { id: "chadlite_low", name: "Lower Chadlite", short: "lcl", description: "Entry band of the Chadlite group: very pronounced visual facial features within the chosen community rating system.", color: "#4fd9a5" },
      { id: "chadlite_mid", name: "Mid Chadlite", short: "mcl", description: "Mid Chadlite.", color: "#34d399" },
      { id: "chadlite_high", name: "Higher Chadlite", short: "hcl", description: "Upper Chadlite.", color: "#22b985" },
    ]),
    ...evenSplit("Chad", 8, 9, [
      { id: "chad_low", name: "Low Chad", short: "lchad", description: "Entry band of the Chad group.", color: "#f7c25f" },
      { id: "chad_mid", name: "Mid Chad", short: "mchad", description: "Mid Chad.", color: "#f5b547" },
      { id: "chad_high", name: "High Chad", short: "hchad", description: "Upper Chad.", color: "#e9a12e" },
    ]),
    { id: "adamlite", name: "Adamlite", short: "adamlite", group: "Adam Tier", min: 9, max: 9.5, description: "Entry band of the Adam tier.", color: "#b794ff", percentile: null },
    { id: "adam", name: "Adam", short: "adam", group: "Adam Tier", min: 9.5, max: 10, description: "Top of the scale.", color: "#8b5cf6", percentile: null },
  ];
  return {
    id: BUILTIN_SCALE_ID,
    name: "PSL Standard",
    description: "Pre-configured community scale (0–10): sub1–sub4, Low/Mid/High Tier Normie, Chadlite, Chad, Adam tier. A configurable community convention, not a validated attractiveness scale.",
    rangeMin: 0,
    rangeMax: 10,
    tiers: specs.map((s, i) => ({ ...s, order: i, images: [], notes: "" })),
    version: 1,
    builtIn: true,
    createdAt: now,
    updatedAt: now,
  };
}

export type ScaleIssueCode = "emptyName" | "invalidRange" | "noTiers" | "duplicateId" | "tierEmptyName" | "invalidBounds" | "overlap" | "gap" | "outsideRange" | "orderMismatch" | "badColor" | "imageInvalid";

export interface ScaleIssue {
  code: ScaleIssueCode;
  tierId?: string;
  /** English fallback; the UI renders the code */
  message: string;
  params?: Record<string, string | number>;
}

const COLOR_RE = /^#[0-9a-fA-F]{6}$/;

/** Validates structure, bounds, coverage and ordering. Returns every problem found. */
export function validateScale(scale: Pick<PslScale, "name" | "rangeMin" | "rangeMax" | "tiers">): ScaleIssue[] {
  const issues: ScaleIssue[] = [];
  if (!scale.name || !scale.name.trim()) issues.push({ code: "emptyName", message: "The scale needs a name." });
  if (!Number.isFinite(scale.rangeMin) || !Number.isFinite(scale.rangeMax) || scale.rangeMax - scale.rangeMin < SCALE_EPSILON) {
    issues.push({ code: "invalidRange", message: "The value range must have a positive width." });
  }
  if (scale.tiers.length === 0) {
    issues.push({ code: "noTiers", message: "A scale needs at least one tier." });
    return issues;
  }
  const seen = new Set<string>();
  for (const t of scale.tiers) {
    if (seen.has(t.id)) issues.push({ code: "duplicateId", tierId: t.id, message: `Duplicate tier id "${t.id}".`, params: { id: t.id } });
    seen.add(t.id);
    if (!t.name || !t.name.trim()) issues.push({ code: "tierEmptyName", tierId: t.id, message: "Every tier needs a name." });
    if (!Number.isFinite(t.min) || !Number.isFinite(t.max) || t.max - t.min < SCALE_EPSILON) issues.push({ code: "invalidBounds", tierId: t.id, message: `Tier "${t.name}" needs min < max.`, params: { name: t.name } });
    if (t.color && !COLOR_RE.test(t.color)) issues.push({ code: "badColor", tierId: t.id, message: `Tier "${t.name}" has an invalid colour.`, params: { name: t.name } });
    for (const img of t.images ?? []) if (!img.imageId || !/^img_[a-z0-9]+$/.test(img.imageId)) issues.push({ code: "imageInvalid", tierId: t.id, message: `Tier "${t.name}" references an invalid image.`, params: { name: t.name } });
  }
  const sorted = [...scale.tiers].sort((a, b) => a.min - b.min || a.max - b.max);
  const byOrder = [...scale.tiers].sort((a, b) => a.order - b.order);
  if (sorted.some((t, i) => t.id !== byOrder[i].id)) issues.push({ code: "orderMismatch", message: "The tier order must follow the value ranges (lowest first)." });
  if (issues.some((i) => i.code === "invalidBounds" || i.code === "invalidRange")) return issues;
  if (Math.abs(sorted[0].min - scale.rangeMin) > SCALE_EPSILON) issues.push({ code: "gap", tierId: sorted[0].id, message: `The scale starts at ${scale.rangeMin} but the first tier at ${sorted[0].min}.`, params: { from: scale.rangeMin, to: sorted[0].min } });
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.min < prev.max - SCALE_EPSILON) issues.push({ code: "overlap", tierId: cur.id, message: `Tiers "${prev.name}" and "${cur.name}" overlap.`, params: { a: prev.name, b: cur.name } });
    else if (cur.min > prev.max + SCALE_EPSILON) issues.push({ code: "gap", tierId: cur.id, message: `Gap between "${prev.name}" (${prev.max}) and "${cur.name}" (${cur.min}).`, params: { a: prev.name, b: cur.name, from: prev.max, to: cur.min } });
  }
  const last = sorted[sorted.length - 1];
  if (Math.abs(last.max - scale.rangeMax) > SCALE_EPSILON) issues.push({ code: "gap", tierId: last.id, message: `The last tier ends at ${last.max} but the scale at ${scale.rangeMax}.`, params: { from: last.max, to: scale.rangeMax } });
  for (const t of scale.tiers) if (t.min < scale.rangeMin - SCALE_EPSILON || t.max > scale.rangeMax + SCALE_EPSILON) issues.push({ code: "outsideRange", tierId: t.id, message: `Tier "${t.name}" lies outside the scale range.`, params: { name: t.name } });
  return issues;
}

export function isScaleValid(scale: Pick<PslScale, "name" | "rangeMin" | "rangeMax" | "tiers">): boolean {
  return validateScale(scale).length === 0;
}

/**
 * Tier for an UNROUNDED value: lower bound inclusive, upper bound exclusive,
 * except the top bound of the scale which is inclusive. null outside the range.
 */
export function assignTier<T extends Pick<PslTier, "min" | "max">>(scale: { rangeMin: number; rangeMax: number; tiers: T[] }, value: number): T | null {
  if (!Number.isFinite(value) || value < scale.rangeMin || value > scale.rangeMax) return null;
  const sorted = [...scale.tiers].sort((a, b) => a.min - b.min);
  const top = sorted[sorted.length - 1];
  // exact comparisons on the unrounded value: [min, max) for every tier, [min, max] for the top tier
  for (const t of sorted) if (value >= t.min && value < t.max) return t;
  if (top && value >= top.min && value <= top.max) return top;
  return null;
}

export function snapshotScale(scale: PslScale, now = new Date().toISOString()): PslScaleSnapshot {
  return {
    scaleId: scale.id, name: scale.name, version: scale.version, rangeMin: scale.rangeMin, rangeMax: scale.rangeMax,
    tiers: [...scale.tiers].sort((a, b) => a.order - b.order).map(({ id, name, short, group, min, max, order, description, color, percentile }) => ({ id, name, short, group, min, max, order, description, color, percentile })),
    snapshotAt: now,
  };
}

/** Main groups in order (for grouped displays). */
export function tierGroups<T extends Pick<PslTier, "group" | "order" | "min" | "max" | "name">>(tiers: T[]): { group: string; min: number; max: number; tiers: T[] }[] {
  const out: { group: string; min: number; max: number; tiers: T[] }[] = [];
  for (const t of [...tiers].sort((a, b) => a.order - b.order)) {
    const g = t.group ?? t.name;
    const last = out[out.length - 1];
    if (last && last.group === g) {
      last.tiers.push(t);
      last.max = Math.max(last.max, t.max);
    } else out.push({ group: g, min: t.min, max: t.max, tiers: [t] });
  }
  return out;
}

export const SCALE_EXPORT_FORMAT = "psl-arena-scale";
export const SCALE_EXPORT_VERSION = 1;

export interface ScaleExport {
  format: typeof SCALE_EXPORT_FORMAT;
  formatVersion: typeof SCALE_EXPORT_VERSION;
  exportedAt: string;
  scale: { name: string; description: string; rangeMin: number; rangeMax: number; version: number; tiers: Omit<PslTier, "images">[] };
}

/** Reference images are not exported (they stay in the owner's encrypted store). */
export function exportScale(scale: PslScale, now = new Date().toISOString()): ScaleExport {
  return {
    format: SCALE_EXPORT_FORMAT, formatVersion: SCALE_EXPORT_VERSION, exportedAt: now,
    scale: { name: scale.name, description: scale.description, rangeMin: scale.rangeMin, rangeMax: scale.rangeMax, version: scale.version, tiers: [...scale.tiers].sort((a, b) => a.order - b.order).map((t) => { const rest: Partial<PslTier> = { ...t }; delete rest.images; return rest as Omit<PslTier, "images">; }) },
  };
}

export function formatTierRange(t: Pick<PslTier, "min" | "max">, digits = 2): string {
  const f = (v: number) => {
    const s = v.toFixed(digits);
    return s.replace(/\.?0+$/, (m) => (m.startsWith(".") ? "" : m)).replace(/\.$/, "");
  };
  return `${f(t.min)}–${f(t.max)}`;
}

export function newTierId(existing: Pick<PslTier, "id">[]): string {
  const ids = new Set(existing.map((t) => t.id));
  let n = 1;
  while (ids.has(`tier_${n}`)) n++;
  return `tier_${n}`;
}
