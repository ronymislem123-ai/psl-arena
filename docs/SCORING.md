# Scoring methodology

PSL ARENA keeps **two clearly separated scoring layers** on top of the measured ratios, plus symmetry, coverage, confidence and uncertainty.

## 1. Original T1 system (source material)

| Tier | Points | Meaning |
| --- | ---: | --- |
| T1 | +10 | inside the defined target range |
| T2 | +5 | next-best deviation |
| T3 | +2.5 | moderate deviation |
| T4 | 0 | larger deviation |
| T5 | −5 | largest defined deviation |

* Theoretical maximum: 42 × 10 = **420 points**; original harmony percentage = points / 420 × 100.
* **Only T1 ranges were provided.** The T2–T5 boundaries are not in the material, so a ratio outside T1 gets tier `null` ("undetermined") and no points. They are never invented. The data structure (`tierBoundaries`) exists so verified boundaries can be entered later without code changes (`assignTier` then applies them).
* Consequently the "original 420-point percentage" is reported as *not computable* (with the reason) unless all 42 ratios are evaluable and have determinable tiers. The UI shows instead:
  * ratios in T1 / evaluable ratios, points from T1 (T1 × 10) out of 420,
  * the **coverage-adjusted T1 rate** = T1 count / evaluable count — explicitly labelled, never presented as the original percentage,
  * counts of unavailable, incomplete-definition, excluded and low-confidence ratios.

## 2. PSL ARENA harmony index (per ratio, 0–100)

A continuous, documented alternative that uses the T1 ranges only:

* `deviation` = distance outside the T1 range (0 inside).
* `tolerance` per ratio = `max(10 % of the T1 midpoint, half the T1 width)`; for one-sided ranges (CBS > 80 %) `10 % of the bound`. Tolerances are stored in the database (`toleranceFor`).
* `index = 100 · 2^(−deviation / tolerance)` — 100 inside T1, 50 one tolerance unit outside, 25 two units outside, …

## 3. Confidence per ratio (0–1)

`confidence = status × landmarks × quality × pose × expression × depth`

| Factor | Values |
| --- | --- |
| status | defined 1.0 · reconstructed 0.85 · incomplete ⇒ unavailable |
| landmarks | minimum landmark confidence of the inputs; landmark confidence = precision (high 1.0 / medium 0.9 / low 0.75) × source (model 1.0 / derived 0.95 / estimated 0.7 / manual 0.8) × estimate quality |
| quality | 0.6 + 0.4 × image-quality score |
| pose | yaw-sensitive widths: 1 − clamp((|yaw| − 4°)/35°, 0, 0.6); others 1 − clamp((|yaw| − 8°)/50°, 0, 0.3); all: 1 − clamp((|pitch| − 5°)/40°, 0, 0.5) |
| expression | per sensitivity region: mouth 1 − 0.5·max(smile, jawOpen, pucker); eyes 1 − 0.5·max(blink, squint); brows 1 − 0.4·max(raise, down); jaw 1 − 0.5·jawOpen |
| depth | depth-sensitive ratios: selfie 0.8 · unknown 0.95 · standard 1.0 |

A ratio is flagged **uncertain** when confidence < 0.5.

## 4. Categories and weights

Every ratio belongs to exactly **one** category (no double counting):

| Category | Weight | Ratios |
| --- | ---: | --- |
| Eye Area | 22 | ESR, OCD, ICD, EAR, PFL/BYZGO, EBL, EBS*, CT, ET, DEV CT/ET, EYS* |
| Midface | 14 | EME, IAA*, MF, FWHR, CBS |
| Nose | 10 | ICD/N, N/H, NBR/ALA*, N/BYZGO |
| Lips | 10 | M/IPD, M/BIG, M/N, LL/UL, LIP WHR |
| Jawline | 20 | JFA*, DEV IAA/JFA*, BIT, DEV BIT/BIG, BIG, JWHR, GS, NW |
| Lower Third | 10 | M/C, L3P, C/P, FT-L |
| Facial Structure | 14 | TFWHR, FWHF, LFF, FT-M, FT-U |

\* incomplete definition — listed for completeness, never scored.

**Dependency weights** reduce redundant information: DEV ratios 0.5 (they are differences of already-scored ratios), the three facial thirds 0.67 each (two degrees of freedom), OCD 0.8 (overlaps ESR), PFL/BYZGO 0.9 (overlaps ICD), M/BIG 0.8 and LIP WHR 0.8 (overlap M/IPD and LL/UL), FWHR 0.9 (overlaps MF), FWHF 0.7 and LFF 0.8 (overlap FT-U). All other ratios weigh 1.0.

* **Category index** = Σ(w·c·index) / Σ(w·c) over available member ratios (w = dependency weight, c = confidence, floor 0.05).
* **Harmony index** (flat) = the same weighted mean over *all* available ratios.
* **Proportion score** = category-weight-weighted mean of the available category indices (weights renormalised over covered categories; coverage is reported).
* **Facial structure score** (display only) = 0.4 jawline + 0.3 midface + 0.3 structure.
* **Symmetry score** = mean of per-metric scores `100·exp(−ln2·asymmetry/tolerance)` over bilateral landmark comparisons (eye opening, fissure length, canthal tilt, canthus height, brow height/tilt, mouth-corner height/width, nose-tip and alar offsets, chin, gonion width/height, cheek width) relative to a midline fitted from pair midpoints and midline landmarks. Symmetry confidence falls with yaw.
* **Overall PSL-style score** = 0.8 × proportion + 0.2 × symmetry.

Feature observations (section 6 of the brief) reuse these values and are **not** added again. Visual properties (skin, cheekbone definition, jawline definition, chin projection, nasal bridge) are reported as *not determinable* rather than guessed.

## 5. Coverage

`coverage = evaluable / 42`, where evaluable = ratios with a value that are included in scoring. With a confirmed hairline and no neck points, 35 of 42 are evaluable (6 incomplete definitions + NW). Scores from fewer evaluable ratios are flagged as coverage-adjusted; battles require ≥ 50 % coverage on both sides for a verdict.

## 6. Uncertainty

Monte-Carlo propagation: the 478 mesh points are jittered with Gaussian noise σ = 0.6 % of the face width × (2 − quality score); estimated/manual points get 3×/2× that σ. The full pipeline is re-run N times (default 40, deterministic seed) and the standard deviation of every score, category index, symmetry score and ratio value is reported (`uncertainty`, `valueSigma`, `sigma`).

## 7. Battle rules

* Rounds: Facial Harmony, Eye Area, Midface, Nose, Lips, Jawline, Lower Third, Facial Structure, Symmetry.
* Round margin = 1 + 1.96·√(σA² + σB²) (fallback σ = (1 − confidence)·8 when no simulation). |diff| ≤ margin ⇒ draw.
* Verdict (overall score, same margin rule):
  * *inconclusive* if an image is not analyzable, an overall score is missing, coverage < 50 % on either side, or confidence < 0.35 on either side;
  * *draw* if |ΔOverall| ≤ margin;
  * otherwise the higher overall score wins.
* Key differences: ratios available on both sides with the largest index deltas (≥ 5).
