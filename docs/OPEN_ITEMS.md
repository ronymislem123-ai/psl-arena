# Open items and known limitations

## Measurement conventions that need the original visual template
* **Incomplete (never scored):** EBS (8), IAA (11), JFA (12), DEV IAA/JFA (13), NBR/ALA (27), EYS (42). The data structures are ready; once the template defines the construction, add the formula in `src/engine/ratios/formulas.ts` and flip the status in `database.ts`.
* **Reconstructed (scored, flagged, excludable):** OCD, GS, M/C, FWHF. JWHR and ICD/N are measured but no longer scored (engine 2.0: no test face reaches their ranges with this construction). Alternatives are listed in `docs/RATIOS.md`.
* **T2–T5 boundaries** are not in the material. `tierBoundaries` can be filled per ratio once verified; the original 420-point percentage then becomes computable automatically.

## Landmark model limitations (2D frontal)
* Gonion, zygion and frontotemporale are soft-tissue stand-ins (low precision); frontal gonial angles are systematically larger than lateral ones.
* The mesh has no hairline, ears or neck: trichion is estimated by an image scan (adjustable/confirmable), neck points are manual, ear measurements are unavailable.
* Profile-only measurements (cervicomental angle, gonial angle, chin projection, nasal dorsum) are reported as not measurable in the frontal analysis; they are covered by the side-view module (`docs/SIDE_VIEW.md`) from a separate lateral photo with manual landmarks.
* Occlusions (glasses, hair over brows, hands) are not detected automatically; the quality step relies on pose, expression and pixel statistics. Perspective distortion cannot be measured from one image — the user-declared capture distance only adjusts confidence.
* Eyebrow tilt follows the mesh brow contour; brows hidden by hair or heavily groomed reduce accuracy.

## Side-view module
* Since 2026-11-08 the midline points are detected automatically from the person silhouette (`docs/SIDE_VIEW.md`). Points off the silhouette (alar crease, tragion, orbitale; usually the gonion) are not detected — GA, GOODE, MPA and the Frankfort axis then need manually added points. Validated on a synthetic profile and a rendered 3D head scan, **not yet on a set of real profile photos with expert annotations**; a strongly tilted head (chin up) is rejected rather than measured. Beards, high collars and hair over the forehead change the silhouette and therefore the points.
* Engine 2.0: an anatomical reference axis (soft-tissue Frankfort horizontal through tragion and an optional orbitale point, or a manually rotated axis) replaces the image vertical when set; without it the image vertical is still used and flagged.
* The soft-tissue gonial angle uses the gonion–tragion line as the ramus proxy; it is not the cephalometric bony angle (the guide range 115–130° is applied as provided).
* No frontal↔side fusion: the profile harmony index is reported separately and is not part of battles.
* The mentolabial angle, dorsal profile and chin meridian are descriptive only (no sourced numeric target in the material).

## PSL modules (rater, scales, tournaments)
* **Visual criteria.** Rubric 2.1 measures upper lid position (MRD1) and scleral show geometrically. Eye shape, lip shape, cheekbone projection and jawline definition are assessed by a real vision model (Claude API) only when it is set up and the user consents per rating; the integration is tested against the SDK request/response contract with mocked HTTP, but **no live call was possible in the development environment (no API key)**. Model scores are impressions, vary with the model version and are not validated against human ratings.
* **Calibration and weights are conventions.** The index→PSL anchors and the criterion weights are documented and versioned but not fitted to human ratings; no consented reference dataset with independent human raters exists in this project, so no empirical accuracy, inter-rater agreement or bias statistics are claimed (`docs/VALIDATION.md`).
* **Minimum coverage** defaults to 70 % (brief suggestion: 80 %, reachable only with a profile view); configurable per rating.
* **Three-quarter view** is not supported (no engine for it); only frontal + profile are fused.
* **Potential rating** was not implemented (speculative by nature; the brief lists it as optional).
* **Sharing** of ratings/tournaments is intentionally absent (privacy default); exports are downloads for the owner.
* **Multi-image per view**: one frontal + one side view per rating; averaging several frontal photos of the same person is a follow-up.
* **Tournament ties**: knockout matches that stay tied after the three tie-breakers need a manual decision (recorded); there is no coin flip by design.
* **Bracket on phones** scrolls horizontally with zoom buttons; a dedicated round-by-round list view would be friendlier.
* **Awards and achievements** are derived from completed tournaments only; achievement thresholds are product conventions and not configurable yet.

