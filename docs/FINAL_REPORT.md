# Final report — OMEGA PSL AI platform evolution

Date: 2026-11-06. Repository: `ronymislem123-ai/psl-arena` (branch `main`). This report follows the structure demanded by the development brief (sections A–H). Everything stated here was implemented and run in this project; numbers come from the test runs documented in `docs/TEST_REPORT.md` and `docs/VALIDATION.md`.

> **Reference images:** the brief refers to six attached reference images. No image files were attached to the session (the upload folders were empty), so the visual direction was derived from the brief's text (tier ladders, rating dashboards, comparison tables, winner cards) and the existing design system. If the images are supplied later, the tier views and winner cards are the places to align.

## A. Website audit

**Method.** Read the whole code base (engine, server, UI, tests, docs), ran the complete automated suite before changing anything (58 unit + 9 e2e tests passing at the start of this phase), then exercised every page through the end-to-end flows while building the new modules.

**Found and fixed / improved**
- *Navigation did not scale:* a flat six-entry bar; on phones every entry shared one row. → Ten entries grouped by purpose on desktop; on phones four primary entries plus a "More" sheet (`src/components/layout/app-shell.tsx`).
- *Single-photo rating did not exist:* the only entry point was the two-person battle. → The battle setup store became a factory (`createSetupStore`) so the rater reuses the proven upload/detection/quality UI with its own store.
- *History and profile pages* only knew analyses and battles. → Ratings and tournaments are listed (tabs, profile cards, dashboard tiles); the dashboard leads with the three main modules.
- *Image clean-up* ignored images referenced from JSON (scale tiers) and tournament participants. → `dropImageIfOrphaned` checks every reference.
- *Schema version* reporting in a test was stale after the migration. → Updated with the v6 migration.
- *No print output:* result pages could not be printed sensibly. → Print stylesheet (navigation hidden, light document).
- *Deprecated React pattern* (setState in effects) in new code was caught by the project's lint rules and rewritten.

**Checked and left as is (working):** authentication (sessions, recovery codes, TOTP), battle flow, side-view module, PWA/service worker, encrypted image store, export/delete-all, German locale, rate limiting and same-origin checks.

**Open findings (not fixed, documented in `docs/OPEN_ITEMS.md`):** server-side settings are not synced with the device store; no e-mail transport; no admin role; the Docker image is untested here.

## B. PSL rating engine (`docs/RUBRIC.md`)

- **Criteria examined:** every area of the brief (eye area, midface/proportions, bone structure, nose, lips/mouth, symmetry, harmony) was mapped against the engine's measurable quantities (42 frontal ratios, 14 symmetry metrics, fifths, 16 profile measurements). Community criteria from the research were classified as measurable / profile-only / visual / unmeasurable.
- **Criteria added:** a versioned rubric of **41 criteria** (rubric 1.0.0): 23 geometric (frontal), 9 profile, 4 symmetry, 2 derived harmony, 6 visual (provider-only). Each has definition, method, required view, requirements, limitations, weight and input list; a test proves that no engine quantity is used twice.
- **Scoring logic:** criterion index = confidence-weighted mean of its input indices → calibration curve (index → PSL 0–10, documented anchors) → area scores and overall = Σ(score × weight)/Σ(weight) over assessable criteria → tier on the selected scale (unrounded, lower-inclusive/upper-exclusive, inclusive top). Coverage = assessable weight share; below the configurable minimum (default 70 %) the score is provisional; an unusable frontal photo yields no score at all.
- **Weights:** area totals eye 18, midface 17, bone 22, nose 9, mouth 8, symmetry 10, harmony 16 — documented conventions informed by the research (bone structure and eye area emphasised, harmony explicit), not an empirical fit.
- **Harmony without double counting:** balance across areas (spread of area scores), vertical balance of the thirds, profile convexity and lower-face harmony — meta-measures and profile quantities, not a second pass over the same ratios.
- **Multi-image:** frontal + side view of the same profile are fused per criterion (each profile criterion names its side measurements); three-quarter views are not supported and say so.
- **Precision:** scores are shown with one decimal and explicitly declared as rubric positions; σ from the landmark Monte-Carlo is propagated through the calibration slope and labelled approximate.
- **Limitations:** calibration and weights unvalidated against human ratings; visual criteria need an external provider (none bundled, nothing simulated); soft-tissue stand-ins for bony landmarks; manual profile landmarks.

## C. Looksmax.org research (`docs/RESEARCH_LOG.md`, raw reports in `docs/research/`)

