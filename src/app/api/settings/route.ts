import { settingsSchema } from "@/server/schemas";
import { fail, ok, readJson } from "@/server/http";
import { getSettings, setSettings } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ settings: getSettings() });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const body = settingsSchema.parse(await readJson(req));
    return ok({ settings: setSettings(body) });
  } catch (e) {
    return fail(e);
  }
}
