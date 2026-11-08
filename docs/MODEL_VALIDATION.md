# Model validation — engine 2.0 / rubric 2.0 against engine 1.x

All numbers below are reproducible:

```bash
VALIDATION_OUT=test-results/validation npm run research -- validation
```

(engine 2.0 part; writes `cases.json`, `results-new.json`, `sensitivity.json`),
the same `cases.json` evaluated with engine 1.x (commit 6391a18, x/y only, as that
engine used them; runner and steps in `scripts/research/engine1-runner.test.ts`), then `python3 -I scripts/research/validation-report.py
test-results/validation` → `docs/research/model-validation.json`.
No human ratings exist for this project, so nothing here validates *attractiveness*;
it validates the measurement chain: stability, sensitivity, invariance, the
aggregation's behaviour and the honesty of the reported uncertainty.

## Test groups

| Group | Cases | What it checks |
| --- | --- | --- |
| A test–retest | 35 re-detections of two portraits under shifts, scales, ±2/±4° rotation, JPEG 60/80, brightness ±15 %, contrast −20 %, blur (`tests/fixtures/repeatability`) | Noise of the scores on the same face |
| B controlled deformations | 10 operators (`engine/synth/deform.ts`) × amounts −2…+2 units × 3 base faces (real photo, AI face, average face) = 150 | Response to one known feature change, relative to the noise |
| C clearly different faces | 4 photo/AI fixtures, the canonical average face, the ideal example | Spread of the totals |
| D compensation | ideal face; eyes weak; four other features weak with eyes excellent; all weak; all moderately off | Whether one excellent feature offsets several weak ones |
| E pose & symmetry | 3D yaw 0–25°, pitch ±10°, roll 30/90/180° of two faces; mirror-averaged face; right eye raised 0.01–0.04 IPD | Invariance and symmetry response |

Synthetic poses in E are orthographic rotations of the 3D landmarks — exactly the
camera model the 3D normalisation assumes. Real photos add perspective and
self-occlusion, so E is an upper bound for the real-world invariance.

## Results

### A — test–retest noise (SD over re-detections)

| | engine 1.x | engine 2.0 |
| --- | ---: | ---: |
| overall index SD, portrait A / B | 0.34 / 0.75 | 1.10 / 2.82 |
| PSL SD, pooled | 0.05 | 0.21 |
| reported Monte-Carlo σ ÷ observed SD, A / B | 6.6 / 3.1 | 2.0 / 0.75 |

The new model is **noisier** under nuisance changes (×3.7 in index, ×4.5 in PSL).
Decomposition (`tests/research`, noise probe): neither the 3D pose normalisation
(2D path: same SD), the power mean (arithmetic: same SD) nor the Monte-Carlo cause
it; it comes from (a) measures that sit on the steep flank of their Gaussian
(e.g. TFWHR with the hairline: index SD 15 for value SD 0.016 vs s = 0.062) and
(b) the evidence-based category weights, which average fewer measures per unit of
weight than the old flat mean of ~35 ratios. The **reported** σ, however, now
matches the observed noise within a factor of 0.75–2 (old: overstated 3–6.6×,
because independent jitter ignored that MediaPipe errors are correlated).

### B — single-feature changes

| | engine 1.x | engine 2.0 |
| --- | ---: | ---: |
| median response amplitude (PSL, −2…+2 units) | 0.28 | 0.76 |
| median amplitude ÷ test–retest SD | 5.4 | 3.6 |
| share of changes > 2 noise SD | 93 % | 80 % |

Per operator (median over the three base faces, amplitude in index points /
amplitude ÷ noise): nose width 5.6/9.6 → 14.3/6.7; lip fullness 4.6/7.9 →
13.2/6.2; midface height 3.2/5.5 → 11.7/5.5; eye spacing 3.2/5.4 → 8.8/4.1; face
width 5.1/8.7 → 9.3/4.3; jaw width 4.2/7.2 → 5.9/2.8; eye size 2.2/3.8 → 4.7/2.2;
mouth width 1.6/2.8 → 2.3/1.1; canthal tilt 1.8/3.1 → 7.4/3.4; chin height
2.5/4.3 → 7.6/3.5.
The new model reacts **2.7× more strongly** to a feature change in absolute terms
(the old one compressed everything into a narrow PSL band), but relative to its
own test–retest noise it separates single-feature changes **less** well. Jaw
width is deliberately down-weighted (λ = 0.4), which shows here.

### C — different faces

| | engine 1.x | engine 2.0 |
| --- | ---: | ---: |
| PSL range over the 6 faces | 2.83 | 5.21 |
| PSL SD | 1.12 | 1.86 |
| between-face SD ÷ test–retest SD | 20.0 | 8.7 |

PSL per face (old → new): portrait A 5.08 → 5.38, portrait B 4.87 → 6.60, AI face 5.85 →
7.71, rotated portrait *unusable* → 4.65, average face 6.07 → 7.50, ideal example
7.69 → 9.86. The complaint "clearly different faces get nearly the same total" is
resolved in absolute terms (range ×1.8); different faces remain 8.7 noise SDs
apart.

### D — compensation

