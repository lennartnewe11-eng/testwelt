# Einkaufsliste Prototyp „Ärmel einsetzen“ (Zoje A6000)

Zur Bauanleitung [prototyp-aermel-a6000.md](prototyp-aermel-a6000.md). Dieselbe Liste als Tabelle für Excel/Numbers: [`prototyp/einkaufsliste.csv`](../prototyp/einkaufsliste.csv).

**Preise:** Richtwerte in Euro inkl. MwSt., von–bis je Stück. Die untere Grenze entspricht Importware vom Marktplatz, die obere Markenware vom Fachhandel. Es sind Schätzungen, keine Angebote; vor dem Bestellen aktuelle Preise prüfen. Die Nähmaschine selbst, ein Rechner, ein 3D-Drucker und Handwerkzeug sind nicht enthalten.

**Spalte „ab Stufe“:** Die Teile werden erst in der genannten Ausbaustufe gebraucht. So lässt sich schrittweise bestellen.

## Summen

| Gruppe | Pflichtteile | optionale Teile |
|---|---|---|
| A – Nähmaschine: Zubehör und Verbrauch | 58–115 € | 15–35 € |
| B – Maschinenanbau: Fußlüftung, Pedal, Drehgeber | 135–324 € | 3–8 € |
| C – Gleitfläche und Gestell | 237–438 € | – |
| D – Werkstückträger und Kalibrierplatte | 74–141 € | 30–70 € |
| E – Körperportal X-Y-C-Z | 491–1.126 € | – |
| F – Ärmelzuführung X-Y-θ-Z mit Platte und Klappfingern | 456–1.097 € | – |
| G – Trennblech | 23–52 € | 25–60 € |
| H – Steuerung und Elektrik | 281–607 € | 35–80 € |
| I – Pneumatik-Versorgung | 36–65 € | 110–220 € |
| J – Messen, Einrichten, Stufe 4 (Kamera, Sensor) | 103–226 € | 110–260 € |
| **Gesamt** | **1.894–4.190 €** | 328–733 € |

### Nach Ausbaustufe (Pflichtteile, aufsummiert)

| bis einschließlich | zusätzlich nötig | Summe bis hier |
|---|---|---|
| Stufe 1 | 327–701 € | 327–701 € |
| Stufe 2 | 1.028–2.206 € | 1.355–2.906 € |
| Stufe 3 | 492–1.179 € | 1.847–4.085 € |
| Stufe 4 | 47–105 € | 1.894–4.190 € |

## A – Nähmaschine: Zubehör und Verbrauch

Bezug: Nähmaschinen-Fachhandel.

| Pos. | Teil | Spezifikation | Menge | Stückpreis | ab Stufe | Hinweis |
|---|---|---|---|---|---|---|
| A1 | Nähfuß mit PTFE-Sohle (Teflonfuß) | Standard-Steppstichfuß für Industrie-Flachbett, Schaftbefestigung, z. B. Typ T35/MT-18 | 1 | 5–12 € | 1 | bremst die obere Lage weniger; Zehenlänge vor der Nadel messen (≤ 16 mm) |
| A2 | Maschinennadeln Kugelspitze | System DB×1 / 16×231 / 1738, SUK, Nm 70, 10 Stück | 1 | 4–8 € | 1 | Maschenware; Nadelsystem am Typenschild prüfen |
| A3 | Maschinennadeln Kugelspitze | wie oben, Nm 75, 10 Stück | 1 | 4–8 € | 1 | Ausweichstärke |
| A4 | Nähgarn | Polyester-Umspinnzwirn Nm 120 (Tex 25), Kone 5 000 m, Farbe kontrastierend | 2 | 6–14 € | 1 | Ober- und Unterfaden; Kontrastfarbe erleichtert das Messen |
| A5 | Spulen | passend zum Greifer der A6000 (Standard-Steppstichspule Alu) | 5 | 0,50–1,50 € | 1 |  |
| A6 | Single Jersey | 95 % CO / 5 % EL, ≈ 180 g/m², 150 cm breit | 3 | 9–15 € | 2 | Meterware; reicht für rund 25 Körper und Ärmel |
| A7 | Sprühstärke | Bügelhilfe/Sprühstärke 400 ml | 1 | 3–6 € | 3 | gegen das Einrollen der Schnittkanten |
| A8 | Transporteur und Stichplatte fein *(optional)* | Ausführung für leichte Stoffe passend zur A6000 | 1 | 15–35 € | 3 | nur wenn der Standard-Transporteur den Jersey markiert |

