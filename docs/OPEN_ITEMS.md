# Open items and known limitations

## Measurement conventions that need the original visual template
* **Incomplete (never scored):** EBS (8), IAA (11), JFA (12), DEV IAA/JFA (13), NBR/ALA (27), EYS (42). The data structures are ready; once the template defines the construction, add the formula in `src/engine/ratios/formulas.ts` and flip the status in `database.ts`.
* **Reconstructed (scored, flagged, excludable):** OCD, ICD/N, JWHR, GS, M/C, FWHF. Alternatives are listed in `docs/RATIOS.md`.
* **T2–T5 boundaries** are not in the material. `tierBoundaries` can be filled per ratio once verified; the original 420-point percentage then becomes computable automatically.

## Landmark model limitations (2D frontal)
* Gonion, zygion and frontotemporale are soft-tissue stand-ins (low precision); frontal gonial angles are systematically larger than lateral ones.
* The mesh has no hairline, ears or neck: trichion is estimated by an image scan (adjustable/confirmable), neck points are manual, ear measurements are unavailable.
* Profile-only measurements (cervicomental angle, true gonial angle, chin projection, nasal dorsum) are reported as not measurable; a lateral-photo mode would be the next step.
* Occlusions (glasses, hair over brows, hands) are not detected automatically; the quality step relies on pose, expression and pixel statistics. Perspective distortion cannot be measured from one image — the user-declared capture distance only adjusts confidence.
* Eyebrow tilt follows the mesh brow contour; brows hidden by hair or heavily groomed reduce accuracy.

## Product / engineering
* **Accounts:** local e-mail/password login with per-account isolation exists. Still missing: e-mail verification, password reset, two-factor authentication, an admin role for managing accounts (sign-up can only be locked globally via `PSL_ARENA_ALLOW_SIGNUP`).
* **Server-side settings** exist (`/api/settings`) but the UI uses the device-local store; syncing is a small follow-up.
* **i18n:** navigation, setup flow, battle, analysis chrome and settings are translated (EN/DE); ratio names, methodology texts, feature summaries and some table headers remain English.
* **Compare different analyses of the same profile** is available as a history table + score trend; a side-by-side diff view of two analyses of one person is not built.
* **Performance:** hairline estimation samples pixels one at a time (fine for ≤1600 px images; could be vectorised). Uncertainty simulation runs 40 samples server-side per analysis (~100 ms).
* **GPU delegate:** CPU WASM is used by default (deterministic, works headless); GPU can be enabled in `landmarker.ts`.
* **Accessibility:** keyboard access for the SVG landmark picker is limited to the list view; colour contrast is tuned for dark mode only (no light theme).
* **Automated tests not covering:** manual neck-point placement through the UI, hairline dragging through the UI (covered at engine level), multi-face selection UI, settings persistence, export/delete-all and change-password through the UI (covered at API/unit level).
