# Prototyp „Ärmel einsetzen“ an der Zoje A6000: Bauanleitung

Diese Anleitung beschreibt den Bau eines ersten Prototyps für das automatische Einsetzen eines
separaten Ärmels: Kinder-T-Shirt Gr. 86, Single Jersey, linkes Armloch. Das Prinzip ist
dasselbe wie im Szenario „T-Shirt, Ärmel einsetzen“ der Simulation:
- Ein Portal führt den Körper auf einem Werkstückträger um die Nadel.
- Eine Zuführung führt den Ärmel gegenläufig und bringt die Mehrweite ein.
- Ein Trennblech entkoppelt die beiden Lagen vor dem Nähfuß.

Alle Maße, Bahnen und Schaltzeitpunkte stammen aus dem Modell. Sie liegen als Dateien im Ordner
[`prototyp/`](../prototyp) und werden mit `node tools/prototyp-export.mjs` erzeugt.

---

## 0. Ergebnis vorweg: Geht es mit der A6000?

**Ja, als Basis für den Prototyp.** Die A6000 ist eine Einnadel-Steppstichmaschine (Flachbett)
mit Direktantrieb, Untertransport, Nadelpositionierung und je nach Variante Fadenabschneider.
Was ihr fehlt, lässt sich von außen ergänzen:

| Anforderung aus der Simulation | A6000 | Lösung im Prototyp |
|---|---|---|
| Untertransport für den Körper | ja (Transporteur) | – |
| Obertransport mit Mehrweite für den Ärmel | **nein** | nicht nötig: Die Ärmelzuführung bringt die Mehrweite vor dem Fuß ein (siehe unten) |
| gleichmäßige niedrige Drehzahl (400 Stiche/min) | ja, Direktantrieb, Höchstdrehzahl am Bedienfeld einstellbar | – |
| Nadelstopp oben/unten | ja (Bedienfeld) | – |
| Fadenabschneider | je nach Variante (Kennbuchstabe D) | für den Prototyp nicht nötig |
| automatische Fußlüftung | meist nein (Handhebel 5,5 mm, Kniehebel bis 13 mm) | Pneumatikzylinder am Kniehebelgestänge |
| Start, Stopp und Drehzahl vom Rechner | keine Schnittstelle | Pedal-Sollwert nachbilden (Stufe 1 mechanisch, Stufe 2 elektrisch) |
| Stichsynchronisation (Nadelphase) | kein Signal nach außen | eigener Drehgeber am Handrad |
| Freiraum unter dem Arm | ≈ 30 cm (Standard-Flachbett) | reicht für den Ärmel |

**Zum fehlenden Obertransport** habe ich die Simulation eigens nachgerechnet, einmal mit und
einmal ohne Obertransport (Option `topFeed` im Modell):

| Variante | Stiche durch beide Lagen | Mehrweite (Soll 2,9 %) | Körpernaht | Ärmelnaht |
|---|---|---|---|---|
| mit Obertransport | 83 / 83 | 2,8 % | Ø 0,30 mm, max. 1,6 mm | Ø 0,35 mm, max. 0,7 mm |
| ohne Obertransport, Stahlfuß 40 N | 83 / 83 | 2,8 % | Ø 0,18 mm, max. 1,3 mm | Ø 0,43 mm, max. 1,0 mm |
| ohne Obertransport, PTFE-Fuß 20 N | 83 / 83 | 2,8 % | Ø 0,18 mm, max. 1,3 mm | Ø 0,43 mm, max. 1,0 mm |

Die Zuführung schiebt den Ärmel schon vor dem Fuß um die Mehrweite schneller nach. Das
Fußmodell der Simulation ist aber vereinfacht: Es kennt nur „Fuß hält die obere Lage fest“ oder
„nicht“. Real bremst der Fuß die obere Lage immer etwas. Deshalb:
- im Prototyp einen **PTFE-Fuß (Teflonfuß)** verwenden,
- den **Fußdruck so gering wie möglich** einstellen,
- in Stufe 3 messen, ob die Mehrweite ankommt.

**Wann auf eine andere Maschine wechseln?** Nur wenn Stufe 3 trotz PTFE-Fuß, reduziertem
Fußdruck und angepasstem Zuführverhältnis die Mehrweite nicht einhält (Abweichung > 1 %) oder der
Ärmel unter dem Fuß zurückbleibt. Dann braucht es eine Maschine mit **getrennt einstellbarem
Ober- und Untertransport**, zum Beispiel Steppstichmaschinen mit Differential-Obertransport wie
die Juki DLU-5494N-7 oder einen Ärmeleinnähautomaten. Genaue Typen vor dem Kauf nach Datenblatt
prüfen. Der Rest des Prototyps (Portal, Zuführung, Trennblech, Steuerung) bleibt gleich.

