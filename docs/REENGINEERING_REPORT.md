# Abschlussbericht – Audit und Re-Engineering der Gesichtsanalyse (Engine 2.0 / Rubrik 2.0)

Stand: 2026-11-08. Alle Zahlen stammen aus reproduzierbaren Läufen; Befehle und
Rohdaten stehen in `docs/MODEL_VALIDATION.md` und `docs/research/`. Es werden nur
Verbesserungen behauptet, die gemessen wurden – Verschlechterungen stehen
ausdrücklich dabei.

## A. Ausgangszustand

Engine 1.0 (Details: `docs/SYSTEM_AUDIT.md`): MediaPipe-Landmarks im Browser,
2D-Rollausgleich über die Pupillenlinie, 42 Verhältnisse mit Community-Bereichen,
Index „100 im Bereich, Halbierung je 10 % des Zielwerts außerhalb“, flacher
gewichteter Mittelwert, Gesamtwert = 0,8·Proportion + 0,2·Symmetrie, PSL-Rubrik 1.0
mit 41 Kriterien, Kalibrierung über Ankerpunkte, die so gewählt waren, dass die
eigenen Testporträts in der Mitte landeten. Tiefe (z) wurde verworfen, Gier- und
Nickwinkel wurden nur als Qualitätsschranke genutzt, die Unsicherheit wurde mit
unabhängigem, für alle Punkte gleichem Rauschen simuliert.

## B. Gefundene kritische Fehler

| # | Fehler | Schwere |
| --- | --- | --- |
| D1 | Nahezu binäre Kriterienwerte; PSL-Gesamtwerte unterschiedlicher Gesichter lagen eng beieinander (4,87 / 5,08 / 5,85) | hoch |
| D2 | Rauschen in der Größenordnung echter Unterschiede, systematische Abwärtsverzerrung unter Rauschen | hoch |
| D3 | Toleranzregel „10 % des Zielwerts“ skalenabhängig (Winkel, Abweichungen um 0) | mittel |
| D4 | Gemeinsame Nenner (Gesichtsbreite in 10 Verhältnissen) vervielfachen ein Merkmal | mittel |
| D5 | Meta-Kriterien `areaBalance` (belohnte gleichmäßig schwache Gesichter) und `verticalBalance` (Drittel doppelt) | hoch |
| D6 | Symmetrie und Breiten durch Kopfdrehung verfälscht | hoch |
| D7 | Rollwinkel > 90° falsch, 90° fälschlich verworfen | hoch |
| D8 | Profilansicht nutzt die Bildsenkrechte statt einer anatomischen Achse | mittel |
| D9 | Tiefe verworfen – keine 3D-Lagenormalisierung möglich | hoch |
| D10 | Gleiches Landmark-Rauschen für Augenwinkel und Kieferkontur | mittel |
| D11 | Zirkuläre Kalibrierung | hoch |
| D12 | Keine Klassifikation der Aufnahmebedingungen | mittel |
| D13 | Referenzbereiche, die zur Landmark-Konstruktion nicht passen (JWHR, ET, DEV CT/ET, ICD/N: alle Testgesichter auf derselben Seite außerhalb) | hoch |
| D14 | Unabhängiges Rauschen überschätzte die Unsicherheit lokaler Differenzen 5–19× | mittel |
| D15 | Server-Schema verwarf die neuen Aufnahme-Metriken | mittel |
| D16 | Rauschuntergrund in Asymmetrien (perfekt symmetrische Gesichter wirkten asymmetrisch) | mittel |

## C. Neue Architektur

```
Bild → MediaPipe (478 Punkte inkl. z) → Aufnahmeklassifikation + Qualität
     → 3D-Lagenormalisierung (Horn-Fit an das kanonische Gesicht) + Pupillen-Horizontale
       (+ optionale manuelle Landmark-/Achsenkorrektur)
     → semantische Landmarks → Messgrößen (Verhältnisse, Symmetrie, EML, Fünftel, Profil)
     → Messindex (Streuungseinheiten, Erwartungswert über Messunsicherheit)
     → 40 Kriterien → 7 Kategorien → nicht-kompensatorisches Gesamtergebnis
     → PSL (Index/10), σ (Monte-Carlo mit korreliertem Rauschmodell), Zuverlässigkeitsstufe
```

* Eine gemeinsame Aggregation (`engine/scoring/hierarchy.ts`) für Analyse und
  PSL-Rater – vorher gab es zwei verschiedene Gesamtmodelle.
