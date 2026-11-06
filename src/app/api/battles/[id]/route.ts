import { fail, ok, type Params } from "@/server/http";
import { deleteBattle, getAnalysis, getBattle } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"id">) {
  try {
    const { id } = await params;
    const battle = getBattle(id);
    if (!battle) return ok({ error: "Not found" }, { status: 404 });
    const full = new URL(req.url).searchParams.get("include") === "analyses";
    return ok(full ? { battle, analysisA: getAnalysis(battle.analysisAId), analysisB: getAnalysis(battle.analysisBId) } : { battle });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, { params }: Params<"id">) {
  try {
    const { id } = await params;
    return ok({ deleted: deleteBattle(id) });
  } catch (e) {
    return fail(e);
  }
}
