import { requireUserApi } from "@/server/auth";
import { createAnalysisSchema } from "@/server/schemas";
import { fail, ok, readJson } from "@/server/http";
import { listAnalyses } from "@/server/repos";
import { createAnalysis } from "@/server/services";
import type { AnalysisInput } from "@/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUserApi(req);
    const url = new URL(req.url);
    const profileId = url.searchParams.get("profileId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? 100);
    return ok({ analyses: listAnalyses(user.id, { profileId, limit: Number.isFinite(limit) ? limit : 100 }) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = createAnalysisSchema.parse(await readJson(req));
    const record = createAnalysis(user.id, {
      profileId: body.profileId,
      profileLabel: body.profileLabel,
      imageDataUrl: body.imageDataUrl,
      storeImage: body.storeImage,
      input: body.input as AnalysisInput,
    });
    return ok({ analysis: record }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