> **Vorher prüfen:** das vollständige Typenschild der Maschine (z. B. A6000-D-G/01,
> A6000-D-HG …). Davon hängen Stichlänge (5 oder 7 mm), Fadenabschneider und Nadelsystem ab.

---

## 1. Was gebaut wird

```
                     hinten (Transportrichtung, +Y)
        ┌──────────────────────────────────────────────┐
        │        Kopf ███   Arm ═══════════════ Ständer │  A6000
        │             ▼ Nadel                           │
        │   ┌────────┐ ┌──Trennblech (0,3 mm)──┐        │
        │   │Ärmel-  │ │  vor dem Fuß, links   │        │
        │   │zuführ. │ └───────────────────────┘        │
        │   │X-Y-θ-Z │  Vakuumplatte, 15 Kammern         │
        │   └────────┘                                  │
        │        Körper auf Werkstückträger             │
        │        ◄── Portal X-Y-C-Z hält den Träger     │
        │            am Griffpunkt (rechts vorne)       │
        └──────────────────────────────────────────────┘
                        vorne (Bediener, −Y)
```

| Baugruppe | Aufgabe |
|---|---|
| A6000 mit Fußlüftung, Pedal-Ansteuerung und Drehgeber | näht; liefert die Nadelphase |
| Werkstückträger (Blech mit Klettband, Schlitz am Armloch) | hält den Körper, bleibt beim Nähen unter ihm |
| Körperportal X-Y-C-Z | führt den Träger so, dass das Armloch an der Nadel immer in Transportrichtung liegt |
| Ärmelzuführung X-Y-θ-Z mit segmentierter Vakuumplatte | führt den Ärmel gegenläufig mit Mehrweite, gibt ihn kammerweise frei |
| Trennblech | verhindert, dass der Körper den Ärmel vor dem Fuß mitnimmt |
| Steuerung (Teensy 4.1 + PC) | koppelt alle Achsen an die Nadelphase („elektronisches Getriebe“) |

---

## 2. Stufenplan

Jede Stufe hat ein messbares Ziel. Erst wenn es erreicht ist, geht es weiter.

| Stufe | Inhalt | Ziel / Abnahme | Aufwand (grob) |
|---|---|---|---|
| **1** | Maschine vom Rechner starten, stoppen, Drehzahl vorgeben; Drehgeber am Handrad | 83 Stiche gerade auf Probestreifen, Stichzahl exakt, Stopp Nadel unten | 1–2 Wochenenden |
| **2** | Werkstückträger und Körperportal; Armlochnaht **ohne Ärmel** | Naht liegt auf der aufgezeichneten Sollinie: Ø ≤ 0,5 mm, max. ≤ 1,5 mm | 3–5 Wochenenden |
| **3** | Trennblech und Ärmelzuführung; Ärmel von Hand auf die Platte gelegt (Anlegemarken) | 83/83 Stiche durch beide Lagen, Mehrweite 2–4 %, Ärmelnaht max. ≤ 2 mm | 3–5 Wochenenden |
| **4** | Kamera-Lagekorrektur beim Aufsetzen, Kantensensor zur Überwachung | wie Stufe 3, aber mit ± 5 mm / ± 3° zufällig verlegtem Ärmel | 2–3 Wochenenden |
| **5** | Versuchsreihe 20 Stück, Protokoll, Vergleich mit der Simulation | Streuung der Kennwerte; Liste der Abweichungen zum Modell | 1–2 Wochenenden |

Die Simulationswerte für Stufe 3 (Abschnitt 0) sind die Zielmarke.

---

## 3. Fertigungsunterlagen (Ordner `prototyp/`)

| Datei | Inhalt | Verwendung |
|---|---|---|
| `schnittteile.svg` | Körper (Vorder- und Rückenteil aufgeklappt) und linker Ärmel, Nähte gestrichelt | 1:1 drucken, Zuschnitt; Sollinie auf den Stoff übertragen |
| `traeger.svg` | Werkstückträger mit Schlitz am Armloch und **Griffpunkt** für das Portal | Laser- oder Wasserstrahlzuschnitt |
| `trennblech.svg` | Trennblech in Maschinenkoordinaten, Lage zum Nähfuß | Laserzuschnitt, Lage beim Einbau |
| `vakuumplatte.svg` | Plattenkontur, 15 Kammern mit Ventilnummer und Abschaltstich, abhebende Kammern rot | Konstruktion der Platte (3D-Druck) |
| `bahn_aermel.csv` | je Stich: Körperpose, Ärmelpose, Griffpunkt Portal, Anlenkpunkt Zuführung, Zuführverhältnis | Sollwerte für die Steuerung |
| `kennwerte.json` | Nahtlängen, Mehrweite, Schlitz, Freigabelinie, Schaltzeitpunkte, Abstände | Parameter |

