import { requireUserApi } from "@/server/auth";
import { fail, ok, readJson } from "@/server/http";
import { listRatings } from "@/server/repos-psl";
import { createRatingSchema } from "@/server/schemas";
import { createRating } from "@/server/services-psl";
import type { AnalysisInput } from "@/engine/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUserApi(req);
    const url = new URL(req.url);
    const profileId = url.searchParams.get("profileId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? 100);
    return ok({ ratings: listRatings(user.id, { profileId, limit: Number.isFinite(limit) ? limit : 100 }) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = createRatingSchema.parse(await readJson(req));
    const rating = await createRating(user.id, {
      analysisId: body.analysisId,
      newAnalysis: body.newAnalysis ? { ...body.newAnalysis, input: body.newAnalysis.input as AnalysisInput } : undefined,
      sideAnalysisId: body.sideAnalysisId,
      useLatestSide: body.useLatestSide,
      scaleId: body.scaleId,
      minCoverage: body.minCoverage,
      visualConsent: body.visualConsent,
      visualImageDataUrl: body.visualConsent ? body.visualImageDataUrl : undefined,
      lang: body.lang,
    });
    return ok({ rating }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
