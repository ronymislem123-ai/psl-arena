# Browser edition (GitHub Pages)

PSL ARENA can be published as a **static website** — for example on GitHub Pages at
`https://<user>.github.io/psl-arena/` — in addition to the server app. The browser
edition has the same modules (AI PSL Rater, Scale Builder, tournaments, battles, side
view, comparison, leaderboards, history, profiles) and the same rating engine, but
**no server**: every calculation and every saved record stays in the visitor's browser.

## How it works

| Part | Server app (`npm run build`) | Browser edition (`npm run build:static`) |
| --- | --- | --- |
| Hosting | Node.js server (`next start`, Docker) | any static host; GitHub Pages via `.github/workflows/pages.yml` |
| Accounts | e-mail/password, sessions, recovery codes, TOTP | none — one local user per browser |
| Database | SQLite file via better-sqlite3 (`data/psl-arena.sqlite`) | the same SQLite schema via sql.js (WebAssembly) in memory, saved to IndexedDB after every change |
| Photos (only on opt-in) | AES-256-GCM files with a server key | BLOBs inside the local database; never uploaded; no separate encryption key (a key stored next to the data in the same browser profile would not protect it) |
| API | Next.js route handlers over HTTP | the **same route handler modules** called inside the page (`src/static/backend.ts`) |
| Record pages | `/rater/<id>`, `/tournaments/<id>` … | `/rater/view/?id=<id>`, `/tournaments/view/?id=<id>` … (static hosting cannot pre-render unknown ids) |
| Offline | ML assets cached | the whole app (pages, code, SQLite runtime) is precached by the service worker; the face model and MediaPipe runtime are cached on first use |
| Moving data | — (server holds it) | backup file download / restore in Settings |
| Quality control (engine 3.1) | detection passes in the browser, checks re-run on the server | detection passes and all checks in the browser (`docs/QUALITY_CONTROL.md`) |

**One codebase, two targets.** `next.config.ts` switches on `PSL_STATIC=1`:

* `output: "export"`, `trailingSlash`, `basePath` from `--base` (GitHub Pages project sites live under `/<repo>`).
* `pageExtensions: ["static.tsx", "static.ts"]` — only `page.static.tsx` / `layout.static.tsx` / `not-found.static.tsx` are routes. The server pages, the API routes and `proxy.ts` are not part of the export.
* `turbopack.resolveExtensions` starts with `.static.ts(x)` — every module with a `*.static.ts` sibling is replaced in this build:
  * `src/server/db.static.ts` — the sql.js connection (schema and migrations are shared in `src/server/db-schema.ts`),
  * `src/server/images.static.ts` — photos as BLOBs, object URLs for display,
  * `src/server/auth.static.ts` — the local user, no sessions,
  * `src/server/http.static.ts` — the HTTP helpers on plain Fetch API objects,
  * `src/lib/transport.static.ts` — `api.*` calls go to the in-page backend instead of `fetch`,
  * `src/components/settings/browser-data.static.tsx` — storage status, backup and restore.

Everything else — zod request schemas, services, repositories, the analysis and rating
engines, the tournament engine, all UI components — is the same code the server runs.

**sql.js adapter.** `src/static/sqljs-adapter.ts` implements the subset of the
better-sqlite3 API the repositories use (`prepare().get/all/run`, `exec`, `pragma`,
nested `transaction` via savepoints) with an LRU cache of compiled statements. sql.js
frees all statements and resets pragmas when it serialises the database, so the adapter
drops its cache and re-enables foreign keys after every export.

**Saving and several tabs.** `src/static/runtime.ts` loads the database once per page.
Every mutating request runs under a Web Lock (serialised across tabs); before it, the
tab reloads the database if another tab saved a newer revision; after it, the database
is written to IndexedDB in one transaction and the new revision is broadcast so other
tabs reload. Pages re-read their data whenever the revision changes (this replaces
`router.refresh()` of the server app). If the browser offers no IndexedDB (some private
windows) the app works in memory and Settings warns that nothing survives the tab.

## Privacy

