"use client";
import { scaleText } from "@/lib/i18n/scale-texts";
import { ImageOff } from "lucide-react";
import { ScaleBar, TierBadge } from "@/components/psl/tier-badge";
import { formatTierRange, tierGroups, type PslScale, type PslTier } from "@/engine/psl/scale";
import { imageUrl } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type ScaleView = "list" | "horizontal" | "table" | "cards" | "images";
export const SCALE_VIEWS: ScaleView[] = ["list", "horizontal", "table", "cards", "images"];

type ScaleLike = Pick<PslScale, "rangeMin" | "rangeMax"> & { tiers: PslTier[] };

function TierImages({ tier, size = 56 }: { tier: PslTier; size?: number }) {
  if (!tier.images.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tier.images.map((img) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={img.imageId} src={imageUrl(img.imageId) ?? ""} alt={img.caption || tier.name} title={img.caption} className="rounded-md border border-line object-cover" style={{ width: size, height: size }} />
      ))}
    </div>
  );
}

export function ScaleViews({ scale, view, value }: { scale: ScaleLike; view: ScaleView; value?: number | null }) {
  const { t, lang } = useT();
  const sorted = [...scale.tiers].sort((a, b) => a.order - b.order);
  const desc = [...sorted].reverse();
  const groups = tierGroups(sorted);

  if (view === "horizontal") {
    return (
      <div className="space-y-4" data-testid="scale-view-horizontal">
        <ScaleBar tiers={sorted} rangeMin={scale.rangeMin} rangeMax={scale.rangeMax} value={value} />
        <div className="flex w-full">
          {groups.map((g) => (
            <div key={g.group} className="min-w-0 border-l border-line px-1 text-center" style={{ width: `${((g.max - g.min) / (scale.rangeMax - scale.rangeMin)) * 100}%` }}>
              <div className="truncate text-[11px] font-medium text-fg-1">{g.group}</div>
              <div className="font-mono text-[10px] text-fg-3">{formatTierRange({ min: g.min, max: g.max })}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sorted.map((tier) => (
            <TierBadge key={tier.id} tier={tier} size="sm" />
          ))}
        </div>
      </div>
    );
  }
  if (view === "table") {
    return (
      <div className="overflow-x-auto" data-testid="scale-view-table">
        <table className="w-full text-sm">
          <thead className="text-fg-3 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="text-left py-2">{t("scales.tierName")}</th>
              <th className="text-left py-2">{t("scales.short")}</th>
              <th className="text-left py-2">{t("scales.group")}</th>
              <th className="text-right py-2">{t("scales.min")}</th>
              <th className="text-right py-2">{t("scales.max")}</th>
              <th className="text-left py-2 pl-3">{t("scales.percentile")}</th>
              <th className="text-left py-2 pl-3">{t("scales.tierDescription")}</th>
              <th className="text-right py-2">{t("scales.images")}</th>
            </tr>
          </thead>
          <tbody>
            {desc.map((tier) => (
              <tr key={tier.id} className="border-t border-line">
                <td className="py-2"><TierBadge tier={tier} size="sm" /></td>
                <td className="py-2 font-mono text-xs text-fg-2">{tier.short}</td>
                <td className="py-2 text-xs text-fg-2">{tier.group ?? "—"}</td>
                <td className="py-2 text-right font-mono num">{tier.min}</td>
                <td className="py-2 text-right font-mono num">{tier.max}</td>
                <td className="py-2 pl-3 text-xs text-fg-2">{tier.percentile ?? "—"}</td>
                <td className="py-2 pl-3 text-xs text-fg-2 max-w-xs truncate" title={scaleText(tier.description, lang)}>{scaleText(tier.description, lang) || "—"}</td>
                <td className="py-2 text-right font-mono text-xs">{tier.images.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (view === "cards") {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="scale-view-cards">
        {desc.map((tier) => (
          <div key={tier.id} className="glass rounded-xl overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between" style={{ background: `${tier.color}33`, borderBottom: `1px solid ${tier.color}66` }}>
              <span className="font-display font-semibold" style={{ color: tier.color }}>{tier.name}</span>
              <span className="font-mono text-xs text-fg-1">{formatTierRange(tier)}</span>
            </div>
            <div className="p-3 space-y-2">
              {tier.group && <div className="text-[11px] uppercase tracking-wider text-fg-3">{tier.group}</div>}
              {tier.percentile && <div className="text-xs text-fg-2">{tier.percentile}</div>}
              <p className="text-xs text-fg-1 min-h-[2rem]">{scaleText(tier.description, lang) || "—"}</p>
              <TierImages tier={tier} />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (view === "images") {
    return (
      <div className="space-y-3" data-testid="scale-view-images">
        {desc.map((tier) => (
          <div key={tier.id} className="flex gap-3 items-start">
            <div className="w-36 shrink-0 pt-1">
              <TierBadge tier={tier} size="sm" />
              <div className="font-mono text-[10px] text-fg-3 mt-1">{formatTierRange(tier)}</div>
            </div>
            <div className="min-w-0 flex-1 rounded-xl border border-dashed border-line p-2 min-h-[64px]">
              {tier.images.length ? <TierImages tier={tier} size={88} /> : <div className="flex items-center gap-2 text-xs text-fg-3 h-full"><ImageOff size={14} /> —</div>}
            </div>
          </div>
        ))}
      </div>
    );
  }
  // vertical ranking
  return (
    <div className="space-y-1.5" data-testid="scale-view-list">
      {desc.map((tier, i) => {
        const active = value != null && value >= tier.min && (value < tier.max || (i === 0 && value <= tier.max));
        return (
          <div key={tier.id} className={cn("flex items-start gap-3 rounded-xl border px-3 py-2", active ? "border-white/40 bg-white/5" : "border-line bg-bg-1/40")}>
            <div className="w-1.5 self-stretch rounded-full" style={{ background: tier.color }} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium" style={{ color: tier.color }}>{tier.name}</span>
                <span className="font-mono text-xs text-fg-2">{formatTierRange(tier)}</span>
                {tier.group && <span className="text-[10px] uppercase tracking-wider text-fg-3">{tier.group}</span>}
                {tier.percentile && <span className="text-[11px] text-fg-3">· {tier.percentile}</span>}
                {active && <span className="ml-auto font-mono text-[10px] text-white">◀ {value!.toFixed(2)}</span>}
              </div>
              {tier.description && <p className="text-xs text-fg-2 mt-0.5">{scaleText(tier.description, lang)}</p>}
              <div className="mt-1"><TierImages tier={tier} size={40} /></div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
