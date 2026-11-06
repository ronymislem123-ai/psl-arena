import type { CriterionId } from "../psl/rubric";
import type { RatingResult } from "../psl/rating";

export type TournamentFormat = "knockout" | "group" | "ranking" | "category";
export type TournamentStatus = "draft" | "running" | "paused" | "completed";
export type Seeding = "rating" | "random" | "manual";
export type WinnerMethod = "weighted" | "knockout";

export interface TournamentCategory {
  id: string;
  name: string;
  /** rubric criteria that feed this category (weights are relative) */
  criteria: { id: CriterionId; weight: number }[];
  /** the category is the rubric's overall PSL score */
  overall?: boolean;
  /** share in the weighted overall tournament score (any scale; normalised) */
  weight: number;
  builtIn?: boolean;
}

export interface TournamentConfig {
  format: TournamentFormat;
  seeding: Seeding;
  /** seed for the deterministic random draw */
  randomSeed: number;
  winnerMethod: WinnerMethod;
  decisiveCategoryId: string;
  /** scores closer than this are a tie (PSL points) */
  tieEpsilon: number;
  groupSize: number;
  qualifyPerGroup: number;
  /** minimum share of a category's criterion weight that must be assessable */
  minCategoryCoverage: number;
  categories: TournamentCategory[];
}

export interface ParticipantData {
  id: string;
  name: string;
  imageId: string | null;
  rating: RatingResult;
  /** 1-based seed; manual order when seeding = manual */
  seed: number;
}

export type CategoryReason = "requiresProfile" | "inputsUnavailable" | "invalidRating" | "noCriteria";

export interface ParticipantCategoryScore {
  participantId: string;
  categoryId: string;
  score: number | null;
  assessable: boolean;
  /** assessable criterion weight / category criterion weight */
  coverage: number;
  reasonCode?: CategoryReason;
}

export interface RankedEntry {
  participantId: string;
  score: number | null;
  /** 1-based; tied participants share the same rank */
  rank: number | null;
}

export interface CategoryRanking {
  categoryId: string;
  decidable: boolean;
  reasonCode?: "tooFewAssessable";
  entries: RankedEntry[];
  winners: string[];
  second: string[];
  third: string[];
  /** gap between first and second score (null if undecidable) */
  margin: number | null;
  tied: boolean;
}

export type TieBreak = "score" | "tb1_overallFace" | "tb2_decisiveCategory" | "tb3_coverage" | "tied";

export interface OverallEntry {
  participantId: string;
  weightedScore: number | null;
  /** share of the category weights that were assessable for this participant */
  weightCoverage: number;
  rank: number | null;
  categoryWins: string[];
}

export interface Match {
  id: string;
  round: number;
  index: number;
  a: string | null;
  b: string | null;
  scoreA: number | null;
  scoreB: number | null;
  winner: string | null;
  status: "pending" | "decided" | "bye" | "tied" | "manual";
  decidedBy: TieBreak | "manual" | "bye" | null;
  margin: number | null;
}

export interface Bracket {
  size: number;
  byes: number;
  rounds: Match[][];
  /** winner of the last match, when decided */
  championId: string | null;
}

export interface GroupTableRow {
  participantId: string;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  scoreFor: number;
  rank: number;
}

export interface Group {
  id: string;
  name: string;
  participantIds: string[];
  fixtures: Match[];
  table: GroupTableRow[];
  qualified: string[];
}

export interface TournamentState {
  phase: "groups" | "knockout" | "ranking" | "done";
  /** next round to play in the current bracket (0-based) */
  currentRound: number;
  groups: Group[] | null;
  bracket: Bracket | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface TournamentStats {
  participants: number;
  matches: number;
  decidedMatches: number;
  categories: number;
  decidableCategories: number;
  mostCategoryWins: { participantId: string; wins: number }[];
  highestSingleScore: { participantId: string; criterionId: CriterionId; score: number } | null;
  closestMatch: { matchId: string; margin: number; a: string; b: string } | null;
  durationMs: number | null;
}

export interface TournamentResults {
  computedAt: string;
  categoryScores: ParticipantCategoryScore[];
  categoryRankings: CategoryRanking[];
  overall: OverallEntry[];
  overallWinnerIds: string[];
  overallTieBreak: TieBreak | null;
  knockoutChampionId: string | null;
  officialMethod: WinnerMethod;
  officialWinnerIds: string[];
  stats: TournamentStats;
}