* No account, no server-side storage, no upload: photos, landmarks, ratings, scales and
  tournaments exist only in the browser's site storage on this device.
* The static host (GitHub) serves the files and sees the usual request metadata of page
  loads (IP address, user agent); it never receives analysis data or photos.
* Clearing the browser's site data deletes everything. Browsers may also evict site data
  under storage pressure; Settings can ask for persistent storage. **Safari (iOS/macOS)
  deletes script-written storage of websites that were not used for seven days unless
  the app was added to the Home Screen** — on iPhone install it via Share → "Add to
  Home Screen" and keep backups.
* The backup is a single SQLite file containing everything including kept photos; treat
  it as private. Restoring accepts only backups of the browser edition.
* The site is public: anyone with the link can use the app, but everyone only ever sees
  the data in their own browser. Consent and adult confirmations apply as in the server
  app; no age estimation, identification or sensitive-attribute inference happens.

## Publishing on GitHub Pages

1. Push to `main` — the workflow `.github/workflows/pages.yml` runs the unit tests,
   builds the browser edition with the repository's Pages base path and deploys it.
2. **Once:** repository **Settings → Pages → Build and deployment → Source: "GitHub
   Actions"**. Until this is set, the deploy step fails; afterwards re-run the workflow
   (Actions → "Deploy browser edition to GitHub Pages" → Run workflow).
3. GitHub Pages for **private** repositories needs a paid plan (Pro, Team or
   Enterprise); on GitHub Free the repository has to be public. Either way the published
   site itself is public.

## Local commands

```bash
npm run build:static -- --base /psl-arena
```

```bash
npm run serve:static -- --base /psl-arena
```

The second command serves `out/` like GitHub Pages at `http://localhost:3300/psl-arena/`.
Next.js also writes its build cache to `.next`, so run `npm run build` again before
`npm start` of the server app.

## Tests

* `tests/static/browser-edition.test.ts` (Vitest project `browser-edition`, resolves
  modules like the static build): the sql.js adapter against better-sqlite3 semantics
  (missing rows, change counts, nested transactions with rollback, BLOBs, export keeps
  data and foreign keys, statement cache overflow, bind type errors), the real route
  handlers running against sql.js (validation 400/404/405/422, built-in scale and rubric,
  analysis with stored photo → BLOB, image route, rating and download headers, tournament
  to completion, reopen with version, leaderboards, profile deletion cascading to the
  BLOB, delete-all keeps the local user) and backup round trip / rejection of foreign files.
* `tests/e2e-static/browser-edition.spec.ts` (`npx playwright test -c
  playwright.static.config.ts` after `npm run build:static -- --base /psl-arena`): the
  export served like GitHub Pages under `/psl-arena/`; rating with a stored photo shown
  from an object URL, reload persistence, a second rating, history selection → compare,
  JSON export as a generated download, tournament from the two profiles, a second tab
  seeing the same data, backup download → delete all → restore → photo back, rejection
  of a non-backup file, unknown id and unknown path (404 page); on a phone (Pixel 7):
  German texts, service-worker control, offline reload and offline navigation to pages
  never visited before.

## Limitations

* No synchronisation between devices; data moves only via backup files.
* Photos in the browser are not encrypted with a separate key (see above).
* The first face analysis needs a connection to download the model and runtime (~30 MB);
  afterwards analyses work offline.
* Battles, ratings and tournaments created in the server app cannot be imported into the
  browser edition (different storage of photos and accounts), and vice versa.

## Vision model (2026-11-08); side view removed (2026-11-09)

- The automatic side view and its segmenter model were removed in rubric/engine 3.0 (front profile only); side-view records in a restored older backup stay in the database.
- The vision model for the four visual criteria is off by default. A user can enter their **own** Anthropic API key under Settings → Vision model; it is kept only in this browser's localStorage, never in the database or backups, and used only when the user ticks the consent box while rating. The page then calls `https://api.anthropic.com` directly (SDK with `dangerouslyAllowBrowser`); costs go to the user's own account. "Check key" uses the free model-info endpoint.