## B – Maschinenanbau: Fußlüftung, Pedal, Drehgeber

Bezug: Pneumatik- und Elektronik-Versand.

| Pos. | Teil | Spezifikation | Menge | Stückpreis | ab Stufe | Hinweis |
|---|---|---|---|---|---|---|
| B1 | Pneumatikzylinder Fußlüftung | doppeltwirkend, Ø 25 mm, Hub 30 mm, ISO 6432 oder Kompaktbauform, mit Gabelkopf und Schwenkbefestigung | 1 | 18–40 € | 1 | wirkt auf das Kniehebelgestänge; Hub per Anschlag auf 8 mm Fußhub begrenzen |
| B2 | 5/2-Wegeventil | 24 V DC, G1/8, monostabil mit Federrückstellung, mit Stecker | 3 | 12–25 € | 1 | Fußlüftung, Z-Hub Portal, Z-Hub Zuführung |
| B3 | Drosselrückschlagventil | G1/8 auf Schlauch 6 mm, Abluftdrosselung | 6 | 3–6 € | 1 | je Zylinder zwei: sanftes Aufsetzen |
| B4 | Stellantrieb für das Pedal (Stufe 1) | Modellbau-Servo ≥ 35 kg·cm, Metallgetriebe (z. B. DS3235), mit Servohebel aus Alu | 1 | 18–30 € | 1 | bewegt das Originalpedal; kein Eingriff in die Elektrik |
| B5 | Gestänge Pedal | Gewindestange M4 200 mm, 2 Kugelgelenkköpfe M4, Winkel | 1 | 6–12 € | 1 |  |
| B6 | Drehgeber inkremental | 600 Impulse/U mit Nullimpuls (A, B, Z), 5–24 V, Welle Ø 6 mm (z. B. Bauart E6B2-CWZ) | 1 | 20–95 € | 1 | koaxial am Handrad; unempfindlich gegen das Magnetfeld des Direktantriebs |
| B7 | Wellenkupplung | flexibel (Balg oder Klauen), 6 × 6 mm | 1 | 4–10 € | 1 | Handrad-Adapter ↔ Drehgeber |
| B8 | Halter Drehgeber | Alu-Winkel 50 × 50 × 4, 150 mm, oder 3D-Druck | 1 | 3–6 € | 1 |  |
| B9 | Magnetischer Winkelsensor *(optional)* | AS5600-Modul mit diametralem Magnet 6 × 2,5 mm | 1 | 3–8 € | 1 | billige Alternative zum Drehgeber; erst bei laufendem Motor auf Störungen prüfen |
| B10 | Pedal-Sollwert elektrisch (Stufe 2) | DAC MCP4725 (Breakout), Operationsverstärker MCP6002, Signalrelais 5 V 2 Wechsler, Lochrasterplatine | 1 | 12–20 € | 2 | erst nach dem Ausmessen des Pedalsteckers; Umschalter Pedal/Rechner vorsehen |

## C – Gleitfläche und Gestell

Bezug: Baumarkt, Profil-Versand.

