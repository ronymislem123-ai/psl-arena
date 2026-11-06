import { createProfileSchema } from "@/server/schemas";
import { fail, ok, readJson } from "@/server/http";
import { createProfile, listProfiles } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok({ profiles: listProfiles() });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const body = createProfileSchema.parse(await readJson(req));
    return ok({ profile: createProfile(body.label, body.note) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
