# Comparison, progress and awards

## Comparison (`/compare`)

Two to four stored PSL ratings are shown side by side: score and tier, scale (name and version), rubric and engine versions, coverage, confidence, validity, frontal image quality, profile-view usage; then the seven area scores and all 41 criteria with the delta of every column against the first (reference) column, the spread across columns, and the five largest gains/losses of the last column versus the reference (criteria assessable in every rating only).

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

## Progress (profile page)

`progressSeries` orders a profile's ratings chronologically and reports first/latest/best score, the total change (only within one rubric version), the mean absolute change per rating, and for every step the days elapsed, the score delta and the three criteria that moved most. Provisional points are marked in the chart. Deltas across rubric versions are refused rather than computed.

## Awards (profile page)

Derived from **completed** tournaments the profile took part in: category wins (with the shared flag when several winners tied), multi-category awards (three or more wins in one tournament), overall wins and knockout championships. Awards are computed from stored tournament results on demand (`awardsForProfile`), so reopening or deleting a tournament updates them.
