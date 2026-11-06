# Side-view (profile) module

The frontal engine cannot measure anything that needs depth: the true gonial angle, the cervicomental angle, chin projection, the nasal dorsum. The side-view module adds these from a **lateral photo** — without a landmark model.

## Why manual landmarks

Face-landmark models (including the MediaPipe mesh used for the frontal analysis) are trained on near-frontal faces and become unreliable on a true 90° profile: the hidden half of the face is hallucinated, and contour points drift. Instead of presenting those guesses as measurements, the module asks the user to place **16 standard soft-tissue points** under guidance:

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
