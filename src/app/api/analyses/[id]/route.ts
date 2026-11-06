import { fail, ok, type Params } from "@/server/http";
import { deleteAnalysis, getAnalysis } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: Params<"id">) {
  try {
    const { id } = await params;
    const analysis = getAnalysis(id);
    if (!analysis) return ok({ error: "Not found" }, { status: 404 });
    return ok({ analysis });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, { params }: Params<"id">) {
  try {
    const { id } = await params;
    return ok({ deleted: deleteAnalysis(id) });
  } catch (e) {
    return fail(e);
  }
}
