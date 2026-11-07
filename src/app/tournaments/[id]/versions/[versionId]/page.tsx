import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TournamentView } from "@/components/tournaments/tournament-view";
import { requireUser } from "@/server/auth";
import { getTournament, getTournamentVersion } from "@/server/repos-psl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Archived tournament version" };

export default async function ArchivedVersionPage({ params }: { params: Promise<{ id: string; versionId: string }> }) {
  const { id, versionId } = await params;
  const user = await requireUser(`/tournaments/${id}/versions/${versionId}`);
  const current = getTournament(user.id, id);
  const archived = getTournamentVersion(user.id, id, versionId);
  if (!current || !archived) notFound();
  return <TournamentView tournament={archived} versions={[]} readOnly={{ currentVersion: current.version }} />;
}
