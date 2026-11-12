# PSL rating rubric (version 3.0.0 — front profile only)

The AI PSL Rater and the frontal analysis share one scoring model that uses the
**frontal view only**: measures (frontal ratios, symmetry metrics, two derived
frontal measures, optional vision-model or self-assessed visual impressions) →
**32 criteria** (one anatomical trait each) → **7 categories** → overall index
0–100 → **PSL Score – Front Profile** 0.0–10.0. The rubric is versioned
(`RUBRIC_VERSION` in `src/engine/psl/rubric.ts`); every rating stores the version,
the quality-control status of its analysis and a snapshot of the scale.

**Engine 3.1.0 (2026-11-12): multi-stage quality control.** Every landmark,
measurement and the final result are checked before the score is shown
(`docs/QUALITY_CONTROL.md`). Excluded measures and rejected landmarks do not enter
the criteria; uncertain ones count with reduced confidence. The user-set minimum
coverage (slider) was removed: a rating is *valid* when the QC passed and coverage
is ≥ 70 %, *provisional* when the QC is limited, coverage is lower or the analysis
predates the QC, and has no score when the QC failed. The rubric (criteria,
weights, formula) is unchanged at 3.0.0; the canthus, brow-apex and gonion
conventions changed (see the QC document).

**3.0.0 (2026-11-09, engine 3.0.0): side profile removed, score rebuilt on the
front view.** The side view (profile upload, automatic profile detection, the
person-segmentation model, side-view routes and API, profile measures, profile
criteria and their weights) is gone from the application. Traits that need a
lateral view — sagittal chin projection, nose projection, mandibular projection,
profile angles (convexity, nasofrontal/nasolabial/cervicomental angles), the true
gonial angle — are no longer criteria; they are not estimated from the front
view. The categories and weights were rebuilt for the front view (table below)
and the overall score is the weighted arithmetic mean of the category scores
(p = 1), renormalised over the assessable categories. Ratings and analyses stored
before 3.0 are **not** recomputed: they keep their score and are marked
"old method" everywhere (rating page, history, profiles, dashboard, compare,
tournaments); leaderboards rank only 3.0 ratings and tournaments refuse older
ones. Stored side-view records stay in the database and in the JSON export.

## Earlier versions

Ratings of rubric 1.x/2.x keep rendering with their own criteria and areas
(`LEGACY_CRITERIA`, legacy `AREA_META` entries, `LEGACY_CATEGORY_WEIGHTS`).

**2.2.0 (2026-11-09, engine 2.1.0):** the frontal gonial slope (GS) is shown but not
scored — all six test faces lie above its 138–143° range (146–153°; the mesh contour
smooths the jaw corner), the same construct-mismatch rule as for JWHR and the brow
tilt; its criterion `jawAngularityFrontal` became a legacy criterion (41 criteria).
Engine 2.1.0: the zygion is the interpolated widest level of the face contour
(parabola through neighbouring contour widths) instead of an argmax over three fixed
pairs, which flipped the cheekbone position between ≈ 10 and ≈ 2 on 1 % width
differences; an estimated hairline whose upper third is more than 3 SD below the
reference (≈ 23 %) is treated as covered by hair and not used (thirds, forehead,
TFWHR, LFF and eye–mouth length become "not determinable — hairline covered"); the
Monte-Carlo samples are centred on the point index of each measure, so the tier
uncertainty is no longer inflated by the uncorrected symmetry samples; a non-neutral
expression caps the analysis reliability; "no-defect" criteria (scleral show) are not
listed as strengths.

**2.1.0 (2026-11-08):** upper lid position (MRD1) and scleral show are now
*measured* from the iris and lid contours of the mesh (millimetres via the iris
diameter 11.7 mm) instead of waiting for a visual provider; two profile criteria
were added (mandibular plane MPA, midface projection MFP) and the chin projection
also uses CHP (pogonion to the glabella vertical); the four remaining visual
criteria are assessed by a real vision model (Claude API) when one is set up and
the user consents per rating. Side views are detected automatically from the
profile silhouette (`docs/SIDE_VIEW.md`).

What changed against 1.0.0 and why is listed in `docs/SYSTEM_AUDIT.md` and
`docs/REENGINEERING_REPORT.md`; the measured effect is in `docs/MODEL_VALIDATION.md`.

## Principles

1. **Front view only.** Every criterion is computed from the frontal photo (or is a
   labelled visual impression of it). Nothing that needs a lateral view is
   measured, estimated or filled in.
2. **One measure, one criterion.** A unit test checks that every measure key
   (`r:`, `s:`, `a:`, `v:`) feeds at most one criterion and that every measurable
   frontal ratio is either scored by exactly one criterion or listed as
   *descriptive* with a reason.
