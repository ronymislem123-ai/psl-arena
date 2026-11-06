import { updateProfileSchema } from "@/server/schemas";
import { fail, ok, readJson, type Params } from "@/server/http";
import { deleteProfile, getProfile, listAnalyses, updateProfile } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: Params<"id">) {
  try {
    const { id } = await params;
    const profile = getProfile(id);
    if (!profile) return ok({ error: "Not found" }, { status: 404 });
    return ok({ profile, analyses: listAnalyses({ profileId: id }) });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: Params<"id">) {
  try {
    const { id } = await params;
    const body = updateProfileSchema.parse(await readJson(req));
    const profile = updateProfile(id, body);
    if (!profile) return ok({ error: "Not found" }, { status: 404 });
    return ok({ profile });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: Request, { params }: Params<"id">) {
  try {
    const { id } = await params;
    return ok({ deleted: deleteProfile(id) });
  } catch (e) {
    return fail(e);
  }
}
