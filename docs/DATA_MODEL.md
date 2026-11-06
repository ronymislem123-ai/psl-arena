# Data model (SQLite)

Raw inputs, calculated values and interpreted scores are stored separately.

| Table | Purpose | Key columns |
| --- | --- | --- |
| `users` | accounts (e-mail unique, scrypt hash + salt, last login, encrypted TOTP secret / pending secret, enabled-at, last accepted step); a legacy `local` row from v1 is adopted by the first account | id, name, email, password_hash, password_salt, totp_* |
| `mfa_challenges` | pending second-factor sign-ins (10 min, attempt counter); id = SHA-256 of the challenge cookie | id, user_id, created_at, expires_at, attempts |
| `sessions` | login sessions; id = SHA-256 of the cookie token | id, user_id, created_at, expires_at, last_seen_at, user_agent |
| `recovery_codes` | one-time password-reset codes; id = SHA-256(user id : code) | id, user_id, created_at, used_at |
| `images` | encrypted photo files (opt-in) | id, mime, width, height, bytes, sha256, encrypted, path |
| `face_profiles` | one per analysed person | id, label, image_id, note, timestamps |
| `analysis_sessions` | one per analysis run | id, profile_id, image_id, engine_version, image size, `config_json`, `input_json` (raw mesh, blendshapes, matrix, quality metrics), `result_json` (full `AnalysisResult`), denormalised overall/harmony/proportion/symmetry/confidence/coverage/quality_level/analyzable |
| `landmarks` | semantic landmarks per analysis (raw + aligned coords, source, precision, confidence, mesh index) | (analysis_id, landmark_id) |
| `ratio_measurements` | calculated ratio values with availability, confidence, T1 flag, tier, points, index, deviation, σ | (analysis_id, ratio_id) |
| `category_scores` | category indices with coverage/confidence | (analysis_id, category_id) |
| `side_analyses` | one per side-view (profile) analysis | id, profile_id, image_id, engine_version, image size, facing, `points_json` (16 manual landmarks), `result_json` (full `SideViewResult`), score, score_sigma, scored_count, analyzable |
| `side_measurements` | per-measurement values of a side analysis (value, in-range flag, deviation, index, σ) | (analysis_id, measurement_id) |
| `psl_scales` | user-defined PSL scales (`tiers_json` holds the tiers with reference-image ids), version counter, template flag | id, name, range_min, range_max, tiers_json, version |
| `psl_ratings` | one per PSL rating: profile, frontal analysis, optional side analysis, scale id + `scale_snapshot_json`, rubric version, `result_json` (full `RatingResult`), denormalised score/tier/coverage/valid/provisional | id, profile_id, analysis_id, side_analysis_id, scale_id, psl_score, tier_id |
| `tournaments` | tournament header: format, status, `config_json` (categories, weights, tie rules), `scale_snapshot_json`, rubric version, `state_json` (bracket/groups), `results_json`, version | id, name, format, status, version |
| `tournament_participants` | participants with the rating snapshot used for the comparison (`rating_snapshot_json`), display name, seed, order; profile/rating links are set to null when those are deleted | id, tournament_id, profile_id, rating_id |
| `tournament_versions` | archived full records of a tournament before it was reopened | id, tournament_id, version, snapshot_json |
| `battle_sessions` | head-to-head results (`result_json` = `BattleResult`), verdict, overall A/B, diff, margin | id, analysis_a_id, analysis_b_id, profile ids |
| `settings` | server-side key/value settings | (user_id, key) |

`schema_meta` stores the schema version (6); `getDb()` migrates older databases in place (v1: account columns and the sessions table; v4: the side-view tables; v5: the PSL scale, rating and tournament tables).

History views are built from `analysis_sessions`, `side_analyses` and `battle_sessions` (ordered by `created_at`). Deleting a profile cascades to its analyses, side analyses, ratings and battles and removes orphaned image files (tier reference images and tournament participant images are checked too); deleting all data wipes every table and the encrypted image directory.

Files: `<PSL_ARENA_DATA_DIR>/psl-arena.sqlite` (WAL mode), `<PSL_ARENA_DATA_DIR>/images/<id>.bin` (AES-256-GCM: 12-byte IV ‖ 16-byte tag ‖ ciphertext), `<PSL_ARENA_DATA_DIR>/image.key` (mode 0600; or `PSL_ARENA_IMAGE_KEY`).