| Pos. | Teil | Spezifikation | Menge | Stückpreis | ab Stufe | Hinweis |
|---|---|---|---|---|---|---|
| C1 | Tischerweiterung vorn | Spanplatte melaminbeschichtet oder Multiplex 19 mm, 1250 × 400 mm | 1 | 15–30 € | 2 | bündig mit Tisch und Maschinenbett; der Körper schwenkt 47 cm vor die Nadel |
| C2 | Tischerweiterung hinten und links | wie oben, 1250 × 450 mm und 450 × 600 mm | 2 | 15–30 € | 2 | 47 cm hinter und 31 cm links der Nadel werden überstrichen |
| C3 | Tischverbinder und Stützwinkel | Flachverbinder, 4 Konsolen 300 mm, Schrauben | 1 | 15–30 € | 2 |  |
| C4 | PTFE-Glasgewebe-Klebeband | 50 mm × 10 m, 0,13 mm | 1 | 14–28 € | 2 | über alle Fugen und die Kante zum Maschinenbett |
| C5 | Aluprofil 40 × 40 Nut 8 | Zuschnitte: 4 × 1 300 mm (Stützen), 2 × 1 300 mm, 2 × 1 100 mm (Rahmen oben) | 9,6 | 9–16 € | 2 | Preis je Meter; eigenes Gestell über dem Tisch, nicht auf der Tischplatte |
| C6 | Aluprofil 40 × 80 Nut 8 | 2 × 700 mm (Träger der Y-Achse), 1 × 600 mm (Brücke) | 2 | 16–28 € | 2 | Preis je Meter |
| C7 | Winkel, Nutensteine, Schrauben | 24 Winkel 40 × 40, 100 Nutensteine M6, 100 Schrauben M6 × 16, 4 Stellfüße M8 | 1 | 45–80 € | 2 |  |

## D – Werkstückträger und Kalibrierplatte

Bezug: Kunststoffhandel, Laserservice.

| Pos. | Teil | Spezifikation | Menge | Stückpreis | ab Stufe | Hinweis |
|---|---|---|---|---|---|---|
| D1 | Polycarbonat-Platte | 1,5 mm, 750 × 500 mm, klar | 3 | 10–20 € | 2 | Träger, Kalibrierplatte, Reserve; Zuschnitt nach traeger.svg (Stichsäge, Fräse oder Laserservice) |
| D2 | PTFE-Klebefolie | 0,13–0,25 mm, 300 mm × 2 m | 1 | 20–35 € | 2 | Unterseite des Trägers |
| D3 | Sprühkleber wieder ablösbar | Textil-Sprühzeitkleber (z. B. Odif 505), 250 ml | 1 | 10–18 € | 2 | hält den Jersey flach auf dem Träger, trägt nicht auf |
| D4 | Zentrierstifte und Bohrbuchsen | Zylinderstifte Ø 6 m6 und Ø 4 m6, je 2; Bundbohrbuchsen Ø 6 und Ø 4, je 2 | 1 | 8–16 € | 2 | Kupplung Portal ↔ Trägerlasche |
| D5 | Topfmagnet | Neodym Ø 20 mm mit Gewinde M4, ≈ 9 kg; Stahlscheibe Ø 25 mm | 2 | 3–6 € | 2 | hält die Kupplung zusammen |
| D6 | Laserzuschnitt Träger *(optional)* | Kontur nach traeger.svg und kalibrierplatte.svg in PC 1,5 mm oder Alu 1 mm | 1 | 30–70 € | 2 | statt Selbstzuschnitt; genauer |

## E – Körperportal X-Y-C-Z

Bezug: CNC-Zubehör-Versand.

