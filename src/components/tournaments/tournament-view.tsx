"use client";
/** Tournament detail: overview, bracket/groups, duels, category standings, results, versions. */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, Pause, Pencil, Play, Printer, RotateCcw, SkipForward, Trash2, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { TierBadge } from "@/components/psl/tier-badge";
import { FaceThumb } from "@/components/shared/face-thumb";
import { BracketView } from "@/components/tournaments/bracket";
import { DuelTable } from "@/components/tournaments/duel-table";
import { liveStandings, participantsOf } from "@/components/tournaments/tournament-client";
import { STATUS_TONE } from "@/components/tournaments/tournaments-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog, Empty, Select, StatTile, Tabs } from "@/components/ui/controls";
import { formatPsl } from "@/engine/psl/rating";
import { assignTier } from "@/engine/psl/scale";
import type { CategoryRanking, Match, TournamentResults } from "@/engine/tournament/types";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { categoryName, criterionName } from "@/lib/i18n/psl-texts";
import { cn, fmt } from "@/lib/utils";
import type { TournamentRecord, TournamentVersionRow } from "@/server/repos-psl";
import { paths } from "@/lib/paths";
import { ApiLink } from "@/components/shared/api-link";

type Tab = "overview" | "bracket" | "groups" | "duels" | "categories" | "results" | "versions";