* Hierarchie: **A Augenpartie (25), F Proportionen (20), B Knochenstruktur (15),
  D Nase (12), E Lippen & Mund (10), A Symmetrie (10), G Stirn & Haaransatz (8)**;
  „H Gesamtharmonie“ ist der Interaktionsterm der Aggregation (kein Doppelzählen).
  Reihenfolge nach Evidenz (`docs/RUBRIC.md`), Werte als Konvention ausgewiesen.
* Jede Messgröße fließt in genau ein Kriterium (Unit-Test). Fünf Messgrößen werden
  angezeigt, aber nicht bewertet (FWHR widerlegt; JWHR, ET, DEV CT/ET, ICD/N
  Konstruktionsfehler).
* Neu: `engine/landmarks/pose.ts`, `noise-model.ts`, `capture/`, `scoring/measurement.ts`,
  `scoring/hierarchy.ts`, `quality/reliability.ts`, `synth/`, `psl/calibration.ts`.

## D. Mathematische Änderungen

| Baustein | vorher | jetzt | Begründung |
| --- | --- | --- | --- |
| Messindex | 100·2^(−d/tol), tol = 10 % des Ziels | 100·exp(−½(d/s)²), s = Streuung zwischen Personen (Fang et al. 2011, sonst dokumentierte Konvention) | einheitliche, skalenfreie Abweichung in „natürlichen“ Einheiten |
| Unsicherheit im Index | – | Erwartungswert des Index über σ des Messwerts | Werte an der Bereichsgrenze nicht als exakt behandeln |
| Symmetrie | 100·exp(−ln2·a/tol) | Gauß + Rauschkorrektur √max(a²−σ²,0) | kleine Asymmetrien nicht wahrnehmbar; Rauschuntergrund entfernt |
| Kriterium | konfidenzgewichteter Mittelwert | Gewicht = Abhängigkeitsgewicht × Landmark-Reliabilität λ × Konfidenz | unzuverlässige Punkte (Gonion λ 0,4: ICC 0,16, Lim et al. 2022) zählen weniger |
| Kategorie/Gesamt | arithmetischer Mittelwert | gewichtetes Potenzmittel p = 0,5 | monoton, gleich dem Mittelwert bei gleichen Werten, abnehmender Grenznutzen eines herausragenden Merkmals |
| Meta-Kriterien | areaBalance, verticalBalance | entfernt | belohnten schwache Gesichter bzw. zählten doppelt |
| Kalibrierung | Ankerpunkte an eigenen Porträts | PSL = Index/10; Populationsanker per Simulation geprüft und **verworfen** | zirkulär bzw. von echten Gesichtern widerlegt |
| Abdeckung | inkl. visueller Kriterien | kategoriengewichteter Anteil der nicht-visuellen Kriterien | fehlender Provider senkt nicht die Abdeckung |
| σ des PSL-Werts | lineare Näherung | Wiederholung der gespeicherten Monte-Carlo-Stichproben durch die gesamte Aggregation; Anzeige mit einer signifikanten Stelle von σ; Wahrscheinlichkeit eines anderen Tiers | keine Scheinpräzision |

## E. Gesichtserkennung und Bildqualität

* **3D-Lagenormalisierung** aus den MediaPipe-Tiefen (gewichteter Horn/Kabsch-Fit an
  33 Punkte des kanonischen Gesichts); Lage stimmt mit MediaPipes Matrix überein
  (Gieren 1,6/1,0°, 11,5/11,5°, 31,2/32,4°).
* **Aufnahmeklassifikation** (Ansicht, Neigung, Ausschnitt, Abstand per EXIF-Brennweite
  und Irisdurchmesser 11,7 mm, Selfie/Spiegel, Bearbeitung, Glättung, Kompression,
  Belichtung, Seitenlicht) mit Kennzeichnung gemessen/abgeleitet/vermutet/unbestimmbar.
  Qualität beeinflusst Konfidenz und σ, nicht den Wert selbst.
* **Analysezuverlässigkeit in 5 Stufen** (sehr hoch / hoch / mittel / niedrig /
  nicht auswertbar) aus σ des Gesamtwerts (≤ 0,25 / 0,40 / 0,60 PSL) mit
  begründeten Obergrenzen (Bildqualität, geschätzter Haaransatz, Gieren > 15°,
  Abdeckung, fehlende Simulation) – angezeigt in Analyse und Rater.