| Pos. | Teil | Spezifikation | Menge | Stückpreis | ab Stufe | Hinweis |
|---|---|---|---|---|---|---|
| E1 | Linearmodul mit Kugelgewindetrieb | Hub 400 mm, Steigung 5 mm (1605), Profilschienen- oder Doppelwellenführung, Flansch NEMA 23 (Bauart FSL40/FSK40) | 2 | 85–160 € | 2 | X- und Y-Achse des Portals |
| E2 | Linearführung für die zweite Seite | Profilschiene MGN15, 500 mm, mit Wagen MGN15H | 1 | 20–45 € | 2 | stützt die Brücke gegenüber dem Y-Modul |
| E3 | Closed-Loop-Schrittmotor mit Treiber | NEMA 23, 2 Nm, Geber 1 000 Striche, Treiber HBS57/CL57T, Kabel 3 m | 3 | 45–110 € | 2 | X, Y, C |
| E4 | Hohlwellen-Drehtisch | Baugröße 60–85, Untersetzung 10:1, Umkehrspiel ≤ 3 Winkelminuten, Flansch passend zum Motor | 1 | 110–300 € | 2 | C-Achse; Datenblatt: „Umkehrspiel“ prüfen, nicht nur „Wiederholgenauigkeit“ |
| E5 | Führungszylinder Z | Kompaktschlitten oder Zwillingskolben Ø 16 mm, Hub 40 mm | 1 | 20–45 € | 2 | hebt die Kupplung vom Träger |
| E6 | Z-Säule | Alu-Rundrohr Ø 30 × 3 mm, 300 mm; 2 Klemmflansche | 1 | 10–20 € | 2 | vom Drehtisch nach unten zur Kupplung |
| E7 | Kupplungsplatte | Alu 8 mm, 80 × 60 mm, für Stifte und Magnet | 1 | 4–10 € | 2 |  |
| E8 | Induktiver Näherungsschalter | M8 oder M12, NPN Schließer, 10–30 V, Schaltabstand 2–4 mm | 4 | 3–9 € | 2 | Referenz X, Y, C und Z oben |
| E9 | Energiekette | 10 × 15 mm, 1 m | 2 | 5–10 € | 2 |  |

## F – Ärmelzuführung X-Y-θ-Z mit Platte und Klappfingern

Bezug: CNC-Zubehör, Modellbau, 3D-Druck.

| Pos. | Teil | Spezifikation | Menge | Stückpreis | ab Stufe | Hinweis |
|---|---|---|---|---|---|---|
| F1 | Linearmodul mit Kugelgewindetrieb | Hub 150 mm und Hub 250 mm, Steigung 4–5 mm, Flansch NEMA 17 oder 23 | 2 | 60–130 € | 3 | X und Y der Zuführung; steht links neben dem Tisch auf dem Gestell |
| F2 | Closed-Loop-Schrittmotor mit Treiber | NEMA 17 (0,5–0,7 Nm) oder NEMA 23, Geber 1 000 Striche | 3 | 40–100 € | 3 | X, Y, θ |
| F3 | Hohlwellen-Drehtisch klein | Baugröße 42–60, Untersetzung 10:1, Umkehrspiel ≤ 3 Winkelminuten | 1 | 90–260 € | 3 | θ-Achse am Ende des Auslegers |
| F4 | Führungszylinder Z | Ø 12–16 mm, Hub 30 mm | 1 | 18–40 € | 3 | senkt die Platte auf das Trennblech |
| F5 | Ausleger | Alu-Rechteckrohr 50 × 30 × 3 mm, 600 mm | 1 | 8–16 € | 3 | biegesteif: an der Spitze ≤ 0,2 mm Durchbiegung |
| F6 | Grundplatte | Alu 5 mm, 260 × 160 mm (Kontur nach aermelplatte.svg) oder 3D-Druck PETG 6 mm | 1 | 8–30 € | 3 |  |
| F7 | Filament | PETG 1,75 mm, 1 kg | 1 | 18–28 € | 3 | Klappfinger, Servohalter, Adapter |
| F8 | Mikroservo | 9–13 g, Metallgetriebe (Bauart MG90S), 180° | 12 | 3–6 € | 3 | 11 Klappfinger + 1 Reserve |
| F9 | Servotreiber | PCA9685, 16 Kanäle, I²C | 1 | 5–12 € | 3 |  |
| F10 | Netzteil Servos | 5 V / 10 A | 1 | 10–20 € | 3 | eigene Versorgung, nicht aus dem Teensy |
| F11 | Scharnierstifte und Gestänge | Edelstahlstift Ø 2 mm, 1 m; Federstahldraht Ø 1 mm, 1 m | 1 | 4–8 € | 3 |  |
| F12 | Moosgummi selbstklebend | Zellkautschuk oder Silikonschaum 1 mm, 200 × 300 mm | 2 | 5–12 € | 3 | Reibbelag unter Platte und Fingern |
| F13 | Induktiver Näherungsschalter | wie Gruppe E | 3 | 3–9 € | 3 | Referenz X, Y, θ |

