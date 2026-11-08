# Übergabe / Handover — PSL ARENA (Stand 2026-11-08, Commit d46f0e5)

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
- Visueller Provider: `src/server/vision-provider.ts` (`VisualAssessmentProvider`, `visualAssessmentSchema`, `getVisualProvider()` gibt `null`); Aufruf in `src/server/services-psl.ts`; 6 visuelle Kriterien in `src/engine/psl/rubric.ts` (`method: "visual"`: upperLidExposure, scleralShow, eyeShape, cheekboneProjection, jawlineDefinition, lipShape).
- Seitenansicht: `src/engine/side-view.ts` (16 Landmarks, 16 Messungen, Referenzachse), UI `src/components/side/side-placer.tsx` (manuelles Setzen mit Lupe), Speicherung `createSideAnalysis` in `src/server/services.ts`.

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
