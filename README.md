# PSL ARENA

**AI facial-harmony analysis and head-to-head “mog battles” — measured, transparent, local-first.**

PSL ARENA detects 478 facial landmarks in the browser, measures the 42 core facial-harmony ratios (plus 7 additional measurements) from a community reference guide, scores them with the original T1 system and a documented, coverage-adjusted harmony index, propagates measurement uncertainty, and lets two profiles face off in a cinematic battle where a winner is only declared outside the uncertainty margin.

> Reference ranges come from a community guide and are **not** validated beauty standards. The app measures geometric proportions only; it never infers ethnicity, religion, health, sexual orientation or any other sensitive attribute, and is intended for consenting adults.

## Quick start

```bash
npm install          # also copies the MediaPipe WASM runtime into public/
npm run dev          # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

Requirements: Node ≥ 20.19 (tested on Node 22). SQLite is embedded (`better-sqlite3`, native binary installed by npm). No external services, no API keys.

The face model (`public/models/face_landmarker.task`, Apache-2.0, Google) is vendored so the app works fully offline. If it is missing, download it from
`https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`.

## What it does

| Area | Implementation |
| --- | --- |
| Face detection & landmarks | MediaPipe Face Landmarker (478 points, blendshapes, head-pose matrix) running in the browser via WASM. Images never leave the device unless the user opts in to store them. |
| Image check | Resolution, sharpness (Laplacian variance), brightness, contrast, yaw/pitch/roll, expression neutrality (blendshapes), parted lips, framing, multiple faces, hairline detection, selfie-perspective flag. Unusable images are blocked. |
| Semantic landmarks | 50+ anthropometric points (canthi, pupils, alar base, cheilia, stomion, nasion, glabella, menton, chin corners, constructed gonions, zygion stand-ins, frontotemporale, estimated/adjustable hairline, optional manual neck points) — each with source, precision and confidence. |
| 42 core ratios | Measured in a roll-normalised frame; each with T1 range, status (`defined` / `reconstructed` / `incomplete`), methodology, limitations and sensitivity flags. Incomplete definitions are never measured or scored. See `docs/RATIOS.md`. |
| Scoring | Original T1 system (+10 inside T1; T2–T5 undefined in the material, so never invented) **plus** the PSL ARENA harmony index (0–100, tolerance-based), category indices, proportion/structure/symmetry/overall scores, coverage and confidence. See `docs/SCORING.md`. |
| Uncertainty | Monte-Carlo landmark jitter (deterministic seed) → σ for every score and ratio. |
| Battle | 9 rounds (harmony, 7 categories, symmetry) + overall. Round and final decisions use a margin derived from both sides' uncertainty; low coverage/confidence ⇒ *inconclusive*; small differences ⇒ *draw*. |
| Visualisation | Interactive SVG overlay with 10 analysis layers (landmarks, eyes, brows, midface, nose, mouth, jaw, thirds, ratios, symmetry), full-mesh toggle, click-to-inspect landmarks, draggable hairline, neck-point placement. |
| Persistence | SQLite (`data/psl-arena.sqlite`): users, images, profiles, analysis sessions, landmarks, ratio measurements, category scores, battles, settings. Photos are stored only with consent, AES-256-GCM encrypted. |
| UI | Next.js 16 App Router, React 19, Tailwind 4, framer-motion; dark premium HUD design; EN/DE; reduced-motion support; responsive (desktop side-by-side, mobile stacked). |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest unit tests (engine, scoring, battle, symmetry, database) on real landmark fixtures |
| `npm run test:e2e` | Playwright end-to-end (upload → analysis → battle → analysis center). Needs `npx playwright install chromium` once. |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run prepare-assets` | Re-copy the WASM runtime and verify the model |

## Configuration

`.env.example` documents the variables: `PSL_ARENA_DATA_DIR` (default `./data`), `PSL_ARENA_IMAGE_KEY` (32-byte hex; generated on first run otherwise), `NEXT_PUBLIC_APP_NAME` (branding; see also `src/config/brand.ts`).

## Documentation

- `docs/ARCHITECTURE.md` — system architecture, pipeline, modules
- `docs/RATIOS.md` — the 42 ratios + 7 additional measurements, landmark mapping, statuses and conventions
- `docs/SCORING.md` — tiers, harmony index, weights, dependency handling, uncertainty, battle rules
- `docs/DATA_MODEL.md` — database schema
- `docs/PRIVACY.md` — data handling and ethics
- `docs/TEST_REPORT.md` — what was tested, partially tested, not tested
- `docs/OPEN_ITEMS.md` — known limitations and open work

## Project layout

```
src/engine/      pure TypeScript analysis engine (shared by browser & server)
src/lib/vision/  browser-only: MediaPipe loader, detection, quality metrics, hairline estimate
src/server/      SQLite, encrypted image store, repositories, services, request schemas
src/app/         Next.js routes (pages + /api)
src/components/  UI (design system, visualiser, battle arena, analysis center, …)
tests/unit       Vitest  ·  tests/e2e  Playwright  ·  tests/fixtures  real landmark fixtures
```
