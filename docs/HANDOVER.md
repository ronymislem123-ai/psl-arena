# Übergabe / Handover — PSL ARENA (Stand 2026-11-08, Modul „Automatische Analyse“)

Dieses Dokument ist die vollständige Übergabe an das nächste Modul (neue Sitzung).
Es ist **kein Neustart**: alles hier Genannte ist umgesetzt, getestet, committet und
auf GitHub Pages deployed. Weiterarbeiten heißt: an Abschnitt 6 („Nächster Auftrag“)
ansetzen, nichts Erledigtes wiederholen.

## 1. Projekt in einem Absatz

Next.js-16-App (App Router, React 19, TypeScript strict, Tailwind 4, zustand, zod 4)
zur geometrischen Gesichtsanalyse: MediaPipe Face Landmarker (478 Punkte inkl. z,
läuft im Browser, Modell `public/models/face_landmarker.task`, WASM in
`public/mediapipe/wasm/` per postinstall), Engine 2.0 / Rubrik 2.0 (`src/engine`),
Battles, AI PSL Rater, Scale Builder, Turniere, Vergleich, Seitenansicht (manuelle
Profil-Landmarks). Zwei Ausgaben aus einem Code: **Server-Edition** (`npm run build`,
`npm start`, SQLite via better-sqlite3, Konten/2FA) und **Browser-Edition**
(`npm run build:static -- --base /psl-arena`, sql.js + IndexedDB, keine Konten,
GitHub Pages: https://ronymislem123-ai.github.io/psl-arena/, Workflow
`.github/workflows/pages.yml` deployt jeden Push auf `main`).

## 2. Stand der Arbeit (alles erledigt)

| Bereich | Stand | Doku |
| --- | --- | --- |
| Audit des alten Systems (16 gemessene Defekte) | erledigt | `docs/SYSTEM_AUDIT.md` |
| Engine 2.0: 3D-Pose-Normalisierung, Roll in jedem Winkel, Aufnahmeklassifikation (EXIF, Irisabstand), Streuungseinheiten, erwartungstreuer Index, korreliertes empirisches Rauschmodell, Symmetrie-Rauschkorrektur | erledigt | `docs/SCORING.md`, `docs/MODEL_VALIDATION.md` |
| Rubrik 2.0: 7 Kategorien, 40 Kriterien, eindeutige Zuordnung, Potenzmittel p=0,5, lineare Kalibrierung (PSL = Index/10), MC-σ bis zum PSL, 5 Maße „angezeigt, nicht bewertet“ | erledigt | `docs/RUBRIC.md` |
| Manuelle Landmark-/Achsenkorrektur, Analysezuverlässigkeit (5 Stufen), Erkennungsqualität je Messung | erledigt | `docs/REENGINEERING_REPORT.md` |
| Idealbeispiel (Regelkreis Render → MediaPipe → Messung), nicht fotorealistisch | erledigt | `docs/MODEL_VALIDATION.md` |
| Validierung alt/neu (222 Fälle), Eigenschaftstests | erledigt | `docs/MODEL_VALIDATION.md`, `docs/research/model-validation.json` |
| Deutscher Abschlussbericht A–L + Akzeptanzkriterien | erledigt | `docs/REENGINEERING_REPORT.md` |
| Absturz der Battle-Seite: **Ursache Browser-Seitenübersetzung** (React „removeChild“), behoben mit `translate="no"`, Deutsch als Standard für deutsche Browser, `src/lib/dom-guard.ts` | erledigt, deployed | `docs/OPEN_ITEMS.md`, `docs/TEST_REPORT.md` |
| Crash-sicheres Battle/Rater-Setup (sessionStorage), serielle Bildvorbereitung, Fehlergrenze `src/app/error.tsx` | erledigt | `docs/PRIVACY.md` |
| **Modul Automatische Analyse (2026-11-08):** Seitenansicht 2.0 vollautomatisch (Segmentierung → Profilkontur → Punkte, Teilpunktmengen, MPA/MFP/CHP), Rubrik 2.1 (MRD1 + Sklera-Show gemessen, 42 Kriterien), echter Vision-Provider (Claude-API, Einwilligung pro Bewertung, Browser-Edition mit eigenem Schlüssel), Rater mit Front- + Profilfoto | erledigt | `docs/SIDE_VIEW.md`, `docs/RUBRIC.md`, `docs/PRIVACY.md`, Abschnitt 7 |

