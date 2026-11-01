# Automatische Produktionsstraße T-Shirt

Vom Stoffballen bis zum verpackten Shirt: eine vollautomatische Linie für ein Kinder-T-Shirt
(Gr. 86, Single Jersey). Sie baut auf den Techniken auf, die in der Nähzelle physikalisch
simuliert und validiert sind: Vereinzeln mit Nadelgreifern, robotergeführtes Nähen von
Kurvennähten, Werkstückträger mit Nadelleisten und Ärmelzuführung mit Mehrweite.

In der Oberfläche oben rechts auf **Produktionsstraße** umschalten (oder `index.html#linie`).

## Was die Simulation ist und was nicht

Die Linie ist ein **digitaler Zwilling als ereignisdiskrete Simulation (DES)**. Jedes Shirt ist
ein Auftrag, der auf einem Werkstückträger durch die Stationen läuft. Die Zykluszeiten werden
nicht geschätzt, sondern aus der Geometrie der Schnittteile und den Prozessgrenzen berechnet:

```
Zykluszeit = Handling + Σ Nähte ( Nahtlänge / (Drehzahl/60 · Stichlänge) + 0,7 s )
Drehzahl   = min( n_max, 60 · ω_max / (κ_max · Stichlänge) )   bei Kurvennähten
```

ω_max ist die Drehgeschwindigkeit der C-Achse beim Drehen des Teils um die Nadel, κ_max die
größte Krümmung der Naht. Mit 2 rad/s und 2,5 mm Stich ergibt das zum Beispiel für die Seitennaht
mit Achselrundung (κ = 25 1/m) etwa 1 920 Stiche/min.

Die Stoffphysik (XPBD, Kontakt, Reibung, Greifer) rechnet die Nähzelle. In der Linie wird sie
nicht an jeder Station neu gerechnet, das wäre in Echtzeit nicht möglich. Die Stationen
„Ärmel einsetzen“ und „Seitennaht“ verweisen über **Physik** in der Stationstabelle auf das
passende Szenario in der Nähzelle, in dem genau dieser Schritt physikalisch nachgewiesen ist.

## Ablauf

| # | Bereich | Station | Technik | Zyklus |
|---|---|---|---|---|
| 1 | Zuschnitt | Stoffrollenregal, Legemaschine | 20 Lagen à 1,19 m, Kantensteuerung, Spannungsfrei legen | 5,0 s je Lage |
| 2 | Zuschnitt | CNC-Cutter | Vakuumtisch mit Folie, oszillierendes Messer, Schnittkontur 23,7 m | 157 s je Stapel |
| 3 | Zuschnitt | Abnahmetisch | Schnittbild mit 6 Shirts (66 % Ausnutzung) | – |
| 4 | Kommissionierung | 2 Roboter mit Nadelgreifern | Vereinzeln der obersten Lage, Ablage aller Teile eines Shirts auf einen Werkstückträger | 6,5 s je Shirt |
| 5 | Nähen | Schulternaht rechts | Overlock, gerade | 7,5 s |
| 6 | Nähen | Halsbündchen annähen | Overlock, Bündchen 15 % kürzer, Obertransport dehnt es | 12,6 s |
| 7 | Nähen | Schulternaht links | Overlock, schließt den Kragen | 7,7 s |
| 8 | Nähen | Ärmel einsetzen links / rechts | Steppstich, Werkstückträger + Ärmelzuführung, flach eingesetzt | je 13,4 s |
| 9 | Nähen | Ärmel- und Saumnaht | Coverstich, 2 Ärmelsäume + Saum | 20,2 s (Engpass) |
| 10 | Handling | Falten an der Schulter | Klappe faltet das Vorderteil auf das Rückenteil | 7,0 s |
| 11 | Nähen | Seitennaht links / rechts | Overlock, Seite + Achselrundung + Ärmelunterkante in einem Zug | je 13,7 s |
| 12 | Finish | Wenden | Rohrwender bläst das Shirt auf rechts | 7,5 s |
| 13 | Finish | Fäden kappen, Kameraprüfung | Absaugung, Durchlichtkamera | 6,0 s |
| 14 | Finish | Bügeln und Falten | Dampfpresse mit Faltklappen, 2 Maschinen | 15,0 s |
| 15 | Finish | Verpacken | Folienbeutel, Schweißbalken, Palette | 7,0 s |