**Koordinaten der Bahntabelle** (Draufsicht, Ursprung = Einstichpunkt):
- X nach rechts (zum Ständer), Y nach hinten (Transportrichtung).
- θ gegen den Uhrzeigersinn von oben, alle Werte in mm bzw. °.
- Eine Pose ist die Lage des Schnittteil-Ursprungs (rotes Fadenkreuz in den SVGs).
- Die Spalten `greif_*` und `zufuehr_*` sind die Wege der beiden Senkrechtachsen.

**Wichtig vor dem Bau:**
1. Die Sperrbereiche von Nähkopf und Arm an der eigenen A6000 nachmessen: Draufsicht ab Nadel, inklusive Fadenhebel, Fußstange und Kopfdeckel.
2. Die Werte oben in `tools/prototyp-export.mjs` eintragen (`HEAD`, `ARM`) und das Skript neu ausführen.

Das Skript wählt den Griffpunkt auf dem Träger und den Anlenkpunkt auf der Vakuumplatte so,
dass die Senkrechtachsen weder Kopf noch Arm noch einander zu nahe kommen. Mit den
Standardwerten bleibt der Griffpunkt mindestens 93 mm entfernt, der Anlenkpunkt 47 mm.

Ausdrucke im Maßstab prüfen: Jede SVG enthält eine 100-mm-Strecke.

**Kennwerte (aus `kennwerte.json`):**

| Größe | Wert |
|---|---|
| Armlochnaht / Kugelnaht | 208,0 / 214,0 mm (1 cm Zugabe) |
| Mehrweite | 2,88 %, im mittleren Kugelbereich verteilt (Verhältnis bis 1,072) |
| Stiche bei 2,5 mm | 83 |
| Drehung Körper / Ärmel während der Naht | −50,7° / +55,6° (gegenläufig, zusammen 106°) |
| Wege Griffpunkt Portal | X −81 … +151 mm, Y −339 … −151 mm |
| Wege Anlenkpunkt Zuführung | X −117 … −107 mm, Y −54 … +53 mm |
| höchste Geschwindigkeiten bei 400 Stichen/min | Körper 27 mm/s, 6,3 °/s; Ärmel 18 mm/s, 9,4 °/s |

---

## 4. Nähmaschine vorbereiten

### 4.1 Einstellungen
- **Nadel:** System DB×1 (16×231), Nm 70–75, **Kugelspitze SUK** für Maschenware.
- **Garn:** Polyester-Umspinnzwirn Nm 120 (Tex 25) in Ober- und Unterfaden.
- **Stichlänge:** 2,5 mm (Stellrad); mit Lineal über 20 Stiche nachmessen (Soll 50 mm). Die gemessene Stichlänge geht in die Steuerung ein.
- **Fadenspannung:** so niedrig, dass der Verschlingungspunkt mittig im Zweilagen-Jersey liegt, keine Kräuselung. Probenaht auf Reststücken.
- **Fußdruck:** an der Stellschraube oben am Kopf reduzieren, bis der Jersey gerade noch ohne Schlupf transportiert wird. Wert als Umdrehungen notieren.
- **Nähfuß:** Standard-Steppstichfuß mit PTFE-Beschichtung (Teflonfuß).
- **Transporteur:** Höhe nach Anleitung (typisch 0,8–1,0 mm über der Stichplatte). Wenn erhältlich, feinverzahnten Transporteur mit passender Stichplatte für leichte Stoffe verwenden.
- **Bedienfeld:**
  - Höchstdrehzahl 400 Stiche/min (später steigern).
  - Nadelstopp **unten**.
  - Anfangs- und Endriegel aus.
  - Sanftanlauf auf den kleinsten Wert.
  - Fadenabschneider in Stufe 1–3 aus.

