# PSL rating rubric (version 2.2.0)

The AI PSL Rater and the frontal analysis share one scoring model: measures
(frontal ratios, symmetry metrics, two derived frontal measures, profile
measurements, optional vision-model assessments) → **41 criteria** (one anatomical trait
each) → **7 categories** → overall index 0–100 → PSL 0–10. The rubric is versioned
(`RUBRIC_VERSION` in `src/engine/psl/rubric.ts`); every rating stores the version,
calibration, minimum coverage and a snapshot of the scale. Ratings of rubric 1.0.0
keep rendering with their own criteria and areas (`LEGACY_CRITERIA`, legacy
`AREA_META` entries).

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

1. **One measure, one criterion.** A unit test checks that every measure key
   (`r:`, `s:`, `a:`, `p:`, `v:`) feeds at most one criterion and that every
   measurable frontal ratio is either scored by exactly one criterion or listed as
   *descriptive* with a reason. The frontal chin–philtrum ratio and the profile
   lip–chin ratio describe the same construct and form one criterion.
2. **No invented values.** Criteria without inputs are *not assessable* with a
   reason code; they are left out of the aggregation, never filled.
3. **Shown, not scored.** Measures whose reference direction is contradicted by
   evidence or whose reference range does not match the landmark construction are
   reported with the reason and excluded from every score (table below).
4. **Unusable photos never score.** A failed quality gate gives no score and no tier.
5. **Uncertainty travels to the end.** The landmark-noise Monte-Carlo of the frontal
   analysis is replayed through the whole aggregation; the rating reports σ in PSL,
   the decimals σ justifies and the probability of another tier.

## Categories and weights (sum 100)

| Category | Weight | Basis for the order |
| --- | ---: | --- |
| A Eye area | 25 | Eyes explain the most variance of whole-face judgements (adj. R² .55, Gao 2025) |
| F Facial proportions | 20 | Averageness/proportion is the most consistent shape predictor (Lee et al. 2025; Pallett et al. 2010) |
| B Bone structure | 15 | Jaw prominence mattered among single features (Mogilski & Welling 2018), but 2D jaw landmarks are unreliable (Lim et al. 2022) |
| D Nose | 12 | adj. R² .20 (Gao 2025) |
| E Lips & mouth | 10 | adj. R² .12 (Gao 2025) |
| A Symmetry | 10 | Weak predictor in recent large samples (Lee et al. 2025; Van Dongen 2011) |
| G Forehead & hairline | 8 | Not predictive in Gao 2025; hairline is the least reliable landmark |

The order follows the cited evidence; the exact values are conventions. Their
influence is tested in `docs/MODEL_VALIDATION.md` (equal weights change no ranking
of the test faces). "H Overall harmony" is not a separate category: it is the
interaction term of the non-compensatory aggregation.

## Criteria

| Category | Criterion | Measures |
| --- | --- | --- |
| Eye area | canthalTilt | CT |
| | eyeSpacing | ESR, ICD, OCD |
| | fissureProportions | EAR, PFL/BYZGO |
| | browArea (brow length) | EBL |
| | upperLidExposure (upper lid position) | MRD1: iris centre → upper lid margin, mm (normal 4–5 mm, Putterman 2012) |
| | scleralShow | SSI: lower iris edge → lower lid margin, mm (≤ 0 normal, > 1 mm retraction, Bartley 1996; plateau to 0.5 mm, s = 1 mm) |
| | eyeShape | vision model only |
| Facial proportions | midfaceRatio | MF |
| | facialThirds (middle & lower) | FT-M, FT-L |
| | faceShape | TFWHR, LFF, DEV BIT/BIG |
| | eyeMouthGeometry | EME |
| | eyeMouthLength | EML (Pallett et al. 2010 length ratio, preferred .36–.37, s = .017) |
| | lowerThirdProportions | L3P |
| | facialFifths | FIFTHS (Gaussian around equal fifths, s = 3 pp) |
| | profileConvexity, lowerFaceHarmony | profile FCA, LFH |
| Bone structure | jawWidth | BIG |
| | jawAngularityFrontal | GS |
| | chinWidthShape | M/C |
| | cheekbonePosition | CBS |
| | gonialAngle | profile GA |
| | mandibularPlane | profile MPA (soft-tissue Go–Me to the reference horizontal, 20–30°, Tweed 1954 FMA 25 ± 5°) |
| | midfaceProjection | profile MFP (Sn ahead of the glabella vertical, 2.4–7.2 % of G–Me; Legan & Burstone 1980: 6 ± 3 mm with G–Me ≈ 125 mm) |
| | chinProjection | profile ZANG, HANG, CHP (Pg to the glabella vertical, ± 3.2 %; Legan & Burstone 1980: 0 ± 4 mm) |
| | neckChinDefinition | profile CMA, MCA; frontal NW (manual neck points) |
| | cheekboneProjection, jawlineDefinition | vision model only |
| Nose | noseWidth | N/BYZGO |
| | noseHeightWidth | N/H |
| | noseProjection, nasalAngles | profile GOODE; NFA, NFC, NMA |
| Lips & mouth | mouthWidth | M/IPD, M/N, M/BIG |
| | lipProportions | LL/UL, LIP WHR |
| | lipChinVertical | C/P (frontal) + LCR (profile) |
| | nasolabialAngle | profile NLA |
| | lipShape | vision model only |
| Symmetry | eyeSymmetry | eye opening, fissure length, canthal tilt, canthus height, brow height, brow tilt |
| | noseSymmetry | nose tip, alar base |
| | mouthSymmetry | mouth-corner height and width |
| | jawChinSymmetry | gonion width/height, cheek width, chin |
| Forehead & hairline | foreheadHeight | FT-U, FWHF |
| | foreheadWidth | BIT |

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
   noise-floor-corrected asymmetry. Profile measures: side-view index. Visual
   scores: inverse calibration of the provider's 0–10 value.
