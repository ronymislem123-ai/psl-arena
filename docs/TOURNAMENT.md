# Tournament mode

Tournaments compare profiles that were rated with the **same rubric version**; the engine (`src/engine/tournament/`) is pure TypeScript and runs identically on the server (official results) and in the browser (live standings).

## Fairness model

- Every participant is rated **independently** by the rater (same rubric, same engine) before the tournament; the tournament only compares stored rating results. No pairwise model decision exists, so there is nothing to swap sides on — `compareParticipants(a, b)` is symmetric by construction (unit-tested for every pair).
- The tournament stores a snapshot of each participant's rating and of the scale, so later re-ratings or scale edits do not change it.
- A participant may win any number of categories; wins are never redistributed.

## Categories

Twelve built-in categories map to rubric criteria (`DEFAULT_CATEGORIES`): Best Overall Face (the rubric's overall score), Jawline, Cheekbones, Eye Area, Facial Harmony, Symmetry, Facial Proportions, Midface, Chin, Lower Third, Nose Harmony, Overall Bone Structure (rubric 3.0: front profile only — the former Profile category was replaced by Lower Third; tournaments accept only ratings of the current rubric). Users can remove categories, change weights and add custom categories from any criteria.

A participant's **category score** is the weighted mean of the assessable criterion scores of that category. If less than `minCategoryCoverage` (default 50 %) of the category's criterion weight is assessable, the participant is *not assessable* in that category (reason `requiresProfile` when the missing criteria are profile criteria). A category is **decidable** only with at least two assessable participants.

**Category rankings** rank the assessable participants; scores within `tieEpsilon` (default 0.05 PSL points) share a rank, so a category can have several winners, seconds and thirds. Non-assessable participants are listed without a rank.

## Weighted overall and tie-breakers

Weighted overall = Σ(normalised category weight × category score) over the categories in which the participant is assessable (weights are normalised to 100 % whatever their sum; all-zero weights become equal weights). Default weights follow the brief's example (Harmony 25, Jawline 20, Symmetry 15, Cheekbones 15, Eye Area 15, Proportions 10; others 0 → not part of the weighted overall but still decided as categories). Participants assessable in less than 50 % of the weight receive no weighted score and are listed unranked.

Tie-breakers (documented, in order): 1. higher **Best Overall Face** score; 2. higher score in the configured **decisive category** (default Facial Harmony); 3. higher data completeness (rating coverage); 4. still tied → shared rank / several winners. The same chain decides knockout and group matches; a knockout match that is still tied after it is **blocked** and must be decided manually (recorded as `manual`), or the tournament stays paused — no artificial decision is invented.

## Formats

- **Ranking**: all participants ranked by the weighted overall; category winners alongside. Completes immediately on start.
- **Category tournament**: same computation, the category rankings are the focus.
- **Knockout**: seeded single elimination (seeding by rating, random with a stored seed, or manual order). Bracket size is the next power of two; byes go to the top seeds (standard 1-vs-n placement). Rounds are played one at a time (or all at once); a tied match blocks the round until decided.
- **Group stage + finals**: balanced groups (snake distribution), round-robin with 3/1/0 points, table order by points → weighted score; the top `qualifyPerGroup` of each group enter a finals bracket seeded by group rank.

**Official winner**: the weighted overall winner by default; for knockout/group tournaments the user can choose the knockout champion instead. Both are always reported (`overallWinnerIds`, `knockoutChampionId`, `officialMethod`) so the two notions are never confused.

## Lifecycle and versions

draft → running (paused) → completed. Drafts are editable (participants, format, categories, scale); completed tournaments are **locked** (HTTP 409 on edits). *Reopen* archives the complete record into `tournament_versions` and creates version n+1 as a draft; *duplicate* creates a new draft with the same configuration and participant snapshots. Deleting a profile keeps the tournament consistent (participant row keeps the snapshot, profile link set to null).

## Results page

Overall winner card(s) with photo, PSL score, tier (from the tournament's scale snapshot), weighted score, rank and tie-breaker used; one card per category with winner(s), seconds, thirds, margin and decidability; final ranking table (weighted score, PSL, tier, category wins); statistics (participants, matches, decidable categories, most category wins, highest single criterion, closest match, duration). Export as JSON; print/PDF via the browser.
