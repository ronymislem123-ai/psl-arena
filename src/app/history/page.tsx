import type { Metadata } from "next";
import { History } from "@/components/history/history";
import { requireUser } from "@/server/auth";
import { listAnalyses, listBattles } from "@/server/repos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  const user = await requireUser("/history");
  return <History battles={listBattles(user.id, 200)} analyses={listAnalyses(user.id, { limit: 200 })} />;
}
