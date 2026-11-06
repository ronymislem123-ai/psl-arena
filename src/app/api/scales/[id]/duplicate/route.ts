import { requireUserApi } from "@/server/auth";
import { fail, ok, readJson, type Params } from "@/server/http";
import { duplicateScaleSchema } from "@/server/schemas";
import { duplicateScale } from "@/server/services-psl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const body = duplicateScaleSchema.parse(await readJson(req).catch(() => ({})));
    return ok({ scale: duplicateScale(user.id, id, body.name) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
