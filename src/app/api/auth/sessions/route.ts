import { destroyOtherSessions, requireUserApi, tokenFromRequest } from "@/server/auth";
import { fail, ok } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Signs the user out everywhere else (keeps the current session). */
export async function DELETE(req: Request) {
  try {
    const user = requireUserApi(req);
    destroyOtherSessions(user.id, tokenFromRequest(req));
    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
