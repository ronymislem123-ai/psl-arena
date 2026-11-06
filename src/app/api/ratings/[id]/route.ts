import { requireUserApi } from "@/server/auth";
import { fail, ok, type Params } from "@/server/http";
import { deleteRating, getRating } from "@/server/repos-psl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const rating = getRating(user.id, id);
    if (!rating) return ok({ error: "Not found" }, { status: 404 });
    const url = new URL(req.url);
    if (url.searchParams.get("download") === "1") return ok({ rating }, { headers: { "Content-Disposition": `attachment; filename="psl-rating-${id}.json"` } });
    return ok({ rating });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    return ok({ deleted: deleteRating(user.id, id) });
  } catch (e) {
    return fail(e);
  }
}
