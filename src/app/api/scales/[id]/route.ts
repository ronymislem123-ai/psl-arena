import { requireUserApi } from "@/server/auth";
import { fail, ok, readJson, type Params } from "@/server/http";
import { deleteScale, getScale } from "@/server/repos-psl";
import { scaleInputSchema } from "@/server/schemas";
import { saveScale } from "@/server/services-psl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const scale = getScale(user.id, id);
    if (!scale) return ok({ error: "Not found" }, { status: 404 });
    return ok({ scale });
  } catch (e) {
    return fail(e);
  }
}

export async function PUT(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const body = scaleInputSchema.parse(await readJson(req));
    return ok({ scale: saveScale(user.id, id, body) });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    return ok({ deleted: deleteScale(user.id, id) });
  } catch (e) {
    return fail(e);
  }
}
