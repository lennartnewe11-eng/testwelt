# Ärmel automatisch einsetzen

Lösungsweg und Umsetzung in der Simulation (Szenario „T-Shirt, Ärmel einsetzen“).

## Die Aufgabe physikalisch betrachtet

| Größe | Körper (Armloch) | Ärmel (Kugel) |
|---|---|---|
| Kantenform | konkav (ins Teil geschnitten) | konvex (gewölbt) |
| Nahtlänge (1 cm Zugabe) | 20,8 cm | 21,4 cm |
| Drehung der Nahttangente über die Naht | +51° | −56° |
| Teilegröße, Masse (Jersey 180 g/m²) | 60 × 26 cm, 22 g | 22 × 12 cm, 3,6 g |

Drei Folgerungen:

1. **Gegensinnige Krümmung**: Liegen beide Teile rechts auf rechts, fallen ihre Kanten nur an
   einem Punkt zusammen: an der Nadel. Davor laufen sie auseinander. Während des Nähens muss
   sich der Ärmel gegenüber dem Körper um insgesamt rund 107° drehen. Starr gemeinsam führen
   (wie bei der Seitennaht) geht deshalb nicht.
2. **Mehrweite**: Die Kugel ist rund 2,9 % länger als das Armloch. Das Mehr muss gleichmäßig
   eingehalten werden, sonst entstehen Falten oder der Ärmel endet zu früh.
3. **Kraftverhältnisse**: Der Ärmel liegt mit 3,6 g Gewicht auf dem Körper. Die Reibkraft
   Jersey auf Jersey beträgt nur 0,5 · 0,035 N ≈ 0,02 N. Dreht sich der Körper unter dem Ärmel,
   nimmt er ihn mit, wenn ihn nichts führt.

## Lösung

**Nähfolge (Flachbauweise)**: Erst Schulternähte schließen, Körper aufklappen, dann den Ärmel
flach einsetzen. Die Seitennähte bleiben offen, damit alles flach auf dem Tisch liegt. Danach
werden Seite und Ärmelunterkante in einem Zug geschlossen (Szenario „Kurvennaht“).

**Zellenaufbau**:

```
            Kantensensor (Lichttaster, 4,5 cm vor der Nadel, überwacht)
                    │        Ärmelzuführung: segmentierte Vakuumplatte auf
                    ▼        Dreh-Schiebeeinheit, führt den Ärmel entlang der Kugelbahn
   ┌──────────[Platte]───────┐   Segmente schalten 1,8 cm vor der Nadel ab
   │   Ärmel (oben)          │
 ══╪══ Trennblech (glatt) ═══╪══ entkoppelt die Lagen vor dem Nähfuß
   │   Körper (unten)        │
 ──┴── Werkstückträger mit Nadelleisten, vom Roboter entlang des Armlochs geführt
       Nähmaschine: Untertransport (Körper) + Obertransport mit Mehrweitensteuerung (Ärmel)
```

| Baustein | Aufgabe | physikalische Wirkung im Modell |
|---|---|---|
| Werkstückträger | hält den Körper von unten, Schlitz entlang des Armlochs | Bindung der Körperknoten an die Trägerlage |
| Portalroboter | dreht den Körper um die Nadel, Armlochtangente in Transportrichtung | Bahnführung über Lageerkennung (Procrustes) |
| Ärmelzuführung | führt den Ärmel gegenläufig entlang der Kugelbahn, mit Kamera-Lagekorrektur beim Aufsetzen | Bindung der Ärmelknoten (Ebene und Höhe), Freigabe an einer Linie vor der Nadel |
| Obertransport | schiebt den Ärmel um das Mehrweitenverhältnis schneller | Verhältnis 1 + E·w(u)/0,4, Mehrweite im mittleren Kugelbereich |
| Trennblech | verhindert, dass der Körper den Ärmel vor dem Fuß mitnimmt | keine Reibung zwischen den Lagen in diesem Bereich |
| Kantensensor | misst die Lage der Ärmelkante vor der Nadel (Qualitätsüberwachung) | Messung an den Kantenknoten mit Krümmungsvorsteuerung |

**Schnitt-Regeln (Design for Automation)**:
- Armloch trifft rechtwinklig auf die Schulternaht, damit es am Schulterpunkt glatt durchläuft.
  Mit einem 25°-Knick musste der Roboter den Körper dort schlagartig um 31° drehen, und der
  Ärmel ging verloren.
- Flache Ärmelkugel (3,2 cm statt 6 cm hoch, 22 cm breit): Die Tangente dreht sich um 56° statt 97°.

## Was die Simulation auf dem Weg gezeigt hat

| Ansatz | Ergebnis |
|---|---|
| nur Kantenführer mit Rolle (P-Regler, Sensor 2,5 cm) | Ärmel geht nach ~30 Stichen verloren: Reibung zum Körper, zu kurzer Hebel |
| + großes Trennblech, PI-Regler, Sensor 4,5 cm, Krümmungsvorsteuerung | erste Nahthälfte ±1–2 mm; ab der Kugelmitte zieht der angenähte Teil den Ärmel mit |
| + Ärmelzuführung (Platte mit 12 mm Nahtschlitz) | 72 von 83 Stichen treffen; Ende driftet im freien Streifen ab |
| + Kamera-Lagekorrektur, Platte bis 1,8 cm vor die Nadel ohne Schlitz, Platte drückt flach | **83 von 83 Stichen treffen** |

Außerdem musste das Materialmodell genauer werden: Stoff hat fast keine Drucksteifigkeit
(Garne knicken, die Fläche beult aus). Erst damit kann sich der Ärmel zwischen Nähfuß und
Zuführung in der Ebene verformen, wie echter Stoff.

## Ergebnis (Kleinkind-T-Shirt Gr. 86, Single Jersey, 400 min⁻¹, 2,5 mm Stich)

| Kennzahl | Wert |
|---|---|
| Stiche | 83, alle durch beide Lagen |
| Abweichung am Körper (Einstich ↔ Armlochbahn) | Ø 0,1 mm, max. 0,3 mm |
| Abweichung am Ärmel (Einstich ↔ Kugelbahn) | Ø 0,5 mm, max. 1,1 mm |
| eingehaltene Mehrweite | 3,5 % (Soll 2,9 %) |
| Nahtzeit | ≈ 12,5 s, Zykluszeit inkl. Laden ≈ 27 s |

## Reale Umsetzung

- Werkstückträger: Aluminiumblech 0,5–1 mm mit Nadelleisten, je Größe ein Träger (oder
  verstellbare Nadelleisten), bleibt als Werkstückträger am Teil bis zur nächsten Station.
- Ärmelzuführung: Vakuumplatte mit 8–12 einzeln schaltbaren Kammern auf einer
  X-Y-Drehachse (Servo, Wiederholgenauigkeit < 0,1 mm), Kamera über der Ladeposition.
- Nähmaschine: Overlock oder Steppstich mit getrennt angetriebenem Ober- und Untertransport
  (Differentialtransport), Trennblech in der Stichplatte.
- Steuerung: gemeinsame Bahnplanung für Roboter, Ärmelzuführung und Mehrweitenprofil aus den
  CAD-Schnittdaten; Kantensensor zur Überwachung und für Nachregelung bei Abweichung.
