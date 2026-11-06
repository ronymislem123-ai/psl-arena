import { requireUserApi } from "@/server/auth";
import { fail, ok, type Params } from "@/server/http";
import { exportScaleJson } from "@/server/services-psl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const data = exportScaleJson(user.id, id);
    return ok(data, { headers: { "Content-Disposition": `attachment; filename="psl-scale-${data.scale.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.json"` } });
  } catch (e) {
    return fail(e);
  }
}