## G – Trennblech

Bezug: Metallhandel, Laserservice.

| Pos. | Teil | Spezifikation | Menge | Stückpreis | ab Stufe | Hinweis |
|---|---|---|---|---|---|---|
| G1 | Federstahlblech | 1.4310, 0,3 mm, mindestens 300 × 300 mm, blank | 1 | 12–30 € | 3 | Kontur nach trennblech.svg; Blechschere genügt, Kanten polieren |
| G2 | Halter Trennblech | Alu-Flach 30 × 5 mm, 400 mm; 2 Rändelschrauben M5; Distanzscheiben | 1 | 6–12 € | 3 | greift von vorn oben; Höhe einstellbar |
| G3 | Polierpaste und Schleifvlies | fein | 1 | 5–10 € | 3 | Blechoberseite und Kante zur Nadel |
| G4 | Laserzuschnitt Trennblech *(optional)* | nach trennblech.svg in 1.4310 0,3 mm | 1 | 25–60 € | 3 | statt Selbstzuschnitt |

## H – Steuerung und Elektrik

Bezug: Elektronik-Versand, Elektro-Großhandel.

| Pos. | Teil | Spezifikation | Menge | Stückpreis | ab Stufe | Hinweis |
|---|---|---|---|---|---|---|
| H1 | Mikrocontroller | Teensy 4.1 mit Stiftleisten | 1 | 35–45 € | 1 | Echtzeit: Drehgeber, Schritterzeugung, Abläufe |
| H2 | Klemmenplatine | Schraubklemmen-Adapter für Teensy 4.1 | 1 | 10–22 € | 1 |  |
| H3 | Pegelwandler Ausgänge | 74HCT245 oder fertige 8-Kanal-Platine 3,3 V → 5 V | 3 | 2–8 € | 2 | Teensy liefert 3,3 V, die Treibereingänge brauchen 5 V |
| H4 | Optokoppler-Eingangsplatine | 8 Kanäle, 24 V → 3,3 V | 2 | 6–14 € | 1 | Drehgeber, Näherungsschalter, Taster; Teensy ist nicht 5-V-fest |
| H5 | MOSFET-Schaltplatine | 4 Kanäle, 24 V, mit Optokoppler und Freilaufdiode | 1 | 6–12 € | 1 | Ventile |
| H6 | Netzteil 48 V | 48 V / 10 A (≈ 480 W), Schaltnetzteil im Gehäuse | 1 | 40–90 € | 2 | Schrittmotoren |
| H7 | Netzteil 24 V | 24 V / 5 A (≈ 120 W) | 1 | 18–35 € | 1 | Ventile, Sensoren |
| H8 | Not-Aus-Taster | Pilztaster rot/gelb, 2 Öffner, im Aufbaugehäuse | 1 | 10–20 € | 1 |  |
| H9 | Sicherheitsrelais | Not-Aus-Schaltgerät 24 V, zweikanalig (z. B. Bauart PNOZ X oder gleichwertig) | 1 | 50–150 € | 2 | schaltet Treiber-Freigabe und Pedal-Sollwert ab |
| H10 | Zustimmtaster *(optional)* | dreistufig, 2 Schließer | 1 | 35–80 € | 2 | für das Einrichten mit den Händen in Maschinennähe |
| H11 | Montageplatte und Hutschiene | Stahlblech 400 × 500 mm, Hutschiene 1 m, Verdrahtungskanal 2 m, 30 Reihenklemmen, Leitungsschutzschalter C6 | 1 | 45–90 € | 2 |  |
| H12 | Leitungen und Stecker | Steuerleitung geschirmt 4 × 0,5 mm² 15 m, Litze 0,5 mm² 5 Farben, Aderendhülsen, 8 Rundstecker 4-polig | 1 | 40–70 € | 2 |  |
| H13 | Bedientaster | Leuchttaster grün/rot/gelb 22 mm | 3 | 3–7 € | 1 | Start, Stopp, Quittieren |

