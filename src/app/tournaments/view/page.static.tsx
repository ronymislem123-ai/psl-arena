"use client";
import { TournamentView } from "@/components/tournaments/tournament-view";
import { getTournament, listTournamentVersions } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

export default function TournamentPage() {
  return (
    <LocalPage
      title="Tournament"
      load={({ userId, query }) => {
        const id = query.get("id") ?? "";
        const tournament = getTournament(userId, id);
        return tournament ? <TournamentView tournament={tournament} versions={listTournamentVersions(userId, id)} /> : null;
      }}
    />
  );
}