* **Erkennungsqualität je Messung**: Wert ± σ, Stufe A–D nach schwächstem Landmark,
  λ, Konfidenz, Einflussfaktoren (Gieren, Nicken, Mimik, Licht, Perspektive,
  Haaransatz, rekonstruiert, manuell) und Verwendung (bewertet / angezeigt /
  nicht verfügbar).
* **Rauschmodell**: empirisches, korreliertes Modell aus 35 Wiederholungsdetektionen
  (14 Hauptkomponenten, spiegelsymmetrisch); Kreuzvalidierung in
  `docs/MODEL_VALIDATION.md`.

## F. Geometrische Anpassungen

* Referenzachsen („H-Ansatz“): Horizontale = Pupillenlinie **nach** 3D-Normalisierung,
  Mittellinie aus Paarmitten und Mittellinienpunkten. Die starre Bild-Senkrechte wird
  nicht mehr verwendet; Roll in jedem Winkel (auch 90°/180°) korrekt.
* **Manuelle Korrektur**: Landmarks per Ziehen verschieben, Referenzachse ±15° neigen;
  alle Messgrößen werden live neu berechnet; die Analyse wird überall als „manuell
  korrigiert“ markiert, Korrekturen werden mit der Eingabe gespeichert und serverseitig
  geprüft (Punkte im Bild, Achse ≤ 15°). Manuelle Punkte bekommen eigenes
  Platzierungsrauschen im Monte-Carlo.
* Profilansicht: anatomisches Bezugssystem (Frankfurter Horizontale über
  Tragion–Orbitale oder manuell gedrehte Achse) statt Bildsenkrechte.
* Grenzen der 2D-Messung sind je Kriterium ausgewiesen (Weichteil-Ersatzpunkte,
  Perspektive ≈ +30 % Nasenbreite bei 30 cm, Ward et al. 2018).

## G. „IDEALBEISPIEL ANSEHEN“

* Ausgangspunkt ist das kanonische MediaPipe-Durchschnittsgesicht (Durchschnittlichkeit
  gilt als attraktiv, Langlois & Roggman 1990), minimal und spiegelsymmetrisch verformt
  (44 RBF-Zentren, (1+1)-Evolutionsstrategie), bis die bewerteten Frontalmaße in
  ihren Referenzbereichen liegen. Ergebnis: **29/32 Ziele im Bereich, 3 auf der
  Grenze** (EME, FT-U je 0,02 Einheiten; Fünftel 1,0 pp), mittlere Änderung 1,8 % IPD.
* Geschlossener Regelkreis im Browser: Rendering → MediaPipe-Neuerkennung →
  vollständige Neuvermessung → Korrektur um das Detektor-Residuum (gedämpft, 6 Schritte).
  Erstes Rendering 14/32 im Bereich (Σz² 14,8), bester Schritt Σz² ≈ 6,8; das
  Landmark-Residuum bleibt bei ≈ 4 % IPD.
* **Nicht erreicht: Fotorealismus.** Es steht kein Bildgenerierungsmodell zur
  Verfügung, und ein generiertes Foto würde Merkmale hinzufügen, die das Modell nicht
  verlangt. Der Dialog sagt das, zeigt Ziel / Geometrie / neu vermessen / Abweichung /
  eigener Wert und die Grenzen (nur Frontalmaße, Community-Ziele, Haaransatz gesetzt,
  keine visuellen Kriterien).

## H. Testergebnisse

* Unit-Tests: **246 bestanden**, 1 diagnostischer übersprungen (27 Dateien; Projekte
  `server` und `browser-edition`). Neu: Pose, Aufnahme, Messmodell, Rubrik 2.0
  (Eindeutigkeit, Monotonie, Nicht-Kompensation, Kalibrierung), Korrekturen,
  Zuverlässigkeit, Idealgeometrie, Eigenschaftstests (Wertebereiche,
  Skalen-/Verschiebungs-/Rotationsinvarianz, Spiegelinvarianz, Determinismus).
* E2E: siehe `docs/TEST_REPORT.md` (Server-Suite inkl. neuem Test für Korrektur,
  Zuverlässigkeit und Idealbeispiel; Browser-Edition).
* Validierung (222 Fälle, Gruppen A–E, alt gegen neu): `docs/MODEL_VALIDATION.md`.
* Typprüfung und Lint ohne Befund.

## I. Vorher-Nachher-Vergleich (gemessen)

