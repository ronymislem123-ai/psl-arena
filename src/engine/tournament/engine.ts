/**
 * Tournament engine: independent per-participant ratings (same rubric, same
 * scale) are compared mathematically. Category winners come from the category
 * scores alone; the weighted overall never changes who wins a category.
 */
import { createRng } from "../geometry";
import type { CriterionId } from "../psl/rubric";
import { normalizeWeights } from "./categories";
import type { Bracket, CategoryRanking, Group, GroupTableRow, Match, OverallEntry, ParticipantCategoryScore, ParticipantData, RankedEntry, Seeding, TieBreak, TournamentCategory, TournamentConfig, TournamentResults, TournamentState, TournamentStats } from "./types";

// ------------------------------------------------------------------ category scores
export function categoryScore(p: ParticipantData, cat: TournamentCategory, minCoverage: number): ParticipantCategoryScore {
  const base = { participantId: p.id, categoryId: cat.id };
  if (cat.overall) {
    if (p.rating.score == null) return { ...base, score: null, assessable: false, coverage: 0, reasonCode: "invalidRating" };
    return { ...base, score: p.rating.score, assessable: true, coverage: p.rating.coverage };
  }
  if (cat.area) {
    const a = p.rating.areas.find((x) => x.id === cat.area);
    if (!a || a.score == null) return { ...base, score: null, assessable: false, coverage: a?.coverage ?? 0, reasonCode: a && a.coverage === 0 && p.rating.criteria.some((c) => c.area === cat.area && c.notAssessableCode === "requiresProfile") ? "requiresProfile" : "inputsUnavailable" };
    if (a.coverage < minCoverage) return { ...base, score: null, assessable: false, coverage: a.coverage, reasonCode: "inputsUnavailable" };
    return { ...base, score: a.score, assessable: true, coverage: a.coverage };
  }
  if (!cat.criteria.length) return { ...base, score: null, assessable: false, coverage: 0, reasonCode: "noCriteria" };
  const byId = new Map(p.rating.criteria.map((c) => [c.id, c]));
  let num = 0;
  let den = 0;
  let total = 0;
  let missingProfile = 0;
  for (const { id, weight } of cat.criteria) {
    total += weight;
    const c = byId.get(id);
    if (c?.assessable && c.score != null) {
      num += weight * c.score;
      den += weight;
    } else if (c?.notAssessableCode === "requiresProfile") missingProfile += weight;
  }
  const coverage = total > 0 ? den / total : 0;
  if (den === 0 || coverage < minCoverage) {
    return { ...base, score: null, assessable: false, coverage, reasonCode: missingProfile > 0 && missingProfile >= total - den - 1e-9 ? "requiresProfile" : missingProfile > 0 ? "requiresProfile" : "inputsUnavailable" };
  }
  return { ...base, score: num / den, assessable: true, coverage };
}

export function allCategoryScores(participants: ParticipantData[], config: TournamentConfig): ParticipantCategoryScore[] {
  const out: ParticipantCategoryScore[] = [];
  for (const cat of config.categories) for (const p of participants) out.push(categoryScore(p, cat, config.minCategoryCoverage));
  return out;
}

// ------------------------------------------------------------------ rankings with ties
function rankEntries(scored: { participantId: string; score: number }[], eps: number): RankedEntry[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score || a.participantId.localeCompare(b.participantId));
  const out: RankedEntry[] = [];
  let rank = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || sorted[i - 1].score - sorted[i].score > eps) rank = i + 1;
    out.push({ participantId: sorted[i].participantId, score: sorted[i].score, rank });
  }
  return out;
}

