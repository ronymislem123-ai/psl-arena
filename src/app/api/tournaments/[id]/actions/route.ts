import { requireUserApi } from "@/server/auth";
import { fail, ok, readJson, type Params } from "@/server/http";
import { tournamentActionSchema } from "@/server/schemas";
import { runTournamentAction } from "@/server/services-psl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const body = tournamentActionSchema.parse(await readJson(req));
    const res = runTournamentAction(user.id, id, body.action, { matchId: body.matchId, winnerId: body.winnerId, note: body.note });
    return ok(res, { status: body.action === "duplicate" ? 201 : 200 });
  } catch (e) {
    return fail(e);
  }
}
