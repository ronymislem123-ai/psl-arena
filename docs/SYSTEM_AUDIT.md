# System audit — facial analysis and rating (state before the 2026-11 re-engineering)

This audit describes how the analysis pipeline actually worked before the
re-engineering (engine 1.0.0, rubric 1.0.0) and lists the defects that were
**measured**, not assumed. All numbers come from `tests/research/` probes on the
landmark fixtures in `tests/fixtures/` (two public-domain US government portraits
and one synthetic render; three further fixtures are deliberately unusable).

## 1. How the pipeline worked

| Stage | Implementation | Notes |
| --- | --- | --- |
| Face detection & landmarks | MediaPipe Face Landmarker (float16, CPU WASM) in the browser; 478 points, blendshapes, 4×4 facial transformation matrix | The landmarker also returns a depth value `z` per point — **discarded** in `lib/vision/detect.ts`. |
| Head pose | Yaw/pitch from the transformation matrix (ZYX Euler); roll from the pupil line | Pose was only used to **gate** quality and lower confidence; nothing was corrected except roll. |
| Coordinate frame | `alignMesh`: 2D rotation about the pupil midpoint so the pupil line is horizontal | Left/right pupil chosen **by image x** instead of mesh topology (defect D7). |
| Semantic landmarks | ~50 points from fixed mesh indices; zygion = widest contour pair; gonion = intersection of ramus and body contour lines; trichion = colour-change scan along the chin→forehead line; neck manual | Precision classes high/medium/low and source factors give a landmark confidence. |
| Quality | Face width (px), Laplacian sharpness, brightness, contrast, yaw/pitch/roll thresholds, blendshape expression | Roll > 35° counted as "poor", > 60° (also 87° in a fixture) as **unusable**. |
| Ratios | 42 definitions (35 evaluable with hairline), T1 ranges from the community guide | Index = 100 inside T1, ×½ per "tolerance" outside; tolerance = max(10 % of the target, half the range width). |
| Symmetry | 14 bilateral metrics relative to a fitted midline in the roll-normalised 2D frame | No yaw correction (defect D6). |
| Uncertainty | Monte-Carlo: every mesh point jittered with the same isotropic σ = 0.6 % of the face width × quality factor | Same σ for eye corners and jaw contour (defect D10). |
| PSL rubric 1.0 | 41 criteria in 7 areas, weights 18/17/22/9/8/10/16; criterion = confidence-weighted mean of its inputs, calibrated index→PSL by fixed anchors, then weight-averaged | Includes `areaBalance` (weight 7) and `verticalBalance` (weight 3). |

## 2. Audit questions

| Area | Question | Finding |
| --- | --- | --- |
| Face detection | Are faces detected reliably? | Yes for frontal, sharp portraits (all fixtures detected). Detection itself was not the weak point. |
| Landmark detection | Are anatomical points placed correctly? | Eye, nose and mouth points are stable; zygion, gonion and hairline are model/contour stand-ins with low precision (documented). No manual correction except hairline and neck. |
| Pose estimation | Are head orientation and perspective considered? | Only as quality gates. Yaw and pitch distort widths, heights and symmetry without correction; perspective (camera distance) only via a manual "selfie" switch. |
| Geometry | Are measurements mathematically correct? | Distances and angles are correct in the roll-normalised frame — **except** for faces rotated by more than 90° (D7), where signed measures flip. |
| Symmetry | Is asymmetry computed sensibly? | Metric design is sound, but yaw inflates it (a fixture with 11.5° yaw scored 46.5 vs 81.2 for a frontal one). |
| Rating | Are the criteria transparent? | Yes, but each criterion is nearly binary (inside range ≈ 9.0 PSL, a few tolerance units outside ≈ 0.5–1). |
| Weighting | Are weights justified? | Area weights were conventions; `areaBalance` rewards *uniformity* (a uniformly weak face scores high), `verticalBalance` scores the three thirds a second time. |
| Aggregation | Is the total computed correctly? | Arithmetic is correct, but the design averages ~24 near-binary criteria, so totals regress to the middle. |
| Reliability | Is uncertainty considered? | A σ was propagated, but the scoring nonlinearity creates a **systematic downward bias** under measurement noise (see D2). |
| User interface | Are results shown transparently? | Detailed, but scores were shown with 0.01 precision regardless of σ; no per-measurement detection-quality table; no landmark correction. |

## 3. Measured defects

