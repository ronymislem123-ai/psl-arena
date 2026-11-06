import { requireUserApi } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { listAnalyses, listBattles, listProfiles, stats } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUserApi(req);
    return ok({ stats: stats(user.id), recentBattles: listBattles(user.id, 6), recentAnalyses: listAnalyses(user.id, { limit: 6 }), profiles: listProfiles(user.id).slice(0, 8) });
  } catch (e) {
    return fail(e);
  }
}
