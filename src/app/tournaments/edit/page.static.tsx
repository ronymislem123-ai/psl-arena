"use client";
import { TournamentWizard } from "@/components/tournaments/tournament-wizard";
import { paths } from "@/lib/paths";
import { getTournament, latestRatings, listScales } from "@/server/repos-psl";
import { LocalPage, LocalRedirect } from "@/static/local-page";

export default function EditTournamentPage() {
  return (
    <LocalPage
      title="Edit tournament"
      load={({ userId, query }) => {
        const tournament = getTournament(userId, query.get("id") ?? "");
        if (!tournament) return null;
        if (tournament.status !== "draft") return <LocalRedirect to={paths.tournament(tournament.id)} />;
        return <TournamentWizard latest={latestRatings(userId)} scales={listScales(userId)} existing={tournament} />;
      }}
    />
  );
}
