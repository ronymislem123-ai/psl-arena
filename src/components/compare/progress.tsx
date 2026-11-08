"use client";
import Link from "next/link";
import { Award as AwardIcon, TrendingUp, Trophy } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Empty } from "@/components/ui/controls";
import { progressSeries, type CompareItem } from "@/engine/psl/compare";
import { computeAchievements } from "@/engine/tournament/achievements";
import { formatPsl } from "@/engine/psl/rating";
import { useT } from "@/lib/i18n";
import { categoryName, criterionName } from "@/lib/i18n/psl-texts";
import { cn, fmt } from "@/lib/utils";
import type { Award, RatingRecord } from "@/server/repos-psl";
import { paths } from "@/lib/paths";

const signed = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(2)}`);

export function RatingTimeline({ records }: { records: RatingRecord[] }) {
  const { t, lang } = useT();
  const items: CompareItem[] = records.map((r) => ({ id: r.id, label: r.profileLabel, createdAt: r.createdAt, result: r.result }));
  const s = progressSeries(items);
  const pts = s.points.filter((p) => p.score != null);
  const max = 10;
  return (
    <Card data-testid="rating-timeline">
      <CardHeader title={t("progress.title")} subtitle={t("progress.sub")} icon={<TrendingUp size={18} />} action={pts.length >= 2 ? <Link href={`/compare?ids=${s.points.slice(-4).map((p) => p.id).join(",")}`} className="text-xs text-fg-2 hover:text-fg-0">{t("compare.title")} →</Link> : undefined} />
      <CardBody className="space-y-4">
        {pts.length < 2 ? (
          <Empty>{t("progress.single")}</Empty>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              {[["first", s.first], ["latest", s.latest], ["best", s.best]].map(([k, v]) => (
                <div key={k as string} className="rounded-lg bg-white/3 p-2"><div className="text-[10px] uppercase tracking-wider text-fg-3">{t(`progress.${k}`)}</div><div className="font-display text-lg num">{formatPsl(v as number | null)}</div></div>
              ))}
              <div className="rounded-lg bg-white/3 p-2"><div className="text-[10px] uppercase tracking-wider text-fg-3">{t("progress.total")}</div><div className={cn("font-display text-lg num", s.totalDelta == null ? "text-fg-3" : s.totalDelta > 0 ? "text-mint" : s.totalDelta < 0 ? "text-[#ff8fa3]" : "")}>{signed(s.totalDelta)}</div></div>
              <div className="rounded-lg bg-white/3 p-2"><div className="text-[10px] uppercase tracking-wider text-fg-3">{t("progress.meanStep")}</div><div className="font-display text-lg num">{s.meanStep == null ? "—" : s.meanStep.toFixed(2)}</div></div>
            </div>
            <svg viewBox="0 0 320 90" className="w-full h-24" data-testid="progress-chart">
              {[0, 2.5, 5, 7.5, 10].map((v) => <line key={v} x1={28} x2={316} y1={80 - (v / max) * 72} y2={80 - (v / max) * 72} stroke="#ffffff14" />)}
              {[0, 5, 10].map((v) => <text key={v} x={24} y={83 - (v / max) * 72} fontSize={8} textAnchor="end" fill="#7a818f">{v}</text>)}
              <polyline fill="none" stroke="#22d3ee" strokeWidth={2} points={pts.map((p, i) => `${28 + (i / (pts.length - 1)) * 288},${80 - (p.score! / max) * 72}`).join(" ")} />
              {pts.map((p, i) => (
                <g key={p.id}>
                  <circle cx={28 + (i / (pts.length - 1)) * 288} cy={80 - (p.score! / max) * 72} r={3.5} fill={p.provisional ? "#f5b547" : "#22d3ee"} />
                  <text x={28 + (i / (pts.length - 1)) * 288} y={80 - (p.score! / max) * 72 - 7} fontSize={8} textAnchor="middle" fill="#eef0f3" fontFamily="ui-monospace, monospace">{formatPsl(p.score)}</text>
                </g>
              ))}
            </svg>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-fg-2 mb-1">{t("progress.steps")}</div>
              <ul className="divide-y divide-line text-sm">
                {s.steps.map((st) => {
                  const to = s.points.find((p) => p.id === st.toId)!;
                  return (
                    <li key={st.toId} className="py-1.5 flex flex-wrap items-center gap-2">
                      <Link href={paths.rating(st.toId)} className="hover:text-accent">{fmt.date(to.createdAt, lang)}</Link>
                      <span className="text-xs text-fg-3">{t("progress.days", { n: Math.round(st.days) })}</span>
                      <span className={cn("font-mono", st.scoreDelta == null ? "text-fg-3" : st.scoreDelta > 0 ? "text-mint" : st.scoreDelta < 0 ? "text-[#ff8fa3]" : "")}>{st.comparable ? signed(st.scoreDelta) : t("progress.noComparable")}</span>
                      {st.biggestChanges.length > 0 && <span className="text-xs text-fg-2">{t("progress.biggest")}: {st.biggestChanges.map((b) => `${criterionName(b.id, lang)} ${signed(b.delta)}`).join(", ")}</span>}
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

export function AwardsCard({ awards, entered = 0 }: { awards: Award[]; entered?: number }) {
  const { t, lang } = useT();
  const { stats, achievements } = computeAchievements(awards, entered);
  return (
    <Card data-testid="awards">
      <CardHeader title={t("awards.title")} icon={<AwardIcon size={18} className="text-amber" />} subtitle={entered > 0 ? t("awards.stats") : undefined} />
      <CardBody className="space-y-4">
        {entered > 0 && (
          <div className="grid grid-cols-3 gap-2 text-center" data-testid="award-stats">
            {[["entered", stats.tournamentsEntered], ["overallWins", stats.overallWins], ["championships", stats.championships], ["categoryWins", stats.categoryWins], ["distinct", stats.distinctCategories], ["withAward", stats.tournamentsWithAward]].map(([k, v]) => (
              <div key={k as string} className="rounded-lg bg-white/3 p-2"><div className="text-[10px] uppercase tracking-wider text-fg-3 leading-tight">{t(`awards.${k}`)}</div><div className="font-display text-lg num">{v as number}</div></div>
            ))}
            {stats.mostWonCategory && <div className="col-span-3 text-xs text-fg-2">{t("awards.mostWon")}: {categoryName(stats.mostWonCategory.id, stats.mostWonCategory.name, lang)} ({stats.mostWonCategory.count}×)</div>}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5" data-testid="achievements">
          {achievements.map((a) => (
            <span key={a.id} className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]", a.earned ? "border-amber/50 bg-amber-soft text-amber" : "border-line text-fg-3")} title={t(`achievements.${a.id}Hint`, a.params ?? {})} data-earned={a.earned ? "true" : "false"}>
              <Trophy size={11} /> {t(`achievements.${a.id}`)} <span className="font-mono">{t("awards.progress", { p: a.progress, t: a.target })}</span>
            </span>
          ))}
        </div>
        {awards.length === 0 ? (
          <Empty>{t("awards.empty")}</Empty>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {awards.map((a, i) => (
              <li key={i} className="flex items-start gap-2">
                <Trophy size={14} className={cn("mt-0.5 shrink-0", a.kind === "champion" || a.kind === "overallWinner" ? "text-amber" : "text-cyan")} />
                <span>
                  {a.kind === "multiCategory" ? t("awards.multiCategory", { n: a.count }) : a.kind === "categoryWinner" ? `${t("awards.categoryWinner")}: ${categoryName(a.categoryId ?? "", a.categoryName ?? "", lang)}` : t(`awards.${a.kind}`)}
                  {a.shared && <span className="text-xs text-fg-3"> ({t("awards.shared")})</span>}
                  <span className="text-xs text-fg-3"> {t("awards.in")} </span>
                  <Link href={paths.tournament(a.tournamentId)} className="text-xs hover:text-accent underline underline-offset-2">{a.tournamentName}</Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