| Kriterium | Engine 1.x | Engine 2.0 | Bewertung |
| --- | ---: | ---: | --- |
| PSL-Spannweite über 6 verschiedene Gesichter | 2,83 | 5,21 | ✔ Differenzierung |
| PSL-SD über diese Gesichter | 1,12 | 1,86 | ✔ |
| Ausgeglichen minus „ein Merkmal herausragend“ (Index) | 5,7 | 17,2 | ✔ keine Kompensation |
| Max. Änderung bei 20° Gieren (Index) | 13,0 | 0,24 | ✔ Lageinvarianz (orthografisch) |
| Roll 90° | verworfen | korrekt (Δ 0,05) | ✔ |
| Gemeldetes σ ÷ beobachtete Streuung | 3,1–6,6 | 0,75–2,0 | ✔ ehrlichere Unsicherheit |
| Test-Retest-Rauschen (PSL-SD) | 0,05 | 0,21 | ✘ höher |
| Einzelmerkmal-Änderung ÷ Rauschen (Median) | 5,4 | 3,6 | ✘ schlechter |
| Anteil erkennbarer Einzeländerungen (> 2 SD) | 93 % | 80 % | ✘ |
| Rangfolge der Testgesichter bei p = 1/0,5/0,25, Gleichgewichten, ohne λ | – | identisch | ✔ robust |

Der Rauschanstieg kommt nicht aus der 3D-Normalisierung, dem Potenzmittel oder dem
Monte-Carlo (geprüft), sondern aus steilen Flanken einzelner Messgrößen und daraus,
dass die evidenzbasierten Kategoriegewichte weniger Messgrößen pro Gewicht mitteln
als der alte flache Mittelwert. Der neue Wert reagiert absolut 2,7× stärker auf
Merkmalsänderungen, relativ zum eigenen Rauschen aber schwächer. Das wird offen
ausgewiesen (σ, Tier-Unsicherheit, Zuverlässigkeitsstufe); Battles und Turniere
entscheiden mit σ-Margen.

## J. Verbleibende Einschränkungen

* Keine Validierung gegen menschliche Attraktivitätsurteile (kein Datensatz).
* Referenzbereiche sind Community-Konventionen, überwiegend aus Gesichtern weißer
  Erwachsener; Nasen- und Lippenbreiten sind bevölkerungsabhängig.
* Kategoriegewichte und p sind evidenzinformierte Konventionen (Sensitivität geprüft).
* Rauschmodell aus zwei Gesichtern; Test-Retest nur unter Bildstörungen desselben Fotos,
  nicht über verschiedene Fotos derselben Person.