### 4.2 Tisch
- Der Träger gleitet über Maschinenbett und Tischplatte. Kanten und Fugen über 0,3 mm haken. Deshalb eine **Anschiebeplatte** (HPL oder Aluverbund, 3–6 mm) bündig zum Maschinenbett einpassen, Fugen mit PTFE-Klebeband überdecken.
- Fläche mindestens 900 × 700 mm um die Nadel; der Körper schwenkt bis 33 cm um die Nadel.

### 4.3 Fußlüftung
- Unter dem Tisch sitzt das Kniehebelgestänge (Hub bis 13 mm).
- Ein **Pneumatik-Kompaktzylinder Ø 16 mm, Hub 25 mm** drückt über einen Hebel auf die Kniehebelwelle. Ansteuerung über ein 5/2-Wegeventil 24 V mit Abluftdrossel, damit der Fuß sanft aufsetzt.
- Hub mit Anschlagschraube so begrenzen, dass der Fuß **8 mm** hebt. Das reicht für Träger, Körper und Ärmel und schont das Gestänge.
- Alternative ohne Druckluft: Linearaktor 12/24 V mit Endschaltern (langsamer).

### 4.4 Start, Stopp, Drehzahl vom Rechner (Pedal-Sollwert)
Das Pedal ist ein Sollwertgeber: Ruhe, vor = nähen (Drehzahl nach Pedalweg), zurück = Fuß
heben bzw. Fadenabschneiden.

- **Stufe 1, ohne Eingriff in die Elektrik:** Ein Stellmotor bewegt das Originalpedal über eine
  Schubstange, zum Beispiel ein Modellbau-Servo ab 25 kg·cm mit Metallgetriebe oder ein
  Linearaktor mit Positionsrückmeldung. Positionen für Ruhe, Nähen bei 400/min und Stopp
  einlernen. Grob, aber ungefährlich und sofort umsetzbar.
- **Stufe 2, Sollwert elektrisch nachbilden** (nur Kleinspannungsseite):
  1. Steckverbindung Pedal ↔ Steuerkasten finden.
  2. Mit dem Multimeter Versorgung (meist 5 V), Masse und Signal bestimmen.
  3. Die Signalspannung in Ruhe, bei leichtem und vollem Treten und beim Zurücktreten notieren.
  4. Teensy 4.1 → DAC MCP4725 → Spannungsfolger (Operationsverstärker, Rail-to-Rail) → Signalleitung.
  5. Einen Umschalter „Pedal / Rechner“ vorsehen.
  6. Der Not-Aus legt den Sollwert hart auf „Ruhe“ (Relaiskontakt) und schaltet die Achsfreigabe ab.

  **Den Steuerkasten nicht öffnen**: Er führt Netzspannung und den Motorumrichter. Der Eingriff
  kann die Gewährleistung berühren.

### 4.5 Drehgeber (Nadelphase)
- Magnetischer Winkelsensor **AS5600** hinter dem Handrad: Einen diametral magnetisierten
  Magneten (6 × 2,5 mm) mittig auf das Wellenende bzw. die Handradschraube kleben. Den Sensor auf
  einem Halter mit 1,5–2 mm Abstand anbringen.
- Kalibrieren durch langsames Drehen von Hand, jeweils Winkel notieren:
  - Nadel oben = 0°,
  - Nadel taucht in den Stoff ein / taucht aus,
  - Transporteur beginnt / beendet den Vorschub.
- Den **Vorschubverlauf** f(φ) messen: eine Messuhr am Probestreifen oder eine Kamera auf einer
  Markierung, alle 15° ablesen. Ergebnis: Tabelle φ → Vorschub in mm, Summe = Stichlänge.

---

## 5. Werkstückträger
- **Material:** Aluminium 1,0 mm (AlMg3, entgratet) oder Polycarbonat 1,5 mm. Polycarbonat ist leichter und für die Kamera durchsichtig. Kontur nach `traeger.svg`.
- **Unterseite:** PTFE-Gleitfolie 0,1–0,2 mm, damit der Träger leicht über den Tisch gleitet.
- **Nadelleisten:** Klettband, **Hakenseite**, 20 mm breit, entlang der Außenkanten. Nicht im Schlitzbereich. Hakenband hält Jersey zuverlässig.
  - Abnahme: Ein Körperstück darf sich bei 2 N Zug quer nicht lösen.
  - Wenn es nicht hält: Kratzenband (Nadelband).
