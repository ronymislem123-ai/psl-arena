"use client";
import { TournamentView } from "@/components/tournaments/tournament-view";
import { getTournament, getTournamentVersion } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

export default function ArchivedVersionPage() {
  return (
    <LocalPage
      title="Archived tournament version"
      load={({ userId, query }) => {
        const id = query.get("id") ?? "";
        const current = getTournament(userId, id);
        const archived = getTournamentVersion(userId, id, query.get("v") ?? "");
        return current && archived ? <TournamentView tournament={archived} versions={[]} readOnly={{ currentVersion: current.version }} /> : null;
      }}
    />
  );
}
