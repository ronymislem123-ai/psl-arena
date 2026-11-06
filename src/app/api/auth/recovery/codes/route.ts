import { recoveryCodeStatus, regenerateRecoveryCodes, requireUserApi } from "@/server/auth";
import { fail, ok, readJson } from "@/server/http";
import { regenerateCodesSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUserApi(req);
    return ok(recoveryCodeStatus(user.id));
  } catch (e) {
    return fail(e);
  }
}

/** Re-authenticates with the password and returns a fresh set of codes (shown once). */
export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = regenerateCodesSchema.parse(await readJson(req));
    const codes = regenerateRecoveryCodes(user.id, body.password);
    return ok({ codes, ...recoveryCodeStatus(user.id) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
