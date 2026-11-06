import { listAnalyses, listBattles, listProfiles, stats } from "@/server/repos";
import { Dashboard } from "@/components/dashboard/dashboard";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const s = stats();
  return <Dashboard stats={s} recentBattles={listBattles(6)} recentAnalyses={listAnalyses({ limit: 6 })} profiles={listProfiles().slice(0, 8)} />;
}
