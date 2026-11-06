import type { Metadata } from "next";
import { History } from "@/components/history/history";
import { listAnalyses, listBattles } from "@/server/repos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return <History battles={listBattles(200)} analyses={listAnalyses({ limit: 200 })} />;
}
