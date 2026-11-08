# Architecture

## Overview

```
 Browser (client)                                   Server (Next.js route handlers)
 ┌──────────────────────────────────────────┐       ┌──────────────────────────────────┐
 │ image file → canvas (≤1600px, EXIF fixed)│       │ POST /api/analyses               │
 │ MediaPipe Face Landmarker (WASM, local)  │       │   zod validation                 │
 │   478 landmarks, blendshapes, pose matrix│       │   engine.analyzeFace()  (same TS)│
 │ quality metrics (sharpness, light, …)    │ JSON  │   → SQLite (analysis, landmarks, │
 │ hairline estimate (+ manual adjust)      │ ────▶ │     ratios, categories)          │
 │ engine.analyzeFace()  → live preview     │       │   optional encrypted image store │
 │ review: layers, hairline, neck, consent  │       │ POST /api/battles → resolveBattle│
 └──────────────────────────────────────────┘       └──────────────────────────────────┘
```

* **Face detection, landmarking and quality metrics run only in the browser.** The server receives landmark coordinates, blendshape coefficients, the pose matrix and summary quality numbers — never the image, unless the user ticks "store photos".
* **One engine, two runtimes.** `src/engine` is dependency-free TypeScript. The client uses it for the live preview; the server re-runs it on the submitted input and persists the authoritative result (with Monte-Carlo uncertainty).
* **Battle resolution is server-side** (`resolveBattle`) and stored with the battle.

## Modules

### `src/engine`
| File | Responsibility |
| --- | --- |
| `types.ts` | All shared types (landmarks, ratio definitions/results, scores, quality, battle). |
| `geometry.ts` | Vector maths, line fitting/intersection, PRNG. |
| `landmarks/mesh-map.ts` | Mesh index map, roll normalisation (`alignMesh`), semantic landmark construction (`buildLandmarks`), gonion construction, zygion selection. |
| `ratios/database.ts` | The 42 ratio definitions + 7 additional measurements (metadata only, serialisable). |
| `ratios/formulas.ts` | One pure formula per ratio (returns value + intermediates). |
| `ratios/evaluate.ts` | Availability, confidence propagation, tier, harmony index per ratio. |
| `ratios/additional.ts` | The 7 additional measurements (raw values / unavailability reasons). |
| `scoring/tiers.ts` | Original T1–T5 system; harmony index function. |
| `scoring/aggregate.ts` | Category indices, harmony/proportion/structure/overall, coverage, original scoring. |
| `scoring/symmetry.ts` | Bilateral symmetry metrics against a fitted midline. |
| `scoring/features.ts` | Section-6 feature observations (measured / approximate / not determinable). |
| `scoring/uncertainty.ts` | Monte-Carlo propagation. |
| `quality/assess.ts` | Pose from matrix, expression from blendshapes, metric levels, issues, analyzability. |
| `analysis.ts` | Orchestrator `analyzeFace(input) → AnalysisResult`. |
| `battle.ts` | `resolveBattle(a, b) → BattleResult`. |
| `explain.ts` | Structured per-ratio explanations for the UI. |

`side-view.ts` — the lateral (profile) module: 16 manual landmark ids, 16 measurement definitions with sourced ranges, placement check (errors block, warnings inform), scale-free measurement, index/score, Monte-Carlo placement sensitivity. Independent of the frontal pipeline; see `docs/SIDE_VIEW.md`.

`psl/` — the shared PSL rating architecture: `scale.ts` (scales, standard scale, validation, unrounded tier assignment, snapshots, export format), `rubric.ts` (41 versioned criteria in 7 areas with weights, inputs, calibration anchors, minimum coverage), `rating.ts` (frontal + profile + optional visual assessments → criterion/area scores, coverage, validity, tier, strengths/lower-rated, σ). `tournament/` — category scores, rankings with shared ranks, weighted overall with documented tie-breakers, seeded knockout brackets with byes, group stage + finals, results and statistics. Both run unchanged in the browser (live previews/standings) and on the server (persisted results).

