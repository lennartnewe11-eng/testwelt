# Nähzelle Materialfluss

Physikalische 3D-Simulation des Materialhandlings biegeschlaffer Halbzeuge (Textilien, Leder,
technische Gewebe) für die Automatisierung von Nähprozessen: Vereinzeln vom Zuschnittstapel,
Greifen, Transport, Ablegen, Unterschieben unter den Nähfuß und robotergeführtes Nähen.

Die Welt rechnet in SI-Einheiten mit irdischen Bedingungen (g = 9,80665 m/s², Luft bei 20 °C und
101,325 kPa). Jedes Material hat seine gemessenen Kennwerte: Flächenmasse, Dicke, anisotrope
Zug-, Scher- und Biegesteifigkeit, Haft- und Gleitreibung, Luftdurchlässigkeit, Permittivität,
Lagenhaftung und mehr. Alle Werte lassen sich in der Oberfläche durch eigene Messwerte ersetzen.

## Starten

```bash
npm start            # statischer Server ohne Abhängigkeiten → http://localhost:8080
npm test             # Validierung des Physikmodells gegen analytische Lösungen
npm run scenario     # Beispielprogramm ohne Grafik durchrechnen (Protokoll im Terminal)
npm run build        # dist/naehzelle.html: eine eigenständige Datei zum Weitergeben
```

Benötigt Node.js ≥ 18 und einen aktuellen Browser mit WebGL. Three.js wird vom CDN geladen.

## Was die Zelle enthält

| Element | Modell |
|---|---|
| Zuschnittstapel | 1–8 Lagen mit Legetoleranz (±1,5 mm, ±0,5°) auf einem Tisch (HPL, Stahl, PTFE, Buche, Gummi wählbar) |
| Portalroboter | Achsen X, Y, Z, C; Trapez-Geschwindigkeitsprofil mit v_max und a_max; Tastfahrt; synchrones Mitführen beim Nähen |
| Greiferkopf | Raster aus 1–25 Elementen; Vakuum-, Nadel-, Elektroadhäsions- oder Kryogreifer |
| Nähmaschine | Flachbett mit Transporteur, Nähfuß (Druck einstellbar, Stahl oder PTFE), Nadel, Stichbildung |
| Saugtisch | Zonen-Saugfeld im Nähbereich, hält die untere Lage beim Auflegen der oberen |

## Physikmodell

**Textil** (`src/physics/cloth.js`): Diskretes Kontinuum auf einem quadratischen Netz, gelöst mit
XPBD (Extended Position Based Dynamics) in festen Teilschritten. Die Nachgiebigkeiten folgen
direkt aus den Prüfwerten:

- Zug: Feder je Netzkante mit k = T · b (T Zugsteifigkeit Kette/Schuss in N/m)
- Scherung: eine Diagonale je Zelle mit k = 2 · G (G Schersteifigkeit nach KES in N/m/rad)
- Biegung: diskrete Krümmung κ = |x₀ − 2x₁ + x₂| / h², Energie ½·B·κ² (B nach KES in N·m)
- Masse exakt aus der Flächenmasse; Luftwiderstand je Dreieck (c_d = 1,17) mit Durchströmung nach Darcy
- Innere Dämpfung nur auf Relativbewegungen

Gewebe sind in der Ebene nahezu undehnbar. Iterative Löser konvergieren dafür langsam; deshalb
ergänzen Long Range Attachments (Kim et al. 2012) und eine hierarchische, nur auf Zug wirkende
Dehnungsbegrenzung den Löser. Zugdehnungen oberhalb einer Linienlast von 10 N/m werden dadurch
begrenzt; die angezeigte Dehnung hat eine Auflösung von etwa 10 N/m / T.

**Kontakt** (`src/physics/collision.js`, `colliders.js`): Punkt-Dreieck-Kontakt zwischen den Lagen
mit Materialdicke, Coulomb-Reibung (Haften/Gleiten) und Lagenhaftung; Selbstkontakt; starre
Quader-Kollider für Tische, Maschine, Nähfuß und Greifer mit Stoff/Werkstoff-Reibpaarungen.

**Greifer** (`src/physics/grippers.js`): Jedes Element berechnet je Lage unter ihm eine maximale
Haltekraft. Gegriffene Knoten sind nachgiebig an das Element gebunden. Die übertragene Kraft
(Gewicht, Trägheit, Luft, Reibung, Lagenhaftung) entsteht in der Simulation. Ist
(F_n/C_n)² + (F_t/C_t)² > 1, löst sich die Lage.