| overall index | engine 1.x | engine 2.0 |
| --- | ---: | ---: |
| ideal | 92.3 | 98.6 |
| eyes excellent, four other features weak | 74.8 | 70.3 |
| all six features moderately off (same total deformation, halved) | 80.5 | 87.5 |
| balanced − one excellent | **5.7** | **17.2** |

With the same amount of deformation, a balanced face now clearly outranks a face
with one excellent and several weak features. Sensitivity to p (same cases):
balanced − one excellent = 10.7 (p = 1, hierarchy only), 17.2 (p = 0.5), 22.6
(p = 0.25) — the hierarchy and the Gaussian measure indices do most of the work,
p adds the rest.

### E — pose and symmetry

| max \|Δ overall\| vs frontal | engine 1.x | engine 2.0 |
| --- | ---: | ---: |
| yaw 10° / 20° (ideal face) | 8.4 / 13.0 | 0.16 / 0.24 |
| yaw 10° / 20° (photo) | 5.6 / 8.9 | 0.18 / 0.53 |
| pitch ±10° | up to 5.2 | ≤ 0.43 |
| roll 90° | rejected as unusable | 0.05 |
| roll 180° | 2.5 | 0.04 |

Symmetry: mirror-averaged face 99.9 → 100; right eye raised 0.01 / 0.02 / 0.04
IPD: old 87 / 77 / 62, new 99 / 90 / 68 — both monotone; the new Gaussian is flat
near zero (tiny asymmetries are not perceived) and the noise floor is removed.

### Parameter sensitivity (groups C, D)

The ranking of the six C faces is **identical** for p = 1, 0.5, 0.25, equal
category weights and no reliability weights. Largest change of any C/D overall
index vs the default: p = 1 +10.6, p = 0.25 −9.2, equal weights 3.8, no
reliability weights 2.8.

### Property tests (`tests/unit/properties.test.ts`, 36 random deformation sets)

Scores bounded (0–100, PSL 0–10, no NaN, compensation penalty ≥ 0); invariant to
image scale, translation and in-plane rotation (any angle) to 6 decimals; the
mirrored photo (x mirrored, left/right indices swapped) gives the same overall and
symmetry to 4 decimals; deterministic including the Monte-Carlo.

## Landmark-noise model (`landmarks/noise-model.ts`)

Leading principal components (14, 95 % of the variance) of the 35 re-detections'
deviation fields, mirror-augmented, plus an independent residual.
Leave-one-face-out check (MC σ ÷ empirical σ over 49 measures):

| model | built from | tested on | median | 90th pct | max | SD(log) |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| independent jitter | — | A / B | 1.53 / 1.11 | 4.2 / 2.3 | 14.0 / 8.5 | 0.69 / 0.52 |
| correlated | B | A | 1.52 | 2.7 | 4.7 | 0.55 |
| correlated | A | B | 0.74 | 1.4 | 2.2 | 0.43 |

Out of sample the correlated model is closer to the observed noise than
independent jitter, but it is built from two faces only; the noise level differs
2.5× between them. A Gaussian-process correlation by distance did not help (the
dominant correlation is between mirror-paired points).

## Reference plausibility

Over the six distinct test faces (`tests/fixtures`: 4 photos incl. 2 unusable for
other reasons, 2 AI faces), three ratios lie outside their range on the same side
for **every** face with a median ≥ 2 dispersion units: JWHR (+4.5), ET (−2.7),
ICD/N (−3.0). They and DEV CT/ET (depends on ET) are shown but not scored
(`docs/RUBRIC.md`). Other ratios that most faces miss stay scored (they may be
genuine ideals).

## Calibration hypothesis (rejected)

`psl/calibration.ts` simulated a population in which every measure varies around
the middle of its reference range with its dispersion unit. Predicted overall
index: median 85.5, SD 4.6 (P5–P95: 76.7–91.7). Observed on the six test faces:
46–77 (usable photos 46–66). The hypothesis is rejected; the PSL value is index ÷ 10
without a population claim.

## Ideal example (closed loop)

`npm run research -- ideal` regenerates the geometry (16 000 ES iterations, 7 s):
29 of 32 targets inside their range when measured directly, the other three on
the boundary (EME, FT-U: 0.02 units; fifths 1.0 pp, Gaussian target 0), mean
vertex change 1.8 % IPD from the average face. `node scripts/research/ideal-loop.mjs`
renders it, re-detects it with MediaPipe and re-measures it
(`docs/research/ideal-closed-loop.json`): first render 14/32 in range (Σz² 14.8,
landmark residual 4.7 % IPD); the damped loop (α = 0.4) reaches Σz² 6.8 and
14–15/32 but the residual stays ≈ 4 % IPD — MediaPipe fits its learned face shape
to a non-photorealistic render. A photorealistic image would be needed to close
this gap; the dialog says so and shows the exact geometry next to the re-measured
values.

## Not validated

- Agreement with human attractiveness ratings (no rated data set).
- Between-photo variation of the same person (different days, lenses, lighting):
  group A covers only nuisance changes of one photo.
- Population bias: no consented, diverse data set; nose and lip references are known
  to be population-dependent.
- Real head rotations with perspective and occlusion (group E is orthographic).
