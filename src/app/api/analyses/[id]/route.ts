import { requireUserApi } from "@/server/auth";
import { fail, ok, type Params } from "@/server/http";
import { deleteAnalysis, getAnalysis } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const analysis = getAnalysis(user.id, id);
    if (!analysis) return ok({ error: "Not found" }, { status: 404 });
    return ok({ analysis });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    return ok({ deleted: deleteAnalysis(user.id, id) });
  } catch (e) {
    return fail(e);
  }
}