### `src/lib/vision` (browser only)
`landmarker.ts` (lazy singleton, CPU delegate with GPU fallback option), `image.ts` (decode/downscale, EXIF orientation), `detect.ts` (faces → pixel meshes, blendshapes, matrices), `quality.ts` (pixel statistics on a normalised face crop), `hairline.ts` (midline skin→hair transition scan), `pipeline.ts` (prepare image → `AnalysisInput`).

### `src/server`
`repos-psl.ts` / `services-psl.ts` hold the PSL persistence and use-cases (scale editing/import, rating creation with the latest side view of the profile, tournament lifecycle with locking and versions); `vision-provider.ts` is the (empty by default) integration point for a visual-assessment model.
`db.ts` (schema v2, WAL, migration from the single-user v1 layout), `auth.ts` (scrypt password hashing, database sessions, rate limiting, `requireUser` for pages and `requireUserApi` for route handlers with same-origin enforcement, legacy-data adoption), `images.ts` (AES-256-GCM at-rest encryption, key management, owner-scoped reads), `repos.ts` (typed data access, every query filtered by `user_id`), `services.ts` (create analysis/battle, validation of analyzability), `schemas.ts` (zod), `http.ts` (response helpers). `src/proxy.ts` redirects page requests without a session cookie to `/login`; the authoritative check happens in the pages and routes.

### `src/app`
Pages: `/` dashboard, `/battle/new`, `/battle/[id]`, `/analysis/[id]`, `/profiles`, `/profiles/[id]`, `/history`, `/settings`.
API: `/api/auth/{signup,login,logout,me,password,sessions,account}`, `/api/profiles[/id]`, `/api/analyses[/id]`, `/api/battles[/id]`, `/api/images/[id]`, `/api/stats`, `/api/settings`, `/api/data` (export / delete all), `/api/ratios` (reference database, public).

### `src/components`
`ui/*` design-system primitives · `layout/app-shell` navigation · `viz/landmark-canvas` the measurement overlay · `battle/*` setup flow, arena, summary, comparison · `analysis/analysis-center` · `profiles`, `history`, `settings`, `dashboard`.

## Analysis pipeline (per face)
1. `alignMesh` — rotate about the inter-pupillary midpoint so the pupil line is horizontal (roll normalisation).
2. `buildLandmarks` — semantic points with source/precision/confidence (model, derived, estimated, manual).
3. `assessQuality` — pose (matrix → Euler), expression, pixel metrics → levels, issues, `analyzable`.
4. `evaluateRatios` — for each of the 42 definitions: incomplete ⇒ unavailable; missing landmarks ⇒ unavailable (reason); otherwise value, confidence, tier, index.
5. `computeSymmetry`, `computeCategories`, `harmonyIndex`, `proportionScore`, `structureScore`, `overallScore`, `computeCoverage`, `computeOriginalScoring`.
6. `estimateUncertainty` — N jittered re-runs ⇒ σ for scores and ratio values.
7. `buildFeatures`, `computeAdditional`, warnings.

## Design principles
* No invented data: undefined conventions ⇒ `incomplete` and unavailable; missing landmarks ⇒ unavailable with a reason; T2–T5 never fabricated.
* Every number is traceable: intermediates, landmarks, methodology and limitations are stored with the result and shown in the UI.
* Measurement quality is first-class: confidence, coverage, uncertainty and quality level propagate into categories, overall scores and battle verdicts.
* Privacy by default: local detection, opt-in encrypted image storage, one-click export and delete-all.
* Accounts isolate data: all repository functions take the user id and filter by it; images are only served to their owner.

## Two build targets
* **Server app** (`npm run build`): Next.js server with route handlers, better-sqlite3, accounts, encrypted photo files.
* **Browser edition** (`npm run build:static`, `docs/BROWSER_EDITION.md`): static export for GitHub Pages. `next.config.ts` limits routes to `*.static.tsx` files and resolves `*.static.ts` siblings first, which swaps the database (sql.js + IndexedDB), image storage, auth (one local user), HTTP helpers and the client transport. The unchanged route handlers run inside the page (`src/static/backend.ts`); record pages take the id as a query parameter (`src/lib/paths.ts`).

