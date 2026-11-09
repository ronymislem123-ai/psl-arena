import { requireUserApi } from "@/server/auth";
import { fail, ok } from "@/server/http";
import { getRating, latestRatings } from "@/server/repos-psl";
import { DEFAULT_CATEGORIES, DEFAULT_TOURNAMENT_CONFIG } from "@/engine/tournament/categories";
import { allCategoryScores, categoryRankings } from "@/engine/tournament/engine";
import type { ParticipantData } from "@/engine/tournament/types";
import { RUBRIC_VERSION } from "@/engine/psl/rubric";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Category leaderboards over the newest rating of every profile. Only ratings of the
 * current rubric (3.0, front profile) are ranked; profiles whose newest rating uses
 * an older method are counted in `legacyExcluded` instead of being mixed in.
 */
export async function GET(req: Request) {
  try {
    const user = requireUserApi(req);
    const all = latestRatings(user.id);
    const latest = all.filter((r) => r.rubricVersion === RUBRIC_VERSION);
    const participants: ParticipantData[] = latest
      .map((r, i) => {
        const full = getRating(user.id, r.id);
        return full ? { id: r.profileId, name: r.profileLabel, imageId: r.profileImageId, rating: full.result, seed: i + 1 } : null;
      })
      .filter((p): p is ParticipantData => !!p);
    const config = { ...DEFAULT_TOURNAMENT_CONFIG, categories: DEFAULT_CATEGORIES };
    const scores = allCategoryScores(participants, config);
    const rankings = categoryRankings(scores, config);
    return ok({ participants: participants.map((p) => ({ id: p.id, name: p.name, imageId: p.imageId, score: p.rating.score, tier: p.rating.tier?.name ?? null })), categories: config.categories.map((c) => ({ id: c.id, name: c.name })), rankings, legacyExcluded: all.length - latest.length });
  } catch (e) {
    return fail(e);
  }
}
