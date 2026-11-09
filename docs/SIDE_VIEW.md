# Side-view (profile) module

The frontal engine cannot measure anything that needs depth: the true gonial angle, the cervicomental angle, chin and midface projection, the nasal dorsum. The side-view module adds these from a **lateral photo**. Since version 2.0 (2026-11-08) the user only uploads the photo: the points are **detected automatically**; manual correction and extra points are optional.

## Automatic detection (side view 2.0)

Face-landmark models (including the MediaPipe mesh used for the frontal analysis) are trained on near-frontal faces: on a true profile the MediaPipe face detector finds no face at all (verified on the rendered head scan at 80–100°), and where it does, the hidden half is hallucinated. The soft-tissue midline points, however, all lie on the **profile silhouette**. The pipeline (`src/lib/vision/profile.ts` in the browser, `src/engine/side-auto.ts` pure TypeScript):

1. **Quality check.** The face landmarker runs on the photo; a face turned less than 50° means "not a profile photo" and nothing is placed (message with the measured turn). Resolution, cropping and lip/neck visibility are reported as warnings.
2. **Segmentation** with the MediaPipe Image Segmenter (multiclass selfie model, served from this origin, runs in the browser): background / hair / body skin / face skin / clothes. Two passes: whole photo, then a crop around the head (≈ 3× the effective resolution of the 256 × 256 model input).
3. **Contour.** Largest person component → Moore boundary tracing → Gaussian smoothing → resampling at ≈ 0.25 mm; the anterior part from the top of the head down the neck is kept.
4. **Scale.** Head length (widest head row above the neck ≈ 21 cm with nose and hair), vertex → nasal tip (≈ 16 cm, only when the top of the head is in the photo), then the soft-tissue nasal length N–Prn (≈ 4.8 cm, Farkas 1994) for the lower face. The scale only sets search windows; all measurements stay scale-free.
5. **Points**, each with a geometric definition:
   * pronasale — the anterior extreme that stands out above *and* below (the nose; lips and chin stand out on one side only);
   * nasion — deepest point behind the chord glabella → nasal tip; glabella — most anterior forehead point 0.4–3 cm above it. **Hair** (multiclass segmentation, class "hair") is never a nasal tip or a glabella: candidates on hair are skipped, a skin maximum cut off by hair above it is rejected, and if no skin glabella remains the glabella is "not determinable" (warning `hairOverForehead`; FCA, LFH, MFP, CHP, NFA, NFC and MCA are then not computed — the glabella is no longer a mandatory point);
   * rhinion — top of a dorsal hump on the upper two thirds of the dorsum, otherwise 40 % of the dorsum (marked *derived*);
   * labrale sup./inf., pogonion — anterior extremes between subnasale and the chin turn; subnasale, stomion, labiomental fold — deepest points between their neighbours; the lower-face frame follows the glabella → subnasale axis when the head is tilted by more than 10°; when that axis leans more than 8° away from its typical ≈ 5° forward lean (Sn ≈ 6 mm ahead of the glabella vertical over ≈ 63 mm) a `headTilted` warning is shown — measures against the vertical (MFP, CHP, ZANG, HANG, LFH) shift with the head posture (≈ 20 index points for a 12° tilt in the audit);
   * chin turn — where the contour runs backwards for ≥ 1.5 cm (submental line); menton — most convex point between pogonion and cervical point; cervical point — deepest point behind the chord pogonion → lower neck; neck point — 2.5 cm along the neck front below it;
   * gonion — only from a plausible corner of the face-skin/body-skin border (5–13 cm behind the menton); otherwise not determinable.
   * **Not guessed:** alar crease, tragion and orbitale are not on the silhouette. Measurements that need them (GOODE, GA, Frankfort axis) are reported as **not determinable** (with the missing point named) unless the user places them.
6. **Provenance.** Every point carries its source (contour / derived / segment border / manual); the result stores `placement` (automatic, mixed, manual) and the missing points. The placement sensitivity uses σ = 0.6 % of the face height for automatic points (0.4 % manual), and automatic profile measures enter the rating with reliability 0.8.

**Validation** (`tests/unit/side-auto.test.ts`, `tests/e2e/side-view.spec.ts`): the synthetic profile drawing with known points (pronasale within 8 px, lips/chin within 14 px, nasion 18 px, glabella 30 px, menton 25 px at a 400 px face height); real MediaPipe segmentations of a rendered 3D head scan (Lee Perry-Smith, CC BY 3.0) at 80°, 90°, 100° and two head tilts — full midline, cervical and neck point, anatomically plausible angles, left/right mirror within 2°, deterministic output. Known failure: a head tilted far back (chin up ≈ 25°+) gives "lips/chin not found" instead of wrong points. Gonion: not found on the head scan (the skin classes are not separated there), so GA and MPA usually need a manually placed gonion/tragion.

## Manual placement (optional)

The user can correct any point or place all **16 standard soft-tissue points** manually under guidance:

| # | Landmark | Placement |
| --- | --- | --- |
| 1 | glabella | most prominent point of the forehead between the brows |
| 2 | nasion (soft tissue) | deepest point of the nasal bridge |
| 3 | rhinion | bone/cartilage junction of the dorsum (top of a hump; mid-dorsum on a straight nose) |
| 4 | pronasale | nasal tip |
| 5 | subnasale | columella–upper-lip junction |
| 6 | alar crease | deepest point of the alar groove |
| 7 | labrale superius | most anterior point of the upper lip |
| 8 | stomion | lip contact point |
| 9 | labrale inferius | most anterior point of the lower lip |
| 10 | labiomental fold | deepest point between lower lip and chin |
| 11 | pogonion (soft tissue) | most anterior chin point |
| 12 | menton (soft tissue) | lowest chin point |
| 13 | cervical point | deepest point between chin and neck |
| 14 | neck point | on the straight front of the neck, 2–3 cm below the cervical point |
| 15 | gonion (soft tissue) | jaw angle |
| 16 | tragion | notch above the tragus |