3. **No invented values.** Criteria without inputs are *not assessable* with a
   reason code; they are left out of the aggregation, never filled and never
   counted as 0.
4. **Shown, not scored.** Measures whose reference direction is contradicted by
   evidence or whose reference range does not match the landmark construction are
   reported with the reason and excluded from every score (table below).
5. **Unusable photos never score; too little data gives no total.** A failed quality
   gate gives no score and no tier; with less than 50 % of the category weight
   assessable (`MIN_SCORABLE_COVERAGE`) no overall score is shown (warning
   `insufficientData`).
6. **Uncertainty travels to the end.** The landmark-noise Monte-Carlo of the frontal
   analysis is replayed through the whole aggregation; the rating reports σ in PSL,
   the decimals σ justifies and the probability of another tier. Image quality
   enters as confidence weight and uncertainty (σ), not as a penalty on the
   anatomical score.

## Categories and weights (sum 100)

| Category (`RubricArea`) | Weight | Criteria |
| --- | ---: | --- |
| Eye Area (`eye`) | 20 | canthalTilt, eyeSpacing, fissureProportions, browArea, upperLidExposure, scleralShow, eyeShape (visual) |
| Facial Harmony & Symmetry (`harmonySymmetry`) | 20 | facialThirds, faceShape, eyeMouthLength, facialFifths, foreheadHeight, eyeSymmetry, noseSymmetry, mouthSymmetry, jawChinSymmetry |
| Midface (`midfaceFront`) | 15 | midfaceRatio, eyeMouthGeometry |
| Nose (`nose`) | 15 | noseWidth, noseHeightWidth |
| Lower Third & Chin Shape (`lowerThird`) | 15 | lowerThirdProportions, chinWidthShape, mouthWidth, lipProportions, lipChinVertical (frontal C/P), lipShape (visual) |
| Jawline & Frontal Mandibular Definition (`jawline`) | 10 | jawWidth, jawlineDefinition (visual), neckWidth (manual neck points) |
| Cheekbones & Facial Width (`cheekbonesWidth`) | 5 | cheekbonePosition, cheekboneProjection (visual), foreheadWidth |

The weights are the proposed front-profile weights of the 3.0 specification. Each
criterion belongs to exactly one category, so nothing is weighted twice: the
symmetry criteria sit in *Facial Harmony & Symmetry* only, the lip/mouth criteria
in *Lower Third*, the bitemporal width in *Cheekbones & Facial Width*. The jaw
category is small because 2D gonion landmarks are the least reliable (bigonial ICC
.16, Lim et al. 2022) and the frontal gonial slope is shown, not scored.

## Criteria

| Category | Criterion | Measures |
| --- | --- | --- |
| Eye area | canthalTilt | CT |
| | eyeSpacing | ESR, ICD, OCD |
| | fissureProportions | EAR, PFL/BYZGO |
| | browArea (brow length) | EBL |
| | upperLidExposure (upper lid position) | MRD1: iris centre → upper lid margin, mm (normal 4–5 mm, Putterman 2012) |
| | scleralShow | SSI: lower iris edge → lower lid margin, mm (≤ 0 normal, > 1 mm retraction, Bartley 1996; plateau to 0.5 mm, s = 1 mm) |
| | eyeShape | vision model or self-assessment only |
| Facial harmony & symmetry | facialThirds (middle & lower) | FT-M, FT-L |
| | faceShape | TFWHR, LFF, DEV BIT/BIG |
| | eyeMouthLength | EML (Pallett et al. 2010 length ratio, preferred .36–.37, s = .017) |
| | facialFifths | FIFTHS (Gaussian around equal fifths, s = 3 pp) |
| | foreheadHeight | FT-U, FWHF |
| | eyeSymmetry | eye opening, fissure length, canthal tilt, canthus height, brow height, brow tilt |
| | noseSymmetry | nose tip, alar base |
| | mouthSymmetry | mouth-corner height and width |
| | jawChinSymmetry | gonion width/height, cheek width, chin |
| Midface | midfaceRatio | MF |
| | eyeMouthGeometry | EME |
| Nose | noseWidth | N/BYZGO |
| | noseHeightWidth | N/H |
| Lower third & chin shape | lowerThirdProportions | L3P |
| | chinWidthShape | M/C |
| | mouthWidth | M/IPD, M/N, M/BIG |
| | lipProportions | LL/UL, LIP WHR |
| | lipChinVertical | C/P (frontal) |
| | lipShape | vision model or self-assessment only |
| Jawline & frontal mandibular definition | jawWidth | BIG |
| | jawlineDefinition | vision model or self-assessment only |
| | neckWidth | NW (only with manually placed neck points) |
| Cheekbones & facial width | cheekbonePosition | CBS |
| | cheekboneProjection | vision model or self-assessment only (frontal contour impression, no depth claim) |
| | foreheadWidth | BIT |

