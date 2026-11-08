"use client";
import { History } from "@/components/history/history";
import { listAnalyses, listBattles, listSideAnalyses } from "@/server/repos";
import { listRatings, listTournaments } from "@/server/repos-psl";
import { LocalPage } from "@/static/local-page";

export default function HistoryPage() {
  return (
    <LocalPage
      title="History"
      load={({ userId }) => <History battles={listBattles(userId, 200)} analyses={listAnalyses(userId, { limit: 200 })} sideAnalyses={listSideAnalyses(userId, { limit: 200 })} ratings={listRatings(userId, { limit: 200 })} tournaments={listTournaments(userId, 200)} />}
    />
  );
}