Theoretischer Takt mit Standardwerten: 20,2 s, also rund **178 Shirts pro Stunde**. Im
eingeschwungenen Zustand erreicht die Simulation mit Fadenbrüchen (0,4 % je Naht, 45 s
automatisches Einfädeln) und Streuung der Handlingzeiten 170 bis 180 Stück pro Stunde.

## Transfersystem

- Hauptband mit 0,25 m/s und Werkstückträgern (0,70 m) im Abstand von 2,8 m.
- Jede Station sitzt auf einer **Stichstrecke** mit getrennter Ein- und Ausschleusung. So kann
  ein fertiger Träger die Station verlassen, auch wenn sich davor ein Träger staut (ohne diese
  Trennung blockiert sich die Linie gegenseitig).
- Leere Träger laufen über ein Rückband mit Hubstationen zur Kommissionierung zurück.
- Die Zahl der Träger begrenzt den Umlaufbestand. Nach dem Gesetz von Little gilt
  Ausbringung = Umlaufbestand / Durchlaufzeit. Mit nur 6 Trägern sinkt die Ausbringung auf
  etwa 60 Stück pro Stunde.

## Kennzahlen in der Oberfläche

- **Ausbringung**: Stück pro Stunde über die letzten 10 Minuten, dazu der theoretische Wert.
- **Taktzeit und Engpass**: langsamste Station (Zykluszeit / Maschinenzahl), Legen,
  Schneiden und Kommissionieren mitgerechnet.
- **Durchlaufzeit und Umlaufbestand**: vom Aufsetzen auf den Träger bis zum Verpacken.
- **Auslastung je Station**: arbeitet (grün), blockiert (orange, Ausgang belegt),
  Störung (rot, Fadenbruch), wartet auf Teile (grau).

Mit dem Feld **Masch.** in der Stationstabelle lässt sich eine Station verdoppeln. Wird die
Coverstation verdoppelt, steigt die Ausbringung auf etwa 198 Stück pro Stunde, und die
Seitennaht wird zum neuen Engpass.

## 3D-Ansicht

Die Ansicht zeigt jede Station mit Roboter, Maschine, Schutzzaun, Schaltschrank und
Signalsäule (grün arbeitet, gelb wartet, rot Störung). Das Shirt ist in jedem Zustand als
eigenes Modell zu sehen: Einzelteile, Schultern geschlossen, Bündchen, eingesetzte Ärmel,
gesäumt, gefaltet, geschlossen, gewendet, gebügelt, verpackt. An den Nähstationen wird das Teil
entlang der echten Nahtbahn unter der Nadel geführt, wie in der Nähzelle.

Kameras: Gesamtansicht, Legen und Zuschnitt, Kommissionierung, jede einzelne Station und
„Werkstückträger verfolgen“.

## Tests

```bash
node tests/line.mjs
```

Prüft die Nahtlängen, die Ausnutzung des Schnittbilds, den Durchsatz gegenüber dem theoretischen
Takt, ob die Linie ohne Stau läuft, die Wirkung einer verdoppelten Engpassstation und die
Begrenzung durch zu wenige Werkstückträger.

## Grenzen

- Handlingzeiten sind Planwerte aus vergleichbaren Roboterzellen, keine gemessenen Werte.
- Wenden, Bügeln und Verpacken sind als Zeitmodelle abgebildet, nicht als Stoffsimulation.
- Rüsten, Größenwechsel, Schichtmodell und Materialnachschub (Garn, Folie) sind nicht enthalten.
