"use client";
import Link from "next/link";
import { ArrowRight, Boxes, DraftingCompass, Images, Scan, ScanFace, SlidersHorizontal, Sparkles, Swords, Trophy, Users } from "lucide-react";
import { TierBadge } from "@/components/psl/tier-badge";
import { formatPsl } from "@/engine/psl/rating";
import { BRAND } from "@/config/brand";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Empty, StatTile } from "@/components/ui/controls";
import { FaceThumb, VerdictBadge } from "@/components/shared/face-thumb";
import { useT } from "@/lib/i18n";
import { fmt } from "@/lib/utils";
import type { AnalysisSummary, BattleSummary, ProfileRow } from "@/server/repos";
import type { RatingSummary, TournamentSummary } from "@/server/repos-psl";
import type { stats as statsFn } from "@/server/repos";
import { paths } from "@/lib/paths";

type Stats = ReturnType<typeof statsFn>;

export function Dashboard({ stats, recentBattles, recentAnalyses, profiles, recentRatings = [], recentTournaments = [] }: { stats: Stats; recentBattles: BattleSummary[]; recentAnalyses: AnalysisSummary[]; profiles: ProfileRow[]; recentRatings?: RatingSummary[]; recentTournaments?: TournamentSummary[] }) {
  const { t, lang } = useT();
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl glass-strong p-6 md:p-10">
        <div className="absolute inset-0 hud-grid opacity-40 pointer-events-none" />
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-violet/15 blur-3xl pointer-events-none" />
        <div className="relative grid gap-8 md:grid-cols-[1.3fr_1fr] items-center">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan/80">{t("dashboard.welcome")}</div>
            <h1 className="mt-2 font-display text-4xl md:text-6xl font-bold tracking-tight text-glow">{BRAND.name}</h1>
            <p className="mt-4 text-fg-1 max-w-xl">{t("dashboard.sub")}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/rater">
                <Button size="lg" title={t("dashboardPsl.rateSub")} data-testid="dash-rate">
                  <ScanFace size={18} /> {t("dashboardPsl.rate")} <ArrowRight size={16} />
                </Button>
              </Link>
              <Link href="/tournaments/new">
                <Button size="lg" variant="outline">
                  <Trophy size={18} /> {t("dashboardPsl.tournament")}
                </Button>
              </Link>
              <Link href="/scales">
                <Button size="lg" variant="outline">
                  <SlidersHorizontal size={18} /> {t("navPsl.scales")}
                </Button>
              </Link>
              <Link href="/battle/new">
                <Button size="lg" variant="outline">
                  <Swords size={18} /> {t("dashboard.quickStart")}
                </Button>
              </Link>
              <Link href="/side-view/new">
                <Button size="lg" variant="outline" title={t("side.quickStartSub")}>
                  <DraftingCompass size={18} /> {t("side.quickStart")}
                </Button>
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="glass rounded-2xl p-5">
              <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-fg-2 mb-3">{t("dashboard.howTitle")}</div>
              <ol className="space-y-3 text-sm text-fg-1">
                {[t("dashboard.how1"), t("dashboard.how2"), t("dashboard.how3"), t("dashboard.how4")].map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent/15 font-mono text-[11px] text-accent">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <StatTile label={t("dashboard.profiles")} value={stats.profiles} icon={<Users size={18} />} />
          <StatTile label={t("dashboard.analyses")} value={stats.analyses} icon={<Scan size={18} />} tone="cyan" />
          <StatTile label={t("dashboard.battles")} value={stats.battles} icon={<Swords size={18} />} tone="violet" />
          <StatTile label={t("dashboardPsl.ratings")} value={stats.ratings} icon={<ScanFace size={18} />} tone="accent" />
          <StatTile label={t("dashboardPsl.tournaments")} value={stats.tournaments} icon={<Trophy size={18} />} tone="amber" />
          <StatTile label={t("dashboardPsl.scales")} value={stats.scales} icon={<SlidersHorizontal size={18} />} tone="violet" />
          <StatTile label={t("side.dashboardTile")} value={stats.sideAnalyses} icon={<DraftingCompass size={18} />} tone="cyan" />
          <StatTile label={t("dashboard.avgOverall")} value={fmt.score(stats.averageOverall, 1)} icon={<Sparkles size={18} />} tone="mint" />
          <StatTile label={t("dashboard.storedImages")} value={stats.images} icon={<Images size={18} />} tone="amber" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("dashboardPsl.recentRatings")} icon={<ScanFace size={18} />} action={<Link href="/history" className="text-xs text-fg-2 hover:text-fg-0">{t("nav.history")} →</Link>} />
          <CardBody>
            {recentRatings.length === 0 ? (
              <Empty>{t("dashboard.empty")}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {recentRatings.map((r) => (
                  <li key={r.id}>
                    <Link href={paths.rating(r.id)} className="flex items-center gap-3 py-3 hover:bg-white/3 rounded-lg px-1 -mx-1">
                      <FaceThumb imageId={r.profileImageId} label={r.profileLabel} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{r.profileLabel}</div>
                        <div className="text-xs text-fg-3">{fmt.date(r.createdAt, lang)} · {r.scaleName}</div>
                      </div>
                      <TierBadge tier={r.tierName ? { id: r.tierId ?? "", name: r.tierName, min: 0, max: 0, color: "#9db6ff" } : null} size="sm" />
                      <div className="font-display text-lg font-semibold num">{formatPsl(r.score)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("dashboardPsl.recentTournaments")} icon={<Trophy size={18} />} action={<Link href="/tournaments" className="text-xs text-fg-2 hover:text-fg-0">{t("navPsl.tournaments")} →</Link>} />
          <CardBody>
            {recentTournaments.length === 0 ? (
              <Empty>{t("tournaments.empty")}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {recentTournaments.map((tr) => (
                  <li key={tr.id}>
                    <Link href={paths.tournament(tr.id)} className="flex items-center gap-3 py-3 hover:bg-white/3 rounded-lg px-1 -mx-1">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{tr.name}</div>
                        <div className="text-xs text-fg-3">{t(`tournaments.formats.${tr.format}`)} · {tr.participantCount} · {t(`tournaments.status.${tr.status}`)}</div>
                      </div>
                      <div className="text-xs text-fg-2 truncate max-w-[40%]">{tr.winnerNames.join(", ")}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("dashboard.recentBattles")} icon={<Trophy size={18} />} action={<Link href="/history" className="text-xs text-fg-2 hover:text-fg-0">{t("nav.history")} →</Link>} />
          <CardBody>
            {recentBattles.length === 0 ? (
              <Empty>{t("dashboard.empty")}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {recentBattles.map((b) => (
                  <li key={b.id}>
                    <Link href={paths.battle(b.id)} className="flex items-center gap-3 py-3 hover:bg-white/3 rounded-lg px-1 -mx-1">
                      <div className="flex -space-x-2">
                        <FaceThumb imageId={b.imageAId} label={b.labelA} size={40} />
                        <FaceThumb imageId={b.imageBId} label={b.labelB} size={40} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {b.labelA} <span className="text-fg-3">vs</span> {b.labelB}
                        </div>
                        <div className="text-xs text-fg-3">{fmt.date(b.createdAt, lang)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm num">
                          {fmt.score(b.overallA, 1)} : {fmt.score(b.overallB, 1)}
                        </div>
                        <VerdictBadge verdict={b.verdict} labelA={b.labelA} labelB={b.labelB} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("dashboard.recentAnalyses")} icon={<Boxes size={18} />} action={<Link href="/history" className="text-xs text-fg-2 hover:text-fg-0">{t("nav.history")} →</Link>} />
          <CardBody>
            {recentAnalyses.length === 0 ? (
              <Empty>{t("dashboard.empty")}</Empty>
            ) : (
              <ul className="divide-y divide-line">
                {recentAnalyses.map((a) => (
                  <li key={a.id}>
                    <Link href={paths.analysis(a.id)} className="flex items-center gap-3 py-3 hover:bg-white/3 rounded-lg px-1 -mx-1">
                      <FaceThumb imageId={a.imageId} label={a.profileLabel} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{a.profileLabel}</div>
                        <div className="text-xs text-fg-3">
                          {fmt.date(a.createdAt, lang)} · {t("common.coverage")} {fmt.pct(a.coverageFraction)}
                        </div>
                      </div>
                      <div className="font-display text-lg font-semibold num">{fmt.score(a.overall, 1)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("dashboard.savedProfiles")} icon={<Users size={18} />} action={<Link href="/profiles" className="text-xs text-fg-2 hover:text-fg-0">{t("nav.profiles")} →</Link>} />
        <CardBody>
          {profiles.length === 0 ? (
            <Empty>{t("dashboard.empty")}</Empty>
          ) : (
            <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
              {profiles.map((p) => (
                <Link key={p.id} href={paths.profile(p.id)} className="glass rounded-xl p-3 text-center hover:border-accent/40 transition-colors">
                  <FaceThumb imageId={p.imageId} label={p.label} size={64} className="mx-auto rounded-full" />
                  <div className="mt-2 text-sm font-medium truncate">{p.label}</div>
                  <div className="text-xs text-fg-3 num">{fmt.score(p.latestOverall, 1)}</div>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
