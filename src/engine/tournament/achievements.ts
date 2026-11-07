/**
 * Cross-tournament achievements of one profile, derived from the awards of
 * completed tournaments. Thresholds are documented conventions (docs/COMPARE.md).
 */
export interface AwardLike {
  tournamentId: string;
  kind: "champion" | "overallWinner" | "categoryWinner" | "multiCategory";
  categoryId: string | null;
  categoryName: string | null;
  shared: boolean;
  count: number;
}

export type AchievementId = "firstWin" | "serialWinner" | "champion" | "specialist" | "allRounder" | "veteran" | "hatTrick";

export interface Achievement {
  id: AchievementId;
  earned: boolean;
  progress: number;
  target: number;
  params?: Record<string, string | number>;
}

export interface AchievementStats {
  tournamentsEntered: number;
  tournamentsWithAward: number;
  overallWins: number;
  championships: number;
  categoryWins: number;
  sharedCategoryWins: number;
  distinctCategories: number;
  mostWonCategory: { id: string; name: string; count: number } | null;
  multiCategoryTournaments: number;
}

export const ACHIEVEMENT_TARGETS: Record<AchievementId, number> = { firstWin: 1, serialWinner: 3, champion: 1, specialist: 3, allRounder: 5, veteran: 5, hatTrick: 1 };

export function computeAchievements(awards: AwardLike[], tournamentsEntered: number): { stats: AchievementStats; achievements: Achievement[] } {
  const categoryWins = awards.filter((a) => a.kind === "categoryWinner");
  const perCategory = new Map<string, { name: string; tournaments: Set<string> }>();
  for (const a of categoryWins) {
    const key = a.categoryId ?? "";
    const e = perCategory.get(key) ?? { name: a.categoryName ?? key, tournaments: new Set<string>() };
    e.tournaments.add(a.tournamentId);
    perCategory.set(key, e);
  }
  let most: AchievementStats["mostWonCategory"] = null;
  for (const [id, e] of perCategory) if (!most || e.tournaments.size > most.count) most = { id, name: e.name, count: e.tournaments.size };
  const stats: AchievementStats = {
    tournamentsEntered,
    tournamentsWithAward: new Set(awards.map((a) => a.tournamentId)).size,
    overallWins: awards.filter((a) => a.kind === "overallWinner").length,
    championships: awards.filter((a) => a.kind === "champion").length,
    categoryWins: categoryWins.length,
    sharedCategoryWins: categoryWins.filter((a) => a.shared).length,
    distinctCategories: perCategory.size,
    mostWonCategory: most,
    multiCategoryTournaments: awards.filter((a) => a.kind === "multiCategory").length,
  };
  const mk = (id: AchievementId, progress: number, params?: Achievement["params"]): Achievement => ({ id, earned: progress >= ACHIEVEMENT_TARGETS[id], progress: Math.min(progress, ACHIEVEMENT_TARGETS[id]), target: ACHIEVEMENT_TARGETS[id], params });
  const achievements: Achievement[] = [
    mk("firstWin", stats.categoryWins + stats.overallWins + stats.championships > 0 ? 1 : 0),
    mk("hatTrick", stats.multiCategoryTournaments),
    mk("champion", stats.championships),
    mk("serialWinner", stats.overallWins),
    mk("specialist", most?.count ?? 0, most ? { category: most.name } : undefined),
    mk("allRounder", stats.distinctCategories),
    mk("veteran", tournamentsEntered),
  ];
  return { stats, achievements };
}
