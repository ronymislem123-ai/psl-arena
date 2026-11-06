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

On first start, open the app and create the first account (e-mail + password, min. 10 characters). Accounts are local to this installation and no e-mails are sent. Each account gets **8 one-time recovery codes** (shown once at sign-up, regenerable in Settings → Account); "Forgot password?" on the login page resets the password with e-mail + code. If all codes are lost, the server operator can set a new password with

```bash
npm run reset-password -- user@example.com
```

Optional **two-factor authentication** (Settings → Two-factor): scan the QR code with any TOTP app (Aegis, Google Authenticator, 1Password, …) and confirm with the current code. Sign-in then asks for the 6-digit code after the password; a recovery code works as a backup. Disabling needs the password and a code.

Data created before accounts existed is assigned to the first account. Set `PSL_ARENA_ALLOW_SIGNUP=false` to stop further sign-ups once your accounts exist.

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
| Accounts | Local e-mail/password accounts (scrypt-hashed), database-backed sessions in HttpOnly SameSite cookies (30 days), login rate limiting, same-origin check on mutating requests, per-account data isolation on every query, hashed one-time recovery codes for password reset plus an operator CLI fallback, optional TOTP two-factor authentication (RFC 6238, QR enrollment, encrypted secret, replay protection, recovery codes as backup factor). |
| Persistence | SQLite (`data/psl-arena.sqlite`): users, sessions, images, profiles, analysis sessions, landmarks, ratio measurements, category scores, battles, settings. Photos are stored only with consent, AES-256-GCM encrypted. |
| UI | Next.js 16 App Router, React 19, Tailwind 4, framer-motion; dark premium HUD design; EN/DE; reduced-motion support; responsive (desktop side-by-side, mobile stacked). |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Vitest unit tests (engine, scoring, battle, symmetry, database) on real landmark fixtures |
| `npm run test:e2e` | Playwright end-to-end (upload → analysis → battle → analysis center). Needs `npx playwright install chromium` once. |
| `npm run typecheck` / `npm run lint` | TypeScript / ESLint |
| `npm run prepare-assets` | Re-copy the WASM runtime and verify the model |
| `npm run reset-password -- <e-mail>` | Operator fallback: set a new (or generated temporary) password for an account and sign it out everywhere |

## Configuration

`.env.example` documents the variables: `PSL_ARENA_DATA_DIR` (default `./data`), `PSL_ARENA_IMAGE_KEY` (32-byte hex; generated on first run otherwise), `PSL_ARENA_ALLOW_SIGNUP` (default true; `false` locks sign-up after the first account), `NEXT_PUBLIC_APP_NAME` (branding; see also `src/config/brand.ts`).

Serve the app over HTTPS when it is reachable from other machines: the session cookie is marked `Secure` automatically on HTTPS requests.

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