## I – Pneumatik-Versorgung

Bezug: Pneumatik-Versand, Baumarkt.

| Pos. | Teil | Spezifikation | Menge | Stückpreis | ab Stufe | Hinweis |
|---|---|---|---|---|---|---|
| I1 | Wartungseinheit | Filter-Druckregler G1/4 mit Manometer | 1 | 18–35 € | 1 |  |
| I2 | Schlauch und Verschraubungen | PU-Schlauch 6 mm 10 m; Steckverschraubungen G1/8 und T-Stücke, Sortiment | 1 | 18–30 € | 1 |  |
| I3 | Kompressor *(optional)* | ölfrei, leise, 24 l, ≥ 6 bar | 1 | 110–220 € | 1 | nur falls keine Druckluft vorhanden; Verbrauch ist gering |

## J – Messen, Einrichten, Stufe 4 (Kamera, Sensor)

Bezug: Werkzeughandel, Elektronik-Versand.

| Pos. | Teil | Spezifikation | Menge | Stückpreis | ab Stufe | Hinweis |
|---|---|---|---|---|---|---|
| J1 | Messuhr mit Magnetstativ | Ablesung 0,01 mm, Messweg 10 mm | 1 | 25–45 € | 1 | Vorschubverlauf, Spiel und Wiederholgenauigkeit der Achsen |
| J2 | Fühlerlehre und Stahlmaßstab | Fühlerlehre 0,05–1 mm; Stahlmaßstab 300 mm; Messschieber | 1 | 15–40 € | 1 | falls nicht vorhanden |
| J3 | Markierstift selbstlöschend | Trickmarker für Textil | 2 | 3–6 € | 2 | Sollinie und Passzeichen |
| J4 | Linienlaser | Kreuzlinien-Lasermodul 650 nm, 5 mW, fokussierbar, 5 V | 2 | 5–12 € | 3 | zeigt beim Auflegen von Hand die Sollage des Ärmels |
| J5 | USB-Kamera | 1080p, manueller Fokus, Objektiv 6–8 mm | 1 | 35–80 € | 4 | Lagekorrektur des Ärmels |
| J6 | LED-Leuchtplatte | A4, dimmbar | 1 | 12–25 € | 4 | Durchlicht für die Konturerkennung |
| J7 | Laser-Distanzsensor *(optional)* | Triangulation, Messbereich ≈ 30 ± 5 mm, Auflösung ≤ 0,05 mm, Analog- oder IO-Link-Ausgang | 1 | 110–260 € | 4 | Kantensensor über die 0,6-mm-Stufe (gleiche Stofffarbe) |

## Selbst anzufertigen (kein Kauf)

| Teil | Vorlage | Verfahren |
|---|---|---|
| Werkstückträger mit Lasche | `prototyp/traeger.svg` | PC 1,5 mm sägen/fräsen oder Laserservice |
| Kalibrierplatte | `prototyp/kalibrierplatte.svg` | wie Träger, Löcher Ø 1,5 mm bohren |
| Trennblech | `prototyp/trennblech.svg` | Blechschere, Kanten polieren |
| Grundplatte und 11 Klappfinger | `prototyp/aermelplatte.svg` | Alu sägen bzw. 3D-Druck |
| Handrad-Adapter für den Drehgeber | nach Maß am Handrad | 3D-Druck oder Drehteil |
| Hebel der Fußlüftung | nach Maß am Kniehebelgestänge | Alu-Flach 30 × 6 mm |
| Zuschnitte Körper und Ärmel | `prototyp/schnittteile.svg` | 1:1 drucken, zuschneiden |
