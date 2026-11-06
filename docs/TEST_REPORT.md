# Test report

Environment: Node 22.23, Chromium (Playwright 1.63 headless), Next.js 16.4 (Turbopack), MediaPipe Face Landmarker float16 model (CPU/WASM delegate). Date: 2025-11-06.

## 1. Automated — tested

### Unit tests (`npm test`, Vitest) — 43 passed, 1 diagnostic skipped
| Suite | What is verified |
| --- | --- |
| `geometry.test.ts` | distances, tilt sign convention (lateral-higher ⇒ positive on both sides), rotation, angle at vertex, line fit/intersection, polyline crossing, deterministic PRNG |
| `database.test.ts` | exactly 42 ratios numbered 1–42, 7 additional measurements, incomplete/reconstructed status lists match the brief, `tierBoundaries` null everywhere (no invented T2–T5), T1 ranges spot-checked, tolerance rule, every ratio has a formula and incomplete ones return null |
| `tiers.test.ts` | +10 inside T1, undetermined tier outside, one-sided ranges, verified-boundary path (T2–T5 only when boundaries are supplied), harmony-index halving |
| `engine.test.ts` (real landmark fixtures of four frontal portraits + one turned head + one rotated image) | 35/42 evaluable with hairline, 6 incomplete, original percentage not computable, plausible anthropometric ranges (ESR, BIG, N/H, EME, GS), symmetry present, uncertainty σ > 0, 40+ feature observations, 7 additional measurements; determinism; smile detection lowers mouth-ratio confidence; yaw 32° ⇒ not analyzable; 87° roll normalised (pupils level); hairline-dependent ratios unavailable without trichion (29 evaluable); NW only with manual neck points; reconstructed ratios excluded by config (6 excluded, uncertainty off); incomplete ratios always unmeasured |
| `battle.test.ts` | identical inputs ⇒ draw with zero diff and no key differences; 9 rounds with consistent verdict/scores; unusable image ⇒ inconclusive; low coverage ⇒ inconclusive |
| `symmetry.test.ts` | mirrored face ⇒ 100; mouth/jaw asymmetry penalised; yaw lowers confidence |
| `i18n.test.ts` | every ratio/category/additional measurement/landmark has German texts; every engine message (tier, unavailability, quality issue, metric, feature summary, symmetry label, additional note, warning, battle verdict/summary) carries a code and renders in German without falling back to English |
| `totp.test.ts` (isolated temp database) | base32 round-trip, RFC 6238 appendix-B vectors, ±1-step window, replay rejection, otpauth URI; enrollment (password re-auth, encrypted pending secret, wrong first code rejected), challenge flow (bad token, wrong code, single use), recovery code as second factor, per-challenge attempt budget, challenge expiry, disabling needs password + unused code |
| `recovery.test.ts` (isolated temp database) | 8 unambiguous codes stored only as hashes; reset with a code in any formatting changes the password once, signs every session out and decrements the count; wrong/used codes and unknown e-mails fail with a generic error; regeneration needs the password and invalidates the old set; code guessing is rate-limited; the operator CLI script writes hashes the app verifies |
| `auth.test.ts` (isolated temp database) | v1→v2 schema migration in place, scrypt hashing with random salts, password policy, e-mail normalisation, legacy-data adoption on first sign-up, duplicate/incorrect credentials, cross-account isolation of profiles, session create/find/expire/destroy with hashed storage, password change signing other devices out, per-client rate limiting, account deletion cascade, cross-site mutation rejection |