export function TournamentView({ tournament: initial, versions, readOnly }: { tournament: TournamentRecord; versions: TournamentVersionRow[]; readOnly?: { currentVersion: number } }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [tr, setTr] = useState(initial);
  const [tab, setTab] = useState<Tab>(initial.status === "completed" ? "results" : "overview");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duelChoice, setDuel] = useState<{ a: string; b: string } | null>(null);
  const [blocked, setBlocked] = useState(false);
  const participants = useMemo(() => participantsOf(tr), [tr]);
  const duel = duelChoice ?? (participants.length >= 2 ? { a: participants[0].id, b: participants[1].id } : null);
  const names = useMemo(() => new Map(participants.map((p) => [p.id, p.name])), [participants]);
  const live = useMemo(() => liveStandings(tr), [tr]);
  const results: TournamentResults | null = tr.results;
  const byId = (id: string) => participants.find((p) => p.id === id);
  const tierOf = (score: number | null) => (score == null ? null : assignTier(tr.scaleSnapshot, score));

  const act = async (action: Parameters<typeof api.tournamentAction>[1]["action"], extra: { matchId?: string; winnerId?: string } = {}) => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.tournamentAction(tr.id, { action, ...extra });
      if (action === "duplicate") {
        router.push(paths.tournament(res.tournament.id));
        return;
      }
      setTr(res.tournament);
      setBlocked(res.blocked);
      if (res.tournament.status === "completed") setTab("results");
      else if (action === "start" && (res.tournament.config.format === "knockout" || res.tournament.config.format === "group")) setTab(res.tournament.state?.phase === "groups" ? "groups" : "bracket");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    if (!confirm(t("tournaments.deleteConfirm"))) return;
    await api.deleteTournament(tr.id);
    router.push("/tournaments");
    router.refresh();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: t("tournaments.tabs.overview") },
    ...(tr.config.format === "group" ? [{ id: "groups" as Tab, label: t("tournaments.tabs.groups") }] : []),
    ...(tr.config.format === "knockout" || tr.config.format === "group" ? [{ id: "bracket" as Tab, label: t("tournaments.tabs.bracket") }] : []),
    { id: "duels", label: t("tournaments.tabs.duels") },
    { id: "categories", label: t("tournaments.tabs.categories") },
    { id: "results", label: t("tournaments.tabs.results") },
    { id: "versions", label: t("tournaments.tabs.versions") },
  ];
  const tiedMatches = tr.state?.bracket?.rounds.flat().filter((m) => m.status === "tied") ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={`${t("navPsl.tournaments")} · ${t(`tournaments.formats.${tr.config.format}`)} · v${tr.version} · ${tr.scaleName} · ${t("rater.result.rubric")} ${tr.rubricVersion}`}
        title={tr.name}
        subtitle={
          <span className="flex flex-wrap gap-2 items-center">
            <Badge tone={STATUS_TONE[tr.status]} data-testid="tournament-status">{t(`tournaments.status.${tr.status}`)}</Badge>
            <Badge tone="muted">{t("tournaments.nParticipants", { n: tr.participants.length })}</Badge>
            <Badge tone="muted">{t("tournaments.nCategories", { n: tr.config.categories.length })}</Badge>
            {tr.description && <span className="text-xs text-fg-2">{tr.description}</span>}
          </span>
        }
        action={
          readOnly ? (
            <Link href={paths.tournament(tr.id)}><Button variant="outline" size="sm">{t("common.back")}</Button></Link>
          ) : (
          <div className="flex flex-wrap gap-2 print:hidden">
            {tr.status === "draft" && <Link href={paths.tournamentEdit(tr.id)}><Button variant="outline" size="sm"><Pencil size={14} /> {t("scales.edit")}</Button></Link>}
            {tr.status === "draft" && <Button size="sm" onClick={() => act("start")} loading={busy} disabled={tr.participants.length < 2} data-testid="tournament-start"><Play size={14} /> {t("tournaments.start")}</Button>}
            {tr.status === "running" && tiedMatches.length === 0 && <Button size="sm" onClick={() => act("advance")} loading={busy} data-testid="tournament-advance"><SkipForward size={14} /> {t("tournaments.advance")}</Button>}
            {tr.status === "running" && tiedMatches.length === 0 && <Button size="sm" variant="outline" onClick={() => act("playAll")} loading={busy} data-testid="tournament-playall"><Play size={14} /> {t("tournaments.playAll")}</Button>}
            {tr.status === "running" && <Button size="sm" variant="outline" onClick={() => act("pause")} loading={busy}><Pause size={14} /> {t("tournaments.pause")}</Button>}
            {tr.status === "paused" && <Button size="sm" onClick={() => act("resume")} loading={busy}><Play size={14} /> {t("tournaments.resume")}</Button>}
            {tr.status === "completed" && <Button size="sm" variant="outline" onClick={() => act("reopen")} loading={busy} data-testid="tournament-reopen"><RotateCcw size={14} /> {t("tournaments.reopen")}</Button>}
            <Button size="sm" variant="ghost" onClick={() => act("duplicate")} loading={busy} title={t("tournaments.duplicate")}><Copy size={14} /></Button>
            <ApiLink href={`/api/tournaments/${tr.id}?download=1`}><Button size="sm" variant="ghost" title={t("tournaments.exportJson")}><Download size={14} /></Button></ApiLink>
            <Button size="sm" variant="ghost" onClick={() => window.print()} title={t("tournaments.print")}><Printer size={14} /></Button>
            <Button size="sm" variant="ghost" onClick={del} title={t("tournaments.delete")}><Trash2 size={14} /></Button>
          </div>
          )
        }
      />
      {readOnly && <div className="rounded-xl border border-violet/40 bg-violet-soft px-4 py-2 text-sm text-[#c4b5fd]" data-testid="archived-banner">{t("compareVersions.archivedBanner", { n: tr.version, current: readOnly.currentVersion })}</div>}
      {error && <div className="rounded-xl border border-rose/40 bg-rose-soft px-4 py-2 text-sm text-[#ff8fa3]" role="alert">{error}</div>}
      {!readOnly && (blocked || tiedMatches.length > 0) && tr.status === "running" && (
        <div className="rounded-xl border border-amber/40 bg-amber-soft px-4 py-3 text-sm text-amber" data-testid="tournament-blocked">
          <div>{t("tournaments.blocked")}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {tiedMatches.map((m) => (
              <span key={m.id} className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => act("decide", { matchId: m.id, winnerId: m.a! })} data-testid={`decide-${m.id}-a`}>{t("tournaments.advanceA", { name: names.get(m.a!) ?? "A" })}</Button>
                <Button size="sm" variant="outline" onClick={() => act("decide", { matchId: m.id, winnerId: m.b! })} data-testid={`decide-${m.id}-b`}>{t("tournaments.advanceA", { name: names.get(m.b!) ?? "B" })}</Button>
              </span>
            ))}
          </div>
        </div>
      )}
      {tr.status === "completed" && <p className="text-xs text-fg-3">{t("tournaments.locked")}</p>}
      <Tabs tabs={tabs} value={tab} onChange={setTab} className="print:hidden" />

      {tab === "overview" && (
        <Card>
          <CardHeader title={t("tournaments.participants")} />
          <CardBody className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="participants-table">
              <thead className="text-fg-3 uppercase tracking-wider text-[10px]"><tr><th className="text-left py-2">{t("tournaments.seed")}</th><th className="text-left py-2">{t("tournaments.displayName")}</th><th className="text-right py-2">{t("tournaments.overallFace")}</th><th className="text-left py-2 pl-3">{t("rater.result.tier")}</th><th className="text-right py-2">{t("rater.result.coverage")}</th><th className="text-right py-2">{t("tournaments.weightedScore")}</th><th className="text-left py-2 pl-3">{t("rater.profileView")}</th></tr></thead>
              <tbody>
                {participants.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <td className="py-2 font-mono text-xs text-fg-3">{p.seed}</td>
                    <td className="py-2"><span className="flex items-center gap-2"><FaceThumb imageId={p.imageId} label={p.name} size={28} className="rounded-full" />{p.name}</span></td>
                    <td className="py-2 text-right font-mono num">{formatPsl(p.rating.score)}</td>
                    <td className="py-2 pl-3"><TierBadge tier={tierOf(p.rating.score)} size="sm" /></td>
                    <td className="py-2 text-right font-mono text-xs">{Math.round(p.rating.coverage * 100)} %</td>
                    <td className="py-2 text-right font-mono num">{formatPsl(live.weighted.get(p.id)?.score ?? null)}</td>
                    <td className="py-2 pl-3 text-xs text-fg-2">{p.rating.quality.sideUsed ? t("common.yes") : t("common.no")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {tab === "groups" && (
        <div className="grid gap-4 md:grid-cols-2">
          {!tr.state?.groups ? <Empty>{t("tournaments.draftHint")}</Empty> : tr.state.groups.map((g) => (
            <Card key={g.id}>
              <CardHeader title={t("tournaments.group", { name: g.name })} />
              <CardBody className="space-y-3">
                <div className="-mx-1 overflow-x-auto px-1"><table className="w-full text-sm">
                  <thead className="text-fg-3 uppercase tracking-wider text-[10px]"><tr><th className="text-left py-1">{t("tournaments.table")}</th><th className="text-right">{t("tournaments.played")}</th><th className="text-right">{t("tournaments.wins")}</th><th className="text-right">{t("tournaments.draws")}</th><th className="text-right">{t("tournaments.losses")}</th><th className="text-right">{t("tournaments.points")}</th></tr></thead>
                  <tbody>
                    {g.table.map((row) => (
                      <tr key={row.participantId} className={cn("border-t border-line", g.qualified.includes(row.participantId) && "text-mint")}>
                        <td className="py-1">{row.rank}. {names.get(row.participantId)}</td><td className="text-right font-mono">{row.played}</td><td className="text-right font-mono">{row.wins}</td><td className="text-right font-mono">{row.draws}</td><td className="text-right font-mono">{row.losses}</td><td className="text-right font-mono font-semibold">{row.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table></div>
                <div className="text-[11px] uppercase tracking-wider text-fg-3">{t("tournaments.fixtures")}</div>
                <ul className="space-y-1 text-xs">
                  {g.fixtures.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2 cursor-pointer hover:text-fg-0" onClick={() => setDuel({ a: m.a!, b: m.b! })}>
                      <span className={cn(m.winner === m.a && "text-mint")}>{names.get(m.a!)}</span>
                      <span className="font-mono text-fg-3">{m.scoreA != null ? m.scoreA.toFixed(2) : "–"} : {m.scoreB != null ? m.scoreB.toFixed(2) : "–"}</span>
                      <span className={cn(m.winner === m.b && "text-mint")}>{names.get(m.b!)}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {tab === "bracket" && (
        <Card>
          <CardBody className="pt-5">
            {tr.state?.bracket ? (
              <BracketView bracket={tr.state.bracket} names={names} onMatch={(m: Match) => m.a && m.b && setDuel({ a: m.a, b: m.b })} onDecide={!readOnly && tr.status === "running" ? (m, w) => act("decide", { matchId: m.id, winnerId: w }) : undefined} />
            ) : (
              <Empty>{tr.config.format === "group" && tr.state?.phase === "groups" ? t("tournaments.tabs.groups") : t("tournaments.draftHint")}</Empty>
            )}
          </CardBody>
        </Card>
      )}

      {tab === "duels" && (
        <Card>
          <CardHeader title={t("tournaments.tabs.duels")} subtitle={t("tournaments.duelsSub")} />
          <CardBody className="space-y-4">
            <DuelPicker participants={participants} value={duel} onChange={setDuel} />
            {duel && byId(duel.a) && byId(duel.b) && <DuelTable a={byId(duel.a)!} b={byId(duel.b)!} config={tr.config} scores={live.scores} weighted={live.weighted} />}
          </CardBody>
        </Card>
      )}

      {tab === "categories" && (
        <div className="space-y-3">
          {tr.status !== "completed" && <p className="text-xs text-fg-3">{t("tournaments.liveStandings")}</p>}
          <CategoryCards rankings={results?.categoryRankings ?? live.rankings} config={tr.config} names={names} byId={byId} />
        </div>
      )}

      {tab === "results" && (results ? <ResultsView tr={tr} results={results} names={names} byId={byId} /> : <Empty>{t("tournaments.draftHint")}</Empty>)}

      {tab === "versions" && (
        <Card>
          <CardHeader title={t("tournaments.versions")} subtitle={t("tournaments.currentVersion", { n: tr.version })} action={versions.length > 0 ? <Link href={`/compare?mode=versions&tournament=${tr.id}`}><Button size="sm" variant="outline" data-testid="versions-compare-link">{t("compareVersions.title")}</Button></Link> : undefined} />
          <CardBody>
            {versions.length === 0 ? <Empty>{t("tournaments.noVersions")}</Empty> : (
              <ul className="divide-y divide-line">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                    <Badge tone="muted">v{v.version}</Badge>
                    <span className="flex-1 text-fg-1">{v.note}</span>
                    <span className="text-xs text-fg-3">{t("tournaments.archivedAt")} {fmt.date(v.createdAt, lang)}</span>
                    <Link href={paths.tournamentVersion(tr.id, v.id)} data-testid={`version-open-${v.version}`}><Button size="sm" variant="outline">{t("common.open")}</Button></Link>
                    <ApiLink href={`/api/tournaments/${tr.id}/versions/${v.id}`} newTab className="text-xs text-fg-3 underline underline-offset-2">JSON</ApiLink>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      <Dialog open={!!duelChoice && tab !== "duels"} onClose={() => setDuel(null)} title={duelChoice ? `${names.get(duelChoice.a)} ${t("tournaments.vs")} ${names.get(duelChoice.b)}` : ""} wide>
        {duelChoice && byId(duelChoice.a) && byId(duelChoice.b) && <DuelTable a={byId(duelChoice.a)!} b={byId(duelChoice.b)!} config={tr.config} scores={live.scores} weighted={live.weighted} />}
      </Dialog>
    </div>
  );
}

function DuelPicker({ participants, value, onChange }: { participants: { id: string; name: string }[]; value: { a: string; b: string } | null; onChange: (v: { a: string; b: string }) => void }) {
  const { t } = useT();
  const a = value?.a ?? participants[0]?.id ?? "";
  const b = value?.b ?? participants[1]?.id ?? "";
  return (
    <div className="grid grid-cols-2 gap-2">
      <Select value={a} onChange={(e) => onChange({ a: e.target.value, b })} aria-label={t("tournaments.pickA")} data-testid="duel-a">{participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
      <Select value={b} onChange={(e) => onChange({ a, b: e.target.value })} aria-label={t("tournaments.pickB")} data-testid="duel-b">{participants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
    </div>
  );
}

function CategoryCards({ rankings, config, names, byId }: { rankings: CategoryRanking[]; config: TournamentRecord["config"]; names: Map<string, string>; byId: (id: string) => { imageId: string | null; name: string } | undefined }) {
  const { t, lang } = useT();
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="category-cards">
      {rankings.map((r) => {
        const cat = config.categories.find((c) => c.id === r.categoryId)!;
        return (
          <Card key={r.categoryId} data-testid={`category-${r.categoryId}`}>
            <CardHeader title={categoryName(cat.id, cat.name, lang)} subtitle={r.decidable ? (r.tied ? t("tournaments.shared") : undefined) : t("tournaments.notDecidable")} icon={<Trophy size={16} className={r.decidable ? "text-amber" : "text-fg-3"} />} />
            <CardBody className="space-y-2">
              {r.decidable ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    {r.winners.map((w) => (
                      <span key={w} className="flex items-center gap-2 rounded-lg bg-amber-soft border border-amber/30 px-2 py-1 text-sm"><FaceThumb imageId={byId(w)?.imageId} label={names.get(w)} size={24} className="rounded-full" />{names.get(w)} <span className="font-mono text-xs">{formatPsl(r.entries.find((e) => e.participantId === w)?.score ?? null)}</span></span>
                    ))}
                  </div>
                  <ol className="text-xs text-fg-2 space-y-0.5">
                    {r.entries.filter((e) => e.rank != null).slice(0, 5).map((e) => <li key={e.participantId} className="flex justify-between"><span>{e.rank}. {names.get(e.participantId)}</span><span className="font-mono">{formatPsl(e.score)}</span></li>)}
                    {r.entries.filter((e) => e.rank == null).map((e) => <li key={e.participantId} className="flex justify-between text-fg-3"><span>— {names.get(e.participantId)}</span><span>{t("tournaments.notAssessable")}</span></li>)}
                  </ol>
                  {r.margin != null && <div className="text-[11px] text-fg-3">{t("tournaments.margin")}: {r.margin.toFixed(2)}</div>}
                </>
              ) : (
                <div className="text-xs text-fg-3">{t("tournaments.noWinner")}</div>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

function ResultsView({ tr, results, names, byId }: { tr: TournamentRecord; results: TournamentResults; names: Map<string, string>; byId: (id: string) => { imageId: string | null; name: string; rating: { score: number | null; coverage: number } } | undefined }) {
  const { t, lang } = useT();
  const winners = results.officialWinnerIds;
  const tierOf = (score: number | null) => (score == null ? null : assignTier(tr.scaleSnapshot, score));
  return (
    <div className="space-y-6" data-testid="tournament-results">
      <Card strong>
        <CardHeader title={winners.length > 1 ? t("tournaments.overallWinners") : t("tournaments.overallWinner")} subtitle={t("tournaments.officialBy", { method: t(`tournaments.winnerMethods.${results.officialMethod}`) }) + (results.overallTieBreak ? ` · ${t(`tournaments.decidedBy.${results.overallTieBreak}`)}` : "")} icon={<Trophy size={18} className="text-amber" />} />
        <CardBody className="flex flex-wrap gap-6">
          {winners.length === 0 && <div className="text-sm text-fg-3">{t("tournaments.noWinner")}</div>}
          {winners.map((w) => {
            const p = byId(w);
            const entry = results.overall.find((e) => e.participantId === w);
            return (
              <div key={w} className="flex items-center gap-4" data-testid="overall-winner">
                <FaceThumb imageId={p?.imageId} label={names.get(w)} size={96} className="rounded-2xl ring-2 ring-amber/60" />
                <div>
                  <div className="font-display text-2xl font-bold">{names.get(w)}</div>
                  <div className="flex items-center gap-2 mt-1"><span className="font-mono num text-lg">{formatPsl(p?.rating.score ?? null)}</span><TierBadge tier={tierOf(p?.rating.score ?? null)} size="sm" /></div>
                  <div className="text-xs text-fg-2 mt-1">{t("tournaments.weightedScore")} {formatPsl(entry?.weightedScore ?? null)} · #{entry?.rank ?? "—"} · {t("tournaments.categoryWins")}: {entry?.categoryWins.length ?? 0}</div>
                  {results.knockoutChampionId && <div className="text-xs text-fg-3">{t("tournaments.champion")}: {names.get(results.knockoutChampionId)}</div>}
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <div>
        <h2 className="font-display text-xl font-semibold mb-3">{t("tournaments.categoryWinners")}</h2>
        <CategoryCards rankings={results.categoryRankings} config={tr.config} names={names} byId={byId} />
      </div>

      <Card>
        <CardHeader title={t("tournaments.finalRanking")} />
        <CardBody className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="final-ranking">
            <thead className="text-fg-3 uppercase tracking-wider text-[10px]"><tr><th className="text-left py-2">#</th><th className="text-left py-2">{t("tournaments.displayName")}</th><th className="text-right py-2">{t("tournaments.weightedScore")}</th><th className="text-right py-2">{t("tournaments.overallFace")}</th><th className="text-left py-2 pl-3">{t("rater.result.tier")}</th><th className="text-left py-2 pl-3">{t("tournaments.categoryWins")}</th></tr></thead>
            <tbody>
              {results.overall.map((e) => {
                const p = byId(e.participantId);
                return (
                  <tr key={e.participantId} className={cn("border-t border-line", e.rank === 1 && "text-amber")}>
                    <td className="py-2 font-mono">{e.rank ?? "—"}</td>
                    <td className="py-2"><span className="flex items-center gap-2"><FaceThumb imageId={p?.imageId} label={names.get(e.participantId)} size={28} className="rounded-full" />{names.get(e.participantId)}</span></td>
                    <td className="py-2 text-right font-mono num">{formatPsl(e.weightedScore)}</td>
                    <td className="py-2 text-right font-mono num">{formatPsl(p?.rating.score ?? null)}</td>
                    <td className="py-2 pl-3"><TierBadge tier={tierOf(p?.rating.score ?? null)} size="sm" /></td>
                    <td className="py-2 pl-3 text-xs text-fg-2">{e.categoryWins.map((c) => categoryName(c, tr.config.categories.find((x) => x.id === c)?.name ?? c, lang)).join(", ") || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4" data-testid="tournament-stats">
        <StatTile label={t("tournaments.statLabels.participants")} value={results.stats.participants} />
        <StatTile label={t("tournaments.statLabels.matches")} value={results.stats.matches} tone="cyan" />
        <StatTile label={t("tournaments.statLabels.categories")} value={`${results.stats.decidableCategories}/${results.stats.categories}`} tone="violet" sub={t("tournaments.statLabels.decidable")} />
        <StatTile label={t("tournaments.statLabels.mostWins")} value={results.stats.mostCategoryWins[0]?.wins ?? 0} sub={results.stats.mostCategoryWins.map((m) => names.get(m.participantId)).join(", ")} tone="amber" />
        <StatTile label={t("tournaments.statLabels.highest")} value={results.stats.highestSingleScore ? formatPsl(results.stats.highestSingleScore.score) : "—"} sub={results.stats.highestSingleScore ? `${names.get(results.stats.highestSingleScore.participantId)} · ${criterionName(results.stats.highestSingleScore.criterionId, lang)}` : undefined} tone="mint" />
        <StatTile label={t("tournaments.statLabels.closest")} value={results.stats.closestMatch ? results.stats.closestMatch.margin.toFixed(2) : "—"} sub={results.stats.closestMatch ? `${names.get(results.stats.closestMatch.a)} ${t("tournaments.vs")} ${names.get(results.stats.closestMatch.b)}` : undefined} tone="rose" />
        <StatTile label={t("tournaments.statLabels.duration")} value={results.stats.durationMs != null ? `${Math.max(1, Math.round(results.stats.durationMs / 1000))} s` : "—"} tone="muted" />
        <StatTile label={t("common.createdAt")} value={fmt.date(results.computedAt, lang)} tone="muted" />
      </div>
    </div>
  );
}
