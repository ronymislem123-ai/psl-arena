import { requireUserApi } from "@/server/auth";
import { fail, ok, readJson, type Params } from "@/server/http";
import { getTournament } from "@/server/repos-psl";
import { updateTournamentSchema } from "@/server/schemas";
import { removeTournament, updateTournamentDraft } from "@/server/services-psl";
import type { TournamentConfig } from "@/engine/tournament/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const tournament = getTournament(user.id, id);
    if (!tournament) return ok({ error: "Not found" }, { status: 404 });
    const url = new URL(req.url);
    if (url.searchParams.get("download") === "1") return ok({ tournament }, { headers: { "Content-Disposition": `attachment; filename="psl-tournament-${id}.json"` } });
    return ok({ tournament });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const body = updateTournamentSchema.parse(await readJson(req));
    return ok({ tournament: updateTournamentDraft(user.id, id, { ...body, config: body.config as TournamentConfig | undefined }) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    return ok({ deleted: removeTournament(user.id, id) });
  } catch (e) {
    return fail(e);
  }
}