### End-to-end (`npm run test:e2e`, Playwright) — 9 passed
| Test | Steps verified |
| --- | --- |
| unauthenticated access is blocked | API returns 401, image route returns 401, pages redirect to `/login?next=…` |
| sign-up, password reset & two-factor | creates an account through the UI, shows 8 recovery codes once, lands on the dashboard, sees no foreign data, signs out; "Forgot password?" resets with a captured code (old password rejected, new accepted, used code rejected); Settings regenerates codes after re-entering the password; enables TOTP from the manual key, signs out, password alone yields no session, wrong code rejected, correct code signs in, disabling needs password + code |
| dashboard renders | page loads, brand heading (signed in) |
| full battle flow | upload two portraits through the real UI → in-browser detection → quality tiles and smile warnings → labels → hairline confirmation → opt-in encrypted photo storage → consent → start button enabled → analyses + battle persisted → arena shows stored images via `/api/images` → summary tab (9 rounds) → comparison tab (42 ratio rows) → analysis center (42 rows, ratio detail dialog, landmark layer with SVG points, symmetry, quality tabs) → history and profiles pages; no page errors |
| rejects a turned head | 32° yaw image ⇒ "Unusable", explicit error message, start button disabled, no preview score shown |
| API | `/api/ratios` returns 42 + 7 without login, `/api/stats` ok when signed in, malformed analysis body ⇒ 400, a second account gets 404 for the first account's analysis and an empty list |
| mobile layout & installability | 390 px viewport renders setup page and dashboard; manifest (standalone, 192/512/maskable icons all served), service worker served uncached, manifest link, `viewport-fit=cover`, camera-friendly `accept="image/*"` |
| battle without stored photos | second battle with storage off: arena renders the session copies (data URLs), no `/api/images` requests, server image count unchanged |
| landmark layers & locale | nose / symmetry / jaw / thirds layers draw measurement lines on the stored photo; an analysis without a stored photo shows the landmark wireframe fallback; switching the language to German relabels the navigation, the ratio table, the ratio detail dialog, the feature overview and the quality tab |

### Static checks
`npm run typecheck` (strict TS) — clean · `npm run lint` — clean · `npm run build` (Turbopack production build) — succeeds.

### Engine validation on real detections
Landmark index choices (canthi, alar base, chin corners, zygion, gonion construction) were checked on zoomed, labelled crops of real detections; EME was corrected to the mouth-vertex definition after the first plausibility run (pupil-vertex values were ≈64°, mouth-vertex 48–52°). Eye-area ratios moved into anthropometrically plausible ranges after switching the canthi to the lid-junction ring (ICD 0.93–1.02 on four faces).

## 2. Partially tested
* **Hairline estimation**: validated on four portraits (estimates at 65–74 % confidence placed on the hairline/upper forehead); not validated on bald heads, hats, strong bangs or very dark/very light hair-skin combinations (the manual override covers these).
* **Multiple faces**: engine/API paths covered; the face-picker UI was only exercised manually with single-face images.
* **Neck points & hairline dragging**: engine behaviour unit-tested; the pointer interaction was checked manually, not in the automated suite.
* **German locale**: dictionary type-checked against the English keys; navigation, ratio table, detail dialog, features and quality tab are covered by e2e; arena and battle summary wording in German was spot-checked manually.
* **Battle verdict "winner"**: the fixture pair resolves to a draw within uncertainty (3.6 points vs ±7.2 margin); the winner path is covered by unit tests on synthetic differences, not by the e2e pair.

* **PWA in production**: service-worker registration, page control and runtime caching of built assets/icons were verified in a mobile Chromium context against `next start`; "Add to Home Screen" on real Android/iOS devices was not exercised.

## 3. Not tested
* The Docker image (`Dockerfile`, `docker-compose.yml`) was written but not built in this session (no Docker daemon available here).
* Load/performance with many stored analyses (hundreds+) and very large images (> 8 MB request limit is enforced, not benchmarked).
* GPU delegate path of MediaPipe (CPU is the default).
* Browsers other than Chromium (Safari/Firefox WASM SIMD behaviour); "Add to Home Screen" on a real phone and the service-worker offline path were verified manually against the production build in Chromium, not on devices.
* E-mail verification, e-mail-based reset links (no mail transport) and WebAuthn (not implemented). QR scanning itself is not automated (the e2e uses the manual key).
* Accessibility audit (screen reader, full keyboard operation of the SVG picker).

## 4. Known results on the fixtures (for reproducibility)
`DUMP=1 npx vitest run tests/unit/dump.test.ts` prints the 42-ratio table for the four frontal fixtures with values, T1 flags, index and confidence, plus category and overall scores.
