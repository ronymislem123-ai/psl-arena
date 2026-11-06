import { requireUserApi } from "@/server/auth";
import { fail, ok, readJson } from "@/server/http";
import { scaleImportSchema } from "@/server/schemas";
import { importScale } from "@/server/services-psl";
import type { ScaleExport } from "@/engine/psl/scale";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const raw = (await readJson(req)) as { data?: unknown; name?: string };
    const data = scaleImportSchema.parse(raw.data ?? raw);
    return ok({ scale: importScale(user.id, data as unknown as ScaleExport, raw.name) }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
