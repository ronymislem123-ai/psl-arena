# Research log — PSL conventions and scientific grounding

Date of research: 2026-11-06. Three research passes were run (community PSL scale, community facial-analysis criteria, scientific literature) plus one direct-verification pass after the development environment's network allow-list had been extended. The raw reports are in `docs/research/` and are the source of every statement below.

## Access status (honest summary)

| Source | Status |
| --- | --- |
| looksmax.org | **Not readable from the development environment.** First the network policy denied the host; after it was allowed, every URL (even `robots.txt`) answered HTTP 403 with a Cloudflare JavaScript challenge. No bot-check circumvention was attempted; archive mirrors are outside the allow-list. All looksmax.org statements therefore rest on **search-engine result snippets** of the threads, never on fetched pages. Thread titles/URLs are real search results; numbers quoted from snippets could not be checked against the full thread. |
| incels.wiki | Readable; the pages `PSL_rating` and `Canthal_tilt` were read in full. |
| PubMed | Reachable but cookie/JS-gated; abstracts could not be read. |
| PMC (pmc.ncbi.nlm.nih.gov) | Readable; full texts used for verification. |
| Journal publishers (via doi.org) | Outside the allow-list. |

Consequence: the rubric treats every looksmax-derived number as an **unverified community claim** and never as a reference value; the scored reference ranges of the engine stay the T1 ranges of the project's own material (frontal) and the published cephalometric norms (profile).

## Part A — The PSL scale (see `docs/research/psl-scale-raw.md`, `verification-raw.md`)

Findings with their evidence level (S = snippet only, P = page read):

1. **Etymology (S, P):** "PSL" = PUAhate / Sluthate / Lookism, the three forums where the rating culture formed; coined "to distinguish their way of rating from the normie inflated ratings". The backronym "Proportion, Size and Lineation" appears only on secondary sites.
2. **Two incompatible ladders coexist (S):** (a) a 0–8 scale, 4 = median, each point ≈ one standard deviation (claimed percentiles 4 → 50 %, 5 → 84.15 %, 6 → 97.25/97.75 %, 7 → 99.87 %, 8 → 99.9968 %); (b) a /10 ladder with tiers on whole digits (sub5 ≤ 3.9, LTN 4.x, MTN 5.x, HTN 6.x, Chadlite 7.x, Chad 8.x, "PSL God" 8.9–9.5 or "True Adam" 9, 10 = "theoretical perfect"). Threads disagree on whether 4 or 5 is average, whether the scale starts at 0 or 1, whether 5 is HTN or Chadlite, and on sub-band boundaries.
3. **Percentiles are nominal (S, P):** the forum itself calls the SD table unsupported ("no consensus", "no set criteria for each level"); incels.wiki (read in full) gives a *different* table (5 = top 5 %, 6 = top 0.1 %, 7 = top 0.001 %) and states that the variance "is generally not clearly defined or based on empirically rank-ordered attractiveness ratings". incels.wiki's descriptions also invoke body fat, age and height, i.e. the scale is not consistently face-only.
4. **Rating rules repeated across threads (S):** rate the face only; neutral expression, full hairline, frontal + side (Frankfurt plane) + ¾ photos; camera at eye level, ~2 m, no zoom/filters; discount "frauding" (angles, squinting, lighting); criteria "harmony, balance, symmetry, sexual dimorphism, averageness, unique qualities"; quarter-point granularity; "if borderline, choose the lower tier".

**Decisions taken:**
- The app's standard scale is the brief's 0–10 ladder (the /10 convention, variant b) with evenly split sub-tiers. It is labelled as a *configurable community convention, not a validated attractiveness scale*. The 0–8/SD variant can be built in the Scale Builder; `percentile` is a free-text claim of the scale author and is never computed.
- Photo rules are enforced by the existing quality gate (yaw/pitch/roll/expression/resolution/blur) and by the side-view module's placement checks; height/body are never considered.
- "Sexual dimorphism" is deliberately **not** a criterion: it would require inferring sex-typed traits, which the privacy rules exclude.

## Part B — Facial-analysis criteria (see `docs/research/looksmax-criteria-raw.md`)

Which metrics the community uses is very consistent (FWHR, ESR, midface ratio, canthal tilt, eye aspect ratio, thirds/fifths, bigonial:bizygomatic, bitemporal, jaw frontal angle, chin:philtrum, mouth:nose, lip ratio, gonial angle, convexity, nasolabial angle, nasal projection). Their "ideal" bands differ by 2–10 % between threads and their landmark definitions differ (e.g. FWHR height from brow or eyelid or mid-brow to upper lip); several ratio threads admit their numbers "come mostly from FaceIQ" or from AI estimates.

| Community criterion | In the rubric as | Decision |
| --- | --- | --- |
| FWHR, ESR, midface ratio, canthal tilt, eye aspect ratio, PFL/face width, brow tilt | geometric criteria on the project's T1 ranges | adopted (measured; community bands not used as targets) |
| Thirds, fifths | facial thirds / fifths / vertical balance | adopted; fifths are a historical canon and get a documented tolerance |
| Bigonial:bizygomatic, bitemporal, jaw frontal angle | jaw width, jaw angularity (frontal) | adopted via BIG / BIT / GS |
| Chin:philtrum, lower third, mouth:nose, lip ratio | lower-third proportions, mouth width, lip proportions | adopted |
| Gonial angle | gonial angle (profile only), guide range 115–130° | adopted as profile criterion; the forum's own values range from 100–110° to 120–130° — no consensus, so the project's guide range is kept |
| Ramus length, "ogee curve", hollow cheeks | — | rejected: not measurable from photos / lighting-dependent (community agrees) |
| Upper eyelid exposure, scleral show, eye shape, lip shape, cheekbone projection, jawline definition | visual criteria | kept in the rubric with small weights, **assessable only with a visual provider** (none bundled) |
| Absolute mm targets (PFL 30–36 mm, philtrum 13–15 mm, ramus cm), "7–7.3°" precision, 5:1 chin:philtrum, 1.35 bizyg:bigonial, "horizontal scleral show is good" | — | rejected as unmeasurable or spurious |
| Harmony weighting (bones 30–85 %, eyes 15–20 % …) | rubric weights + user-configurable tournament weights | adapted: no community consensus exists, so weights are documented conventions and the tournament lets the user set them |