* Lagetests sind orthografisch; echte Drehungen bringen Perspektive und Verdeckung.
* 2D-Weichteil-Ersatzpunkte für knöcherne Landmarks; Profil per Hand gesetzt.
* Idealbeispiel nicht fotorealistisch; Restfehler der Neuerkennung ≈ 4 % IPD.
* **Referenzpersonen (Sean O'Pry, Hernan Drago)**: nicht verwendet. Es lagen keine
  lizenzierten Bilder vor, und das Projekt veröffentlicht keine Attraktivitätswerte
  namentlich identifizierbarer realer Personen; eigene Fotos können mit Einwilligung
  analysiert werden. Auch die vorhandenen Porträt-Fixtures erscheinen in Berichten
  nur als „Porträt A/B“.
* Minderjährige: keine automatische Altersschätzung (unzuverlässig, sensible
  Ableitung); die Volljährigkeits- und Einwilligungsbestätigung bleibt Pflicht.
  Es werden keine Persönlichkeits-, Intelligenz-, Herkunfts- oder ähnlichen
  Merkmale abgeleitet.

## K. Geänderte Dateien (Auswahl)

* Engine: `analysis.ts`, `types.ts`, `battle.ts`, `side-view.ts`,
  `landmarks/{mesh-map,pose,canonical,repeatability,noise-model,noise-model.data}.ts`,
  `capture/{exif,classify}.ts`, `quality/{assess,reliability}.ts`,
  `ratios/{database,evaluate,additional}.ts`,
  `scoring/{measurement,hierarchy,symmetry,uncertainty,aggregate}.ts`,
  `psl/{rubric,rating,calibration}.ts`, `synth/{deform,ideal,ideal-mesh.data}.ts`,
  `tournament/{categories,engine,types}.ts`.
* App: `components/analysis/{analysis-center,reliability-panel}.tsx`,
  `components/ideal/ideal-example.tsx`, `components/battle/upload-slot.tsx`,
  `components/viz/landmark-canvas.tsx`, `components/rater/{rating-result,rater-setup}.tsx`,
  `components/side/*`, `components/shared/capture-panel.tsx`,
  `components/tournaments/tournament-wizard.tsx`, `lib/{battle-store,ideal-example,psl-report}.ts`,
  `lib/vision/{detect,image,quality,pipeline,render-face}.ts`, i18n EN/DE.
* Server: `schemas.ts`, `services.ts`, `api/rubric`, `api/side-analyses`.
* Forschung/Tests: `scripts/research/*`, `tests/research/*`, `vitest.research.config.ts`,
  `tests/unit/{pose,capture,measurement,corrections,reliability,ideal,properties}.test.ts`,
  `tests/e2e/ideal.spec.ts`, `tests/fixtures/repeatability/`.
* Doku: `SYSTEM_AUDIT.md`, `RUBRIC.md`, `SCORING.md`, `RATIOS.md`, `PRIVACY.md`,
  `MODEL_VALIDATION.md`, `research/*`, dieser Bericht.

## L. Status

| Bereich | Status |
| --- | --- |
| Audit, Fehlerliste mit Messungen | erledigt |
| Hierarchische, nicht-kompensatorische Bewertung ohne Doppelgewichtung | erledigt, getestet |
| 3D-Pose, Achsen, Rollen in jedem Winkel, Profil-Achse | erledigt, getestet |
| Aufnahmeklassifikation, Qualität → Zuverlässigkeit | erledigt |
| Manuelle Landmark-/Achsenkorrektur | erledigt, Unit- und E2E-getestet |
| 5-stufige Analysequalität + Erkennungsqualität je Messung | erledigt |
| Idealbeispiel mit Regelkreis | erledigt, **nicht fotorealistisch** |
| Validierung A–E, Eigenschaften, Sensitivität, alt/neu | erledigt; Rausch-/Trennschärfe-Rückschritt dokumentiert |
| Validierung gegen menschliche Urteile, Bias-Audit | nicht möglich (keine Daten) |

## Akzeptanzkriterien

| Kriterium | Erfüllt | Nachweis |
| --- | --- | --- |
| Deutlich verschiedene Gesichter erhalten deutlich verschiedene Gesamtwerte | ja | PSL-Spannweite 2,83 → 5,21 (Gruppe C) |
| Ein herausragendes Merkmal kompensiert nicht alle Schwächen | ja | Abstand ausgeglichen/herausragend 5,7 → 17,2; Unit-Test |
| Keine Mehrfachgewichtung desselben Merkmals | ja | Eindeutigkeitstest; areaBalance/verticalBalance entfernt |
| Gewichte begründet, Sensitivität geprüft | ja (Konvention mit Evidenzreihenfolge) | `RUBRIC.md`, Sensitivität |
| Keine künstlich gestauchten Bereiche | ja | lineare Kalibrierung, keine Kompressionszone |
| Keine erfundenen Referenzen; ungeprüfte gekennzeichnet | ja | Evidenzstatus je Verhältnis; 5 nicht bewertet |
| Bildqualität beeinflusst Zuverlässigkeit, nicht den Wert | ja | Konfidenz/σ/Stufe; Unit-Tests |
| Kopfhaltung erkannt und korrigiert | ja (orthografisch geprüft) | Gruppe E, Pose-Tests |
| Referenzachse anpassbar, keine starre Senkrechte | ja | Achsenkorrektur, Frankfurter Horizontale |
| Manuelle Korrektur mit Neuberechnung und Markierung | ja | Unit + E2E |
| Analysequalität in 5 Stufen + Tabelle je Messung | ja | Unit + E2E |
| Keine Scheinpräzision | ja | σ-abhängige Nachkommastellen, Tier-Unsicherheit |
| Stabilität (Test-Retest) mindestens wie vorher | **nein** | PSL-SD 0,05 → 0,21 (dokumentiert, Ursache analysiert) |
| Idealbeispiel fotorealistisch | **nein** | kein Generator; Rendering + Regelkreis, offen ausgewiesen |
| Validierung gegen Menschen / Bias | **nicht möglich** | keine Daten |
| Keine Bewertung Minderjähriger, keine sensiblen Ableitungen | ja | Einwilligung, keine Attributschätzung |
