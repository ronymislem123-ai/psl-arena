import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { TournamentWizard } from "@/components/tournaments/tournament-wizard";
import { requireUser } from "@/server/auth";
import { getTournament, latestRatings, listScales } from "@/server/repos-psl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit tournament" };

export default async function EditTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/tournaments/${id}/edit`);
  const tournament = getTournament(user.id, id);
  if (!tournament) notFound();
  if (tournament.status !== "draft") redirect(`/tournaments/${id}`);
  return <TournamentWizard latest={latestRatings(user.id)} scales={listScales(user.id)} existing={tournament} />;
}
