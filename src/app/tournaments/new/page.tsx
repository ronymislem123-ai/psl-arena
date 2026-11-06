import type { Metadata } from "next";
import { TournamentWizard } from "@/components/tournaments/tournament-wizard";
import { requireUser } from "@/server/auth";
import { latestRatings, listScales } from "@/server/repos-psl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New tournament" };

export default async function NewTournamentPage() {
  const user = await requireUser("/tournaments/new");
  return <TournamentWizard latest={latestRatings(user.id)} scales={listScales(user.id)} />;
}
