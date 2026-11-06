import { requireUserApi } from "@/server/auth";
import { settingsSchema } from "@/server/schemas";
import { fail, ok, readJson } from "@/server/http";
import { getSettings, setSettings } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUserApi(req);
    return ok({ settings: getSettings(user.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = settingsSchema.parse(await readJson(req));
    return ok({ settings: setSettings(user.id, body) });
  } catch (e) {
    return fail(e);
  }
}
