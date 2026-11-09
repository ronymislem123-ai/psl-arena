"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Plus, Trash2, Trophy } from "lucide-react";
import { PageHeader } from "@/components/layout/app-shell";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/controls";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { fmt } from "@/lib/utils";
import type { TournamentSummary } from "@/server/repos-psl";
import { paths } from "@/lib/paths";

export const STATUS_TONE: Record<string, Tone> = { draft: "muted", running: "cyan", paused: "amber", completed: "mint" };

export function TournamentsList({ tournaments }: { tournaments: TournamentSummary[] }) {
  const { t, lang } = useT();
  const router = useRouter();
  const del = async (id: string) => {
    if (!confirm(t("tournaments.deleteConfirm"))) return;
    await api.deleteTournament(id);
    router.refresh();
  };
  const dup = async (id: string) => {
    const r = await api.tournamentAction(id, { action: "duplicate" });
    router.push(paths.tournament(r.tournament.id));
    router.refresh();
  };
  return (
    <div className="space-y-6">
      <PageHeader kicker={t("navPsl.tournaments")} title={t("tournaments.title")} subtitle={t("tournaments.sub")} action={<Link href="/tournaments/new"><Button data-testid="tournament-new"><Plus size={16} /> {t("tournaments.newTournament")}</Button></Link>} />
      {tournaments.length === 0 ? (
        <Empty>{t("tournaments.empty")}</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="tournaments-list">
          {tournaments.map((tr) => (
            <Card key={tr.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={paths.tournament(tr.id)} className="font-display text-lg font-semibold hover:text-accent block truncate">{tr.name}</Link>
                  <div className="text-xs text-fg-3">{t(`tournaments.formats.${tr.format}`)} · {t("tournaments.nParticipants", { n: tr.participantCount })} · v{tr.version} · {fmt.date(tr.updatedAt, lang)}</div>
                </div>
                <Badge tone={STATUS_TONE[tr.status]}>{t(`tournaments.status.${tr.status}`)}</Badge>
              </div>
              {tr.winnerNames.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-amber"><Trophy size={14} /> <span className="truncate">{tr.winnerNames.join(", ")}</span></div>
              )}
              <p className="text-xs text-fg-2 line-clamp-2">{tr.description || t(`tournaments.formatHint.${tr.format}`)}</p>
              <div className="flex flex-wrap gap-1.5">
                <Link href={paths.tournament(tr.id)}><Button size="sm" variant="outline">{t("common.open")}</Button></Link>
                <Button size="sm" variant="ghost" onClick={() => dup(tr.id)} title={t("tournaments.duplicate")}><Copy size={14} /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(tr.id)} title={t("tournaments.delete")}><Trash2 size={14} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
