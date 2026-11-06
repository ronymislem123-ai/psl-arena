import { requireUserApi } from "@/server/auth";
import { fail, ok, readJson } from "@/server/http";
import { listScales } from "@/server/repos-psl";
import { scaleInputSchema } from "@/server/schemas";
import { saveNewScale } from "@/server/services-psl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUserApi(req);
    return ok({ scales: listScales(user.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = scaleInputSchema.parse(await readJson(req));
    return ok({ scale: saveNewScale(user.id, body) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
