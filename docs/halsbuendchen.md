# Halsbündchen automatisch annähen

Lösungsweg und Umsetzung in der Simulation (Szenario „T-Shirt, Halsbündchen“).

## Die Aufgabe physikalisch betrachtet

| Größe | Körper (Ausschnitt) | Bündchen |
|---|---|---|
| Material | Single Jersey, 180 g/m² | 1×1-Rippe 220 g/m², längs gefaltet (2 Lagen) |
| Nahtlänge (6 mm Zugabe) | 29,2 cm, geschlossener Umlauf | 25,2 cm, gerader Streifen |
| Drehung der Nahttangente | 360° | 0° (gerade) |
| Soll | – | um 15 % gedehnt annähen |

Drei Folgerungen:

1. **Dehnung statt Mehrweite**: Beim Ärmel ist das obere Teil länger (Mehrweite), beim Bündchen
   kürzer. Es muss unter Zug angenäht werden, gleichmäßig über den ganzen Umfang. Sonst liegt
   der Ausschnitt nicht an oder wellt sich.
2. **360°-Umlauf**: Der Körper dreht sich einmal ganz um die Nadel. Ein Roboter, der den
   Werkstückträger hält, kreist dabei um die Nadel und würde auf einer Seite den Maschinenarm
   (0°) und auf der anderen die Bündchenzuführung (90°) kreuzen. Außerdem muss der Körper unter
   dem Maschinenarm durchdrehen; der Abstand vom Ausschnitt zum Saum beträgt bis 33 cm.
3. **Weiche, leichte Teile**: Das Bündchen dehnt sich schon bei ≈ 6 N/m um 15 %. Liegt es lose
   auf dem Körper, verrutscht es beim Transport (in der Simulation um 4,5 cm).

## Lösung

**Nähfolge (Flachbauweise)**: rechte Schulter schließen, Körper aufklappen, Bündchen annähen,
dann die linke Schulter über die Bündchenenden schließen.

**Zellenaufbau**:

| Baustein | Aufgabe | physikalische Wirkung im Modell |
|---|---|---|
| Langarm-Maschine | 0,40 m freie Armlänge statt 0,28 m, Körper dreht unter dem Arm durch | Ständer und Arm als Kollider weiter außen |
| Werkstückträger mit Ausschnitt | hält den Körper außerhalb eines 16-mm-Schlitzes um die Naht | Bindung der Körperknoten; Schlitz ≥ halbe Fußbreite plus Kurvenversatz, sonst drückt der Fuß gegen den Träger |
| Faltapparat und Abzug | zieht das Bündchen von der Rolle, faltet es, hält den Anfang 8 cm über der Nadel bereit, senkt es vor dem Fuß ab und schiebt den Anfang flach unter den angehobenen Fuß | Bindung der Bündchenknoten (Ebene und Höhe), Freigabe an einer Linie 18 mm vor der Nadel |
| Obertransport / Abzug | Bündchen läuft um den Faktor 1/1,15 langsamer als der Körper | gleichmäßiges Verhältnis 0,87 über die ganze Naht |
| Trennblech | trennt Bündchen und Körper vor dem Fuß vollständig | keine Kontakte zwischen den Lagen im Blechbereich; unter dem Fuß ordnet das Fußmodell die Lagen |
| Umgreifen in der Nahtmitte | Nadel bleibt unten, Saugtisch hält, Roboter greift auf der anderen Seite neu | Griffpunkt bleibt im freien Bereich 118°…298° |
| Kamera nach dem Umgreifen | misst die Halskante neu (Punkte bis 3 cm um die restliche Naht) | Lage des Teils aus der Halskante statt aus den entfernten Haltepunkten |

## Was die Simulation auf dem Weg gezeigt hat

| Ansatz | Ergebnis |
|---|---|
| Bündchen lose auf dem Körper, Träger mit 8-mm-Schlitz | Bündchen verrutscht beim Transport um 4,5 cm, der freie Anfang staucht sich vor dem Fuß auf (Stoff hat keine Drucksteifigkeit) |
| Bündchen in der Zuführung, senkrecht auf den Fuß abgesenkt | Anfang landet auf dem angehobenen Fuß statt darunter |
| vor dem Fuß absenken, dann flach einschieben | jeder Stich geht durch beide Lagen |
| Haltehöhe ohne Trägerblech gerechnet | Bündchen und Körper überlappen 0,6 mm, Kontakt schaukelt sich auf |
| 12-mm-Schlitz | am äußeren Kurvenrand liegt der Fuß 12,2 mm von der Naht entfernt und drückt auf den Träger |
| Griffpunkt ohne Sektorplanung | Roboter schwenkt über den Maschinenarm (Kollision) |
| Umgreifen mit Nadel oben | Bündchenzug zieht den losgelassenen Körper 8 mm weg |
| Nadel unten, großer Saugtisch, Kamera-Neuvermessung | Ergebnis unten |

Außerdem mussten zwei Stellen im Modell genauer werden:
- **Netz:** Kein Dreieck darf ein Loch überbrücken. Der hintere Ausschnitt ist nur 1,5 cm tief, das 1,5-cm-Netz hatte ihn überspannt.
- **Kontakte:** Kontakte mit veralteter Seitenzuordnung (mehr als drei Stoffdicken „Durchdringung“) werden verworfen.

## Ergebnis (Kleinkind-T-Shirt Gr. 86, 400 min⁻¹, 2,5 mm Stich)

| Kennzahl | erste Hälfte | zweite Hälfte (nach dem Umgreifen) | gesamt |
|---|---|---|---|
| Stiche durch beide Lagen | 58 / 58 | 55 / 56 | 113 / 114 |
| Abweichung am Körper (Einstich ↔ Halsnaht) | ≤ 0,3 mm | ≤ 4,0 mm | Ø 0,8 mm |
| Abweichung am Bündchen (Einstich ↔ Bündchennaht) | ≤ 0,4 mm | ≤ 1,1 mm | Ø 0,2 mm |
| Dehnung des Bündchens (Soll 15 %) | 16,3 % | 13,7 % | 15,0 % |
| Nahtzeit / Zyklus in der Zelle | | | ≈ 17 s Nähen, ≈ 3 s Umgreifen |

Der eine Stich ohne Körper ist der letzte. Er liegt im Spalt an der offenen linken Schulter und
trifft nur das Bündchen; diese Stelle schließt später die Schulternaht.

Die zweite Hälfte ist schlechter. Das gespannte Bündchen verzieht den freien Ring um den
Ausschnitt, und die einmalige Kamera-Neuvermessung gleicht das nur teilweise aus. Der nächste
Schritt wäre eine laufende Nachführung, bei der Kamera oder Kantensensor während der Naht
nachregeln.

## Reale Umsetzung

- Langarm-Nähmaschine (Overlock oder Steppstich) mit getrennt angetriebenem Obertransport und
  Trennblech, Nadelstopp unten.
- Bündchen-Faltapparat mit angetriebenem Abzug und Zugregelung (Tänzer oder Kraftsensor), Messer
  am Nahtende.
- Werkstückträger aus 0,5–1 mm Blech mit Nadelleisten und Ausschnitt; Saugtisch mit Zonen.
- Kamera über der Maschine für die Neuvermessung nach dem Umgreifen.