- **Schlitz:** 16 mm ab Naht nicht verkleinern. Sonst drückt der Nähfuß auf den Träger; das hat die Simulation beim Halsbündchen gezeigt.
- **Griffpunkt:** Buchse am markierten Punkt. Zentrierstift Ø 6 mm plus Verdrehsicherung (zweiter Stift Ø 4 mm im Abstand 30 mm) plus Haftmagnet. Der Träger liegt mit Eigengewicht auf dem Tisch; das Portal hält ihn in der Ebene steif und in der Höhe nur locker.
- **Körper auflegen:** Sollinie (Armlochnaht) mit Trickmarker auf den Körper übertragen, Körper an Anlegemarken auf dem Träger ausrichten, auf das Hakenband drücken.

---

## 6. Körperportal (X-Y-C-Z)

| Achse | Weg | Geschwindigkeit beim Nähen | Ausführung |
|---|---|---|---|
| X | 400 mm | ≤ 30 mm/s | Linearführung MGN15 (2 Schienen), Zahnriemen HTD-3M 15 mm, Closed-Loop-Schrittmotor NEMA 23 (≈ 2 Nm) |
| Y | 300 mm | ≤ 30 mm/s | wie X (Doppelantrieb oder Querwelle gegen Verkanten) |
| C | ± 180° | ≤ 10 °/s | NEMA 23 Closed-Loop über **spielfreien** Zahnriemen 1:10 auf Kreuzrollenlager oder Drehtisch |
| Z | 40 mm | nur Auf/Ab | pneumatischer Führungszylinder Ø 20 mm oder kleiner Linearaktor |

- **Genauigkeit:** Der Griffpunkt liegt bis etwa 30 cm vom Nahtpunkt entfernt. 0,1° Winkelfehler
  ergibt dort 0,5 mm. Deshalb braucht die C-Achse ≤ 0,02° Spiel und Wiederholgenauigkeit;
  X und Y brauchen ≤ 0,05 mm. Closed-Loop-Motoren mit 1000-Strich-Gebern erreichen das mit der
  1:10-Untersetzung.
- **Gestell:** Das Portal steht auf einem **eigenen Gestell** aus Aluprofil 40×80 neben bzw. über
  dem Nähtisch, nicht auf der Tischplatte. Die Maschine vibriert, und die Tischplatte federt.
- **Höhe:** Unterkante Portal ≥ 250 mm über dem Tisch, damit der Nähkopf (≈ 200 mm) frei bleibt.
  Die Achsen X, Y und C sitzen oben, Z ragt nach unten zum Griffpunkt.
- **Referenzieren:** Endschalter je Achse. Danach den Träger einmal von Hand so legen, dass
  der Nahtanfang unter der Nadel liegt (Nadel absenken). Achspositionen speichern = Bahnstart.

---

## 7. Ärmelzuführung (X-Y-θ-Z mit Vakuumplatte)

| Achse | Weg | Ausführung |
|---|---|---|
| X | 100 mm (Laden) | MGN12, Riemen GT2, NEMA 17 Closed-Loop |
| Y | 200 mm | wie X |
| θ | ± 90° | NEMA 17 mit spielfreiem Riemen 1:5 |
| Z | 30 mm (Absenken auf das Trennblech, Laden) | kleiner Führungszylinder oder Servo |

Die Zuführung wird am **Anlenkpunkt** (siehe `vakuumplatte.svg`, an der Saumseite des Ärmels)
über einen waagerechten Ausleger von vorne links gehalten. So bleibt der Bereich über der Nadel
frei.

### 7.1 Vakuumplatte
- **Aufbau:** 3D-Druck in PETG oder ASA, zweiteilig.
  - Kammerkörper: 15 Kammern à 38 × 38 mm, Wände 2 mm, Höhe 8 mm, je Kammer ein Schlauchanschluss M5.
  - Saugboden: 2 mm, Bohrungen Ø 1,5 mm im Raster 6 mm, Unterseite plan geschliffen.
- **Kammern:** Kammern, die beim Nähen die Freigabelinie (18 mm vor der Nadel) überqueren, schalten ab. Laut Auswertung sind das alle 15, beim jeweils angegebenen Stich (`kennwerte.json`).
- **Abhebende Kammern (rot, ↑):** V1, V4, V6, V9, V10 und V13 laufen nach dem Abschalten in den Bereich des Nähfußes. Sie werden als **einzelne Finger** ausgeführt, je mit einem Mini-Zylinder Ø 10 mm und 5–10 mm Hub. Beim Abschalten heben sie ab.
  - V1 ist schon ab Stich 0 aus und kann entfallen; die Platte ist dort ausgespart.
  - Die übrigen 9 Kammern bilden die feste Platte.
