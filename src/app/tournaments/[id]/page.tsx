import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TournamentView } from "@/components/tournaments/tournament-view";
import { requireUser } from "@/server/auth";
import { getTournament, listTournamentVersions } from "@/server/repos-psl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tournament" };

export default async function TournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/tournaments/${id}`);
  const tournament = getTournament(user.id, id);
  if (!tournament) notFound();
  return <TournamentView tournament={tournament} versions={listTournamentVersions(user.id, id)} />;
}