- **Access:** looksmax.org could not be read from the development environment — first blocked by the network policy, then (after the host was allowed with the user's approval) by the site's Cloudflare JavaScript challenge. No circumvention was attempted. All looksmax.org content therefore comes from search-engine result snippets of 60+ threads and is labelled as such; incels.wiki pages and PMC full texts were read directly.
- **Relevant sources (snippets):** PSL scale explanations (threads 432467, 379179, 103244), rating guides (1334104, 1659787, 1636334, 1363291, 815024), ratio compilations (Full Measuring Guide 1773516, "38 most important ratios" 956143, "frontal facial harmony" 1954357, "ideal frontal ratios" 1872454), gonial-angle threads (731204, 854526), profile threads (1960377, 319189, 1724234), cheekbone/ogee threads, weighting discussions. Read pages: incels.wiki *PSL rating* and *Canthal tilt*; PMC5876805 (Ward 2018), PMC4444660 (Legan & Burstone norms), PMC4369102 (Farkas citation).
- **Community definitions used:** the set of criteria (FWHR, ESR, midface ratio, canthal tilt, thirds/fifths, bigonial ratios, chin:philtrum, mouth:nose, lip ratio, gonial angle, convexity, nasolabial angle, projection), the photo standard (frontal + Frankfort-plane side, neutral, no filters, camera at distance), the tier ladder vocabulary.
- **Rejected:** forum "ideal" bands as targets (inconsistent by 2–10 % and sourced from third-party apps or AI), absolute millimetre targets, spurious precision, 5:1 chin:philtrum, 1.35 bizygomatic:bigonial, "horizontal scleral show is good", percentage weightings presented as facts, "sexual dimorphism" as a criterion (privacy), ramus/ogee claims (unmeasurable from photos), the SD-percentile table as a measurement (the forum itself and incels.wiki contradict it).
- **External scientific sources:** Ward, Ward & Paskhover 2018 (selfie nasal distortion, verified); Legan & Burstone 1980 norms (verified via a PMC table); Farkas et al. 1985 (neoclassical canons not valid; citation verified, abstract not readable); canthal-tilt surgical norms and a 2007 preference study (read on incels.wiki with PubMed ids); Rhodes 2006 (existence confirmed, numbers not retrievable). The dedicated scientific-literature pass is reported in `docs/research/` when it completed; its findings do not change the rubric.

## D. PSL Scale Builder (`docs/SCALES.md`)

Implemented: scale list (built-in + own), editor with linked bounds, add/duplicate/remove/move tiers, colours, groups, percentile claims, descriptions, notes, reference images (upload, caption, reorder, move between tiers, remove; encrypted, owner-scoped, ≤ 12 per tier), live validation with every error listed, value tester, five preview views, save with version bump, duplicate, export/import JSON (validated, images excluded), delete, compare page, restore of the standard scale as a copy. Tiers are stored as JSON on the scale row; ratings and tournaments store immutable snapshots; the built-in scale is served from code and read-only.

## E. Tournament mode (`docs/TOURNAMENT.md`)

Implemented formats: knockout (seeded, byes, round-by-round or play-all, manual tie decisions), group stage + finals, ranking, category. Category winners come solely from the category rankings (shared wins allowed, non-assessable participants excluded, undecidable categories reported); the weighted overall uses normalised user weights and three documented tie-breakers (overall face, decisive category, data completeness), then shared ranks. The official winner is the weighted winner or the knockout champion (user choice), both always reported. Lifecycle draft → running/paused → completed with locking; reopening archives a version; duplicates, exports, print, statistics, duel tables (symmetric by construction), live standings before completion, mobile bracket with zoom.

## F. Quality assurance

Executed on 2026-11-06 (details in `docs/TEST_REPORT.md`, experiments in `docs/VALIDATION.md`):

| Suite | Result |
| --- | --- |
| Unit tests (`npm test`, 18 files) | **179 passed**, 1 diagnostic dump skipped — incl. 5 new files: `psl-scale` (5), `psl-rubric` (10 incl. hand-checked coverage/validity), `tournament` (11), `psl-store` (8), `compare` (6) |
| End-to-end (`npm run test:e2e`, one run of the whole suite) | **16 passed** — battle flows (9), side view (2), PSL platform (3: scale builder, rater, tournaments), compare/progress/awards (1), consistency experiment (1) |
| Static checks | `npm run typecheck` clean, `npm run lint` clean, `npm run build` succeeds |
| Consistency experiments | identical file ⇒ Δ 0.000 PSL (both portraits); mirrored Δ 0.03; 60 % downscale Δ 0.03; tighter crop Δ 0.01 with coverage dropping 72 % → 64 % (provisional); tier stable in every case |

**Failed during development and fixed:** the saved-scale confirmation was lost on navigation (fixed with a `saved` flag); the duel tab opened without a pre-selected pair (fixed); two test defects (query parameter in a test URL, winner comparison by participant id instead of name). All suites were green at the end.

**Not executed:** empirical validation against human ratings, inter-rater agreement, demographic bias audit (no consented dataset); the visual-provider path (no provider); Docker image build (no daemon); print/PDF rendering inspection; three-quarter-view handling (not implemented).

## G. Technical changes

- **New engine modules:** `src/engine/psl/{scale,rubric,rating,index}.ts`, `src/engine/tournament/{types,categories,engine,index}.ts`.
- **Server:** schema v6 (`psl_scales`, `psl_ratings`, `tournaments`, `tournament_participants`, `tournament_versions`), `src/server/repos-psl.ts`, `src/server/services-psl.ts`, `src/server/vision-provider.ts`, request schemas, image-orphan check, stats/export/delete-all integration.
- **API:** `/api/scales` (+ `[id]`, `images`, `duplicate`, `export`, `import`), `/api/ratings` (+ `[id]`), `/api/tournaments` (+ `[id]`, `actions`, `versions`, `versions/[versionId]`), `/api/leaderboards`, `/api/rubric`.
- **UI:** `/rater`, `/rater/[id]`, `/scales`, `/scales/new`, `/scales/[id]`, `/scales/compare`, `/tournaments`, `/tournaments/new`, `/tournaments/[id]`, `/tournaments/[id]/edit`, `/leaderboards`; components under `src/components/{psl,rater,scales,tournaments,leaderboards}`; navigation, dashboard, history, profile pages extended; print stylesheet.
- **i18n:** `src/lib/i18n/{en-psl,de-psl,psl-texts}.ts` (all new texts in EN and DE, German names for criteria/areas/categories).
- **Tests:** `tests/unit/{psl-scale,psl-rubric,psl-store,tournament}.test.ts`, `tests/e2e/{psl,validation}.spec.ts`, fixture variants (`portrait-a-mirror/-small/-crop.jpg`).
- **Docs:** RUBRIC, SCALES, TOURNAMENT, RESEARCH_LOG, VALIDATION, FINAL_REPORT; README, DATA_MODEL, PRIVACY, ARCHITECTURE, OPEN_ITEMS, TEST_REPORT updated.
- **External dependencies:** none added (the modules use the existing stack: Next.js, React, zod, better-sqlite3, Playwright, Vitest).
- **Configuration:** no new environment variables are required. `PSL_ARENA_VISION_PROVIDER` is reserved for a future visual provider.

## Addendum — Comparison, progress and awards module (`docs/COMPARE.md`)

Added after the platform evolution as the next module (brief items 10.2 and 10.4): `/compare` shows 2–4 stored ratings side by side (score, tier, scale, rubric/engine versions, coverage, confidence, quality, profile view; 7 area rows and 41 criterion rows with deltas against the reference column and the spread; largest gains/losses of the last column) and flags differing rubric/engine versions, scales, coverage, image quality, profile-view or visual-assessment usage, provisional and invalid ratings. Profile pages show a progress timeline (first/latest/best, total change within one rubric version, mean change per rating, per-step deltas with the biggest criterion changes) and tournament awards (category wins incl. shared, multi-category, overall wins, knockout championships). Entry points: rating page, history selection, profile page, picker. Tests: `compare.test.ts` (engine), awards in `psl-store.test.ts`, `compare.spec.ts` (end-to-end).

## H. Remaining limitations

- **No visual-assessment model:** six rubric criteria stay not assessable; adding a provider is an integration task with privacy and reproducibility consequences.
- **No empirical validation data:** no consented reference set with multiple human raters exists, so inter-rater agreement, human–AI deviation and demographic bias were **not** measured; only repeatability and transformation robustness were.
- **looksmax.org not directly verifiable** from this environment (Cloudflare); forum-derived statements are snippet-based.
- **Three-quarter view, potential rating, public sharing, PDF rendering engine** not implemented (print/PDF via the browser only).
- **Docker image** not built here (no daemon); production deployment paths unchanged from the previous phase.
- **Legal review** of GDPR/AI-Act obligations for processing other people's faces is the operator's responsibility; the app provides the consent gates, encryption, deletion and export mechanisms.
