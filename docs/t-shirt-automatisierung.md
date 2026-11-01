# Weg zum automatisch genähten T-Shirt

Lösungsweg für komplette Teile mit Kurvennähten am Beispiel eines T-Shirts. Teile davon
sind in der Simulation umgesetzt (Szenario „T-Shirt, Kurvennaht“).

## 1. Das Problem zerlegen: so lange wie möglich flach nähen

Ein T-Shirt besteht aus Vorderteil, Rückenteil, zwei Ärmeln und einem Halsbündchen. Schwer
zu automatisieren sind nicht die Nähte an sich, sondern zwei Dinge:

1. **Biegeschlaffes Material**: Jersey rollt an den Kanten, dehnt sich beim Greifen und hängt über.
2. **Dreidimensionale Form**: Sobald das Teil zur Röhre geschlossen ist, kann man es nicht
   mehr flach unter die Nadel legen.

Daraus folgt die wichtigste Regel: **Nähfolge so wählen, dass das Teil möglichst lange flach
bleibt** und erst ganz am Ende geschlossen wird („Flachbauweise“):

| Schritt | Naht | Geometrie | Automatisierung |
|---|---|---|---|
| 1 | Schulternähte | gerade, flach | einfach: Kantenführung, gerade Naht |
| 2 | Halsbündchen | Kurve, flach (eine Schulter bleibt offen oder Bündchen im Rund) | Schablone oder Kantenführung mit Differentialtransport |
| 3 | Ärmel einsetzen | Kurve konvex gegen konkav, Mehrweite einhalten | **in der Simulation umgesetzt**: Werkstückträger + Ärmelzuführung + Obertransport ([aermel-einsetzen.md](aermel-einsetzen.md)) |
| 4 | Ärmel- und Saum flach vorversäubern | gerade | Covermaschine, flach vor dem Schließen |
| 5 | Seitennaht + Ärmelunternaht in einem Zug | Kurve (Achselrundung), flach | **in der Simulation umgesetzt** |
| 6 | Saum (falls nicht in Schritt 4) | Röhre | Röhrenführung oder Roboter mit Nähkopf |

## 2. Wie man eine Kurvennaht automatisch näht

Eine Nähmaschine transportiert den Stoff nur geradeaus. Für eine Kurve muss das Teil während
des Nähens **um die Nadel gedreht** werden, sodass die Nahttangente immer in
Transportrichtung zeigt. Drei bewährte Wege:

**a) Schablonennähautomat** (Industriestandard bei Taschen, Kragen, Manschetten)
Das Teil wird in eine teilespezifische Schablone (zwei Platten mit Nahtschlitz) eingelegt. Eine
CNC-Achse (X, Y, Drehung) führt die Schablone unter der feststehenden Nadel. Die Schablone
hält den Stoff flach und formtreu, Kantenrollen und Überhang spielen keine Rolle.
Nachteil: eine Schablone je Teil und Größe.

**b) Roboter mit Schablone** (so in der Simulation)
Wie a), aber ein Roboter übernimmt Laden, Transport und Führung. Die Schablone bleibt als
Werkstückträger am Teil und wandert von Station zu Station. Das Ergebnis der Simulation
(Kinder-T-Shirt, Jersey, Seitennaht mit Achselrundung, 39 cm, 130 Stiche):
mittlere Abweichung der Einstiche von der Sollbahn rund 1,2 mm, maximal rund 3 mm.

**c) Roboter mit Kamera-Kantenführung** (ohne Schablone)
Eine Kamera oder ein Kantensensor vor der Nadel misst laufend den Abstand Naht ↔ Schnittkante;
der Regler korrigiert die Drehachse. Flexibler (keine Schablonen), aber empfindlich bei
weichen, rollenden Kanten. Ohne Rückführung zeigt die Simulation, warum: Mit einem
Nadelgreifer hängt der Jersey 5–8 cm über, landet beim Ablegen verschoben und der Nahtanfang
liegt um mehrere Zentimeter daneben.

## 3. Bausteine für Maschenware

- **Vereinzeln**: Nadelgreifer mit auf die Stoffdicke abgestimmter Einstichtiefe. Vakuum ist für
  Jersey ungeeignet (zu luftdurchlässig, die Simulation zeigt „Haltekraft zu gering“).
- **Paarweise greifen**: Vorder- und Rückenteil werden im Zuschnitt rechts auf rechts geschnitten
  und gemeinsam gegriffen. Dann liegen sie für die Seitennaht schon deckungsgleich.
- **Kantenrollen**: Kantenglätter, Luftdüsen oder temporäres Versteifen (wasserlösliches Polymer,
  das Teil wird wie Blech gehandhabt und später ausgewaschen).
- **Mehrweite beim Ärmel**: Differentialtransport (Ober- und Untertransport getrennt geregelt).
- **Geschlossene Nähte**: Nähkopf am Roboterarm mit einer Form (Torso) als Vorrichtung, oder
  Nähte vermeiden: Komplettstrick (WholeGarment-Strickmaschinen), Ultraschall- oder Laserschweißen.

## 4. Vorschlag Zellenaufbau

```
 Zuschnitt ─▶ [1 Vereinzeln + Kamera-Lageerkennung] ─▶ [2 Schulter + Bündchen, gerade/Kantenführung]
            ─▶ [3 Ärmel einsetzen, Schablone + Differentialtransport]
            ─▶ [4 Seite + Ärmel links | rechts, Roboter + Schablone]  ─▶ [5 Saum, Röhrenführung]
 Transport zwischen den Stationen auf Werkstückträgern (die Schablone bleibt am Teil)
```

Taktzeit-Abschätzung aus der Simulation für Station 4: rund 20 s je Seite bei 500 min⁻¹ und
3 mm Stichlänge (Greifen, Positionieren, 39 cm Naht, Ablegen). Mit zwei Nähköpfen (links und
rechts gleichzeitig) halbiert sich das.

## 5. Nächste Schritte in der Simulation

1. ~~Ärmel einsetzen~~ (umgesetzt, siehe aermel-einsetzen.md); als Nächstes: Ärmel und Körper anschließend falten und Seite + Ärmel schließen.
2. Kamera-Kantenführung als Regler statt fester Bahn (Vergleich mit der Schablone).
3. Stichtypen Overlock und Covernaht (Kantenumstechung, zwei Nadeln).
4. Kantenrollen von Jersey (Ruhekrümmung am Rand).
5. Eigene Materialmessungen (KES/FAST) eintragen und die Prozessfenster damit bestimmen.
