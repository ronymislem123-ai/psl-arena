/** Diff between two versions of a tournament (archived vs. current, or any two archived records). */
import type { TournamentConfig, TournamentResults, TournamentStatus } from "./types";

export interface TournamentLike {
  version: number;
  status: TournamentStatus;
  completedAt: string | null;
  config: TournamentConfig;
  participants: { id: string; displayName: string }[];
  results: TournamentResults | null;
}

export interface VersionDiff {
  a: { version: number; status: TournamentStatus; completedAt: string | null; participants: number };
  b: { version: number; status: TournamentStatus; completedAt: string | null; participants: number };
  participants: { added: string[]; removed: string[]; unchanged: number };
  config: { formatChanged: [string, string] | null; winnerMethodChanged: [string, string] | null; categoriesAdded: string[]; categoriesRemoved: string[]; weightChanges: { id: string; name: string; a: number; b: number }[] };
  results: {
    overallWinners: { a: string[]; b: string[]; changed: boolean };
    champion: { a: string | null; b: string | null; changed: boolean };
    categories: { id: string; name: string; a: string[]; b: string[]; changed: boolean }[];
    ranking: { name: string; a: number | null; b: number | null; delta: number | null }[];
    changedCategories: number;
  } | null;
}

export function compareTournamentVersions(a: TournamentLike, b: TournamentLike): VersionDiff {
  const nameOf = (t: TournamentLike, id: string) => t.participants.find((p) => p.id === id)?.displayName ?? id;
  const namesA = new Set(a.participants.map((p) => p.displayName));
  const namesB = new Set(b.participants.map((p) => p.displayName));
  const added = [...namesB].filter((n) => !namesA.has(n));
  const removed = [...namesA].filter((n) => !namesB.has(n));
  const catA = new Map(a.config.categories.map((c) => [c.id, c]));
  const catB = new Map(b.config.categories.map((c) => [c.id, c]));
  const weightChanges: VersionDiff["config"]["weightChanges"] = [];
  for (const [id, ca] of catA) {
    const cb = catB.get(id);
    if (cb && cb.weight !== ca.weight) weightChanges.push({ id, name: cb.name, a: ca.weight, b: cb.weight });
  }
  const same = (x: string[], y: string[]) => x.length === y.length && [...x].sort().every((v, i) => v === [...y].sort()[i]);
  let results: VersionDiff["results"] = null;
  if (a.results && b.results) {
    const ra = a.results;
    const rb = b.results;
    const ow = { a: ra.overallWinnerIds.map((id) => nameOf(a, id)), b: rb.overallWinnerIds.map((id) => nameOf(b, id)) };
    const champion = { a: ra.knockoutChampionId ? nameOf(a, ra.knockoutChampionId) : null, b: rb.knockoutChampionId ? nameOf(b, rb.knockoutChampionId) : null };
    const ids = Array.from(new Set([...ra.categoryRankings.map((r) => r.categoryId), ...rb.categoryRankings.map((r) => r.categoryId)]));
    const categories = ids.map((id) => {
      const xa = ra.categoryRankings.find((r) => r.categoryId === id)?.winners.map((w) => nameOf(a, w)) ?? [];
      const xb = rb.categoryRankings.find((r) => r.categoryId === id)?.winners.map((w) => nameOf(b, w)) ?? [];
      return { id, name: catB.get(id)?.name ?? catA.get(id)?.name ?? id, a: xa, b: xb, changed: !same(xa, xb) };
    });
    const names = Array.from(new Set([...namesA, ...namesB]));
    const rankOf = (t: TournamentLike, r: TournamentResults, name: string) => {
      const p = t.participants.find((x) => x.displayName === name);
      return p ? (r.overall.find((e) => e.participantId === p.id)?.rank ?? null) : null;
    };
    const ranking = names.map((name) => {
      const x = rankOf(a, ra, name);
      const y = rankOf(b, rb, name);
      return { name, a: x, b: y, delta: x != null && y != null ? x - y : null };
    }).sort((p, q) => (q.b == null ? -1 : 1) - (p.b == null ? -1 : 1) || (p.b ?? 99) - (q.b ?? 99));
    results = { overallWinners: { ...ow, changed: !same(ow.a, ow.b) }, champion: { ...champion, changed: champion.a !== champion.b }, categories, ranking, changedCategories: categories.filter((c) => c.changed).length };
  }
  return {
    a: { version: a.version, status: a.status, completedAt: a.completedAt, participants: a.participants.length },
    b: { version: b.version, status: b.status, completedAt: b.completedAt, participants: b.participants.length },
    participants: { added, removed, unchanged: [...namesA].filter((n) => namesB.has(n)).length },
    config: {
      formatChanged: a.config.format !== b.config.format ? [a.config.format, b.config.format] : null,
      winnerMethodChanged: a.config.winnerMethod !== b.config.winnerMethod ? [a.config.winnerMethod, b.config.winnerMethod] : null,
      categoriesAdded: [...catB.keys()].filter((id) => !catA.has(id)).map((id) => catB.get(id)!.name),
      categoriesRemoved: [...catA.keys()].filter((id) => !catB.has(id)).map((id) => catA.get(id)!.name),
      weightChanges,
    },
    results,
  };
}
