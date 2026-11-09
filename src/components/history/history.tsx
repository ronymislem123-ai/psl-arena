"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Empty, Tabs } from "@/components/ui/controls";
import { Badge, levelTone } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/app-shell";
import { FaceThumb, VerdictBadge } from "@/components/shared/face-thumb";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { fmt } from "@/lib/utils";
import type { AnalysisSummary, BattleSummary, SideAnalysisSummary } from "@/server/repos";
import type { RatingSummary, TournamentSummary } from "@/server/repos-psl";
import { formatPsl } from "@/engine/psl/rating";
import { paths } from "@/lib/paths";

export function History({ battles, analyses, sideAnalyses, ratings = [], tournaments = [] }: { battles: BattleSummary[]; analyses: AnalysisSummary[]; sideAnalyses: SideAnalysisSummary[]; ratings?: RatingSummary[]; tournaments?: TournamentSummary[] }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [tab, setTab] = useState<"battles" | "analyses" | "side" | "ratings" | "tournaments">(ratings.length ? "ratings" : "battles");
  const [selected, setSelected] = useState<string[]>([]);
  const toggleSel = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));
  const [selectedA, setSelectedA] = useState<string[]>([]);
  const toggleSelA = (id: string) => setSelectedA((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= 4 ? s : [...s, id]));
  const delB = async (id: string) => {
    if (!confirm(t("common.deleteConfirm"))) return;
    await api.deleteBattle(id);
    router.refresh();
  };
  const delA = async (id: string) => {
    if (!confirm(t("common.deleteConfirm"))) return;
    await api.deleteAnalysis(id);
    router.refresh();
  };
  const delR = async (id: string) => {
    if (!confirm(t("common.deleteConfirm"))) return;
    await api.deleteRating(id);
    router.refresh();
  };
  const delT = async (id: string) => {
    if (!confirm(t("tournaments.deleteConfirm"))) return;
    await api.deleteTournament(id);
    router.refresh();
  };
  const delS = async (id: string) => {
    if (!confirm(t("side.deleteConfirm"))) return;
    await api.deleteSideAnalysis(id);
    router.refresh();
  };
  return (
    <div className="space-y-6">
      <PageHeader kicker={t("nav.history")} title={t("history.title")} subtitle={t("history.sub")} action={<Tabs tabs={[{ id: "ratings", label: t("historyPsl.ratings"), count: ratings.length }, { id: "tournaments", label: t("historyPsl.tournaments"), count: tournaments.length }, { id: "battles", label: t("history.battles"), count: battles.length }, { id: "analyses", label: t("history.analyses"), count: analyses.length }, { id: "side", label: t("side.historyTab"), count: sideAnalyses.length }]} value={tab} onChange={setTab} />} />
      {tab === "battles" && (
        <Card>
          <CardBody className="pt-5">
            {battles.length === 0 ? (
              <Empty>{t("history.empty")}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {battles.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                    <div className="flex -space-x-2">
                      <FaceThumb imageId={b.imageAId} label={b.labelA} size={44} />
                      <FaceThumb imageId={b.imageBId} label={b.labelB} size={44} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={paths.battle(b.id)} className="font-medium hover:text-accent">
                        {b.labelA} <span className="text-fg-3">vs</span> {b.labelB}
                      </Link>
                      <div className="text-xs text-fg-3">
                        {fmt.date(b.createdAt, lang)} · {t("common.engine")} {b.engineVersion} · ±{b.margin.toFixed(1)}
                      </div>
                    </div>
                    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                      <div className="font-mono text-sm num whitespace-nowrap">
                        {fmt.score(b.overallA, 1)} : {fmt.score(b.overallB, 1)}
                      </div>
                      <VerdictBadge verdict={b.verdict} labelA={b.labelA} labelB={b.labelB} />
                      <Link href={paths.battle(b.id)}>
                        <Button size="sm" variant="outline">{t("common.open")}</Button>
                      </Link>
                      <Button size="sm" variant="ghost" onClick={() => delB(b.id)} aria-label={t("common.delete")}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
      {tab === "ratings" && (
        <Card>
          <CardBody className="pt-5">
            {ratings.length === 0 ? (
              <Empty>{t("history.empty")}</Empty>
            ) : (
              <>
              <div className="flex items-center justify-between gap-2 pb-3 text-xs text-fg-3">
                <span>{t("historyPsl.selectHint")}</span>
                <Link href={selected.length >= 2 ? `/compare?ids=${selected.join(",")}` : "#"}><Button size="sm" variant="outline" disabled={selected.length < 2} data-testid="history-compare">{t("historyPsl.compareSelected", { n: selected.length })}</Button></Link>
              </div>
              <ul className="divide-y divide-line" data-testid="ratings-history">
                {ratings.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                    <input type="checkbox" checked={selected.includes(r.id)} onChange={() => toggleSel(r.id)} className="h-4 w-4 shrink-0 accent-[#4f7cff]" aria-label={t("historyPsl.select")} data-testid={`select-${r.id}`} />
                    <FaceThumb imageId={r.profileImageId} label={r.profileLabel} size={44} />
                    <div className="min-w-0 flex-[1_1_12rem]">
                      <Link href={paths.rating(r.id)} className="font-medium hover:text-accent break-words">{r.profileLabel}</Link>
                      <div className="text-xs text-fg-3">{fmt.date(r.createdAt, lang)} · {r.scaleName} · {t("rater.result.rubric")} {r.rubricVersion} · {t("rater.result.coverage")} {Math.round(r.coverage * 100)} %</div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Badge tone={r.valid ? "mint" : r.provisional ? "amber" : "rose"}>{r.valid ? t("rater.result.valid") : r.provisional ? t("rater.result.provisional") : t("rater.result.invalid")}</Badge>
                      <span className="text-xs text-fg-2 hidden sm:inline">{r.tierName ?? "—"}</span>
                      <div className="font-display text-lg num">{formatPsl(r.score)}</div>
                      <Link href={paths.rating(r.id)}><Button size="sm" variant="outline">{t("common.open")}</Button></Link>
                      <Button size="sm" variant="ghost" onClick={() => delR(r.id)}><Trash2 size={14} /></Button>
                    </div>
                  </li>
                ))}
              </ul>
              </>
            )}
          </CardBody>
        </Card>
      )}
      {tab === "tournaments" && (
        <Card>
          <CardBody className="pt-5">
            {tournaments.length === 0 ? (
              <Empty>{t("tournaments.empty")}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {tournaments.map((tr) => (
                  <li key={tr.id} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <Link href={paths.tournament(tr.id)} className="font-medium hover:text-accent">{tr.name}</Link>
                      <div className="text-xs text-fg-3">{fmt.date(tr.updatedAt, lang)} · {t(`tournaments.formats.${tr.format}`)} · {t("tournaments.nParticipants", { n: tr.participantCount })} · v{tr.version}</div>
                    </div>
                    <Badge tone={tr.status === "completed" ? "mint" : tr.status === "running" ? "cyan" : tr.status === "paused" ? "amber" : "muted"}>{t(`tournaments.status.${tr.status}`)}</Badge>
                    <span className="text-xs text-fg-2 hidden sm:inline truncate max-w-[30%]">{tr.winnerNames.join(", ")}</span>
                    <Link href={paths.tournament(tr.id)}><Button size="sm" variant="outline">{t("common.open")}</Button></Link>
                    <Button size="sm" variant="ghost" onClick={() => delT(tr.id)}><Trash2 size={14} /></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
      {tab === "side" && (
        <Card>
          <CardBody className="pt-5">
            {sideAnalyses.length === 0 ? (
              <Empty>{t("side.empty")}</Empty>
            ) : (
              <ul className="divide-y divide-line" data-testid="side-history">
                {sideAnalyses.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <FaceThumb imageId={a.imageId} label={a.profileLabel} size={44} />
                    <div className="min-w-0 flex-1">
                      <Link href={paths.sideView(a.id)} className="font-medium hover:text-accent">
                        {a.profileLabel}
                      </Link>
                      <div className="text-xs text-fg-3">
                        {fmt.date(a.createdAt, lang)} · {t("side.facing")} {t(a.facing === "left" ? "side.facingLeft" : "side.facingRight")} · {a.scoredCount} {t("side.scored")}
                      </div>
                    </div>
                    <div className="font-display text-lg num">{fmt.score(a.score, 1)}</div>
                    <Link href={paths.sideView(a.id)}>
                      <Button size="sm" variant="outline">{t("common.open")}</Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => delS(a.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
      {tab === "analyses" && (
        <Card>
          <CardBody className="pt-5">
            {analyses.length === 0 ? (
              <Empty>{t("history.empty")}</Empty>
            ) : (
              <>
              <div className="flex items-center justify-between gap-2 pb-3 text-xs text-fg-3">
                <span>{t("historyPsl.selectHintAnalyses")}</span>
                <Link href={selectedA.length >= 2 ? `/compare?mode=analyses&analyses=${selectedA.join(",")}` : "#"}><Button size="sm" variant="outline" disabled={selectedA.length < 2} data-testid="history-compare-analyses">{t("historyPsl.compareSelected", { n: selectedA.length })}</Button></Link>
              </div>
              <ul className="divide-y divide-line" data-testid="analyses-history">
                {analyses.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <input type="checkbox" checked={selectedA.includes(a.id)} onChange={() => toggleSelA(a.id)} className="h-4 w-4 accent-[#4f7cff]" aria-label={t("historyPsl.select")} data-testid={`select-analysis-${a.id}`} />
                    <FaceThumb imageId={a.imageId} label={a.profileLabel} size={44} />
                    <div className="min-w-0 flex-1">
                      <Link href={paths.analysis(a.id)} className="font-medium hover:text-accent">
                        {a.profileLabel}
                      </Link>
                      <div className="text-xs text-fg-3">
                        {fmt.date(a.createdAt, lang)} · {t("common.coverage")} {fmt.pct(a.coverageFraction)} · {t("common.confidence")} {fmt.pct(a.confidence)}
                      </div>
                    </div>
                    <Badge tone={levelTone(a.qualityLevel)}>{t(`quality.${a.qualityLevel}`)}</Badge>
                    <div className="font-display text-lg num">{fmt.score(a.overall, 1)}</div>
                    <Link href={paths.analysis(a.id)}>
                      <Button size="sm" variant="outline">{t("common.open")}</Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => delA(a.id)}>
                      <Trash2 size={14} />
                    </Button>
                  </li>
                ))}
              </ul>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
