import { createBattleSchema } from "@/server/schemas";
import { fail, ok, readJson } from "@/server/http";
import { listBattles } from "@/server/repos";
import { createBattle } from "@/server/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? 100);
    return ok({ battles: listBattles(Number.isFinite(limit) ? limit : 100) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = createBattleSchema.parse(await readJson(req));
    return ok({ battle: createBattle(body.analysisAId, body.analysisBId) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