export function categoryRankings(scores: ParticipantCategoryScore[], config: TournamentConfig): CategoryRanking[] {
  return config.categories.map((cat) => {
    const mine = scores.filter((s) => s.categoryId === cat.id);
    const assessable = mine.filter((s): s is ParticipantCategoryScore & { score: number } => s.assessable && s.score != null);
    const ranked = rankEntries(assessable, config.tieEpsilon);
    const unranked: RankedEntry[] = mine.filter((s) => !s.assessable).map((s) => ({ participantId: s.participantId, score: null, rank: null }));
    const entries = [...ranked, ...unranked];
    if (assessable.length < 2) return { categoryId: cat.id, decidable: false, reasonCode: "tooFewAssessable", entries, winners: [], second: [], third: [], margin: null, tied: false };
    const byRank = (r: number) => ranked.filter((e) => e.rank === r).map((e) => e.participantId);
    const winners = byRank(1);
    const secondRank = ranked.find((e) => e.rank! > 1)?.rank ?? null;
    const second = secondRank ? byRank(secondRank) : [];
    const thirdRank = ranked.find((e) => e.rank! > (secondRank ?? 1))?.rank ?? null;
    const third = thirdRank ? byRank(thirdRank) : [];
    const top = ranked[0].score!;
    const next = ranked.find((e) => e.rank! > 1)?.score ?? null;
    return { categoryId: cat.id, decidable: true, entries, winners, second, third, margin: next == null ? null : top - next, tied: winners.length > 1 };
  });
}

// ------------------------------------------------------------------ overall weighted score + tie-breakers
export function weightedOverall(participants: ParticipantData[], scores: ParticipantCategoryScore[], config: TournamentConfig): Map<string, { score: number | null; weightCoverage: number }> {
  const weights = normalizeWeights(config.categories.filter((c) => c.weight > 0).length ? config.categories : config.categories);
  const out = new Map<string, { score: number | null; weightCoverage: number }>();
  for (const p of participants) {
    let num = 0;
    let den = 0;
    for (const cat of config.categories) {
      const w = weights.get(cat.id) ?? 0;
      if (w <= 0) continue;
      const s = scores.find((x) => x.participantId === p.id && x.categoryId === cat.id);
      if (s?.assessable && s.score != null) {
        num += w * s.score;
        den += w;
      }
    }
    out.set(p.id, { score: den >= 0.5 ? num / den : null, weightCoverage: den });
  }
  return out;
}

export interface Comparison {
  winner: string | null;
  decidedBy: TieBreak;
  margin: number;
}

/** Compares two participants: weighted score, then the three documented tie-breakers. Symmetric in a/b. */
export function compareParticipants(aId: string, bId: string, participants: ParticipantData[], scores: ParticipantCategoryScore[], overall: Map<string, { score: number | null }>, config: TournamentConfig): Comparison {
  const eps = config.tieEpsilon;
  const sa = overall.get(aId)?.score ?? null;
  const sb = overall.get(bId)?.score ?? null;
  const pa = participants.find((p) => p.id === aId)!;
  const pb = participants.find((p) => p.id === bId)!;
  const decide = (va: number | null, vb: number | null, by: TieBreak): Comparison | null => {
    if (va == null && vb == null) return null;
    if (va == null) return { winner: bId, decidedBy: by, margin: vb! };
    if (vb == null) return { winner: aId, decidedBy: by, margin: va };
    if (Math.abs(va - vb) <= eps) return null;
    return { winner: va > vb ? aId : bId, decidedBy: by, margin: Math.abs(va - vb) };
  };
  return (
    decide(sa, sb, "score") ??
    decide(pa.rating.score, pb.rating.score, "tb1_overallFace") ??
    decide(scores.find((s) => s.participantId === aId && s.categoryId === config.decisiveCategoryId)?.score ?? null, scores.find((s) => s.participantId === bId && s.categoryId === config.decisiveCategoryId)?.score ?? null, "tb2_decisiveCategory") ??
    decide(pa.rating.coverage, pb.rating.coverage, "tb3_coverage") ?? { winner: null, decidedBy: "tied", margin: 0 }
  );
}