- **Vakuum:** Jersey ist sehr luftdurchlässig. Nötig ist **viel Luftmenge bei wenig Unterdruck** (2–5 kPa), kein hoher Unterdruck. Geeignet sind ein kleiner Seitenkanalverdichter (0,2–0,4 kW) oder ein Werkstattsauger mit Nebenluftklappe. Verteilerleiste mit 15 × 3/2-Wegeventilen 24 V.
- **Höhe:** Die Platte drückt den Ärmel flach auf das Trennblech. Z-Position so einstellen, dass die Platte mit ≈ 0,5 mm Vorspannung aufliegt.

### 7.2 Ärmel laden (Prototyp)
1. Die Platte steht in Ladeposition, Unterseite nach oben gedreht oder seitlich zugänglich.
2. Ärmel an gravierten Anlegemarken auflegen (Kugelnaht-Linie und Passzeichen sichtbar), Vakuum ein.
3. Platte fährt in die Startlage aus `bahn_aermel.csv` (Stich 0) und senkt auf das Trennblech ab.
4. Ab Stufe 4 misst eine Kamera die Ärmellage und korrigiert die Startlage (in der Simulation über 0,4 s).

---

## 8. Trennblech, Kantensensor, Kamera
- **Trennblech:**
  - Material: Federstahl 1.4310, 0,3 mm, poliert.
  - Kontur nach `trennblech.svg`: 250 × 234 mm, Hinterkante 16 mm vor der Nadel (Fußspitze), überwiegend links vor der Nadel.
  - Höhe: Unterkante 2,0 mm über dem Tisch (Träger 1 mm + Jersey 0,55 mm + Luft).
  - Halter: von vorne links an der Tischplatte, außerhalb des Schwenkbereichs des Körpers.
  - Kante zur Nadel 30° anfasen und polieren; Unterseite mit PTFE-Folie, damit der Körper gleitet.
- **Kantensensor (Stufe 4):** 45 mm vor der Nadel. Er misst, wo die Ärmelkante liegt. Weil
  Ärmel und Körper dieselbe Farbe haben, eignet sich ein **Laser-Lichtschnittsensor** oder ein
  Laser-Distanzsensor über die 0,6-mm-Kante. Eine einfache Farbkamera eignet sich nicht. In der
  Simulation dient der Sensor nur der Überwachung.
- **Kamera (Stufe 4):** USB-Kamera mit fester Brennweite über der Ladeposition der Zuführung,
  Durchlicht durch eine Leuchtplatte. Mit OpenCV Konturerkennung, Abgleich mit der Schnittkontur
  (Procrustes wie im Modell), Korrektur der Startlage.

---

## 9. Steuerung und Elektrik

```
 PC (Python)  ── USB ──  Teensy 4.1 (Echtzeit, 1 kHz)
  Bahn laden               ├─ AS5600 (I²C): Nadelphase φ, Umdrehungszähler n
  Bedienung                ├─ MCP4725 (I²C) → Spannungsfolger → Pedal-Sollwert
  Protokoll                ├─ Step/Dir → 4 Treiber Portal (X, Y, C, Z)
                           ├─ Step/Dir → 4 Treiber Zuführung (X, Y, θ, Z)
                           ├─ MOSFET-Karte 24 V → 15 Kammerventile, 6 Fingerventile,
                           │                       Fußlüftung, Vakuum Haupt
                           └─ Eingänge: Endschalter, Not-Aus-Rückmeldung, Taster
 Sicherheitskreis (getrennt): Not-Aus-Relais → Treiber-Freigabe AUS, Pedal-Sollwert = Ruhe,
                              Ventile drucklos (Fuß hebt nicht unkontrolliert)
 Netzteile: 48 V / 10 A (Schrittmotoren), 24 V / 5 A (Ventile, Logik über 5 V-Regler)
```

### 9.1 Kern: elektronisches Getriebe zur Nadel
Die Achsen fahren nicht nach Zeit, sondern nach **Transportweg**. Genau so führt die Simulation
den Roboter (synchrones Mitführen).

```
jede Millisekunde:
  φ, n  ← Drehgeber                         # Winkel und Umdrehungen seit Nahtbeginn
  s     ← (n + f(φ)) · Stichlänge            # f(φ): kalibrierter Vorschubverlauf 0…1 je Stich
  k     ← s / Stichlänge                     # Zeile der Bahntabelle (gebrochen)
  Soll  ← lineare Interpolation in bahn_aermel.csv bei k
            (greif_x, greif_y, koerper_theta, zufuehr_x, zufuehr_y, aermel_theta)
  Achsen ← Soll                              # Schritte erzeugen (z. B. TeensyStep, Lageregelung)
  wenn k ≥ Abschaltstich der Kammer i:  Ventil i AUS (+ Finger heben, falls ↑)
  wenn φ im Bereich "Nadel im Stoff": Achsen nicht quer bewegen (nur Rest des Vorschubs)
```

