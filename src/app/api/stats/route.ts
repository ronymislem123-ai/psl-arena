import { fail, ok } from "@/server/http";
import { listAnalyses, listBattles, listProfiles, stats } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ stats: stats(), recentBattles: listBattles(6), recentAnalyses: listAnalyses({ limit: 6 }), profiles: listProfiles().slice(0, 8) });
  } catch (e) {
    return fail(e);
  }
}
