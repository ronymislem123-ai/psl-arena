# PSL rating rubric (version 1.0.0)

The AI PSL Rater turns the geometric frontal analysis (42 ratios, symmetry metrics, additional measurements), the optional side-view analysis (16 profile measurements) and — only when an external provider is configured — visual assessments into **41 criteria in 7 areas**, an overall PSL score (0–10) and a tier on the selected scale. The rubric is versioned (`RUBRIC_VERSION` in `src/engine/psl/rubric.ts`); every stored rating records the version, the calibration curve, the minimum coverage and a snapshot of the scale it used.

## Principles

1. **Traceable inputs.** Every criterion names the engine quantities it is built from. A unit test guarantees that each ratio, symmetry metric, additional measurement and side measurement feeds **exactly one** criterion, so no feature is counted twice. The two derived harmony criteria are meta-measures (spread across areas, equality of the thirds) and are documented as such.
2. **No invented values.** Criteria that cannot be computed from the available data are reported as *not assessable* with a reason (`requiresProfile`, `requiresVisualProvider`, `inputsUnavailable`, `notEnoughAreas`, `frontalUnusable`). They are excluded from the weighted mean — never filled with a neutral or negative value.
3. **Coverage-aware validity.** Coverage = assessable rubric weight / total weight. Below the minimum coverage (default 70 %, configurable per rating between 50 and 95 %) the score is shown as **provisional**. With a complete frontal photo (hairline confirmed) the geometric criteria reach 72 %; a side-view analysis adds 20 %; visual criteria (8 %) need a provider. The brief's suggested 80 % is reachable only with a profile view, which is why 70 % is the default and the UI explains the trade-off.
4. **Unusable photos never score.** If the frontal quality gate fails (yaw, blur, resolution, roll …), every criterion is *not assessable* and no score or tier is produced.
5. **Separate from the frontal harmony score and from battles.** The PSL score lives next to the existing 0–100 harmony scores; neither feeds the other.

## Criteria and weights (sum = 100)

| Area (weight) | Criterion | W | Method | Inputs |
| --- | --- | --- | --- | --- |
| Eye area (18) | Canthal tilt | 4 | geometric | CT |
| | Eye spacing | 4 | geometric | ESR, OCD, ICD |
| | Fissure proportions | 3 | geometric | EAR, PFL/BYZGO |
| | Brow position & shape | 3 | geometric | ET, DEV CT/ET, EBL |
| | Upper lid exposure | 2 | visual | provider only |
| | Scleral show | 1 | visual | provider only |
| | Eye shape | 1 | visual | provider only |
| Midface & proportions (17) | Midface ratio | 3 | geometric | MF |
| | Facial thirds | 3 | geometric | FT-U, FT-M, FT-L |
| | Facial width-to-height | 3 | geometric | FWHR |
| | Face shape proportions | 2 | geometric | TFWHR, LFF, FWHF |
| | Cheekbone position | 2 | geometric | CBS |
| | Eye–mouth geometry | 2 | geometric | EME |
| | Lower third proportions | 1 | geometric | L3P, C/P |
| | Facial fifths | 1 | geometric | FIFTHS (mean deviation from 20 %, tolerance 3 pp) |
| Bone structure (22) | Jaw width | 5 | geometric | BIG, DEV BIT/BIG, BIT |
| | Jaw width-to-height | 2 | geometric | JWHR |
| | Jaw angularity (frontal) | 2 | geometric | GS |
| | Gonial angle (profile) | 3 | profile | GA |
| | Chin projection (profile) | 3 | profile | ZANG, HANG |
| | Neck–chin definition | 2 | profile/frontal | CMA, MCA, NW |
| | Chin width | 2 | geometric | M/C |
| | Cheekbone projection | 2 | visual | provider only |
| | Jawline definition | 1 | visual | provider only |
| Nose (9) | Nose width | 3 | geometric | N/BYZGO, ICD/N |
| | Nose height-to-width | 2 | geometric | N/H |
| | Nose projection (profile) | 2 | profile | GOODE |
| | Nasal angles (profile) | 2 | profile | NFA, NFC, NMA |
| Lips & mouth (8) | Mouth width | 3 | geometric | M/IPD, M/N, M/BIG |
| | Lip proportions | 2 | geometric | LL/UL, LIP WHR |
| | Nasolabial angle (profile) | 1 | profile | NLA |
| | Lip–chin height (profile) | 1 | profile | LCR |
| | Lip shape | 1 | visual | provider only |
| Symmetry (10) | Eye & brow symmetry | 3 | symmetry | eyeHeight, pfl, canthalTilt, canthusHeight, browHeight, browTilt |
| | Nose symmetry | 2 | symmetry | noseTip, alar |
| | Mouth symmetry | 2 | symmetry | mouthCornerHeight, mouthCornerWidth |
| | Jaw & chin symmetry | 3 | symmetry | gonionWidth, gonionHeight, zygion, chin |
| Harmony (16) | Balance across areas | 7 | derived | spread (SD) of the six other area scores; tolerance 20 index points |
| | Vertical balance | 3 | derived | largest deviation of a third from 33.3 %; tolerance 3.33 pp |
| | Profile convexity | 3 | profile | FCA |
| | Lower-face harmony (profile) | 3 | profile | LFH |