Not part of the rubric (need a lateral view): sagittal chin projection, nose
projection, midface/mandibular projection, mandibular plane, true gonial angle
(the frontal gonial slope GS is shown, not scored), nasofrontal/nasolabial/
cervicomental angles, profile convexity.

### Shown, not scored

| Measure | Reason |
| --- | --- |
| FWHR | Reference direction contradicted: higher FWHR is rated *less* attractive (meta-analysis, r̄ = −.26, Geniole et al. 2015); tracks BMI. |
| JWHR | Reconstructed convention: all six test faces lie 2–6 dispersion units above the range (2.5–2.8 vs 1.85–1.95) — the source used another construction. |
| ET, DEV CT/ET | All six test faces have a negative brow tilt (−2 to −7°) against 5–13°: the source's angle convention differs; the deviation inherits it. |
| ICD/N | All six test faces lie below 1.0–1.1 (median −3 units); alar width relative to the intercanthal distance also differs systematically between populations (Farkas et al. 2005), so one narrow range is not a fair reference. |

The "test faces" are the four photo fixtures and two AI faces of `tests/fixtures`
(`docs/MODEL_VALIDATION.md`, reference plausibility). The rule — every test face
outside on the same side and the median ≥ 2 dispersion units — is deliberately
strict; ratios that some faces meet stay scored.

## From measures to the overall score

1. **Measure index (0–100).** Ratios: 100 inside the reference range, Gaussian
   fall-off `100·exp(−½(d/s)²)` outside, with the dispersion unit `s` = natural
   between-person spread (`docs/SCORING.md`), taken as the expectation over the
   measurement σ of the value. Symmetry metrics: the same Gaussian on the
   noise-floor-corrected asymmetry. Visual scores: inverse calibration of the
   provider's (or the user's) 0–10 value.
2. **Criterion index** = weighted mean of its measures (they describe one trait),
   weight = dependency weight × landmark reliability λ × confidence.
   λ (weakest landmark): gonion/ramus/mandible 0.4 (2D bigonial ICC .16, Lim et al.
   2022), zygion 0.75 (bizygomatic ICC .66), hairline, chin corners, temples,
   neck 0.6; all others 1.
3. **Category score Sᵢ** = weighted mean of its assessable criteria
   (criterion weight × mean λ × mean confidence), as index 0–100 and ÷ 10 on 0–10.
4. **PSL Score – Front Profile** = Σ Sᵢ · Wᵢ over the assessable categories, with
   Wᵢ = category weight ÷ sum of the weights of the assessable categories (so the
   used weights sum to 1.00). A category without any assessable criterion is left
   out — it is not counted as 0. Worked example (all categories assessable):
   0.20·8 + 0.20·6 + 0.15·7 + 0.15·5 + 0.15·9 + 0.10·4 + 0.05·10 = **6.85**;
   without the nose and cheekbone categories the remaining weights 0.80 are
   renormalised (`tests/unit/front-rubric.test.ts`). With less than 50 % of the
   category weight assessable, no overall score and no tier are given.
5. **Calibration** PSL = index ÷ 10 (linear), shown with one decimal (the tier comes
   from the unrounded score). The PSL value is a **geometric conformity score**,
   not a population percentile.
6. **Interpretation bands** (`src/engine/psl/bands.ts`), the same for the total
   and every category, judged on the displayed value: 0–2.9 very weak,
   3.0–4.9 below average, 5.0–6.9 average, 7.0–8.9 above average, 9.0–10
   exceptional — a reading against this rubric's criteria, not a medical or
   anthropometric norm.
7. **Coverage** = category-weighted share of the non-visual criteria that were
   assessable. Frontal photo with hairline ≈ 0.95 (test faces; the jaw category
   lacks the manual neck points), without a usable hairline ≈ 0.88. Below 0.7
   (fixed QC threshold since engine 3.1; before, a user-set minimum) the score is
   *provisional*; a criterion whose measures the QC excluded is not assessable.
8. **σ, precision, tier.** σ_PSL = SD of the overall score over the stored
   Monte-Carlo samples of every frontal measure (correlated landmark noise); the
   display uses one significant digit of σ (`displayDecimals`); `tierUncertainty`
   = share of samples in another tier.
9. **Strengths / lower-rated criteria**: assessable criteria ≥ 6.5 / < 5.

## Tournaments and comparisons