- **Vorschub:** f(φ) ist außerhalb des Transportfensters konstant, sodass sich die Achsen nur
  bewegen, während der Transporteur schiebt. Dadurch zerren Portal und Transporteur nie
  gegeneinander.
- **Überwachung:**
  - Weicht die Lageabweichung einer Achse um mehr als 0,3 mm vom Sollwert ab: Sollwert sofort auf „Ruhe“, Nadel unten.
  - Fehlen Drehgeber-Impulse (Faden gerissen, Blockade): Stopp.

### 9.2 Ablauf eines Zyklus
1. Träger mit Körper an das Portal koppeln (Laden von Hand), Zuführung mit Ärmel laden.
2. Portal fährt den Nahtanfang 40 mm vor die Nadel, senkt ab und schiebt den Anfang unter den Fuß. Das entspricht `ALIGNPATH` / `MOVEREL` im Simulationsprogramm.
3. Zuführung fährt in die Startlage und senkt auf das Trennblech ab (`SLEEVEFEED ON`).
4. Fuß ab, 0,2 s warten.
5. Sollwert „Nähen 400/min“. Das elektronische Getriebe läuft bis 83 Stiche, dann Sollwert „Ruhe“ (Stopp Nadel unten).
6. Nadel hoch, Fuß hoch, alle Kammern aus, Zuführung hebt ab und fährt zurück.
7. Portal fährt den Träger heraus und entkoppelt.

---

## 10. Stückliste (Richtwerte, ohne Gewähr, Stand 2026)

| Baugruppe | Teile | Richtpreis |
|---|---|---|
| Portal Mechanik | Aluprofile 40×40/40×80, 4 Linearschienen MGN15, Riemen und Scheiben HTD-3M, Platten, Kreuzrollenlager | 450–800 € |
| Portal Antriebe | 3 × NEMA 23 Closed-Loop mit Treiber, Z-Zylinder mit Führung | 350–550 € |
| Zuführung Mechanik und Antriebe | 2 Schienen MGN12, 3 × NEMA 17 Closed-Loop mit Treiber, Ausleger, Z-Zylinder | 300–500 € |
| Vakuum | Seitenkanalverdichter oder Werkstattsauger, Verteiler, 15 × 3/2-Ventil, Schläuche | 250–600 € |
| Pneumatik | Wartungseinheit, 6 Mini-Zylinder Ø 10 mit Ventilen, Fußlüftungszylinder Ø 16 mit 5/2-Ventil, Drosseln (Kompressor vorhanden?) | 200–400 € |
| Elektronik | Teensy 4.1, MCP4725, AS5600 mit Magnet, MOSFET-Karte, Netzteile 48 V und 24 V, Not-Aus-Relais, Taster, Endschalter, Gehäuse, Kabel | 250–400 € |
| Teile nach Zeichnung | Träger (Laser), Trennblech (Laser), 3D-Druck-Material, PTFE-Folie, Klettband | 80–180 € |
| Maschine | PTFE-Fuß, SUK-Nadeln, Garn, ggf. Transporteur/Stichplatte für leichte Stoffe | 40–120 € |
| Stufe 4 | USB-Kamera, Leuchtplatte, Laser-Distanz- oder Lichtschnittsensor | 100–400 € |
| **Summe** | | **≈ 2 000–4 000 €** |

---

## 11. Inbetriebnahme Schritt für Schritt
1. **Maschine:** Einstellungen aus 4.1, Probenähte auf Jersey-Reststücken (2 Lagen).
   Stichlänge über 20 Stiche messen.
2. **Pedal Stufe 1** anbauen. Ruhe, Nähen und Stopp einlernen. 83 Stiche nach Zählung des
   Drehgebers, Stopp Nadel unten, zehnmal wiederholen: Stichzahl muss immer exakt stimmen.
3. **Vorschubverlauf** f(φ) messen (4.5).
4. **Portal:** Endschalter und Referenzfahrt. Mit einer Messuhr Spiel und
   Wiederholgenauigkeit je Achse messen. C-Achse: Messuhr 300 mm vom Drehpunkt, Ziel ≤ 0,1 mm.
