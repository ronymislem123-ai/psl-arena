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
| `battle_sessions` | head-to-head results (`result_json` = `BattleResult`), verdict, overall A/B, diff, margin | id, analysis_a_id, analysis_b_id, profile ids |
| `settings` | server-side key/value settings | (user_id, key) |

`schema_meta` stores the schema version; `getDb()` migrates a v1 database in place (adds the account columns and the sessions table).

History views are built from `analysis_sessions` and `battle_sessions` (ordered by `created_at`). Deleting a profile cascades to its analyses and battles and removes orphaned image files; deleting all data wipes every table and the encrypted image directory.

Files: `<PSL_ARENA_DATA_DIR>/psl-arena.sqlite` (WAL mode), `<PSL_ARENA_DATA_DIR>/images/<id>.bin` (AES-256-GCM: 12-byte IV ‖ 16-byte tag ‖ ciphertext), `<PSL_ARENA_DATA_DIR>/image.key` (mode 0600; or `PSL_ARENA_IMAGE_KEY`).
