import { changePassword, destroyOtherSessions, requireUserApi, tokenFromRequest } from "@/server/auth";
import { fail, ok, readJson } from "@/server/http";
import { changePasswordSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = changePasswordSchema.parse(await readJson(req));
    changePassword(user.id, body.currentPassword, body.newPassword);
    destroyOtherSessions(user.id, tokenFromRequest(req));
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