| # | Defect | Evidence |
| --- | --- | --- |
| D1 | **Near-binary criterion scores.** Inside T1 → index 100 → PSL 9.0; outside, the index halves per tolerance unit, so faces a few units outside all score ≈ 0. Real faces hit only 9–14 of 35 ranges. | Criterion scores of the three usable fixtures: 0.7 … 9.0 with a gap in between; totals 4.87 / 5.08 / 5.85. |
| D2 | **Noise at the size of real differences + downward bias.** | Re-scoring each fixture 60× under the engine's own landmark jitter: PSL SD 0.14–0.19, range 0.7–0.8 points; mean under jitter 0.17–0.34 lower than the unjittered score (the plateau can only lose). The two real portraits differ by 0.21. |
| D3 | **Tolerance rule is scale-dependent.** "10 % of the target" is meaningless for interval-scale quantities (angles in degrees, signed tilts, deviations around 0) and makes some ratios extremely lenient (EME: tolerance 4.75° for a 1° range) and others steep. | `toleranceFor` in `ratios/database.ts`. |
| D4 | **Shared denominators multiply single traits.** Bizygomatic width (a low-precision soft-tissue stand-in) is a denominator of 10 ratios, the hairline of 6, bigonial width of 5. | A ±5 % change of the cheek width alone changed 12 ratios and 10 criteria; a ±5 % eye-spacing change 8 ratios and 11 criteria. |
| D5 | **Compressive and duplicate meta-criteria.** `areaBalance` (weight 7) rewards a low spread across areas regardless of level; `verticalBalance` (weight 3) re-scores FT_U/FT_M/FT_L. | `psl/rubric.ts`, `psl/rating.ts`. |
| D6 | **Yaw-confounded symmetry and widths.** | 11.5° yaw → symmetry 46.5 vs 81.2 frontal; jaw/chin symmetry criterion 2.3 vs 5.8. |
| D7 | **Roll handling breaks beyond 90° and rejects lossless cases.** | Mesh rotated 180°: detected roll −0.7°, ratios off by up to 14.3, result still "valid" (PSL 5.10). Rotated 89°: ratios exact but rejected as unusable. 120°/270°: wrong frame and rejected. |
| D8 | **Side view uses the image vertical as the anatomical vertical** (the reference axis behind the Z angle, lower-face height, lip–chin ratio and chin meridian). A tilted head shifts these values. | `side-view.ts`: `vdist` on image y, Z angle against the image horizontal. |
| D9 | **Depth discarded.** MediaPipe's per-point z is dropped, so no 3D pose normalisation is possible. | `lib/vision/detect.ts`. |
| D10 | **Isotropic landmark error model.** Eye corners and jaw contour get the same jitter. | `scoring/uncertainty.ts`. |
| D11 | **Circular calibration.** Calibration anchors were "chosen so that the project's real-portrait fixtures land near the centre". | `psl/rubric.ts` comment. |
| D12 | **Capture conditions not classified.** No view/framing/selfie/lighting/compression analysis; camera distance only via a manual switch. | `quality/assess.ts`. |

### Found during the re-engineering

| # | Defect | Evidence / fix |
| --- | --- | --- |
| D13 | **Reference ranges that do not fit the landmark construction.** JWHR, ET (and DEV CT/ET) and ICD/N are outside their range on the same side for every real and AI test face (median 2.7–4.5 dispersion units). | Shown, not scored (`constructMismatch`, `docs/MODEL_VALIDATION.md`). |
| D14 | **Independent landmark jitter overstated the uncertainty of local differences 5–19×** (MediaPipe errors of neighbouring and mirror-paired points are shared). | Empirical correlated noise model; leave-one-face-out check. |
| D15 | **Server schema dropped the capture metrics.** `rawQuality` was validated with a closed zod object, so the engine-2.0 capture fields sent by the browser were stripped on the server. | Fields added to `analysisInputSchema`; unit test. |
| D16 | **The Monte-Carlo kept the noise floor in asymmetries.** \|asymmetry\| measured with noise is biased upwards, so a perfectly symmetric face looked asymmetric. | √max(a² − σ², 0) with the MC σ. |

## 4. What worked and is kept

* Detection, the semantic landmark map and the quality gates for blur, darkness, yaw and expression.
* "Never invent": incomplete ratios are never measured, visual criteria are never guessed, unusable images get no score.
* Monte-Carlo uncertainty as a method (re-run the whole pipeline on perturbed inputs).
* Snapshots of scale and rubric version in every stored rating.
