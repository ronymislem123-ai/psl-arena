"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/app-shell";
import { FaceThumb } from "@/components/shared/face-thumb";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Empty } from "@/components/ui/controls";
import { formatPsl } from "@/engine/psl/rating";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { categoryName } from "@/lib/i18n/psl-texts";
import type { CategoryRanking } from "@/engine/tournament/types";
import { paths } from "@/lib/paths";

type Data = Awaited<ReturnType<typeof api.leaderboards>>;

export function Leaderboards() {
  const { t, lang } = useT();
  const [data, setData] = useState<Data | null>(null);
  useEffect(() => {
    api.leaderboards().then(setData).catch(() => setData({ participants: [], categories: [], rankings: [] }));
  }, []);
  const byId = new Map((data?.participants ?? []).map((p) => [p.id, p]));
  return (
    <div className="space-y-6">
      <PageHeader kicker={t("navPsl.leaderboards")} title={t("leaderboards.title")} subtitle={t("leaderboards.sub")} />
      {!data ? (
        <div className="text-sm text-fg-3">{t("common.loading")}</div>
      ) : data.participants.length < 2 ? (
        <Empty>{t("leaderboards.empty")}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="leaderboards">
          {data.categories.map((c) => {
            const r = data.rankings.find((x: CategoryRanking) => x.categoryId === c.id);
            const entries = (r?.entries ?? []).filter((e) => e.rank != null).slice(0, 5);
            return (
              <Card key={c.id}>
                <CardHeader title={categoryName(c.id, c.name, lang)} subtitle={r?.decidable ? undefined : t("tournaments.notDecidable")} />
                <CardBody>
                  {entries.length === 0 ? (
                    <div className="text-xs text-fg-3">—</div>
                  ) : (
                    <ol className="space-y-1.5">
                      {entries.map((e) => {
                        const p = byId.get(e.participantId);
                        return (
                          <li key={e.participantId} className="flex items-center gap-2 text-sm">
                            <span className="w-5 font-mono text-xs text-fg-3">{e.rank}</span>
                            <FaceThumb imageId={p?.imageId} label={p?.name} size={28} className="rounded-full" />
                            <Link href={paths.profile(e.participantId)} className="min-w-0 flex-1 truncate hover:text-accent">{p?.name ?? e.participantId}</Link>
                            <span className="font-mono num">{formatPsl(e.score)}</span>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