Tournament categories that correspond to rubric categories (eye area, facial
harmony & symmetry, midface, lower third, nose) use the category score; the others
(jawline, cheekbones, harmony, symmetry, chin, bone structure) average a criterion
selection. There is no profile category any more. By default only "Best overall face" carries weight, so the
weighted tournament overall equals the rubric overall and nothing is counted twice.
Comparisons warn when rubric or engine versions differ and mark old-method
ratings; tournaments accept only ratings of the current rubric; leaderboards rank
only 3.0 ratings and say how many profiles were left out; battles between analyses
of different engine generations are inconclusive.

## Visual criteria

Since 2.1 four criteria remain visual impressions that no landmark measures:
eye shape, lip shape, cheekbone projection and jawline definition. They are
assessed by a real vision model (`src/lib/visual-model/claude.ts`, Anthropic
Claude through the official SDK, structured output validated with zod; provider
`src/server/vision-provider.ts`) — never simulated, never guessed:

* **Set-up.** Server edition: `PSL_ARENA_VISION_PROVIDER=claude` and
  `ANTHROPIC_API_KEY` (optional `PSL_ARENA_VISION_MODEL`, default
  `claude-opus-5-5` with server-side fallback). Browser edition: the user's own
  key in the settings, stored only in that browser.
* **Consent per rating.** The photo is sent only when the user ticks the consent
  box for that rating; otherwise the four criteria report `visualNoConsent`.
* **What the model may say.** One 0–10 score per criterion with anchors, a
  confidence and a one-sentence reason, or "not assessable" (beard, hair, pose).
  The prompt forbids identification, age/ethnicity/health estimates and any
  overall attractiveness verdict. Scores are labelled "visual impression by the
  model …, not a measurement".
* **Status per criterion:** `visualNotConfigured`, `visualNoConsent`,
  `visualNoImage`, `visualFailed` (key rejected, network, refusal — the rating is
  still computed) or `visualNotAssessable` (the model declined this feature).
* The visual criteria do not change the coverage (as in 2.0).

### Free alternatives (no model, no cost)

**Self-assessment (scored, labelled).** In the rater the user may rate the four
visual criteria themselves (0–10, each optional). A self-assessed criterion is
labelled "self-assessment" (source `self-assessment`, warning `selfAssessment`)
and enters the hierarchy with half confidence and half reliability
(`SELF_ASSESSMENT_WEIGHTING`), so it moves the score less than a model score of
the same value. A vision-model score for the same criterion takes precedence.
Self-assessments never replace a measured criterion and do not change coverage.

**Photo measures (shown, not scored).** `src/engine/appearance.ts` measures six
descriptive quantities; they appear next to the criterion and in its detail
dialog but never enter the score, because no study gives reference ranges for
them (a score would invent a norm):

| Id | Criterion | Basis | Definition |
|---|---|---|---|
| `EYE_LID_BALANCE` | eye shape | mesh | share (%) of the fissure height above the canthal line (upper lid) |
| `EYE_LID_APEX` | eye shape | mesh | position (%) of the highest upper-lid point from medial (0) to lateral (100) canthus |
| `LIP_BOW` | lip shape | mesh | depth of the Cupid's-bow notch (0) below the bow peaks (37/267), % of upper vermilion height (peaks → stomion 13) |
| `LIP_FULLNESS` | lip shape | mesh | vermilion height (0 → 17), % of lower-face height (2 → 152) |
| `JAW_EDGE` | jawline definition | pixels | mean luminance step across the lower jaw border (6 points per side, inside vs. outside along the normal), ÷ face-luminance SD |
| `MALAR_SHADE` | cheekbone projection | pixels | zygomatic patch minus cheek-hollow patch luminance, ÷ face-luminance SD |

The pixel measures are computed in the browser (`imageAppearance` in
`src/lib/vision/pipeline.ts`); only the two numbers are sent. They depend on
lighting, make-up and beard and describe the photo, not the anatomy. Missing
inputs (closed eyes, no pixels, flat image) give "not available", never a value.

## Known limitations

- Community reference ranges, mostly derived from white adult faces; several are
  untested conventions (`evidenceOf()` per ratio). Nose and lip widths differ
  systematically between populations.
- Category weights and p are evidence-informed conventions, not fitted to human
  ratings (none were available).
- 2D soft-tissue stand-ins for bony landmarks. Front view only: projections and
  profile angles are not part of the score, so faces that differ mainly in profile
  are not distinguished.
- Vision-model scores are impressions of a general model, not validated against
  human ratings, and vary between runs and model versions (the model id is stored
  with every rating).
- The rubric is for consenting adults' voluntary comparison of facial geometry; the
  disclaimer is part of every result.
