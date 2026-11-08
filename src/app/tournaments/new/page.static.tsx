"use client";
import { TournamentWizard } from "@/components/tournaments/tournament-wizard";
import { latestRatings, listScales } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

export default function NewTournamentPage() {
  return <LocalPage title="New tournament" load={({ userId }) => <TournamentWizard latest={latestRatings(userId)} scales={listScales(userId)} />} />;
}