export function overallRanking(participants: ParticipantData[], scores: ParticipantCategoryScore[], rankings: CategoryRanking[], config: TournamentConfig): { entries: OverallEntry[]; winnerIds: string[]; tieBreak: TieBreak | null } {
  const overall = weightedOverall(participants, scores, config);
  const scored = participants.filter((p) => overall.get(p.id)?.score != null);
  // sort by comparison (transitive within the documented tie-break chain)
  const sorted = [...scored].sort((a, b) => {
    const c = compareParticipants(a.id, b.id, participants, scores, overall, config);
    if (c.winner === a.id) return -1;
    if (c.winner === b.id) return 1;
    return a.name.localeCompare(b.name);
  });
  const entries: OverallEntry[] = [];
  let rank = 0;
  let tieBreak: TieBreak | null = null;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) rank = 1;
    else {
      const c = compareParticipants(sorted[i - 1].id, sorted[i].id, participants, scores, overall, config);
      if (c.winner === sorted[i - 1].id) rank = i + 1;
      if (i === 1 && c.winner && c.decidedBy !== "score") tieBreak = c.decidedBy;
    }
    entries.push({ participantId: sorted[i].id, weightedScore: overall.get(sorted[i].id)!.score, weightCoverage: overall.get(sorted[i].id)!.weightCoverage, rank, categoryWins: rankings.filter((r) => r.winners.includes(sorted[i].id)).map((r) => r.categoryId) });
  }
  for (const p of participants) if (!scored.includes(p)) entries.push({ participantId: p.id, weightedScore: null, weightCoverage: overall.get(p.id)?.weightCoverage ?? 0, rank: null, categoryWins: rankings.filter((r) => r.winners.includes(p.id)).map((r) => r.categoryId) });
  const winnerIds = entries.filter((e) => e.rank === 1).map((e) => e.participantId);
  return { entries, winnerIds, tieBreak };
}

