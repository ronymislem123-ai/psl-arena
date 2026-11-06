import type { Metadata } from "next";
import { History } from "@/components/history/history";
import { requireUser } from "@/server/auth";
import { listAnalyses, listBattles, listSideAnalyses } from "@/server/repos";
import { listRatings, listTournaments } from "@/server/repos-psl";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  const user = await requireUser("/history");
  return <History battles={listBattles(user.id, 200)} analyses={listAnalyses(user.id, { limit: 200 })} sideAnalyses={listSideAnalyses(user.id, { limit: 200 })} ratings={listRatings(user.id, { limit: 200 })} tournaments={listTournaments(user.id, 200)} />;
}
