import { requireUserApi } from "@/server/auth";
import { fail, ok, type Params } from "@/server/http";
import { listTournamentVersions } from "@/server/repos-psl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    return ok({ versions: listTournamentVersions(user.id, id) });
  } catch (e) {
    return fail(e);
  }
}
