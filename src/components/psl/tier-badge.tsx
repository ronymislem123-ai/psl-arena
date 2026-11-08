"use client";
import { formatTierRange, type PslTier } from "@/engine/psl/scale";
import { cn } from "@/lib/utils";

type TierLike = Pick<PslTier, "id" | "name" | "min" | "max" | "color"> & Partial<Pick<PslTier, "short" | "group" | "percentile" | "description">>;

const trim = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? String(Math.round(v)) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));

/** Tiers whose lower bound gets a label: the first tier of every group, or every n-th tier when there are no groups. */
function labelTiers<T extends TierLike>(sorted: T[]): T[] {
  const starts = sorted.filter((t, i) => i === 0 || (t.group ?? t.name) !== (sorted[i - 1].group ?? sorted[i - 1].name));
  if (starts.length >= 2 && starts.length <= 12) return starts;
  const step = Math.max(1, Math.ceil(sorted.length / 8));
  return sorted.filter((_, i) => i % step === 0);
}

export function TierBadge({ tier, className, size = "md" }: { tier: TierLike | null | undefined; className?: string; size?: "sm" | "md" | "lg" }) {
  if (!tier) return <span className={cn("inline-flex items-center rounded-md border border-line px-2 py-0.5 text-xs text-fg-3", className)}>—</span>;
  const pad = size === "lg" ? "px-3 py-1.5 text-base" : size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-sm";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border font-medium", pad, className)} style={{ borderColor: `${tier.color}66`, background: `${tier.color}22`, color: tier.color }} title={`${tier.name} · ${formatTierRange(tier)}`}>
      <span className="h-2 w-2 rounded-full" style={{ background: tier.color }} />
      {tier.name}
    </span>
  );
}

/** Horizontal segmented bar of all tiers with an optional value marker. */
export function ScaleBar({ tiers, rangeMin, rangeMax, value, className, compact, labels = true }: { tiers: TierLike[]; rangeMin: number; rangeMax: number; value?: number | null; className?: string; compact?: boolean; labels?: boolean }) {
  const span = Math.max(1e-9, rangeMax - rangeMin);
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  const frac = (v: number) => (v - rangeMin) / span;
  const pct = (v: number) => `${frac(v) * 100}%`;
  const showMarker = value != null && Number.isFinite(value);
  const mv = showMarker ? Math.max(rangeMin, Math.min(rangeMax, value!)) : 0;
  // labels at the ends stay inside the bar's own box
  const align = (f: number) => (f < 0.04 ? "translate-x-0" : f > 0.96 ? "-translate-x-full" : "-translate-x-1/2");
  return (
    // the value marker's label is drawn above the bar: reserve that space inside this box
    <div className={cn("relative", showMarker && !compact && "pt-6", showMarker && compact && "pt-5", className)} data-testid="scale-bar">
      <div className={cn("flex w-full overflow-hidden rounded-lg border border-line", compact ? "h-3" : "h-6")}>
        {sorted.map((t) => (
          <div key={t.id} className="h-full border-r border-black/30 last:border-r-0" style={{ width: `${((t.max - t.min) / span) * 100}%`, background: t.color }} title={`${t.name} ${formatTierRange(t)}`} />
        ))}
      </div>
      {showMarker && (
        <div className={cn("absolute w-0.5 bg-white shadow-[0_0_0_2px_#07080a]", compact ? "top-[0.875rem] h-6" : "top-[1.125rem] h-9")} style={{ left: pct(mv) }} data-testid="scale-marker">
          <div className={cn("absolute whitespace-nowrap", compact ? "-top-[0.875rem]" : "-top-[1.125rem]", " rounded bg-white px-1 font-mono text-[10px] leading-4 text-black", frac(mv) < 0.04 ? "left-0" : frac(mv) > 0.96 ? "right-0" : "left-1/2 -translate-x-1/2")}>{value!.toFixed(2)}</div>
        </div>
      )}
      {labels && !compact && (
        <div className="relative mt-1 h-4 font-mono text-[10px] text-fg-3">
          {labelTiers(sorted).map((t) => (
            <span key={t.id} className={cn("absolute", align(frac(t.min)))} style={{ left: pct(t.min) }}>{trim(t.min)}</span>
          ))}
          <span className="absolute -translate-x-full" style={{ left: "100%" }}>{trim(rangeMax)}</span>
        </div>
      )}
    </div>
  );
}