| Greifer | Haltekraftmodell | typische Effekte |
|---|---|---|
| Vakuum | Leiternetzwerk: Pumpenkennlinie, Durchströmung je Lage (Luftdurchlässigkeit), seitliche Leckage, offene Teilfläche | Doppelgriff bei porösen Stoffen, zu geringe Kraft bei Maschenware und Vlies |
| Nadel | Nadelanzahl × Auszugskraft je Nadel × Eingriffsgrad | Einstechtiefe entscheidet über Mehrfachgriff |
| Elektroadhäsion | Maxwell-Spannung ½·ε₀·ε_r·E², Streufeld fällt mit exp(−2π·z/Teilung) | Restladung verzögert das Ablegen |
| Kryo | Eis-Haftfestigkeit × Benetzbarkeit, Durchfeuchtung tieferer Lagen | lange Zykluszeit, Durchfrieren dünner Lagen |

**Nähmaschine** (`src/physics/sewing.js`): Transporteur mit Reibschluss bis μ·F_Fuß, Nähfuß bremst
die obere Lage (Lagenverschiebung), Nadel fixiert die Lagen beim Einstich, jeder Stich verbindet
die Lagen über einen nur zugtragenden Faden an der Einstichstelle.

## Validierung (`npm test`)

| Prüfung | Simulation | Referenz | Abweichung |
|---|---|---|---|
| Freier Fall 1 m ohne Luft | 0,4517 s | 0,4516 s | 0,0 % |
| Sinkgeschwindigkeit Popeline (flach) | 1,301 m/s | 1,293 m/s | 0,6 % |
| Haften auf Stahlrampe unter arctan μ_H | 0 mm | 0 mm | – |
| Gleiten auf Stahlrampe (a = g·(sin α − μ_G·cos α)) | 249,7 mm | 249,4 mm | 0,1 % |
| Biegelänge Popeline (ASTM D1388) | 1,80 cm | 1,80 cm | 0,0 % |
| Biegelänge Denim (ASTM D1388) | 3,33 cm | 3,11 cm | 7,3 % |
| Biegelänge Nappaleder (ASTM D1388) | 3,79 cm | 3,85 cm | −1,5 % |
| Zugversuch Single Jersey 3 N/m (XPBD konvergiert) | 0,366 % | 0,353 % | 3,8 % |
| Sauggreifer auf luftdichtem Material, F = Δp·A | 18,68 N | 18,85 N | −0,9 % |

Die gleichen Prüfungen laufen in der Oberfläche über „Physik prüfen“.

## Ablaufsprache

Eine Anweisung je Zeile, Kommentare mit `#`. Koordinaten in m, y ist die Höhe der Greiferfläche.

```
SPEED v / ACCEL a        Bahngeschwindigkeit [m/s] / -beschleunigung [m/s²]
MOVE x y z [c°]          absolut verfahren
MOVEREL dx dy dz [dc°]   relativ verfahren
TOUCH [v]                absenken bis Kontakt (Tastsensor)
GRIP ON|OFF [1,2,…]      Greiferelemente schalten (alle oder Auswahl, z. B. zum Abschälen)
WAIT t                   warten [s]
FOOT UP|DOWN             Nähfuß
TABLEVAC ON|OFF          Saugtisch im Nähbereich
SEW L [rpm] [mm] [SYNC]  Naht der Länge L starten; SYNC koppelt den Greifer an den Transporteur
WAITSEW                  auf das Nahtende warten
HOME                     Grundstellung
```

## Messwerte

- Haltekraft und Last je Greiferelement, Auslastung, Doppelgriff-Erkennung
- Zeitverlauf von Greiferlast und Haltekraft
- Ablagefehler je Lage (Abweichung zur Lage bei starrem Mitführen durch den Greifer), Dehnung, Welligkeit
- Ereignisprotokoll (Lagentrennung, Ablösen, Verlust, Überdehnung)
- Messdaten als CSV (Zwischenablage)

## Grenzen

Keine Strömungssimulation (CFD), keine Temperatur- und Feuchteabhängigkeit, Tische und
Maschinenteile sind starr. Die Netzweite (1–2 cm) begrenzt die Auflösung: Einzelfäden,
Ausfransen und Effekte unterhalb der Maschenweite werden nicht abgebildet. Die Materialwerte sind
typische Literaturwerte; für belastbare Aussagen eigene KES-/FAST-Messungen eintragen.

## Aufbau

```
index.html                 Oberfläche
src/physics/               Simulation (ohne Abhängigkeiten, läuft auch in Node)
  constants.js materials.js cloth.js collision.js colliders.js
  grippers.js sewing.js robot.js world.js validation.js
src/render/                Three.js-Darstellung
src/ui/                    Bedienung, Diagramm, Modellbeschreibung
tests/                     Validierung und Szenario-Lauf
scripts/build-single.mjs   Ein-Datei-Version
```
