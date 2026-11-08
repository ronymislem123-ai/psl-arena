# Comparison, progress and awards

## Comparison (`/compare`)

Two to four stored PSL ratings are shown side by side: score and tier, scale (name and version), rubric and engine versions, coverage, confidence, validity, frontal image quality, profile-view usage; then the seven area scores and all criteria of the rubric (40 in rubric 2.0) with the delta of every column against the first (reference) column, the spread across columns, and the five largest gains/losses of the last column versus the reference (criteria assessable in every rating only).

The comparison engine (`src/engine/psl/compare.ts`) is pure and flags what makes ratings less comparable instead of hiding it:

| Warning | Trigger |
| --- | --- |
| `rubricVersion` | different rubric versions — scores are *not* directly comparable (`comparable = false`) |
| `engineVersion` | different landmark-engine versions |
| `scaleDiffers` | different scale id/version — tier names are not comparable, scores are |
| `coverageDiffers` | coverage differs by more than 10 percentage points |
| `qualityDiffers` | different frontal image-quality levels |
| `sideViewDiffers` / `visualDiffers` | a profile view / visual assessments were used in some ratings only |
| `provisional` / `invalid` | some ratings are provisional / have no score |

Entry points: the rating page ("Compare with…" preselects that rating), the history tab (tick 2–4 ratings), the profile page (latest ratings), or the picker at `/compare`.

## Raw frontal analyses (`/compare?mode=analyses`)

Two to four stored frontal analyses on ratio level (`compareAnalyses`): the five scores (overall, proportion, harmony, structure, symmetry), the seven category indices, every symmetry metric and all 42 ratios with value, T1 flag, harmony index and the deltas of value and index against the reference column; largest index gains/losses of the last column (ratios evaluable in every analysis only). Warnings: different engine versions (`comparable = false`), image-quality levels, hairline present in some analyses only, coverage differing by more than 10 points, "include reconstructed" or capture-distance settings differing, unusable analyses. Entry points: history (Analyses tab selection), the analysis center ("Compare frontal analyses"), the picker tab.

## Tournament versions (`/compare?mode=versions&tournament=…`)

`compareTournamentVersions` diffs any two versions of a tournament (the current record and the archived versions created by *reopen*): participants added/removed (by display name), format and official-winner method, categories added/removed, weight changes; and, when both versions are completed, overall winners, knockout champion, every category's winners (changed flag) and the ranking position of every participant with ▲/▼ deltas. Archived versions can also be opened as a rendered, read-only tournament page (`/tournaments/[id]/versions/[versionId]`, banner with the archived and current version numbers; no actions).

## Progress (profile page)

`progressSeries` orders a profile's ratings chronologically and reports first/latest/best score, the total change (only within one rubric version), the mean absolute change per rating, and for every step the days elapsed, the score delta and the three criteria that moved most. Provisional points are marked in the chart. Deltas across rubric versions are refused rather than computed.

## Awards (profile page)

Derived from **completed** tournaments the profile took part in: category wins (with the shared flag when several winners tied), multi-category awards (three or more wins in one tournament), overall wins and knockout championships. Awards are computed from stored tournament results on demand (`awardsForProfile`), so reopening or deleting a tournament updates them.

### Cross-tournament achievements

`computeAchievements` aggregates the awards: tournaments entered (completed), tournaments with an award, overall wins, championships, category wins (and shared ones), distinct categories won, most-won category. Achievement badges with documented thresholds (`ACHIEVEMENT_TARGETS`):

| Achievement | Earned when |
| --- | --- |
| First win | any category, overall or knockout title |
| Hat-trick | three or more category wins in one tournament |
| Champion | a knockout final won |
| Serial winner | overall winner in three tournaments |
| Specialist | the same category won in three tournaments |
| All-rounder | five different categories won |
| Veteran | five completed tournaments entered |

Progress towards unearned badges is shown as n / target. The thresholds are product conventions, not community standards.