## Product / engineering
* **Accounts:** local e-mail/password login with per-account isolation, recovery-code password reset and optional TOTP two-factor authentication exist. Still missing: e-mail verification, e-mail-based reset links (no mail transport), WebAuthn/passkeys, an admin role for managing accounts (sign-up can only be locked globally via `PSL_ARENA_ALLOW_SIGNUP`; operators use the CLI).
* **Server-side settings** exist (`/api/settings`) but the UI uses the device-local store; syncing is a small follow-up.
* **i18n:** the full UI including ratio names, formulas, methodology, limitations, categories, additional measurements, landmark labels and all engine-generated messages is available in EN and DE. Engine results store language-neutral codes; results saved before this change render their stored English messages in the German UI.
* **Comparison** of ratings, of raw frontal analyses (ratio level) and of tournament versions, plus a per-profile progress series and achievements exist (`docs/COMPARE.md`).
* **Mobile:** the app installs as a PWA and works in phone browsers; a native wrapper (Capacitor) or a store listing is not provided. Offline use covers the ML assets and the app shell; analyses still need the server for saving.
* **Performance:** hairline estimation samples pixels one at a time (fine for ≤1600 px images; could be vectorised). Uncertainty simulation runs 40 samples server-side per analysis (~100 ms).
* **GPU delegate:** CPU WASM is used by default (deterministic, works headless); GPU can be enabled in `landmarker.ts`.
* **Accessibility:** keyboard access for the SVG landmark picker is limited to the list view; colour contrast is tuned for dark mode only (no light theme).
* **Automated tests not covering:** manual neck-point placement through the UI, hairline dragging through the UI (covered at engine level), multi-face selection UI, settings persistence, export/delete-all and change-password through the UI (covered at API/unit level), side-view point dragging and arrow-key nudging through the UI, reference-image upload through the editor UI (covered at service level), group-stage tournaments through the UI (covered at service/engine level), the print/PDF output itself.
* **Browser edition (GitHub Pages):** no synchronisation between devices (backup files only); photos are not encrypted with a separate key in the browser; the first analysis needs a connection for the model (~30 MB); data from the server app cannot be imported into the browser edition and vice versa; Safari evicts website storage after seven days without use unless the app is installed to the Home Screen. Enabling GitHub Pages (and, on GitHub Free, making the repository public) is a manual step in the repository settings.


## Engine 2.0 / rubric 2.0 (2026-11 re-engineering)
* **Test–retest noise rose** (PSL SD 0.05 → 0.21 under nuisance changes) and single-feature changes are less separable from that noise (median 5.4 → 3.6 noise SDs) — `docs/MODEL_VALIDATION.md`. Candidate follow-ups: noise-aware measure weights (classical reliability s²/(s²+σ²) from repeated detections of more faces), multi-photo averaging per person.
* **Noise model from two faces only**; between-photo variation of the same person is not covered.
* **Ideal example is not photorealistic**; the re-detection residual stays ≈ 4 % IPD.
* **No population calibration**: PSL = index ÷ 10 is a conformity score, not a percentile.
* **Reference ranges** that every test face misses on the same side are excluded (JWHR, ET, DEV CT/ET, ICD/N); more faces could reveal further mismatches or re-admit them with corrected constructions.
* **Battle page "crash" (user report, 2026-11-08) — fixed.** Cause: browsers (Chrome, Edge) machine-translated the English UI into German, replacing text nodes behind React's back; the next update (photo added, box ticked) threw "Failed to execute 'removeChild' on 'Node'" and the page fell over (reproduced with a simulated translation). Fix: `<html translate="no" class="notranslate">` + `<meta name="google" content="notranslate">`, German UI by default for German browsers on the first visit, `<html lang>` kept in sync with the app language, and `lib/dom-guard.ts` so that a forced translation or a DOM-rewriting extension can no longer crash React. Regression test in `tests/e2e-static/browser-edition.spec.ts`. Earlier mitigations stay (serialised photo preparation, crash-safe setup, error boundary). Still open: decoding very large photos (24–48 MP) at reduced size directly.
