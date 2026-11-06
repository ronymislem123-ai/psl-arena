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

export function History({ battles, analyses, sideAnalyses }: { battles: BattleSummary[]; analyses: AnalysisSummary[]; sideAnalyses: SideAnalysisSummary[] }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [tab, setTab] = useState<"battles" | "analyses" | "side">("battles");
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
  const delS = async (id: string) => {
    if (!confirm(t("side.deleteConfirm"))) return;
    await api.deleteSideAnalysis(id);
    router.refresh();
  };
  return (
    <div className="space-y-6">
      <PageHeader kicker={t("nav.history")} title={t("history.title")} subtitle={t("history.sub")} action={<Tabs tabs={[{ id: "battles", label: t("history.battles"), count: battles.length }, { id: "analyses", label: t("history.analyses"), count: analyses.length }, { id: "side", label: t("side.historyTab"), count: sideAnalyses.length }]} value={tab} onChange={setTab} />} />
      {tab === "battles" && (
        <Card>
          <CardBody className="pt-5">
            {battles.length === 0 ? (
              <Empty>{t("history.empty")}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {battles.map((b) => (
                  <li key={b.id} className="flex items-center gap-3 py-3">
                    <div className="flex -space-x-2">
                      <FaceThumb imageId={b.imageAId} label={b.labelA} size={44} />
                      <FaceThumb imageId={b.imageBId} label={b.labelB} size={44} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/battle/${b.id}`} className="font-medium hover:text-accent">
                        {b.labelA} <span className="text-fg-3">vs</span> {b.labelB}
                      </Link>
                      <div className="text-xs text-fg-3">
                        {fmt.date(b.createdAt, lang)} · {t("common.engine")} {b.engineVersion} · ±{b.margin.toFixed(1)}
                      </div>
                    </div>
                    <div className="font-mono text-sm num">
                      {fmt.score(b.overallA, 1)} : {fmt.score(b.overallB, 1)}
                    </div>
                    <VerdictBadge verdict={b.verdict} labelA={b.labelA} labelB={b.labelB} />
                    <Link href={`/battle/${b.id}`}>
                      <Button size="sm" variant="outline">{t("common.open")}</Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => delB(b.id)}>
                      <Trash2 size={14} />
                    </Button>
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
                      <Link href={`/side-view/${a.id}`} className="font-medium hover:text-accent">
                        {a.profileLabel}
                      </Link>
                      <div className="text-xs text-fg-3">
                        {fmt.date(a.createdAt, lang)} · {t("side.facing")} {t(a.facing === "left" ? "side.facingLeft" : "side.facingRight")} · {a.scoredCount} {t("side.scored")}
                      </div>
                    </div>
                    <div className="font-display text-lg num">{fmt.score(a.score, 1)}</div>
                    <Link href={`/side-view/${a.id}`}>
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
              <ul className="divide-y divide-line">
                {analyses.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <FaceThumb imageId={a.imageId} label={a.profileLabel} size={44} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/analysis/${a.id}`} className="font-medium hover:text-accent">
                        {a.profileLabel}
                      </Link>
                      <div className="text-xs text-fg-3">
                        {fmt.date(a.createdAt, lang)} · {t("common.coverage")} {fmt.pct(a.coverageFraction)} · {t("common.confidence")} {fmt.pct(a.confidence)}
                      </div>
                    </div>
                    <Badge tone={levelTone(a.qualityLevel)}>{t(`quality.${a.qualityLevel}`)}</Badge>
                    <div className="font-display text-lg num">{fmt.score(a.overall, 1)}</div>
                    <Link href={`/analysis/${a.id}`}>
                      <Button size="sm" variant="outline">{t("common.open")}</Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => delA(a.id)}>
                      <Trash2 size={14} />
                    </Button>
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
