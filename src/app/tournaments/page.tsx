import type { Metadata } from "next";
import { TournamentsList } from "@/components/tournaments/tournaments-list";
import { requireUser } from "@/server/auth";
import { listTournaments } from "@/server/repos-psl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tournaments" };

export default async function TournamentsPage() {
  const user = await requireUser("/tournaments");
  return <TournamentsList tournaments={listTournaments(user.id)} />;
}
