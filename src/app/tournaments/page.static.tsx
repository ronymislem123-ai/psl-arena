"use client";
import { TournamentsList } from "@/components/tournaments/tournaments-list";
import { listTournaments } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

export default function TournamentsPage() {
  return <LocalPage title="Tournaments" load={({ userId }) => <TournamentsList tournaments={listTournaments(userId)} />} />;
}
