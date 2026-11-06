import { requireUserApi } from "@/server/auth";
import { createBattleSchema } from "@/server/schemas";
import { fail, ok, readJson } from "@/server/http";
import { listBattles } from "@/server/repos";
import { createBattle } from "@/server/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUserApi(req);
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 100);
    return ok({ battles: listBattles(user.id, Number.isFinite(limit) ? limit : 100) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = createBattleSchema.parse(await readJson(req));
    return ok({ battle: createBattle(user.id, body.analysisAId, body.analysisBId) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
