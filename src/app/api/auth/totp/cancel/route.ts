import { cancelTotpEnrollment, requireUserApi, totpStatus } from "@/server/auth";
import { fail, ok } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    cancelTotpEnrollment(user.id);
    return ok(totpStatus(user.id));
  } catch (e) {
    return fail(e);
  }
}
