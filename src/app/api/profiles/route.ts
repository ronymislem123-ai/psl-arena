import { requireUserApi } from "@/server/auth";
import { createProfileSchema } from "@/server/schemas";
import { fail, ok, readJson } from "@/server/http";
import { createProfile, listProfiles } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUserApi(req);
    return ok({ profiles: listProfiles(user.id) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = createProfileSchema.parse(await readJson(req));
    return ok({ profile: createProfile(user.id, body.label, body.note) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
