# Rating validation — what was tested, what the numbers are, what was not tested

> **Note (2026-11-08):** this page documents the rubric 1.0.0 consistency experiments. The engine 2.0 / rubric 2.0 validation against engine 1.x (222 cases: test–retest, controlled deformations, different faces, compensation, pose and symmetry, parameter sensitivity) is in `docs/MODEL_VALIDATION.md`.

Date: 2026-11-06. All experiments ran through the real product path (browser detection with MediaPipe → engine → rubric 1.0.0 → standard scale) using `tests/e2e/validation.spec.ts`; the raw numbers are written to `test-results/validation.json` on every run. Inputs: the two public-domain test portraits of the project (`portrait-a.jpg`, `portrait-b.jpg`) and derived variants of portrait A (horizontally mirrored, downscaled to 60 %, cropped tighter so that part of the hairline is lost).

## 1. Functional tests (passed)
Unit tests of the rubric (weights sum, single use of every input, calibration monotonicity, coverage/validity, unusable images, visual-assessment handling, determinism), of the scales (standard ladder, unrounded assignment, validation) and of the tournament engine (category winners with ties, weight normalisation, symmetric comparisons, byes, manual decisions, groups) — see `docs/TEST_REPORT.md`.

## 2. Mathematical validation (passed)
- Overall PSL = weight-normalised mean of assessable criterion scores (checked numerically in `psl-rubric.test.ts`).
- Tier assignment on the unrounded value with inclusive lower / exclusive upper bounds and inclusive top (checked at every boundary of the standard scale).
- Category winners independent of the overall weights; comparisons symmetric for every pair (no left/right bias possible by construction).

## 3. Reproducibility tests (measured)

| Experiment | PSL score | Tier | Coverage | Δ vs. original |
| --- | --- | --- | --- | --- |
| A original | 4.98 | High LTN | 72 % | — |
| A repeat (same file) | 4.98 | High LTN | 72 % | **0.000** |
| A mirrored | 4.94 | High LTN | 72 % | 0.032 |
| A downscaled to 60 % | 4.94 | High LTN | 72 % | 0.033 |
| A tighter crop (hairline partly lost) | 4.98 | High LTN | 64 % (provisional) | 0.008 |
| B original | 4.86 | High LTN | 72 % | — |
| B repeat | 4.86 | High LTN | 72 % | **0.000** |

Per-criterion differences (assessable in both runs): mirrored — mean 0.21, max 1.45 (lip proportions); 60 % scale — mean 0.13, max 0.43 (eye spacing); crop — mean 0.10, max 0.47 (mouth symmetry).

Reading: the pipeline is deterministic (identical file ⇒ identical score, the brief's 0.5-point tolerance is met with 0.0). Mirroring and downscaling move the overall score by ≈ 0.03 points and no tier changes; single criteria can move by up to 1.5 points under mirroring (lip proportions), which is why individual criterion scores are shown with their confidence and the overall is the quantity to compare. The crop shows the coverage mechanism: losing the hairline removes the thirds/face-shape criteria, the score becomes provisional although it hardly moves.

These figures are for **two** portraits and their variants; they are not population statistics.

## 4. External model validation (not performed)
No consented reference dataset with independent human ratings exists in this project. Therefore **no** claim is made about agreement with human raters, inter-rater reliability, mean deviation from community ratings or the validity of the calibration curve. The calibration anchors were chosen so that the project's fixtures land near the scale centre; this is documented in `docs/RUBRIC.md`.

## 5. Human comparison (not performed)
Community ratings from looksmax.org could not be collected (site not readable, and they would not be a ground truth anyway — see `docs/RESEARCH_LOG.md`).

## 6. Bias (not tested)
Systematic differences by skin tone, ethnic appearance, face type, lighting or image quality were **not** evaluated: there is no suitable consented test set. What the engine does by design: it scores only geometric ratios, symmetry metrics and profile angles against fixed reference ranges, never demographic attributes; the quality gate rejects strong yaw/pitch/roll, blur, over/under-exposure and low resolution instead of scoring them. Known systematic effects: soft-tissue stand-ins for bony landmarks, selfie-distance distortion (flagged, not corrected), hairline estimation on dark hair/skin combinations (manual override exists). A bias audit with a consented, demographically diverse set remains open.

## 7. Tournament validation (passed)
Unit tests: swapping two participants leaves winners and category rankings unchanged; duplicate ratings tie in every category; weights < 100 % / > 100 % normalise identically; brackets for 4–64 participants place the right number of byes; tied knockout matches block until decided manually. End-to-end: a five-participant ranking tournament with duplicate ratings produces shared category wins, a non-decidable "Best Profile" category (no side views), identical category winners under different weights, locking of the completed tournament, a new version on reopen and a knockout run with manual decisions.
