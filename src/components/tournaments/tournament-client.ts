"use client";
/** Client-side helpers over the pure tournament engine (live standings, duels). */
import { allCategoryScores, categoryRankings, overallRanking, weightedOverall } from "@/engine/tournament/engine";
import type { ParticipantData, TournamentConfig } from "@/engine/tournament/types";
import type { TournamentRecord } from "@/server/repos-psl";

export function participantsOf(t: TournamentRecord): ParticipantData[] {
  return t.participants.map((p) => ({ id: p.id, name: p.displayName, imageId: p.imageId, rating: p.rating, seed: p.seed }));
}

export function liveStandings(t: TournamentRecord) {
  const participants = participantsOf(t);
  const scores = allCategoryScores(participants, t.config);
  const rankings = categoryRankings(scores, t.config);
  const overall = overallRanking(participants, scores, rankings, t.config);
  const weighted = weightedOverall(participants, scores, t.config);
  return { participants, scores, rankings, overall, weighted };
}

export function weightSum(config: TournamentConfig): number {
  return config.categories.reduce((s, c) => s + Math.max(0, c.weight), 0);
}
