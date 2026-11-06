import { requireUserApi } from "@/server/auth";
import { fail, ok, type Params } from "@/server/http";
import { getTournamentVersion } from "@/server/repos-psl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"id" | "versionId">) {
  try {
    const user = requireUserApi(req);
    const { id, versionId } = await params;
    const tournament = getTournamentVersion(user.id, id, versionId);
    if (!tournament) return ok({ error: "Not found" }, { status: 404 });
    return ok({ tournament });
  } catch (e) {
    return fail(e);
  }
}
