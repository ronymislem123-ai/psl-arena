# Ratio database and landmark conventions

All measurements are taken in the **roll-normalised frame** (rotation about the inter-pupillary midpoint so the pupil line is horizontal). Horizontal widths use Euclidean distances between bilateral points; midline heights use vertical distances. Angles are relative to the pupil line.

## Landmark mapping (MediaPipe Face Landmarker, 478 points)

| Semantic landmark | Mesh index / construction | Precision | Notes |
| --- | --- | --- | --- |
| pupil R/L | 468 / 473 (iris centres) | high | |
| endocanthion R/L | 243 / 463 | high | medial lid junction (ring 1), validated against 133/362 (fissure edge) |
| exocanthion R/L | 130 / 359 | high | lateral lid junction (ring 1) |
| upper / lower lid R | 159 / 145 (L: 386 / 374) | medium | eye opening at the pupil |
| brow head R/L | midpoint of 107 & 55 (336 & 285) | medium | |
| brow tail R/L | midpoint of 70 & 46 (300 & 276) | medium | |
| brow apex R/L | highest of 63/105/66 (293/334/296) | medium | |
| brow lower-mid R/L | 52 / 282 | medium | |
| brow line | horizontal through mean y of 52 & 282 | medium | upper bound of FWHR |
| nasion | 168 | medium | soft-tissue sellion level |
| pronasale | 1 | high | |
| subnasale | 2 | high | |
| alare R/L | 48 / 278 | medium | lateral edge of the alar wing at the crease; 129/358 (cheek side) overestimate the width by ≈8 % |
| cheilion R/L | 61 / 291 | high | |
| labrale superius / inferius | 0 / 17 | medium | |
| stomion | midpoint of 13 & 14 | medium | |
| glabella | 9 | medium | mid-brow reference for the thirds |
| menton | 152 | high | |
| chin corner R/L | 176 / 400 | medium | lateral edges of the chin pad, below the mouth corners |
| zygion R/L | widest of the contour pairs (127/356), (234/454), (93/323) | low | soft-tissue stand-in for the zygomatic arch |
| frontotemporale R/L | 21 / 251 | low | temple contour at brow level |
| gonion R/L | intersection of the ramus line (fit through 93,132,58 / 323,361,288) and the body line (150,136,172 / 379,365,397); fallback 58/288 | low | soft-tissue silhouette, wider than the bony gonion |
| trichion | image scan (skin→hair transition above mesh point 10) or manual | low (estimated) / medium (confirmed) | hairline is not part of the mesh |
| neck R/L | manual only | low | required for NW |

The mapping was validated on real detections (see `tests/fixtures`, derived from public-domain portraits) by inspecting labelled crops.

## The 42 core ratios

Status: **D** = defined in the material · **R** = reconstructed convention (scored, flagged, can be excluded in settings) · **I** = incomplete (never measured/scored).

