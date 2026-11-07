"use client";
import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, levelTone } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/controls";
import { formatPsl } from "@/engine/psl/rating";
import { useT } from "@/lib/i18n";
import { fmt } from "@/lib/utils";
import type { AnalysisSummary } from "@/server/repos";
import type { RatingSummary, TournamentSummary } from "@/server/repos-psl";

export type CompareMode = "ratings" | "analyses" | "versions";

export function ComparePickers({ mode, ratings, analyses, tournaments, preselect = [] }: { mode: CompareMode; ratings: RatingSummary[]; analyses: AnalysisSummary[]; tournaments: TournamentSummary[]; preselect?: string[] }) {
  const { t, lang } = useT();
  const [tab, setTab] = useState<CompareMode>(mode);
  const [selR, setSelR] = useState<string[]>(() => preselect.filter((id) => ratings.some((r) => r.id === id)).slice(0, 4));
  const [selA, setSelA] = useState<string[]>(() => preselect.filter((id) => analyses.some((a) => a.id === id)).slice(0, 4));
  const toggle = (set: (f: (s: string[]) => string[]) => void) => (id: string) => set((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));
  return (
    <div className="space-y-6">
      <PageHeader kicker={t("navPsl.rater")} title={t("compare.title")} subtitle={t("compare.sub")} action={<Tabs tabs={[{ id: "ratings", label: t("compareAnalyses.tab") }, { id: "analyses", label: t("compareAnalyses.tabAnalyses") }, { id: "versions", label: t("compareAnalyses.tabVersions") }]} value={tab} onChange={setTab} />} />
      {tab === "ratings" && (
        <Card>
          <CardHeader title={t("compare.pick")} subtitle={t("compare.pickHint")} action={<Link href={selR.length >= 2 ? `/compare?ids=${selR.join(",")}` : "#"}><Button disabled={selR.length < 2} data-testid="compare-go">{t("compare.go")} ({selR.length})</Button></Link>} />
          <CardBody>
            {ratings.length < 2 ? <div className="text-sm text-fg-3">{t("compare.empty")}</div> : (
              <ul className="divide-y divide-line" data-testid="compare-picker">
                {ratings.map((r) => (
                  <li key={r.id}><label className="flex items-center gap-3 py-2 cursor-pointer"><input type="checkbox" checked={selR.includes(r.id)} onChange={() => toggle(setSelR)(r.id)} className="h-4 w-4 accent-[#4f7cff]" /><span className="min-w-0 flex-1 truncate">{r.profileLabel}</span><span className="text-xs text-fg-3">{fmt.date(r.createdAt, lang)} · {r.scaleName} · {r.tierName ?? "—"}</span><span className="font-mono num">{formatPsl(r.score)}</span></label></li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
      {tab === "analyses" && (
        <Card>
          <CardHeader title={t("compareAnalyses.pick")} subtitle={t("compareAnalyses.pickHint")} action={<Link href={selA.length >= 2 ? `/compare?mode=analyses&analyses=${selA.join(",")}` : "#"}><Button disabled={selA.length < 2} data-testid="compare-analyses-go">{t("compare.go")} ({selA.length})</Button></Link>} />
          <CardBody>
            {analyses.length < 2 ? <div className="text-sm text-fg-3">{t("compareAnalyses.empty")}</div> : (
              <ul className="divide-y divide-line" data-testid="analyses-picker">
                {analyses.map((a) => (
                  <li key={a.id}><label className="flex items-center gap-3 py-2 cursor-pointer"><input type="checkbox" checked={selA.includes(a.id)} onChange={() => toggle(setSelA)(a.id)} className="h-4 w-4 accent-[#4f7cff]" /><span className="min-w-0 flex-1 truncate">{a.profileLabel}</span><span className="text-xs text-fg-3">{fmt.date(a.createdAt, lang)} · {t("common.coverage")} {fmt.pct(a.coverageFraction)}</span><Badge tone={levelTone(a.qualityLevel)}>{t(`quality.${a.qualityLevel}`)}</Badge><span className="font-mono num">{fmt.score(a.overall, 1)}</span></label></li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
      {tab === "versions" && (
        <Card>
          <CardHeader title={t("compareVersions.title")} subtitle={t("compareVersions.sub")} />
          <CardBody>
            {tournaments.length === 0 ? <div className="text-sm text-fg-3">{t("compareVersions.empty")}</div> : (
              <ul className="divide-y divide-line" data-testid="versions-picker">
                {tournaments.map((tr) => (
                  <li key={tr.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{tr.name}</span>
                    <span className="text-xs text-fg-3">v{tr.version} · {t(`tournaments.status.${tr.status}`)}</span>
                    <Link href={`/compare?mode=versions&tournament=${tr.id}`}><Button size="sm" variant="outline">{t("compare.go")}</Button></Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
