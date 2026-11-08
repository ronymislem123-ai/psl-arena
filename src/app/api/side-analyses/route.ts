import { requireUserApi } from "@/server/auth";
import { createSideAnalysisSchema } from "@/server/schemas";
import { fail, ok, readJson } from "@/server/http";
import { listSideAnalyses } from "@/server/repos";
import { createSideAnalysis } from "@/server/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = requireUserApi(req);
    const url = new URL(req.url);
    const profileId = url.searchParams.get("profileId") ?? undefined;
    const limit = Number(url.searchParams.get("limit") ?? 100);
    return ok({ sideAnalyses: listSideAnalyses(user.id, { profileId, limit: Number.isFinite(limit) ? limit : 100 }) });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = requireUserApi(req);
    const body = createSideAnalysisSchema.parse(await readJson(req));
    const record = createSideAnalysis(user.id, {
      profileId: body.profileId,
      profileLabel: body.profileLabel,
      imageDataUrl: body.imageDataUrl,
      storeImage: body.storeImage,
      imageWidth: body.imageWidth,
      imageHeight: body.imageHeight,
      points: body.points,
      reference: body.reference,
    });
    return ok({ sideAnalysis: record }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