// ------------------------------------------------------------------ seeding and knockout brackets
export function seedOrder(participants: ParticipantData[], seeding: Seeding, overall: Map<string, { score: number | null }>, randomSeed: number): string[] {
  if (seeding === "manual") return [...participants].sort((a, b) => a.seed - b.seed).map((p) => p.id);
  if (seeding === "random") {
    const rng = createRng(randomSeed);
    const ids = participants.map((p) => p.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  }
  return [...participants].sort((a, b) => (overall.get(b.id)?.score ?? -1) - (overall.get(a.id)?.score ?? -1) || (b.rating.score ?? -1) - (a.rating.score ?? -1) || a.name.localeCompare(b.name)).map((p) => p.id);
}

/** Standard seeded placement: seed 1 meets the lowest seed, byes go to the top seeds. */
function bracketSlots(size: number): number[] {
  let slots = [1];
  while (slots.length < size) {
    const n = slots.length * 2 + 1;
    const next: number[] = [];
    for (const s of slots) next.push(s, n - s);
    slots = next;
  }
  return slots;
}

export function buildBracket(orderedIds: string[]): Bracket {
  const n = orderedIds.length;
  let size = 1;
  while (size < n) size *= 2;
  const slots = bracketSlots(size);
  const first: Match[] = [];
  for (let i = 0; i < size; i += 2) {
    const a = slots[i] <= n ? orderedIds[slots[i] - 1] : null;
    const b = slots[i + 1] <= n ? orderedIds[slots[i + 1] - 1] : null;
    const bye = !a || !b;
    first.push({ id: `r0m${i / 2}`, round: 0, index: i / 2, a, b, scoreA: null, scoreB: null, winner: bye ? (a ?? b) : null, status: bye ? "bye" : "pending", decidedBy: bye ? "bye" : null, margin: null });
  }
  const rounds: Match[][] = [first];
  let count = size / 2;
  let r = 1;
  while (count > 1) {
    count /= 2;
    rounds.push(Array.from({ length: count }, (_, i) => ({ id: `r${r}m${i}`, round: r, index: i, a: null, b: null, scoreA: null, scoreB: null, winner: null, status: "pending" as const, decidedBy: null, margin: null })));
    r++;
  }
  const bracket: Bracket = { size, byes: size - n, rounds, championId: null };
  propagate(bracket);
  return bracket;
}

/** Copies decided winners into the next round and detects the champion. */
export function propagate(bracket: Bracket) {
  for (let r = 0; r < bracket.rounds.length - 1; r++) {
    for (const m of bracket.rounds[r]) {
      const next = bracket.rounds[r + 1][Math.floor(m.index / 2)];
      const slot = m.index % 2 === 0 ? "a" : "b";
      if (m.winner && next[slot] !== m.winner) {
        next[slot] = m.winner;
      }
    }
    // a next-round match with only one participant (both predecessors byes) is itself a bye
    for (const m of bracket.rounds[r + 1]) {
      const preds = bracket.rounds[r].filter((p) => Math.floor(p.index / 2) === m.index);
      const settled = preds.every((p) => p.winner);
      if (settled && m.status === "pending" && (!m.a || !m.b) && (m.a || m.b)) {
        m.status = "bye";
        m.winner = m.a ?? m.b;
        m.decidedBy = "bye";
      }
    }
  }
  const last = bracket.rounds[bracket.rounds.length - 1][0];
  bracket.championId = last?.winner ?? null;
}

export function resolveMatch(m: Match, participants: ParticipantData[], scores: ParticipantCategoryScore[], overall: Map<string, { score: number | null }>, config: TournamentConfig): Match {
  if (m.status !== "pending" || !m.a || !m.b) return m;
  const c = compareParticipants(m.a, m.b, participants, scores, overall, config);
  return { ...m, scoreA: overall.get(m.a)?.score ?? null, scoreB: overall.get(m.b)?.score ?? null, winner: c.winner, status: c.winner ? "decided" : "tied", decidedBy: c.winner ? c.decidedBy : null, margin: c.winner ? c.margin : 0 };
}

/** Plays one round of a bracket. Returns false when a tied match blocks progress. */
export function playRound(bracket: Bracket, round: number, participants: ParticipantData[], scores: ParticipantCategoryScore[], overall: Map<string, { score: number | null }>, config: TournamentConfig): { bracket: Bracket; blocked: boolean } {
  const rounds = bracket.rounds.map((rs) => rs.map((m) => ({ ...m })));
  const b: Bracket = { ...bracket, rounds };
  propagate(b);
  let blocked = false;
  b.rounds[round] = b.rounds[round].map((m) => {
    const r = resolveMatch(m, participants, scores, overall, config);
    if (r.status === "tied") blocked = true;
    return r;
  });
  propagate(b);
  return { bracket: b, blocked };
}

export function decideManually(bracket: Bracket, matchId: string, winnerId: string): Bracket {
  const rounds = bracket.rounds.map((rs) => rs.map((m) => ({ ...m })));
  const b: Bracket = { ...bracket, rounds };
  for (const rs of b.rounds) for (const m of rs) if (m.id === matchId && (m.a === winnerId || m.b === winnerId) && (m.status === "tied" || m.status === "pending")) {
    m.winner = winnerId;
    m.status = "manual";
    m.decidedBy = "manual";
  }
  propagate(b);
  return b;
}

export function roundName(roundIndex: number, totalRounds: number): "final" | "semifinal" | "quarterfinal" | "roundOf16" | "roundOf32" | "roundOf64" | "round" {
  const remaining = totalRounds - roundIndex;
  return remaining === 1 ? "final" : remaining === 2 ? "semifinal" : remaining === 3 ? "quarterfinal" : remaining === 4 ? "roundOf16" : remaining === 5 ? "roundOf32" : remaining === 6 ? "roundOf64" : "round";
}

// ------------------------------------------------------------------ group stage
export function buildGroups(orderedIds: string[], groupSize: number): Group[] {
  const n = orderedIds.length;
  const count = Math.max(1, Math.ceil(n / Math.max(2, groupSize)));
  const groups: Group[] = Array.from({ length: count }, (_, i) => ({ id: `g${i}`, name: String.fromCharCode(65 + i), participantIds: [], fixtures: [], table: [], qualified: [] }));
  // snake distribution keeps groups balanced in strength
  orderedIds.forEach((id, i) => {
    const row = Math.floor(i / count);
    const col = row % 2 === 0 ? i % count : count - 1 - (i % count);
    groups[col].participantIds.push(id);
  });
  for (const g of groups) {
    const ids = g.participantIds;
    let k = 0;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) g.fixtures.push({ id: `${g.id}f${k++}`, round: 0, index: k, a: ids[i], b: ids[j], scoreA: null, scoreB: null, winner: null, status: "pending", decidedBy: null, margin: null });
  }
  return groups;
}