Weights follow the community emphasis found in the research (bone structure and eye area first, harmony as an explicit factor, symmetry as a moderate factor) while keeping every area represented; they are a documented convention, not an empirical fit (see `docs/RESEARCH_LOG.md`).

## From measurements to scores

1. **Criterion index (0–100).** Confidence-weighted mean of the input indices: the frontal ratios' harmony indices (100 inside the T1 range, halving per tolerance unit outside — `docs/SCORING.md`), the symmetry metric scores, the side-view measurement indices (`docs/SIDE_VIEW.md`) and the derived measures. Visual criteria are taken directly on the 0–10 scale from the provider.
2. **Calibration (index → PSL).** Piecewise-linear anchors `[0→0.5, 30→2.5, 50→4.0, 65→5.0, 80→6.3, 90→7.5, 100→9.0]`. The curve is a rubric convention: it places the project's real-portrait fixtures (overall indices 65–72) near the centre of the 0–10 scale and lets only a geometrically flawless face approach 9. It is **not** an empirical calibration against human ratings (none were available; see `docs/VALIDATION.md`).
3. **Area score** = weight-normalised mean of the assessable criteria of the area (0–10).
4. **Overall PSL score** = Σ(criterion score × weight) / Σ(weight) over assessable criteria — the brief's formula with controlled normalisation.
5. **Tier** = `assignTier(scale snapshot, unrounded score)`: lower bound inclusive, upper bound exclusive, top bound inclusive. Display rounding never changes the tier.
6. **σ (placement sensitivity)** ≈ frontal Monte-Carlo σ of the overall index × local calibration slope × frontal weight share — an approximation reported as such.
7. **Strengths / lower-rated criteria** = assessable criteria with scores ≥ 6.5 (top four) / < 5 (lowest four). The result page and the copyable report follow the mandatory format (score, tier, reasoning, strengths, lower-rated, overall assessment, analysis quality, disclaimer).

## Visual criteria and the provider interface

Six criteria (upper lid exposure, scleral show, eye shape, cheekbone projection, jawline definition, lip shape) are visual impressions that 2D landmarks cannot provide. `src/server/vision-provider.ts` defines `VisualAssessmentProvider` (image in → scores 0–10 with confidence per criterion) and a strict output schema; `getVisualProvider()` returns `null` by default. **No provider is bundled and nothing is simulated**: without one these criteria stay *not assessable* and the coverage reflects that. Any provider added later must respect the privacy rules (no identification, no sensitive-attribute inference) and record its model version with the rating.

## Known limitations

- **Community rubric, not a scientific model.** The criteria follow the PSL community's conventions. The literature check (`docs/RESEARCH_LOG.md`, part C) shows that several of them are weakly supported or contradicted as attractiveness predictors: symmetry has a small effect, FWHR correlates *negatively* with rated attractiveness, equal facial thirds occur in 0 % of measured adults, canthal-tilt norms differ by population. The rubric keeps them because that is what a PSL rating means, with small weights where the evidence is weakest, and the result page says so.
- **Reference ranges are not population-specific.** The T1 ranges of the frontal material and the community norms were derived mostly from white adult male faces; faces from other populations may be systematically shifted. No bias audit was possible without a consented, diverse dataset.
- Weights and calibration are conventions (documented, versioned), not validated against human ratings.
- The frontal ratios use soft-tissue stand-ins for bony landmarks; the profile criteria depend on manual placement.
- The rubric is for consenting adults' voluntary comparison of facial geometry; the disclaimer is part of every result.
