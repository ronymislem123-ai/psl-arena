"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Empty, Field, Select } from "@/components/ui/controls";
import { compareTournamentVersions, type TournamentLike } from "@/engine/tournament/compare";
import { useT } from "@/lib/i18n";
import { categoryName } from "@/lib/i18n/psl-texts";
import { cn, fmt } from "@/lib/utils";
import type { TournamentSummary, TournamentVersionRow } from "@/server/repos-psl";

export interface VersionOption {
  id: string;
  version: number;
  label: string;
  record: TournamentLike & { status: "draft" | "running" | "paused" | "completed" };
}

export function VersionsCompareView({ tournaments, tournamentId, versions, options, a, b }: { tournaments: TournamentSummary[]; tournamentId: string | null; versions: TournamentVersionRow[]; options: VersionOption[]; a: string | null; b: string | null }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [selA, setSelA] = useState(a ?? options[1]?.id ?? options[0]?.id ?? "");
  const [selB, setSelB] = useState(b ?? options[0]?.id ?? "");
  const diff = useMemo(() => {
    const x = options.find((o) => o.id === selA)?.record;
    const y = options.find((o) => o.id === selB)?.record;
    return x && y && selA !== selB ? compareTournamentVersions(x, y) : null;
  }, [options, selA, selB]);
  const changeTournament = (id: string) => router.push(`/compare?mode=versions&tournament=${id}`);
  const sameNames = (xs: string[], ys: string[]) => xs.length === ys.length && xs.every((v) => ys.includes(v));
  const cat = (id: string, name: string) => categoryName(id, name, lang);
  return (
    <div className="space-y-6" data-testid="versions-compare-view">
      <PageHeader kicker={t("navPsl.tournaments")} title={t("compareVersions.title")} subtitle={t("compareVersions.sub")} action={<Link href="/compare"><Button variant="outline" size="sm">{t("compare.pick")}</Button></Link>} />
      <Card>
        <CardBody className="pt-5 grid gap-3 sm:grid-cols-3">
          <Field label={t("compareVersions.pick")}>
            <Select value={tournamentId ?? ""} onChange={(e) => changeTournament(e.target.value)} className="w-full" data-testid="versions-tournament">
              <option value="">—</option>
              {tournaments.map((tr) => <option key={tr.id} value={tr.id}>{tr.name} (v{tr.version}, {t(`tournaments.status.${tr.status}`)})</option>)}
            </Select>
          </Field>
          <Field label={t("compareVersions.versionA")}>
            <Select value={selA} onChange={(e) => setSelA(e.target.value)} className="w-full" disabled={!options.length} data-testid="versions-a">{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
          </Field>
          <Field label={t("compareVersions.versionB")}>
            <Select value={selB} onChange={(e) => setSelB(e.target.value)} className="w-full" disabled={!options.length} data-testid="versions-b">{options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</Select>
          </Field>
        </CardBody>
      </Card>
      {!tournamentId ? (
        <Empty>{tournaments.length ? t("compareVersions.pick") : t("compareVersions.empty")}</Empty>
      ) : versions.length === 0 ? (
        <Empty>{t("compareVersions.noVersions")}</Empty>
      ) : !diff ? (
        <Empty>{t("compare.tooFew")}</Empty>
      ) : (
        <div className="space-y-5" data-testid="versions-diff">
          <div className="flex flex-wrap gap-2 text-xs">
            {[diff.a, diff.b].map((v, i) => (
              <Badge key={i} tone={i === 0 ? "muted" : "cyan"}>v{v.version} · {t(`tournaments.status.${v.status}`)} · {v.participants} {t("tournaments.participants").toLowerCase()}{v.completedAt ? ` · ${fmt.date(v.completedAt, lang)}` : ""}</Badge>
            ))}
            {options.filter((o) => o.id === selA || o.id === selB).filter((o) => o.id !== "current").map((o) => (
              <Link key={o.id} href={`/tournaments/${tournamentId}/versions/${o.id}`} className="underline underline-offset-2 text-fg-2 hover:text-fg-0">{t("compareVersions.openArchived")} (v{o.version}) →</Link>
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title={t("compareVersions.participants")} />
              <CardBody className="text-sm space-y-1">
                <div><span className="text-fg-3">{t("compareVersions.added")}:</span> {diff.participants.added.join(", ") || "—"}</div>
                <div><span className="text-fg-3">{t("compareVersions.removed")}:</span> {diff.participants.removed.join(", ") || "—"}</div>
                <div><span className="text-fg-3">{t("compareVersions.unchanged")}:</span> {diff.participants.unchanged}</div>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title={t("compareVersions.config")} />
              <CardBody className="text-sm space-y-1">
                {!diff.config.formatChanged && !diff.config.winnerMethodChanged && !diff.config.categoriesAdded.length && !diff.config.categoriesRemoved.length && !diff.config.weightChanges.length && <div className="text-fg-3">{t("compareVersions.noChanges")}</div>}
                {diff.config.formatChanged && <div><span className="text-fg-3">{t("compareVersions.format")}:</span> {t(`tournaments.formats.${diff.config.formatChanged[0]}`)} → {t(`tournaments.formats.${diff.config.formatChanged[1]}`)}</div>}
                {diff.config.winnerMethodChanged && <div><span className="text-fg-3">{t("compareVersions.winnerMethod")}:</span> {t(`tournaments.winnerMethods.${diff.config.winnerMethodChanged[0]}`)} → {t(`tournaments.winnerMethods.${diff.config.winnerMethodChanged[1]}`)}</div>}
                {diff.config.categoriesAdded.length > 0 && <div><span className="text-fg-3">{t("compareVersions.categoriesAdded")}:</span> {diff.config.categoriesAdded.join(", ")}</div>}
                {diff.config.categoriesRemoved.length > 0 && <div><span className="text-fg-3">{t("compareVersions.categoriesRemoved")}:</span> {diff.config.categoriesRemoved.join(", ")}</div>}
                {diff.config.weightChanges.length > 0 && <div><span className="text-fg-3">{t("compareVersions.weights")}:</span> {diff.config.weightChanges.map((w) => `${cat(w.id, w.name)} ${w.a} → ${w.b}`).join(", ")}</div>}
              </CardBody>
            </Card>
          </div>
          <Card>
            <CardHeader title={t("compareVersions.results")} subtitle={diff.results ? t("compareVersions.changedCategories", { n: diff.results.changedCategories, total: diff.results.categories.length }) : t("compareVersions.noResults")} />
            {diff.results && (
              <CardBody className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className={cn("rounded-lg border p-3", diff.results.overallWinners.changed ? "border-amber/40 bg-amber-soft" : "border-line")}>
                    <div className="text-[11px] uppercase tracking-wider text-fg-2">{t("compareVersions.overallWinners")} · {diff.results.overallWinners.changed ? t("compareVersions.changed") : t("compareVersions.unchangedLabel")}</div>
                    <div>{diff.results.overallWinners.a.join(", ") || "—"} → {diff.results.overallWinners.b.join(", ") || "—"}</div>
                  </div>
                  <div className={cn("rounded-lg border p-3", diff.results.champion.changed ? "border-amber/40 bg-amber-soft" : "border-line")}>
                    <div className="text-[11px] uppercase tracking-wider text-fg-2">{t("compareVersions.champion")} · {diff.results.champion.changed ? t("compareVersions.changed") : t("compareVersions.unchangedLabel")}</div>
                    <div>{diff.results.champion.a ?? "—"} → {diff.results.champion.b ?? "—"}</div>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-2 mb-1">{t("compareVersions.categoryWinners")}</div>
                  <table className="w-full text-sm" data-testid="versions-categories">
                    <tbody>
                      {diff.results.categories.map((c) => (
                        <tr key={c.id} className={cn("border-t border-line", c.changed && "text-amber")}><td className="py-1">{cat(c.id, c.name)}</td><td className="py-1">{c.a.join(", ") || "—"}</td><td className="py-1 text-fg-3">→</td><td className="py-1">{c.b.join(", ") || "—"}</td><td className="py-1 text-right text-xs">{c.changed ? t("compareVersions.changed") : sameNames(c.a, c.b) ? t("compareVersions.unchangedLabel") : ""}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-fg-2 mb-1">{t("compareVersions.ranking")}</div>
                  <table className="w-full text-sm" data-testid="versions-ranking">
                    <tbody>
                      {diff.results.ranking.map((r) => (
                        <tr key={r.name} className="border-t border-line"><td className="py-1">{r.name}</td><td className="py-1 text-right font-mono">{r.a ?? "—"}</td><td className="py-1 text-fg-3 text-center">→</td><td className="py-1 text-right font-mono">{r.b ?? "—"}</td><td className={cn("py-1 text-right font-mono text-xs", r.delta == null || r.delta === 0 ? "text-fg-3" : r.delta > 0 ? "text-mint" : "text-[#ff8fa3]")}>{r.delta == null ? "" : r.delta > 0 ? `▲${r.delta}` : r.delta < 0 ? `▼${-r.delta}` : "="}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