export function playGroups(groups: Group[], participants: ParticipantData[], scores: ParticipantCategoryScore[], overall: Map<string, { score: number | null }>, config: TournamentConfig): Group[] {
  return groups.map((g) => {
    const fixtures = g.fixtures.map((m) => {
      if (m.status !== "pending") return m;
      const c = compareParticipants(m.a!, m.b!, participants, scores, overall, config);
      return { ...m, scoreA: overall.get(m.a!)?.score ?? null, scoreB: overall.get(m.b!)?.score ?? null, winner: c.winner, status: c.winner ? ("decided" as const) : ("tied" as const), decidedBy: c.winner ? c.decidedBy : ("tied" as const), margin: c.margin };
    });
    const rows = new Map<string, GroupTableRow>(g.participantIds.map((id) => [id, { participantId: id, played: 0, wins: 0, draws: 0, losses: 0, points: 0, scoreFor: overall.get(id)?.score ?? 0, rank: 0 }]));
    for (const m of fixtures) {
      const a = rows.get(m.a!)!;
      const b = rows.get(m.b!)!;
      a.played++;
      b.played++;
      if (!m.winner) {
        a.draws++;
        b.draws++;
        a.points += 1;
        b.points += 1;
      } else if (m.winner === m.a) {
        a.wins++;
        b.losses++;
        a.points += 3;
      } else {
        b.wins++;
        a.losses++;
        b.points += 3;
      }
    }
    const table = [...rows.values()].sort((x, y) => y.points - x.points || y.scoreFor - x.scoreFor || x.participantId.localeCompare(y.participantId));
    table.forEach((r, i) => (r.rank = i === 0 || table[i - 1].points !== r.points || Math.abs(table[i - 1].scoreFor - r.scoreFor) > config.tieEpsilon ? i + 1 : table[i - 1].rank));
    const qualified = table.slice(0, config.qualifyPerGroup).map((r) => r.participantId);
    return { ...g, fixtures, table, qualified };
  });
}

/** Finals seeding: group winners first (by score), then runners-up, so group mates meet late. */
export function finalsOrder(groups: Group[], overall: Map<string, { score: number | null }>): string[] {
  const byRank: string[][] = [];
  for (const g of groups) g.qualified.forEach((id, i) => (byRank[i] ??= []).push(id));
  return byRank.flatMap((ids) => [...ids].sort((a, b) => (overall.get(b)?.score ?? -1) - (overall.get(a)?.score ?? -1)));
}

// ------------------------------------------------------------------ orchestration
export function initialState(participants: ParticipantData[], config: TournamentConfig, now: string): TournamentState {
  const scores = allCategoryScores(participants, config);
  const overall = weightedOverall(participants, scores, config);
  const order = seedOrder(participants, config.seeding, overall, config.randomSeed);
  if (config.format === "knockout") return { phase: "knockout", currentRound: 0, groups: null, bracket: buildBracket(order), startedAt: now, completedAt: null };
  if (config.format === "group") return { phase: "groups", currentRound: 0, groups: buildGroups(order, config.groupSize), bracket: null, startedAt: now, completedAt: null };
  return { phase: "ranking", currentRound: 0, groups: null, bracket: null, startedAt: now, completedAt: null };
}

export interface StepResult {
  state: TournamentState;
  done: boolean;
  blocked: boolean;
}