5. **Träger trocken (ohne Stoff):** Bahn mit gestoppter Maschine abfahren, dabei das Handrad
   von Hand drehen. Prüfen: Nähfuß bleibt immer im Schlitz, keine Kollision.
6. **Stufe 2:** Körper auf den Träger, Sollinie aufgezeichnet, Naht bei 200/min, dann 400/min.
   Abweichung an 10 Stellen mit Messschieber messen (Mitte Stich ↔ Sollinie).
7. **Trennblech** einbauen, Höhe mit Fühlerlehre einstellen (2,0 mm). Träger mit Körper
   darunter von Hand durchschieben: nichts darf haken.
8. **Zuführung:** Bahn trocken abfahren. Prüfen: Finger heben rechtzeitig, kein Kontakt mit
   Fuß oder Nadelstange.
9. **Stufe 3:** Ärmel mit Passzeichen (alle 5 cm auf Körper und Ärmel, nach `schnittteile.svg`)
   annähen. Messen:
   - Stiche durch beide Lagen (von der Rückseite zählen),
   - Abstand der Passzeichen nach dem Nähen (zeigt die Verteilung der Mehrweite),
   - Ärmelnaht ↔ Kugelnaht-Linie.

## 12. Messprotokoll (je Teil)

| Größe | Soll (Simulation) | Messung |
|---|---|---|
| Stiche durch beide Lagen | 83 / 83 | |
| Abweichung Körper Ø / max. | ≤ 0,3 / ≤ 1,6 mm | |
| Abweichung Ärmel Ø / max. | ≤ 0,4 / ≤ 1,0 mm | |
| Mehrweite gesamt | 2,8–2,9 % | |
| Versatz Passzeichen Mitte Kugel | ≤ 2 mm | |
| Falten / Fältchen in der Naht | keine | |
| Zykluszeit Nähen | ≈ 12,5 s (83 Stiche bei 400/min) | |

Abweichungen von der Simulation sind die eigentlichen Ergebnisse des Prototyps. Mit ihnen kann
das Modell nachgeschärft werden: Reibwerte, Fußbremse, Biegesteifigkeit des Jerseys.

## 13. Sicherheit
- Nähmaschine und Achsen nur mit **Not-Aus in Griffweite** betreiben. Der Not-Aus schaltet den
  Pedal-Sollwert auf Ruhe und die Achstreiber stromlos.
- Beim Einrichten Portal und Zuführung auf ≤ 20 mm/s begrenzen (Software und Treiber).
- Hände nie im Bereich Nadel/Fuß, solange die Steuerung aktiv ist. Ein **Zustimmtaster**
  (Totmann) während der Testläufe hilft.
- Pneumatik mit Druckregler auf das Nötige begrenzen (Fußlüftung 3–4 bar, Finger 2–3 bar).
- Für einen Prototyp im Eigengebrauch reicht diese Grundabsicherung. Wird die Anlage von Dritten
  bedient oder weitergegeben, gelten Maschinenrichtlinie bzw. Maschinenverordnung mit
  Risikobeurteilung und Schutzeinrichtungen.

## 14. Risiken und Rückfallebenen

| Risiko | Anzeichen | Abhilfe |
|---|---|---|
| Fuß bremst den Ärmel (kein Obertransport) | Mehrweite < 2 %, Ärmel endet zu früh | Fußdruck senken, Zuführverhältnis in der Tabelle um 0,5–1 % erhöhen; sonst Maschine mit Differential-Obertransport (Abschnitt 0) |
| Jersey rollt sich an den Kanten | Kante steht vor dem Fuß hoch | Kanten leicht anfeuchten oder mit Sprühstärke fixieren; Platte bis 18 mm vor die Nadel |
| Klettband hält nicht | Körper verschiebt sich auf dem Träger | Kratzenband; mehr Haltefläche |
| Spiel in der C-Achse | Abweichung wächst mit dem Drehwinkel | spielfreier Riemen vorgespannt, Harmonic-Getriebe |
| Synchronisation | Stoff wird zwischen Portal und Transporteur gedehnt | Vorschubverlauf f(φ) genauer messen; nachgiebige Kupplung (± 1 mm in Y) am Griffpunkt |
| Kammern zu grob | Ärmel wird kurz vor der Nadel nicht mehr geführt | kleineres Raster (Skript: `CELL`), die Simulation kann das vorab prüfen |

---

*Zugehörige Simulation:* Szenario „T-Shirt, Ärmel einsetzen“ ([aermel-einsetzen.md](aermel-einsetzen.md)).
*Fertigungsunterlagen neu erzeugen:* `node tools/prototyp-export.mjs`