Placement aids: a 3× loupe window that follows the pointer, dragging of placed points, arrow-key nudging (1 px, Shift = 5 px), undo and a step list that allows any point to be re-placed. The facing direction (left/right) is detected from the pronasale–tragion order, so photos of either side work without mirroring.

## Measurements

All values are scale-free (angles or ratios of distances between placed points). The image vertical/horizontal stands in for the true vertical/Frankfort horizontal (natural head position assumed), which is listed as an assumption in every result.

| Id | Measurement | Construction | Reference | Source |
| --- | --- | --- | --- | --- |
| GA | Gonial angle (soft tissue) | ∠ tragion–gonion–menton | 115–130° | provided guide (older reference) |
| CMA | Cervicomental angle | ∠ menton–cervical–neck | 105–120° | Ellenbogen & Karlin 1980 |
| MCA | Mentocervical angle | line G–Pg vs line Me–C | 80–95° | Powell & Humphreys 1984 |
| NFA | Nasofrontal angle | ∠ glabella–nasion–pronasale | 115–130° | Powell & Humphreys 1984 |
| NFC | Nasofacial angle | line G–Pg vs line N–Prn | 30–40° | Powell & Humphreys 1984 |
| NMA | Nasomental angle | ∠ nasion–pronasale–pogonion | 120–132° | Powell & Humphreys 1984 |
| NLA | Nasolabial angle | ∠ pronasale–subnasale–labrale sup. | 90–110° | Powell & Humphreys 1984 / Legan & Burstone 1980 |
| MLA | Mentolabial angle | ∠ labrale inf.–labiomental–pogonion | — | descriptive (published values vary widely) |
| FCA | Facial convexity | interior ∠ glabella–subnasale–pogonion | 164–172° (12° ± 4° convexity) | Legan & Burstone 1980 |
| HANG | Holdaway H angle | ∠ nasion–pogonion–labrale sup. | 7–15° | Holdaway 1983 |
| ZANG | Merrifield Z angle | profile line (most protrusive lip → pogonion) vs posterior horizontal | 71–89° (80° ± 9°) | Merrifield 1966 |
| LFH | Lower face height | (Sn–Me) / (G–Me), vertical | ≈ 50 % (G–Sn : Sn–Me' = 1 : 1) | Legan & Burstone 1980 |
| LCR | Vertical lip–chin ratio | (Stm–Me) / (Sn–Stm), vertical | ≈ 2.0 (1 : 2) | Legan & Burstone 1980 |
| GOODE | Nasal projection | ⊥ distance Prn to line N–alar crease / N–Prn | 0.55–0.60 | Goode (in Powell & Humphreys 1984) |
| DORSUM | Dorsal profile | signed ⊥ offset of rhinion from N–Prn in % of N–Prn | — | descriptive (+ hump / − saddle) |
| MPA | Mandibular plane angle (soft tissue) | line Go′–Me′ vs reference horizontal | 20–30° | Tweed 1954 (FMA 25° ± 5°; soft-tissue proxy) |
| MFP | Midface projection | Sn ahead of the glabella vertical in % of G–Me′ | 2.4–7.2 % | Legan & Burstone 1980 (6 ± 3 mm, converted with G–Me′ ≈ 125 mm, Farkas 1994) |
| CHP | Chin projection | Pg′ relative to the glabella vertical in % of G–Me′ | −3.2 to +3.2 % | Legan & Burstone 1980 (0 ± 4 mm, converted) |
| CHIN_MERIDIAN | Chin position | anterior offset of Pg from the vertical through N in % of N–Me | — | descriptive (Gonzalez-Ulloa zero meridian; no numeric target in the material) |

Point targets (LFH, LCR) use the app's tolerance rule (10 % of the target, as in the frontal engine) rather than an invented range. Nothing from this module enters the 42-ratio frontal score; the **profile harmony index** is the plain mean of the 13 scored harmony indices (100 inside the range, halving per tolerance unit outside — the same curve as the frontal ratios) and is reported as a separate number.

## Placement check and sensitivity

Before any value is shown, the placement is checked. Errors block the analysis (the result carries no values, the API answers 422):

* `verticalOrder` — the midline points must run top → bottom (glabella, nasion, pronasale, subnasale, lips, labiomental, pogonion, menton);
* `anteriorOrder` — the pronasale must be the most anterior point of the nose;
* `neckOrder` — cervical point below the menton, neck point below the cervical point.

Warnings are shown but do not block: implausible tragion/gonion level, face smaller than 150 px (glabella–menton).

Every result includes the **placement sensitivity**: all 16 points are jittered with Gaussian noise (σ = max(1.5 px, 0.4 % of the face height), 40 samples, deterministic seed) and the standard deviation of every value and of the index is reported — angles with short arms (nasolabial, mentolabial) are visibly more sensitive than long-arm angles (H angle, convexity).

## Data

`side_analyses` (one row per analysis: profile, optional encrypted image, facing, `points_json`, `result_json`, index, σ, scored count) and `side_measurements` (one row per measurement). Side analyses belong to the same face profile as frontal analyses, are listed in the history and on the profile page, are included in the JSON export and in delete-all, and are deleted with their profile. Photos are stored only with the explicit opt-in, AES-256-GCM encrypted like frontal photos; otherwise only the 16 coordinates and the results are kept.
