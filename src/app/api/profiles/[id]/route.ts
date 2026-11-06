import { requireUserApi } from "@/server/auth";
import { updateProfileSchema } from "@/server/schemas";
import { fail, ok, readJson, type Params } from "@/server/http";
import { deleteProfile, getProfile, listAnalyses, updateProfile } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const profile = getProfile(user.id, id);
    if (!profile) return ok({ error: "Not found" }, { status: 404 });
    return ok({ profile, analyses: listAnalyses(user.id, { profileId: id }) });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    const body = updateProfileSchema.parse(await readJson(req));
    const profile = updateProfile(user.id, id, body);
    if (!profile) return ok({ error: "Not found" }, { status: 404 });
    return ok({ profile });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request, { params }: Params<"id">) {
  try {
    const user = requireUserApi(req);
    const { id } = await params;
    return ok({ deleted: deleteProfile(user.id, id) });
  } catch (e) {
    return fail(e);
  }
}
