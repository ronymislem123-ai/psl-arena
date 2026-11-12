# Multi-stage quality control (engine 3.1.0)

Since engine 3.1.0 every frontal analysis runs through a three-stage quality control
before a result is shown. The goal is a **reproducible** result whose landmarks,
measurements and final score have each been checked — and an honest statement of
what the checks can and cannot prove. Code: `src/lib/vision/verify.ts` (browser),
`src/engine/verify/*` (engine), `src/components/analysis/qc-panel.tsx` (report).

```
photo ──► 6 detections (original + 5 controlled variants, mapped back to photo px)
      ──► stage 1  every landmark: median of all passes, tolerance check, anatomical
                   rules → confirmed / corrected (re-checked) / uncertain / rejected
      ──► stage 2  every measurement recomputed from every pass → stable / unstable /
                   excluded / implausible; result not reproducible → rejected and
                   re-analysed without the least reproducible measures (≤ 3 rounds)
      ──► stage 3  independent control instance → passed / limited / failed
      ──► result is shown (failed ⇒ no overall score)
```

## Detection passes (browser, on the device)

The photo is detected again under controlled changes; each detection is mapped back
to the pixels of the unchanged photo (mirror passes also swap left/right vertices):

| pass | change |
|---|---|
| `original` | unchanged photo |
| `mirror` | mirrored horizontally |
| `rotPlus` / `rotMinus` | rotated ±5° about the face centre |
| `zoom` | square face crop with 35 % margin, enlarged to ≥ 1024 px |
| `zoomMirror` | the zoomed crop, mirrored |

A pass whose face is not found (or lies more than 0.35 face sizes away) is recorded
as failed. The passes run after the main detection (≈ 0.7–3 s per photo on a
desktop CPU); the upload field shows the progress. Only point coordinates are kept
(`verification` in the analysis input), never extra images.

## Stage 1 — every landmark individually

For each of the semantic landmarks:

1. **Verified position** = component-wise median of all passes (the zoom passes
   are the "zoomed-in" re-detection of the region).
2. **Tolerance** = max(1.2 % IPD, 3 × measured repeatability σ of the vertex × 1.5).
   The spread is the trimmed spread of the passes around the median.
   * `confirmed` — the single detection of the unchanged photo and the passes agree
     within the tolerance;
   * `corrected` — the single detection lies outside the tolerance but the passes
     agree: the median replaces it and is **checked again** (at least half the
     passes inside the tolerance);
   * `uncertain` — passes disagree (spread > tolerance): the point is used with
     confidence × 0.6;
   * `rejected` — spread > 2.5 × tolerance: the point is not used; measures that
     need it become not assessable.
3. **Anatomical rules** (`midlineOrder`, `hairlineAbove`, `eyeOrder`, `lidOrder`,
   `browAboveEye`, `sideOfMidline`, `noseWings`, `mouthCorners`, `chinLowest`,
   `contourWidth`, `bilateralLevel`). For a violation the suspect point is the one
   farthest from where the canonical face model puts it; it is **re-analysed**: the
   positions of the individual passes are tried as alternatives, the first that
   satisfies all rules replaces it and is checked again; if none does, it is
   rejected. One suspect per violation and round, up to six rounds.
4. A rejected pupil makes every measurement impossible → the control fails.

## Stage 2 — every measurement and calculation

Every available ratio that enters the score, every symmetry metric and every
additional frontal measure the rubric scores is recomputed from every pass with the
verified landmarks. Spread is measured in
**dispersion units** s (the natural spread of that measure between people, the same
unit the scoring uses):

* ≤ 0.5 s `stable`; 0.5–1 s `unstable` (counts with half weight);
* > 1 s `excluded` — the photo does not determine the value better than people
  differ; it does not enter the score;
* > 12 s outside the reference range `implausible` → excluded (a measurement error,
  not anatomy);
* a measure built on an uncertain landmark is at most `unstable`.

Then the overall index is computed for every pass. If its trimmed standard
deviation exceeds 3.5 index points (0.35 PSL), the result is **rejected and
re-analysed** without the (up to three) least reproducible measures; at most three
rounds. Every step is logged (`qc.actions`) and shown in the report.

