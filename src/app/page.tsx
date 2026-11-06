import { requireUser } from "@/server/auth";
import { listAnalyses, listBattles, listProfiles, stats } from "@/server/repos";
import { listRatings, listTournaments } from "@/server/repos-psl";
import { Dashboard } from "@/components/dashboard/dashboard";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser("/");
  return <Dashboard stats={stats(user.id)} recentBattles={listBattles(user.id, 6)} recentAnalyses={listAnalyses(user.id, { limit: 6 })} profiles={listProfiles(user.id).slice(0, 8)} recentRatings={listRatings(user.id, { limit: 6 })} recentTournaments={listTournaments(user.id, 6)} />;
}
