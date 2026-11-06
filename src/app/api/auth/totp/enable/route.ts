import { confirmTotpEnrollment, requireUserApi } from "@/server/auth";
import { fail, ok, readJson } from "@/server/http";
import { totpCodeSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = totpCodeSchema.parse(await readJson(req));
    return ok(confirmTotpEnrollment(user.id, body.code));
  } catch (e) {
    return fail(e);
  }
}
