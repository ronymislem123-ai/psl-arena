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

## 2. Measure index (per ratio, 0–100) — engine 2.0

A continuous index that uses the T1 ranges and the natural between-person spread:

* `d` = distance outside the T1 range (0 inside).
* `s` = **dispersion unit** of the ratio (`scoring/measurement.ts`): from published
  coefficients of variation of the underlying distances (Fang et al. 2011 and others,
  combined for ratios with ρ = 0.5), otherwise a documented convention (CV .07).
* `index = 100 · exp(−½ (d/s)²)` — 100 inside T1, 61 one unit outside, 14 two units
  outside. After the Monte-Carlo the reported index is the **expectation over the
  value's measurement σ** (Simpson integration), so a value near a range boundary is
  not scored as if it were exact.
* Every ratio carries an **evidence status** (`evidenceOf`): *supported*,
  *convention*, *contradicted* (FWHR) or *constructMismatch* (JWHR, ET, DEV CT/ET,
  ICD/N). The last two are measured and shown but never scored (`docs/RUBRIC.md`).
* Engine 1.x used `100 · 2^(−d/tolerance)` with tolerance = max(10 % of the target,
  half the width); kept as `toleranceFor()` for reference.

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
* **Symmetry score** = mean of per-metric scores `100·exp(−½(a/s)²)` over 14 bilateral comparisons (eye opening, fissure length, canthal tilt, canthus height, brow height/tilt, mouth-corner height/width, nose-tip and alar offsets, chin, gonion width/height, cheek width) in the 3D-pose-normalised frame. Engine 2.0 removes the noise floor: |a| measured with noise σ (Monte-Carlo, without the safety factor) becomes √max(a² − σ², 0).
* **Overall score (engine ≥ 3.0)** = rubric 3.0 hierarchical index of the frontal measures (`scores.rubric`, `docs/RUBRIC.md`): criteria → 7 front-profile categories → weighted mean (Σ Sᵢ·Wᵢ, renormalised over the assessable categories). Engine 2.x used rubric 2.x (7 other categories, weighted power mean p = 0.5). The ratio categories above remain as descriptive groups (battle rounds, overview). Engine 1.x: 0.8 × proportion + 0.2 × symmetry.

Feature observations (section 6 of the brief) reuse these values and are **not** added again. Visual properties (skin, cheekbone definition, jawline definition, chin projection, nasal bridge) are reported as *not determinable* rather than guessed.

## 5. Coverage

`coverage = evaluable / 42`, where evaluable = ratios with a value that are included in scoring. With a confirmed hairline and no neck points, 35 of 42 are evaluable (6 incomplete definitions + NW). Scores from fewer evaluable ratios are flagged as coverage-adjusted; battles require ≥ 50 % coverage on both sides for a verdict.

## 6. Uncertainty

Monte-Carlo propagation (default 40 samples, deterministic seed). Engine 2.0 draws
**correlated** landmark noise from an empirical model of 35 repeated MediaPipe
detections (`landmarks/noise-model.ts`: 14 principal components + residual,
mirror-augmented), scaled by the face's IPD × safety factor 1.5 × image-quality
factor (1–2). Manual points (hairline, neck, corrected landmarks) get their own
placement σ. Every sample re-runs the full pipeline; the SD of every score,
category, ratio value and symmetry metric is reported, and the per-sample index of
every frontal measure is stored (`uncertainty.measureSamples`) so the PSL rater can
replay the samples through its own aggregation. Validation: `docs/MODEL_VALIDATION.md`.

## 7. Battle rules

* Rounds: Facial Harmony, Eye Area, Midface, Nose, Lips, Jawline, Lower Third, Facial Structure, Symmetry.
* Round margin = 1 + 1.96·√(σA² + σB²) (fallback σ = (1 − confidence)·8 when no simulation). |diff| ≤ margin ⇒ draw.
* Verdict (overall score, same margin rule):
  * *inconclusive* if an image is not analyzable, the analyses come from different engine generations, an overall score is missing, coverage < 50 % on either side, or confidence < 0.35 on either side;
  * *draw* if |ΔOverall| ≤ margin;
  * otherwise the higher overall score wins.
* Key differences: ratios available on both sides with the largest index deltas (≥ 5).

## 8. Quality control (engine 3.1)

Before any of the scores above is shown, the analysis passes the multi-stage
quality control (`docs/QUALITY_CONTROL.md`): landmarks are verified over six
detections (median position, tolerance, anatomical rules, re-analysis of violating
points), every measure is recomputed from every detection (stable ≤ 0.5 s,
unstable ≤ 1 s with half confidence, excluded > 1 s or implausible), excluded
measures and rejected landmarks never enter an index, and a control instance
recomputes the category and overall indices independently and checks
reproducibility (≤ 0.35 PSL), coverage and consistency. A failed control removes
the overall score (`overall = null`); battles treat such an analysis like one
without an overall score (*inconclusive*).
