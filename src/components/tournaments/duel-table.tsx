"use client";
import { FaceThumb } from "@/components/shared/face-thumb";
import { formatPsl } from "@/engine/psl/rating";
import { CRITERIA } from "@/engine/psl/rubric";
import type { ParticipantCategoryScore, ParticipantData, TournamentConfig } from "@/engine/tournament/types";
import { useT } from "@/lib/i18n";
import { categoryName, criterionName } from "@/lib/i18n/psl-texts";
import { cn } from "@/lib/utils";

export function DuelTable({ a, b, config, scores, weighted }: { a: ParticipantData; b: ParticipantData; config: TournamentConfig; scores: ParticipantCategoryScore[]; weighted: Map<string, { score: number | null }> }) {
  const { t, lang } = useT();
  const cell = (va: number | null, vb: number | null, side: "a" | "b") => {
    const v = side === "a" ? va : vb;
    const better = va != null && vb != null && Math.abs(va - vb) > config.tieEpsilon && (side === "a" ? va > vb : vb > va);
    return <td className={cn("py-1.5 text-right font-mono num", better ? "text-mint font-semibold" : "text-fg-1")}>{formatPsl(v)}</td>;
  };
  const delta = (va: number | null, vb: number | null) => <td className="py-1.5 text-right font-mono text-xs text-fg-3">{va != null && vb != null ? (vb - va > 0 ? "+" : "") + (vb - va).toFixed(2) : "—"}</td>;
  const catScore = (pid: string, cid: string) => scores.find((s) => s.participantId === pid && s.categoryId === cid)?.score ?? null;
  return (
    <div className="space-y-4" data-testid="duel-table">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
        <div className="flex items-center gap-3"><FaceThumb imageId={a.imageId} label={a.name} size={56} /><div><div className="font-display font-semibold">{a.name}</div><div className="font-mono text-sm text-fg-2">{formatPsl(weighted.get(a.id)?.score ?? null)}</div></div></div>
        <div className="font-display text-2xl font-bold text-fg-3">{t("tournaments.vs")}</div>
        <div className="flex items-center gap-3 justify-end text-right"><div><div className="font-display font-semibold">{b.name}</div><div className="font-mono text-sm text-fg-2">{formatPsl(weighted.get(b.id)?.score ?? null)}</div></div><FaceThumb imageId={b.imageId} label={b.name} size={56} /></div>
      </div>
      <div className="-mx-1 overflow-x-auto px-1"><table className="w-full text-sm">
        <thead className="text-fg-3 uppercase tracking-wider text-[10px]"><tr><th className="text-left py-2">{t("tournaments.categoryScores")}</th><th className="text-right py-2">A</th><th className="text-right py-2">B</th><th className="text-right py-2">{t("tournaments.difference")}</th></tr></thead>
        <tbody>
          {config.categories.map((c) => {
            const va = catScore(a.id, c.id);
            const vb = catScore(b.id, c.id);
            return <tr key={c.id} className="border-t border-line"><td className="py-1.5">{categoryName(c.id, c.name, lang)}</td>{cell(va, vb, "a")}{cell(va, vb, "b")}{delta(va, vb)}</tr>;
          })}
        </tbody>
      </table></div>
      <div className="-mx-1 overflow-x-auto px-1"><table className="w-full text-sm">
        <thead className="text-fg-3 uppercase tracking-wider text-[10px]"><tr><th className="text-left py-2">{t("tournaments.criterion")}</th><th className="text-right py-2">A</th><th className="text-right py-2">B</th><th className="text-right py-2">{t("tournaments.difference")}</th></tr></thead>
        <tbody>
          {CRITERIA.map((def) => {
            const ca = a.rating.criteria.find((c) => c.id === def.id);
            const cb = b.rating.criteria.find((c) => c.id === def.id);
            const va = ca?.assessable ? ca.score : null;
            const vb = cb?.assessable ? cb.score : null;
            if (va == null && vb == null) return null;
            return <tr key={def.id} className="border-t border-line"><td className="py-1.5">{criterionName(def.id, lang)}</td>{cell(va, vb, "a")}{cell(va, vb, "b")}{delta(va, vb)}</tr>;
          })}
        </tbody>
      </table></div>
    </div>
  );
}
