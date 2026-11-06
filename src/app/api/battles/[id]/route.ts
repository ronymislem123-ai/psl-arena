import { requireUserApi } from "@/server/auth";
import { fail, ok, type Params } from "@/server/http";
import { deleteBattle, getAnalysis, getBattle } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const battle = getBattle(user.id, id);
    if (!battle) return ok({ error: "Not found" }, { status: 404 });
    const full = new URL(req.url).searchParams.get("include") === "analyses";
    return ok(full ? { battle, analysisA: getAnalysis(user.id, battle.analysisAId), analysisB: getAnalysis(user.id, battle.analysisBId) } : { battle });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    return ok({ deleted: deleteBattle(user.id, id) });
  } catch (e) {
    return fail(e);
  }
}