| # | Ratio | T1 | Status | Implementation |
| ---: | --- | --- | :-: | --- |
| 1 | ESR | 45.0–47.9 % | D | IPD / bizygomatic × 100 |
| 2 | OCD | 62–68 % | R | outer canthal (exocanthion–exocanthion) / bizygomatic × 100; denominator reconstructed |
| 3 | ICD | 0.93–1.05 | D | intercanthal / mean PFL |
| 4 | EAR | 3.0–3.6 | D | per eye PFL / eye height, averaged |
| 5 | PFL/BYZGO | 19.5–21.5 % | D | mean PFL / bizygomatic × 100 |
| 6 | M/IPD | 80–88 % | D | mouth width / IPD × 100 |
| 7 | EBL | 69–79 % | D | brow head–tail length / IPD × 100 (mean) |
| 8 | EBS | 90–98 % | I | literal text formula does not reproduce the range; template needed |
| 9 | ICD/N | 1.00–1.10 | R | intercanthal / alar width; end points fixed here |
| 10 | EME | 47–48° | D | angle at the stomion between the rays to the pupils (E–M–E) |
| 11 | IAA | 85–95° | I | angle construction only in the template |
| 12 | JFA | 85–95° | I | angle construction only in the template |
| 13 | DEV IAA/JFA | 0–3° | I | depends on 11 & 12 |
| 14 | BIT | 85–95 % | D | bitemporal (21–251) / bizygomatic × 100 |
| 15 | DEV BIT/BIG | 0–3 | D | |BIT − BIG| |
| 16 | BIG | 85–92 % | D | bigonial (constructed gonions) / bizygomatic × 100 |
| 17 | JWHR | 1.85–1.95 | R | bigonial / (stomion→menton); vertical bounds fixed here (subnasale→menton would give ≈30 % lower values) |
| 18 | M/BIG | 40–45 % | D | mouth width / bigonial × 100 |
| 19 | GS | 138–143° | R | frontal projection of the gonial angle (ramus line vs. body line). Mesh contour is smooth ⇒ values run ≈150° even for angular jaws; low precision |
| 20 | M/N | 1.38–1.52 | D | mouth width / alar width |
| 21 | MF | 0.95–1.03 | D | IPD / (nasion→labrale superius) |
| 22 | FWHR | 1.90–2.05 | D | bizygomatic / (brow line→labrale superius) |
| 23 | TFWHR | 1.33–1.38 | D | (trichion→menton) / bizygomatic |
| 24 | CBS | > 80 % | D | (zygion level→stomion) / (pupil line→stomion) × 100; one-sided |
| 25 | N/H | 1.40–1.59 | D | (nasion→subnasale) / alar width |
| 26 | M/C | 0.95–1.05 | R | mouth width / chin width (176–400) |
| 27 | NBR/ALA | 2.00–2.15 | I | end points not defined |
| 28 | N/BYZGO | 24–26 % | D | alar width / bizygomatic × 100 |
| 29 | CT | 5–8° | D | canthal tilt, + when the lateral canthus is higher (mean of both eyes) |
| 30 | ET | 5–13° | D | brow head→tail tilt, + when the tail is higher (mean) |
| 31 | DEV CT/ET | 0–3° | D | |CT − ET| |
| 32 | FWHF | 44–50 % | R | (trichion→glabella) / bizygomatic × 100; reference width fixed here |
| 33 | LL/UL | 1.40–1.90 | D | lower vermilion height / upper vermilion height |
| 34 | L3P | 31–33 % | D | (subnasale→stomion) / (subnasale→menton) × 100 |
| 35 | LFF | 63–67 % | D | (nasion→menton) / (trichion→menton) × 100 |
| 36 | C/P | 2.10–2.50 | D | (labrale inferius→menton) / (subnasale→labrale superius); "lip midpoint" read as the upper vermilion border |
| 37 | FT-L | 34–37 % | D | lower third / total height × 100 |
| 38 | FT-M | 31–33 % | D | middle third / total height × 100 |
| 39 | FT-U | 30–32 % | D | upper third / total height × 100 |
| 40 | LIP WHR | 3.0–3.5 | D | mouth width / (labrale superius→labrale inferius) |
| 41 | NW | 90–98 % | D | neck width (manual points) / bigonial × 100 |
| 42 | EYS | 2.9–3.6 | I | measurement undefined |

Every definition also stores: unit, formula text, methodology, landmark inputs, tolerance (see SCORING.md), dependency weight, sensitivity flags (yaw, expression regions, depth, hairline), limitations and the source note. `GET /api/ratios` returns the full database.

### Known systematic effects of the mesh conventions
* **GS** (frontal gonial projection) is larger than the lateral gonial angle and the mesh smooths the jaw corner: expect ≈145–160° for most faces.
* **BIG/bigonial** follows the soft-tissue silhouette (wider than caliper go–go). The guide's photo-based T1 (85–92 %) matches this convention.
* **Alar width** depends on the chosen alar landmark (±8 % between 48/278 and 129/358). Nose ratios (N/H, ICD/N, N/BYZGO) inherit that.
* **Brow tilt** uses the mesh brow contour ends; tails hidden by hair/grooming reduce accuracy.
* **Hairline-dependent ratios** (23, 32, 35, 37–39) depend on the trichion estimate; confirm or drag it in the review step.

## The 7 additional measurements (outside the core score)

| Measurement | Handling |
| --- | --- |
| CMA – cervicomental angle | unavailable: requires a profile photo |
| GA – gonial angle (115–130°) | unavailable: lateral measurement; the frontal projection is reported as GS and is not comparable |
| FH – forehead finger rule | raw: forehead height relative to the middle third and to IPD; no scoring |
| Facial fifths | measured: five horizontal segments (zygion–exocanthion–endocanthion–endocanthion–exocanthion–zygion) in % and the mean deviation from 20 % |
| BYZ/BIG (1.35) | raw only: contradicts BIG 85–92 % (⇒ 1.09–1.18); not scored |
| Ear angle | unavailable: no ear landmarks, no defined target |
| Nose–chin | raw only: nose tip→menton relative to IPD and the lower third |
