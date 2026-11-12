# Übergabe / Handover — PSL ARENA (Stand 2026-11-12, Rubrik 3.0 „PSL Score – Front Profile“, Engine 3.1 mit mehrstufiger Qualitätskontrolle)

Dieses Dokument ist die vollständige Übergabe an das nächste Modul (neue Sitzung).
Es ist **kein Neustart**: alles hier Genannte ist umgesetzt, getestet, committet und
auf GitHub Pages deployed. Weiterarbeiten heißt: an Abschnitt 6 („Nächster Auftrag“)
ansetzen, nichts Erledigtes wiederholen.

## 1. Projekt in einem Absatz

Next.js-16-App (App Router, React 19, TypeScript strict, Tailwind 4, zustand, zod 4)
zur geometrischen Gesichtsanalyse: MediaPipe Face Landmarker (478 Punkte inkl. z,
läuft im Browser, Modell `public/models/face_landmarker.task`, WASM in
`public/mediapipe/wasm/` per postinstall), Engine 2.0 / Rubrik 2.0 (`src/engine`),
Battles, AI PSL Rater, Scale Builder, Turniere, Vergleich. Seit Rubrik/Engine 3.0
(2026-11-09) wird ausschließlich die Frontalansicht bewertet; die Seitenansicht ist
entfernt (Abschnitt 10). Zwei Ausgaben aus einem Code: **Server-Edition** (`npm run build`,
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
- Seitenansicht (bis 2.x): entfernt in 3.0. `src/engine/side-view.ts` enthält nur noch Definitionen/Typen zum Lesen gespeicherter Seitenansicht-Datensätze und alter Bewertungen; Repo-Funktionen `listSideAnalyses`/`getSideAnalysis` bleiben für Export und Löschen.
- Testmaterial Profil (Scan-Renderings, Segmentierungs-Fixtures) wurde mit der Seitenansicht entfernt.

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

## 9. Gesamtprüfung Bewertungen & Analysen (2026-11-09)

Drei unabhängige Prüfungen (Messlogik, Punktplatzierung auf Fotos, deutsche Oberfläche, Live-Version) und Behebung:

- **Haare vor der Stirn:** frontal wird ein geschätzter Haaransatz mit oberem Drittel < ≈ 23 % (Referenz 31 % − 3 SD) verworfen (`src/engine/hairline-check.ts`, Warnung `hairlineCovered`, Kriterien „Haaransatz von Haaren verdeckt“; Button „Verdeckt – nicht verwenden“); im Profil sind Haare (Segmentierungsklasse) nie Nasenspitze oder Glabella, die Glabella ist optional (`hairOverForehead`).
- **Geneigter Kopf im Profil:** Warnung `headTilted`, wenn die Glabella–Subnasale-Linie > 8° von ≈ 5° abweicht.
- **Engine 2.1.0 / Rubrik 2.2.0:** stetiger Zygion (Parabel statt Argmax), GS nur angezeigt (41 Kriterien), MC-Stichproben zentriert, Mimik begrenzt die Zuverlässigkeit, Sklera-Show keine „Stärke“, Idealgesicht neu berechnet.
- **Rater:** Ein während der Wiederherstellung gewähltes Foto wurde überschrieben (Generationszähler in `battle-store.ts`).
- **Oberfläche:** Frontal-Index statt „PSL-Style-Score“ (mit PSL-Umrechnung und Hinweis), Engine-1.x-Kennzahlen eingeklappt, nicht bewertete Verhältnisse nicht mehr als Abweichung, lesbare Messgrößen statt Rohschlüsseln, deutsche Overlay-/Regionstexte, Spaltenkopf „Quelle“, Methoden deutsch, keine Repository-Pfade/internen Formulierungen, Vergleich/Battle/Turnier/Seitenansicht-Texte und Zahlen korrigiert, σ/λ in Großbuchstaben-Köpfen, Telefon-Layout bei 320 px.
- Offene Punkte: `docs/OPEN_ITEMS.md` → „Audit 2026-11-09“.

## 10. Referenzprompt & Rubrik 3.0 „PSL Score – Front Profile“ (2026-11-09)

**A. „Schlechtes Foto? Kein Problem!“** — Der Button existierte in keinem Commit und
wurde minimal-invasiv im gemeinsamen Upload-Feld (`src/components/battle/upload-slot.tsx`,
Rater und Battle) ergänzt. Modal „Universal Facial Reference Optimization“
(`src/components/shared/reference-prompt.tsx`) zeigt den Originalprompt wortgetreu
aus der einzigen Quelle `src/lib/reference-prompt.ts` (`REFERENCE_PROMPT`, 9352 Zeichen,
SHA-256 `5197e2ac…5af8`, 11 Abschnitte). „Elite-Prompt kopieren“ kopiert genau diese
Konstante (Clipboard-API, Fallback `execCommand`), „Prompt erfolgreich kopiert“ nur bei
Erfolg, sonst Fehlermeldung. Nutzungshinweis wird angezeigt, nicht mitkopiert. Keine
Bildbearbeitung in der App, kein externer Bilddienst. Tests:
`tests/unit/reference-prompt.test.ts`, `tests/e2e/reference-prompt.spec.ts`
(Zwischenablage-Hash = Konstante, 1440 px und 360 px).

**B. Seitenprofil entfernt, Score neu auf Frontansicht** (`docs/RUBRIC.md`):
- Entfernt: Seitenansicht-Seiten/-API/-Navigation, automatische Profilerkennung und
  Segmentierungsmodell, Profilfoto im Rater, Profilkriterien und -gewichte,
  Turnierkategorie „Profil“, Seitenansicht-Kacheln/-Tabs.
- Rubrik 3.0.0 / Engine 3.0.0: 7 Kategorien Eye Area 20, Facial Harmony & Symmetry 20,
  Midface 15, Nose 15, Lower Third & Chin Shape 15, Jawline & Frontal Mandibular
  Definition 10, Cheekbones & Facial Width 5 (Summe 100); 32 Kriterien; PSL = Σ Sᵢ·Wᵢ
  über die beurteilbaren Kategorien (Gewichte renormiert, fehlend ≠ 0); unter 50 % des
  Kategoriegewichts kein Gesamtscore (`insufficientData`); Anzeige mit einer
  Nachkommastelle; Einordnung 0–2/3–4/5–6/7–8/9–10 (`src/engine/psl/bands.ts`).
- Oberfläche: „PSL Score – Front Profile“ + Hinweistext, Einordnung je Gesamt- und
  Kategoriewert; Bewertungen/Analysen < 3.0 als „Alte Methode“ markiert (Bewertung,
  Verlauf, Profile, Dashboard, Vergleich, Turnier, Analyse); Ranglisten nur 3.0,
  Turniere lehnen alte Bewertungen ab. Gespeicherte Daten werden nicht neu berechnet
  oder gelöscht; Seitenansicht-Datensätze bleiben in DB und Export.
- Dabei gefundener Fehler (behoben): `UploadSlot` hatte je Zustand ein eigenes
  Datei-Input; endete die Wiederherstellung eines gespeicherten Fotos, während der
  Dateidialog offen war, wurde das Input ausgehängt und die neue Auswahl ging
  verloren. Jetzt ein dauerhaft gemountetes Input (E2E 6/6 wiederholt grün).
- Tests: `tests/unit/front-rubric.test.ts` (Gewichte, Rechenbeispiel 6,85,
  Renormierung, Mindestdaten, Bänder, Bericht), angepasste Unit-/E2E-Tests
  (`psl.spec.ts` u. a. „front profile only“ und „old method“).

## 11. Mehrstufige Qualitätskontrolle, Engine 3.1.0 (2026-11-12)

Auftrag: jeden Landmark einzeln prüfen (vergrößert, korrigieren, erneut prüfen),
alle Messungen mit Plausibilitäts-/Fehlerkontrolle neu berechnen, Kontrollinstanz
vor der Ergebnisanzeige (Ablehnung → Neuanalyse), keine Schein-Sicherheit, und den
Abdeckungs-Schieberegler im Frontprofil vollständig entfernen. Details:
`docs/QUALITY_CONTROL.md`.

- **Erkennungsdurchgänge (Browser, auf dem Gerät):** `src/lib/vision/verify.ts` –
  Original + gespiegelt, ±5° gedreht, vergrößerter Gesichtsausschnitt, vergrößert +
  gespiegelt; alles auf Fotopixel zurückgerechnet; Fortschritt im Upload-Feld.
- **Stufe 1 – Landmarks** (`src/engine/verify/landmarks.ts`): Median aller
  Durchgänge, Toleranz je Punkt aus der gemessenen Wiederholgenauigkeit;
  bestätigt / korrigiert (+ erneute Prüfung) / unsicher (Konfidenz × 0,6) /
  verworfen; 11 anatomische Regeln, verletzender Punkt wird mit den
  Durchgangspositionen neu analysiert (Verdächtiger per Residuum zum kanonischen
  Gesicht), sonst verworfen.
- **Stufe 2 – Messungen** (`measures.ts`, `run.ts`): jede Messung aus jedem
  Durchgang neu; ≤ 0,5 s stabil, ≤ 1 s unsicher (halbes Gewicht), > 1 s bzw.
  unplausibel ausgeschlossen; Gesamtergebnis-Streuung > 0,35 PSL → Ablehnung und
  Neuanalyse ohne die instabilsten Messungen (≤ 3 Runden), protokolliert.
- **Stufe 3 – Kontrollinstanz** (`control.ts`): 10 Prüfungen (Bildqualität,
  Mehrfacherkennung, Landmarks, Anatomie, Messungen, Wertebereiche, unabhängige
  Nachrechnung inkl. Leck-Prüfung, Reproduzierbarkeit, Abdeckung,
  Widerspruchsfreiheit) → bestanden / eingeschränkt / nicht bestanden (dann kein
  Gesamtscore in Analyse, Bewertung, Battle, Turnier).
- **Schieberegler entfernt** (UI `rater-setup.tsx`, API-Schema, `rating.ts`,
  `DEFAULT_MIN_COVERAGE`, Berichte): gültig = QC bestanden und Abdeckung ≥ 70 %;
  vorläufig = QC eingeschränkt / Abdeckung < 70 % / Analyse ohne QC; alte
  Bewertungen behalten ihren gespeicherten Wert und Status.
- **Bei der Zoom-Prüfung gefundene Landmark-Fehler (behoben):** Exocanthion lag auf
  dem Ring außerhalb des Auges (CT ≈ 1–1,5° zu niedrig) → Vertices 33/263;
  Brauen-Scheitel sprang zwischen Nachbar-Vertices → Parabel-Scheitel; Gonion
  wechselte hart zwischen zwei Konstruktionen → glatter Übergang. Ideal-Beispiel
  neu erzeugt.
- **Oberfläche:** Analyse-Reiter „Prüfung“ (`qc-panel.tsx`: Status, 10 Prüfungen,
  Neuanalyse-Protokoll, jeder Landmark vergrößert mit allen Durchgängen und
  Toleranzkreis, jede Messung mit Streuung), QC-Banner in Übersicht und
  Bewertung (Link `…#qc`).
- **Tests:** `tests/unit/verification.test.ts` (19 Tests, echte erfasste Eingaben in
  `tests/fixtures/verification`, eingeschleuste Fehler), angepasste Unit-Tests,
  E2E (Server `psl.spec.ts`, statisch `browser-edition.spec.ts`) für Banner,
  Prüfbericht, Zoom-Ausschnitte und fehlenden Schieberegler.
- **Grenzen (ehrlich):** Die Prüfung belegt Wiederholgenauigkeit und anatomische
  Plausibilität, nicht Expertengenauigkeit; systematische Modellfehler, die in
  allen Durchgängen gleich sind, bleiben unsichtbar. Kalibrierdaten: zwei
  gemeinfreie Fotos (sechs Aufnahmen) + synthetisches Gesicht; Schwellen sind
  dokumentierte Konventionen.