## Stage 3 — control instance

`finalControl` (`src/engine/verify/control.ts`) checks the finished analysis with
its own code:

| check | pass | restriction (`warn`) | fail |
|---|---|---|---|
| image quality | analysable | poor | unusable |
| multiple detection | ≥ 5 passes | fewer | — |
| landmarks | all confirmed (`note` if handled) | ≥ 4 uncertain/rejected | a pupil rejected |
| anatomy | no rule hit (`note` if corrected) | ≥ 3 rejected by rules | — |
| measurements | all stable (`note` if handled) | ≥ 5 flagged or a criterion lost | — |
| plausibility | none implausible | ≥ 2 | — |
| independent recomputation | category and overall indices recomputed independently match (≤ 10⁻⁶), all values finite and in 0–100, no excluded measure used | — | any deviation or leak |
| reproducibility | spread ≤ 0.35 PSL | ≤ 0.75 PSL / not determinable | > 0.75 PSL |
| coverage | ≥ 70 % of the rubric | 50–70 % | < 50 % |
| consistency | overall inside the category range | lid-axis tilt of the two eyes differs > 6° | overall outside the category range |

`note` means "found and handled automatically" and does not restrict the result.
Status: any `fail` → **failed** (no overall score anywhere: analysis, rating,
battle, tournament); any `warn` → **limited**; otherwise **passed**.

## Effect on ratings — the coverage slider is gone

The user-set "minimum coverage" slider (default 70 %, adjustable 50–95 %) was
removed from the rater, the API schema (`minCoverage`), the rating engine and the
reports. Validity now follows the quality control alone:

* **valid** = QC passed and coverage ≥ 70 %;
* **provisional** = a score exists but QC limited, coverage < 70 %, or the
  analysis predates the QC (`noQc`);
* **no score** = QC failed, unusable photo, or < 50 % of the category weight.

Stored ratings keep their original `minCoverage` and status; they are not
recomputed.

## Landmark conventions changed in engine 3.1

Found while auditing every landmark in zoomed crops:

* **Exocanthion** now uses mesh vertices 33/263 (the true lateral lid commissure);
  the former vertices lay on the ring outside the eye and tilted the canthal axis
  by ≈ 1–1.5° too low.
* **Brow apex** = vertex of a parabola fitted through the upper brow vertices
  instead of the single highest vertex (the latter jumped between neighbours).
* **Gonion** blends smoothly between the jaw-line intersection and the contour
  corner (was a hard switch that made the point jump between passes).

Analyses from engine 3.0 keep their stored values; re-analysing a photo applies
the new conventions.

## Report in the app

Analysis → tab **Check / Prüfung**: overall status, the ten checks, the
re-analysis log, every landmark in a zoomed crop of the photo (verified position,
all pass positions, the original detection when corrected, tolerance circle) and
every measurement with its spread. The rating page shows the QC status with a link
to this report. Analyses from before engine 3.1 show "no quality control" and
their ratings count as provisional.

## Validation and limits (honest)

* Calibration data: six captured inputs — portrait A (original, cropped, mirrored,
  downscaled), portrait B (public-domain photos, used only as test fixtures) and the
  synthetic ideal face (`tests/fixtures/verification`). On these, all landmarks were confirmed and the
  overall spread was ≤ 1.45 index points (≤ 0.15 PSL). Unit tests
  (`tests/unit/verification.test.ts`) inject displaced landmarks, disagreeing
  passes, rule violations, outliers and broken aggregations and check that each is
  corrected, flagged or rejected.
* The quality control proves **repeatability and anatomical plausibility**. It does
  **not** prove that each point lies exactly where a trained anthropometrist would
  place it: a systematic bias of the detection model that is the same in every
  pass stays invisible. Contour points (jaw, cheeks) are inherently less precise
  on 2-D photos.
* Thresholds (tolerances, 0.5/1/12 s, 0.35/0.75 PSL, 70/50 %) are documented
  conventions, not empirically optimal values; a larger, annotated data set would
  be needed to calibrate them.