/** Advances the tournament by one step (a group stage, a knockout round, or the ranking). */
export function step(state: TournamentState, participants: ParticipantData[], config: TournamentConfig, now: string): StepResult {
  const scores = allCategoryScores(participants, config);
  const overall = weightedOverall(participants, scores, config);
  const s: TournamentState = { ...state };
  if (s.phase === "ranking") return { state: { ...s, phase: "done", completedAt: now }, done: true, blocked: false };
  if (s.phase === "groups" && s.groups) {
    const played = playGroups(s.groups, participants, scores, overall, config);
    const qualified = finalsOrder(played, overall);
    const next: TournamentState = { ...s, groups: played, bracket: qualified.length >= 2 ? buildBracket(qualified) : null, phase: qualified.length >= 2 ? "knockout" : "done", currentRound: 0, completedAt: qualified.length >= 2 ? null : now };
    return { state: next, done: next.phase === "done", blocked: false };
  }
  if (s.phase === "knockout" && s.bracket) {
    if (s.currentRound >= s.bracket.rounds.length) return { state: { ...s, phase: "done", completedAt: s.completedAt ?? now }, done: true, blocked: false };
    const { bracket, blocked } = playRound(s.bracket, s.currentRound, participants, scores, overall, config);
    if (blocked) return { state: { ...s, bracket }, done: false, blocked: true };
    const nextRound = s.currentRound + 1;
    const done = nextRound >= bracket.rounds.length;
    return { state: { ...s, bracket, currentRound: nextRound, phase: done ? "done" : "knockout", completedAt: done ? now : null }, done, blocked: false };
  }
  return { state: { ...s, phase: "done", completedAt: now }, done: true, blocked: false };
}

export function resolveTiedMatch(state: TournamentState, matchId: string, winnerId: string): TournamentState {
  if (!state.bracket) return state;
  return { ...state, bracket: decideManually(state.bracket, matchId, winnerId) };
}

export function computeResults(participants: ParticipantData[], config: TournamentConfig, state: TournamentState, now: string): TournamentResults {
  const categoryScores = allCategoryScores(participants, config);
  const rankings = categoryRankings(categoryScores, config);
  const overall = overallRanking(participants, categoryScores, rankings, config);
  const champion = state.bracket?.championId ?? null;
  const officialMethod = config.format === "knockout" || config.format === "group" ? config.winnerMethod : "weighted";
  const officialWinnerIds = officialMethod === "knockout" ? (champion ? [champion] : []) : overall.winnerIds;
  const allMatches = [...(state.groups ?? []).flatMap((g) => g.fixtures), ...(state.bracket?.rounds.flat() ?? [])];
  const decided = allMatches.filter((m) => m.status === "decided" || m.status === "manual");
  const closest = decided.filter((m) => m.margin != null && m.status === "decided").sort((a, b) => a.margin! - b.margin!)[0] ?? null;
  const winCounts = new Map<string, number>();
  for (const r of rankings) for (const w of r.winners) winCounts.set(w, (winCounts.get(w) ?? 0) + 1);
  const maxWins = Math.max(0, ...winCounts.values());
  let highest: TournamentStats["highestSingleScore"] = null;
  for (const p of participants) for (const c of p.rating.criteria) if (c.assessable && c.score != null && (!highest || c.score > highest.score)) highest = { participantId: p.id, criterionId: c.id as CriterionId, score: c.score };
  const stats: TournamentStats = {
    participants: participants.length,
    matches: allMatches.filter((m) => m.status !== "bye").length,
    decidedMatches: decided.length,
    categories: config.categories.length,
    decidableCategories: rankings.filter((r) => r.decidable).length,
    mostCategoryWins: maxWins > 0 ? [...winCounts.entries()].filter(([, n]) => n === maxWins).map(([participantId, wins]) => ({ participantId, wins })) : [],
    highestSingleScore: highest,
    closestMatch: closest ? { matchId: closest.id, margin: closest.margin!, a: closest.a!, b: closest.b! } : null,
    durationMs: state.startedAt && state.completedAt ? new Date(state.completedAt).getTime() - new Date(state.startedAt).getTime() : null,
  };
  return { computedAt: now, categoryScores, categoryRankings: rankings, overall: overall.entries, overallWinnerIds: overall.winnerIds, overallTieBreak: overall.tieBreak, knockoutChampionId: champion, officialMethod, officialWinnerIds, stats };
}
