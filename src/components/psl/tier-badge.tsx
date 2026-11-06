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
  const pct = (v: number) => `${((v - rangeMin) / span) * 100}%`;
  return (
    <div className={cn("relative", className)} data-testid="scale-bar">
      <div className={cn("flex w-full overflow-hidden rounded-lg border border-line", compact ? "h-3" : "h-6")}>
        {sorted.map((t) => (
          <div key={t.id} className="h-full border-r border-black/30 last:border-r-0" style={{ width: `${((t.max - t.min) / span) * 100}%`, background: t.color }} title={`${t.name} ${formatTierRange(t)}`} />
        ))}
      </div>
      {value != null && Number.isFinite(value) && (
        <div className="absolute -top-1.5 h-[calc(100%+12px)] w-0.5 bg-white shadow-[0_0_0_2px_#07080a]" style={{ left: pct(Math.max(rangeMin, Math.min(rangeMax, value))) }} data-testid="scale-marker">
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-white px-1 font-mono text-[10px] text-black">{value.toFixed(2)}</div>
        </div>
      )}
      {labels && !compact && (
        <div className="relative mt-1 h-4 font-mono text-[10px] text-fg-3">
          {labelTiers(sorted).map((t) => (
            <span key={t.id} className="absolute -translate-x-1/2" style={{ left: pct(t.min) }}>{trim(t.min)}</span>
          ))}
          <span className="absolute -translate-x-1/2" style={{ left: "100%" }}>{trim(rangeMax)}</span>
        </div>
      )}
    </div>
  );
}
