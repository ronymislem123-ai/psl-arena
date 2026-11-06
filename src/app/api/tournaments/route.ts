import { requireUserApi } from "@/server/auth";
import { fail, ok, readJson } from "@/server/http";
import { listTournaments } from "@/server/repos-psl";
import { createTournamentSchema } from "@/server/schemas";
import { createTournament } from "@/server/services-psl";
import type { TournamentConfig } from "@/engine/tournament/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUserApi(req);
    return ok({ tournaments: listTournaments(user.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = createTournamentSchema.parse(await readJson(req));
    return ok({ tournament: createTournament(user.id, { ...body, config: body.config as TournamentConfig }) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
