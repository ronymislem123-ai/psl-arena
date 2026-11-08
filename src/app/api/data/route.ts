import { requireUserApi } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { deleteAllData, exportAll } from "@/server/repos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUserApi(req);
    return ok(exportAll(user.id), { headers: { "Content-Disposition": `attachment; filename="psl-arena-export-${Date.now()}.json"` } });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const user = requireUserApi(req);
    deleteAllData(user.id);
    return ok({ deleted: true });
  } catch (e) {
    return fail(e);
  }
}