2. **Criterion index** = weighted mean of its measures (they describe one trait),
   weight = dependency weight × landmark reliability λ × confidence.
   λ (weakest landmark): gonion/ramus/mandible 0.4 (2D bigonial ICC .16, Lim et al.
   2022), zygion 0.75 (bizygomatic ICC .66), hairline, chin corners, temples,
   neck 0.6; all others 1.
3. **Category index** = weighted power mean (p = 0.5) of its criteria
   (weight 1 × mean λ × mean confidence).
4. **Overall index** = weighted power mean (p = 0.5) of the category indices with the
   category weights, renormalised over assessed categories. Missing profile or
   visual criteria therefore change coverage, not the scale of the result.
   The power mean is monotone in every input, equals the arithmetic mean when all
   inputs agree, and gives an excellent trait diminishing returns. The difference to
   the arithmetic mean is reported as **compensation penalty**. p is a stated model
   parameter (configural, non-additive judgements: Abbas & Duchaine 2008; Lin & Zhou
   2021; no study quantifies the degree) with a sensitivity analysis.
5. **Calibration** PSL = index ÷ 10 (linear). Rubric 1.0's anchors were placed so
   the project's portraits landed in the middle (circular). A population anchor
   would need human ratings or population data of every measure; the model
   simulation that assumed the population to be centred in the reference ranges was
   rejected by the real test faces (median index ≈ 85 predicted, 54–79 observed).
   The PSL value is therefore a **geometric conformity score**, not a population
   percentile.
6. **Coverage** = category-weighted share of the non-visual criteria that were
   assessable. Frontal photo with hairline ≈ 0.79 (test faces), with a side view ≈ 0.9–1.0. Below the
   minimum coverage (default 0.7) the score is *provisional*.
7. **σ, precision, tier.** σ_PSL = SD of the overall score over the stored
   Monte-Carlo samples of every frontal measure (correlated landmark noise) and the
   side-view σ; the display uses one significant digit of σ (`displayDecimals`); the
   tier comes from the unrounded score; `tierUncertainty` = share of samples in
   another tier.
8. **Strengths / lower-rated criteria**: assessable criteria ≥ 6.5 / < 5.

## Tournaments and comparisons

Tournament categories that correspond to rubric categories (eye area, symmetry,
proportions, nose, bone structure) use the category score; the others average a
criterion selection. By default only "Best overall face" carries weight, so the
weighted tournament overall equals the rubric overall and nothing is counted twice.
Comparisons warn when rubric or engine versions differ; battles between analyses
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
- 2D soft-tissue stand-ins for bony landmarks; profile criteria come from the
  automatically detected silhouette points (or manual placement); points off the
  silhouette (alar crease, tragion, often the gonion) make GA, GOODE and MPA
  "not determinable" unless the user adds them.
- Vision-model scores are impressions of a general model, not validated against
  human ratings, and vary between runs and model versions (the model id is stored
  with every rating).
- The rubric is for consenting adults' voluntary comparison of facial geometry; the
  disclaimer is part of every result.
