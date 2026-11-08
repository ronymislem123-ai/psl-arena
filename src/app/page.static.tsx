"use client";
import { Dashboard } from "@/components/dashboard/dashboard";
import { listAnalyses, listBattles, listProfiles, stats } from "@/server/repos";
import { listRatings, listTournaments } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

export default function HomePage() {
  return (
    <LocalPage
      load={({ userId }) => (
        <Dashboard stats={stats(userId)} recentBattles={listBattles(userId, 6)} recentAnalyses={listAnalyses(userId, { limit: 6 })} profiles={listProfiles(userId).slice(0, 8)} recentRatings={listRatings(userId, { limit: 6 })} recentTournaments={listTournaments(userId, 6)} />
      )}
    />
  );
}
