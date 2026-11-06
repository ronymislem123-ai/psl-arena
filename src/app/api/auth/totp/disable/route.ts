import { disableTotp, requireUserApi } from "@/server/auth";
import { fail, ok, readJson } from "@/server/http";
import { totpDisableSchema } from "@/server/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = totpDisableSchema.parse(await readJson(req));
    return ok(disableTotp(user.id, body.password, body.code));
  } catch (e) {
    return fail(e);
  }
}