Teststand (alle grün, 2026-11-08): **246 Unit-Tests** (+1 diagnostischer Skip;
`npx vitest run`), **18 Server-E2E** (`npx playwright test`), **3 Browser-Edition-E2E**
(`npx playwright test -c playwright.static.config.ts` nach `npm run build:static -- --base /psl-arena`),
Typprüfung und Lint sauber, Pages-Deploy für d46f0e5 erfolgreich.

Bekannte, dokumentierte Rückschritte/Grenzen (nicht neu angehen ohne Auftrag):
Test-Retest-Rauschen des PSL höher als in Engine 1.x (0,21 statt 0,05), keine
Validierung gegen menschliche Urteile, Rauschmodell aus zwei Gesichtern,
Idealbeispiel-Restfehler ≈ 4 % IPD (`docs/OPEN_ITEMS.md`).

## 3. Wichtige Entscheidungen (bitte beibehalten)

- Keine Attraktivitätswerte namentlich bekannter realer Personen veröffentlichen; Fixtures in Berichten nur „Porträt A/B“.
- Keine Altersschätzung, keine sensiblen Merkmale (Ethnie, Gesundheit …); Erwachsenen-/Einwilligungsbestätigung bleibt Pflicht.
- Nichts erfinden: nicht messbare Kriterien = „nicht beurteilbar“ mit Grund; Werte nach Grundlage kennzeichnen (gemessen / abgeleitet / geschätzt).
- Fotos verlassen das Gerät nur bei ausdrücklichem Opt-in (Server-Edition: verschlüsselt gespeichert; Browser-Edition: nur lokal).
- Commits mit Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` und `Claude-Session: …`; keine Modellnamen in Repo-Dateien außerhalb des Trailers. Push: `git push -u origin main` (Pages deployt automatisch).

## 4. Technische Hinweise / Fallstricke

- **Statischer Build und `.static.tsx`**: im statischen Build löst `./x` zuerst `./x.static.tsx` auf. Eine `x.static.tsx`, die `./x` importiert, importiert sich selbst → Turbopack hängt endlos ohne CPU-Last. Gemeinsamen Code in `src/components/...` legen (siehe `src/app/error*.tsx`).
- Static-Build und `next start` nicht parallel auf demselben `.next`; nach dem statischen Build Server neu bauen (`rm -rf .next && npm run build`).
- Vorschau: `bash <scratchpad>/serve.sh` (startet `next start -p 3000`), danach Port 3000 melden. Statische Ausgabe lokal: `node scripts/serve-static.mjs --base /psl-arena --port 3301`.
- github.io ist aus der Sandbox gesperrt (Proxy 403); Live-Seite nur über den Deploy-Status (`gh run list --repo ronymislem123-ai/psl-arena`) prüfbar.
- E2E-Konten hängen an `Date.now()` pro Worker: nach einem Fehlschlag laufen Folgetests in einem leeren Konto (Folgefehler, nicht echte Fehler).
- Forschungsläufe: `npm run research -- ideal|validation`; Engine-1.x-Vergleich: `scripts/research/engine1-runner.test.ts`.
- Visuelles Modell: `src/lib/visual-model/claude.ts` (SDK, `beta.messages.parse`, zod-Schema, `fallbacks: "default"`; Schlüssel/Endpunkt explizit, sonst übernimmt das SDK `ANTHROPIC_AUTH_TOKEN`/`ANTHROPIC_BASE_URL` aus der Umgebung). Konfiguration `src/server/vision-config.ts` (Server: `PSL_ARENA_VISION_PROVIDER=claude`, `ANTHROPIC_API_KEY`, opt. `PSL_ARENA_VISION_MODEL`) bzw. `vision-config.static.ts` (Browser: localStorage `psl-arena.visionModel`). Einwilligung `visualConsent` + `visualImageDataUrl` in `createRating`. 4 Kriterien `method: "visual"`: eyeShape, cheekboneProjection, jawlineDefinition, lipShape.
- **zod 4:** `z.record(z.enum(...), …)` ist erschöpfend (alle Schlüssel Pflicht) → für Teilmengen `z.partialRecord` verwenden.
- Seitenansicht: `src/engine/side-view.ts` (Version 2.0: 16 Landmarks, 19 Messungen, Pflicht nur `SIDE_CORE_POINTS`), automatische Erkennung `src/engine/side-auto.ts` (rein, testbar) + `src/lib/vision/profile.ts` (Segmentierer `public/models/selfie_multiclass_256x256.tflite`, 16 MB, Apache-2.0), UI `src/components/side/side-placer.tsx` (Erkennung beim Hochladen, Korrektur optional).
- Testmaterial Profil: `tests/e2e/fixtures/profile-scan*.jpg` (3D-Scan-Renderings, CC BY 3.0), Segmentierungs-Fixtures `tests/fixtures/side-seg-*.json`, Synthetik-Maske `tests/fixtures/profile-synthetic-mask.json`.

## 5. Live-Entwicklungsboard

Bestehendes Board: https://claude.ai/artifact/CWpQSQkkrQbiAeGMvWQDEa — dort wurde für
diese Phase eine neue Sitzung „Modul: Automatische Analyse (visueller Provider &
Seitenansicht)“ angelegt. Regeln: nach jedem Arbeitsschritt, jeder Entscheidung,
Codeänderung, jedem Test, Problem und Fix aktualisieren; nach jedem sichtbaren
Zwischenstand Screenshot als Asset hinterlegen; nichts als veröffentlicht melden,
was nicht tatsächlich geschrieben wurde.

## 6. Nächster Auftrag (Start des neuen Moduls)

Vom Nutzer (2026-11-08, sinngemäß, vollständig):

1. **„Hierfür wird ein visueller Bewertungs-Provider benötigt (keiner konfiguriert)“** erscheint in vielen Bereichen. Ursache finden und beheben: die Funktionen müssen tatsächlich funktionieren — keine geänderte Meldung, keine simulierte Analyse. Einen geeigneten Provider implementieren oder einen tatsächlich verfügbaren integrieren.
2. **Seitenansicht automatisch**: kein manuelles Eintragen/Setzen mehr als Voraussetzung. Bild hochladen → Qualitätsprüfung → Landmarks → Messwerte (u. a. Facial Convexity, Nasolabial-, Gonial-, Mandibular-Plane-Winkel, Kinn- und Mittelgesichtsprojektion, Profil, Kinn-/Kieferposition) → Zuordnung → Scores → Erklärung → Darstellung. Manuelle Korrektur bleibt optional.
3. **Frontansicht** ebenso vollständig automatisch (Symmetrie, Proportionen, Knochenstruktur, Kiefer, Kinn, Mittelgesicht, Wangenknochen, Augen, Nase, Stirn …).
4. Technische Gesamtprüfung (KI-Anbindung, Provider-Konfiguration, Landmarken, Bildverarbeitung, Geometrie, Bewertung, Datenbank, Zuordnung, Frontend/Backend, Fehlerbehandlung), dann Tests (Front, Seite, Landmarken, Werte, Übernahme, Scores, Erklärungen, unterschiedliche/schlechte Bilder, Speicherung, Plausibilität, Reproduzierbarkeit). Gemessen / Näherung / nicht bestimmbar unterscheiden; nichts erfinden.
5. Alles im Live-Board dokumentieren (Aufgaben, Protokoll, Screenshots, Status).

Ausgangsanalyse (zu verifizieren, keine getroffene Entscheidung):
- Die 6 visuellen Kriterien sind ohne Provider „nicht beurteilbar“. Mehrere lassen sich geometrisch aus vorhandenen Daten messen (Sklera unter der Iris aus Iris-Ring 468–477 und unterem Lidrand; Lidspalten-/Augenform aus der Augenkontur; Lippenform aus den Lippenkonturen; Wangenknochen-/Kieferprojektion teils aus MediaPipe-z) — diese als gemessen/abgeleitet kennzeichnen. Für echte visuelle Urteile kommt ein Vision-LLM-Provider in Frage (z. B. Claude-API; Browser-Edition nur mit nutzereigenem API-Schlüssel und ausdrücklicher Einwilligung zum Senden des Fotos; Server-Edition per Umgebungsvariable); Ergebnisse dann als „visuelles Modell“ kennzeichnen. Vor API-Code den Skill `claude-api` laden.
- Seitenansicht automatisch: MediaPipe Face Landmarker erkennt Gesichter nur bis etwa 60–70° Gieren; für echte Profile wahrscheinlich eine Profilkontur nötig (Segmentierung Person/Hintergrund, z. B. MediaPipe Image Segmenter, oder Kantenanalyse) mit Landmarks als Krümmungs-/Extrempunkte (Glabella, Nasion, Pronasale, Subnasale, Labrale, Pogonion, Menton, Hals-Kinn-Punkt); Tragion/Gonion/Orbitale liegen nicht auf der Kontur → schätzen und kennzeichnen oder als nicht bestimmbar ausweisen. Modell-Downloads können an der Netzwerkfreigabe scheitern (dann über `read_documentation`/Umgebungs-Tools klären).

## 7. Modul „Automatische Analyse“ (2026-11-08) — Ergebnis

Auftrag A–F aus Abschnitt 6 umgesetzt:

- **Ursache „visueller Bewertungs-Provider benötigt“:** `getVisualProvider()` gab fest `null` zurück, 6 Kriterien hatten keinen anderen Messweg. Behoben: (1) Oberlidposition (MRD1) und Sklera-Show werden jetzt aus Iris-Ring und Lidkontur gemessen (mm über Irisdurchmesser 11,7 mm); (2) die 4 echten visuellen Eindrücke laufen über einen echten Provider (Claude-API), nur nach Einwilligung pro Bewertung, mit Status je Kriterium. Kein Live-Aufruf in der Entwicklungsumgebung möglich (kein API-Schlüssel) – Vertrag mit gemocktem HTTP getestet.
- **Seitenansicht vollautomatisch:** Upload → Qualitätsprüfung (Frontalgesicht wird abgelehnt) → Segmentierung (2 Durchgänge) → Profilkontur → 13–14 Punkte automatisch; Nasenflügelfurche, Tragion, Orbitale und meist das Gonion liegen nicht auf der Silhouette und werden nicht geraten (abhängige Maße „nicht bestimmbar“). Neue Maße MPA, MFP, CHP.
- **Frontansicht:** war bereits vollautomatisch (Haaransatz geschätzt); Lücken MRD1/Sklera-Show geschlossen.
- **Gesamtablauf:** Rater nimmt Front- und Profilfoto in einem Schritt; beide Editionen.
- **Gefundene und behobene Fehler:** zod-4-Records (Provider-Antworten und Punktquellen wären abgelehnt worden), Umgebungs-Token im SDK, irreführende „angeschnitten“-Warnung durch den eigenen Zuschnitt.

Offene Punkte: Validierung der automatischen Profilpunkte an echten, expertenannotierten Profilfotos; Live-Test des visuellen Modells mit einem echten Schlüssel; Gonion/Tragion-Erkennung (z. B. Ohr-Detektor).

## 8. Kostenlose Alternativen zum visuellen Modell (2026-11-08)

- **Selbsteinschätzung** (Rater-Karte „Selbsteinschätzung (optional)“, 4 Schieberegler 0–10, einzeln weglassbar): `selfAssessment` in `createRating` → `rateFace`; Quelle `self-assessment`, Warnung `selfAssessment`, halbe Konfidenz/Zuverlässigkeit (`SELF_ASSESSMENT_WEIGHTING`), Modell hat Vorrang, Abdeckung unverändert. Die Warnung „kein visuelles Modell“ entfällt, sobald alle vier selbst eingeschätzt sind.
- **Messwerte aus dem Foto** (`src/engine/appearance.ts`): Oberlid-Anteil, Oberlid-Scheitel, Amorbogen-Tiefe, Lippenrot-Fülle (Mesh); Kieferkanten-Kontrast, Jochbein-Licht/Schatten (Pixel, im Browser gemessen, nur Zahlen gesendet). Angezeigt je Kriterium und im Detaildialog, **nicht bewertet** (keine Referenzbereiche). Siehe `docs/RUBRIC.md` → „Free alternatives“.
- Tests: `tests/unit/appearance.test.ts` (synthetische Bilder: scharfe vs. weiche Kante, beleuchtete vs. flache Wangen; Gewichtung, Vorrang, Schema), E2E „rater: self-assessment …“ in `tests/e2e/psl.spec.ts`.
- Offen: Die Bildmaße sind nicht gegen Expertenurteile validiert; Zielbereiche bewusst nicht vergeben.
