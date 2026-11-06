import { requireUserApi } from "@/server/auth";
import { fail, ok, readJson, type Params } from "@/server/http";
import { tierImageSchema } from "@/server/schemas";
import { addTierImage } from "@/server/services-psl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const body = tierImageSchema.parse(await readJson(req));
    return ok({ scale: addTierImage(user.id, id, body.tierId, body.imageDataUrl, body.width, body.height, body.caption) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