## Part C — Scientific sources (see `docs/research/scientific-raw.md`, `verification-raw.md`)

Read in full (PMC): Geniole et al. 2015 (FWHR meta-analyses), Haselhuhn et al. 2015, Lee et al. 2025 (averageness/femininity vs. symmetry), Jayaratne et al. 2012 and Al-Sebaei 2015 (neoclassical canons), Gao et al. 2025 (canthal-tilt norms by population), Kramer et al. 2018 (inter-rater agreement), Kaschel & Hildebrandt 2023 (photo validity), Bryan et al. 2012 and Třebický et al. 2016 (perspective/focal length), Ward et al. 2018 (selfie distortion). Snippet-only or not retrievable: Rhodes 2006, Van Dongen 2011, Jones & Jaeger 2019, Kleisner et al. 2024, Langlois & Roggman 1990, DeBruine et al. 2007, Farkas et al. 1985, Holland 2008, Kiekens et al. 2008, Pallett et al. 2010, Bashour & Geist 2007, Kempa et al. 2025, Legan & Burstone 1980, Holdaway 1983, Merrifield 1966, Powell & Humphreys 1984, Ellenbogen & Karlin 1980, Langlois et al. 2000, Hönekopp 2006, Buolamwini & Gebru 2018, Riccio et al. 2022/2024, Hamel et al. 2025.

What the literature says, and what it means for this app:

| Topic | Finding (evidence level) | Consequence |
| --- | --- | --- |
| Symmetry | Small effect, inflated by publication bias, near zero in large multivariate samples (Van Dongen 2011 snippet; Lee 2025 verified; Kleisner 2024 snippet) | Symmetry stays a moderate area (10 %) because the community rates it; the documentation states that its empirical weight is small. |
| Averageness / distinctiveness | The most replicable predictor across cultures, but weak (Lee 2025 verified; Kleisner 2024 snippet) | The engine does not compute a population mean (no reference population dataset); the "balance across areas" criterion is a configuration measure, not averageness. Documented as a limitation. |
| FWHR | Cue of perceived dominance/threat; **negatively** related to rated attractiveness, r = −.26 (Geniole 2015, verified); no fixed "ideal" range in any primary source; value shifts by ≈ 0.1 with lens choice (Třebický 2016, verified) | FWHR remains a community criterion scored on the project's T1 range, explicitly labelled a community convention that the attractiveness literature does not support; weight kept small (3). |
| Neoclassical canons (thirds, fifths) | Equal thirds occur in 0 % of measured adults; fifths-type canons in ≈ 20–40 % of Caucasians and far fewer elsewhere; not esthetic goals (Jayaratne 2012, Al-Sebaei 2015 verified) | Thirds are scored against the material's T1 ranges, not equality; the "vertical balance" and "fifths" criteria carry small weights (3 and 1) and are documented as community/historical conventions. |
| Golden ratio | Unsupported (Holland 2008, Kiekens 2008, Pallett 2010, Khoshab 2022, snippets) | Not used anywhere in the app. |
| Canthal tilt | Population norms ≈ 1–9° upward, differing by ethnicity and sex (Gao 2025 verified); raising the lateral canthus *lowers* attractiveness (Kempa 2025 snippet); the forum "5–9° ideal" has no scientific basis | The T1 range of the project material is kept as a community convention; the result page notes that reference ranges are not population-specific. |
| Cephalometric soft-tissue norms | Clinical population norms for white adults, not attractiveness predictors; some bounds disagree between sources (Z-angle SD, nasofacial 30 vs 36°, cervicomental 90–125°) | Side-view ranges stay as labelled "literature norms"; the disagreement is noted in `docs/SIDE_VIEW.md`'s successor notes here. |
| Rating reliability | Single raters are unreliable (retest ≈ 0.7–0.8); shared taste explains ~37–69 % of variance; ≈ 20–30 raters for a stable mean (Kramer 2018 verified) | Any single score, human or algorithmic, must not be presented as objective; the disclaimer and the "rubric position, not measurement" wording implement this. |
| Perspective | Selfie distance inflates nose width ≈ 30 % and midface height 12–19 %, lowers FWHR by ≈ 0.1 and lowers rated attractiveness (Ward 2018, Bryan 2012, Třebický 2016 verified) | The quality step flags selfie perspective and reduces the confidence of depth-sensitive ratios; capture at ≥ 1.5 m is recommended in the UI. |
| Bias of beauty AI | Trained beauty models show skin-tone and ethnicity bias (Beauty.AI, SCUT-FBP5500 analyses, snippets) | This app uses no trained beauty model; but its reference ranges come from community material based mostly on white adult male faces and are therefore not population-specific — stated on the result page and in `docs/VALIDATION.md`; no bias audit was possible. |

## Impact on the rating engine

- Rubric criteria and areas follow the consistent *set* of community criteria; numeric targets come from the project's T1 database and published cephalometric norms, not from forum bands.
- Visual impressions are modelled but never guessed (provider interface).
- Weights and calibration are declared conventions; the validation document reports what was and was not tested.
