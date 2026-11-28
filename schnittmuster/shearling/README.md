# Shearling-Fliegerjacke – Größe L, oversized

Schnitt nach Referenzbild (weite, kastige Fliegerjacke aus Lammfell) auf Basis der Körpermaße aus
[`../jacke`](../jacke). Konstruktion und Ausgabe nutzen die Werkzeuge aus `../jacke/grundschnitt.py`.

| Datei | Zweck |
|---|---|
| `shearling_A4.pdf` | Seite 1 Übersicht + Kontrollmaße, danach 33 A4-Seiten zum Zusammenkleben |
| `shearling_A0.pdf` | eine große Seite 1:1 (194 × 76 cm) für Copyshop / Plotter |
| `shearling_1zu1.svg` | dasselbe als SVG 1:1 |
| `masse.json` | Körpermaße, Konstruktionswerte, Kontrollmaße |
| `shearling.py` | Konstruktion; nach Maßänderung `python3 shearling.py` neu ausführen |

## Fit

| | Jacke | Körper | Bemerkung |
|---|---|---|---|
| Brustweite | 136 cm | 106 cm | + 22 cm oversized + ca. 8 cm für die Felldicke (innen ca. 128,5 cm) |
| Weite unten / Bund | 128 cm | 96 cm | Bundriegel an den Seiten ziehen zusammen |
| Schulterbreite | 60 cm | 50 cm | überschnittene Schulter, je 5 cm |
| Rückenlänge | 67 cm | | inkl. 8 cm Bund |
| Vorderlänge (Halsloch vordere Mitte) | 61 cm | | inkl. Bund |
| Ärmellänge | 61 cm | Arm 64 cm | ab Kugeloberkante; −5 cm überschnitten, +2 cm Volumen |
| Oberarmweite / Ärmelsaum | 56 / 34 cm | Oberarm 34 cm | weit; Kugelhöhe 12,4 cm (flach, passend zur überschnittenen Schulter) |

## Teile

Shearling wird **einlagig** zugeschnitten, Fell nach unten, **nie im Stoffbruch**. Alle Teile sind Hälften und
werden gegengleich zugeschnitten; Pfeil = Strichrichtung des Fells (nach unten).

| Teil | Anzahl | Material |
|---|---|---|
| Rücken (hintere Mittelnaht) | 2× gegengleich | Shearling |
| Vorderteil (Reißverschluss vorne) | 2× gegengleich | Shearling |
| Oberärmel, Hinterärmel (hintere Ärmelnaht) | je 2× gegengleich | Shearling |
| Bund hinten, Bund vorne (8 cm) | je 2× gegengleich | Shearling |
| Kragensteg, Kragenfall (hintere Mitte genäht) | je 2× gegengleich | Shearling |
| Taschenpaspel 17,3 × 3 cm | 2× gegengleich | Shearling, Fell nach außen |
| Taschenbeutel 20 × 24 cm | 4× | Futter / Baumwollköper |
| Kinnriemen 30 × 4 cm, Bundriegel 15 × 3,5 cm (2×), Schnallenlasche 8 × 4 cm (3×) | | Leder |

Zubehör: teilbarer Reißverschluss ca. 60 cm, 3 Schnallen (ca. 3,5–4 cm), Leder-/Nahtband für die Nähte.

## Zugaben

- Nähte 1 cm (Leder/Shearling), Nähte auseinanderlegen und absteppen oder mit Nahtband abdecken.
- Bund unten und Ärmelsaum: **4 cm nach außen umschlagen**, so dass das Fell sichtbar ist.
- Kragen: Außen- und Vorderkanten ohne Zugabe (roh), Ansatz und Klappnaht 1 cm.

## Details

- **Taschen**: schräge Eingrifftaschen, Eingriff 17,3 cm, oben 17 cm / unten 20 cm von der vorderen Mitte
  (37 bzw. 54 cm unter der hinteren Mitte am Halsloch). Fellpaspel 3 cm zur Seitennaht hin.
- **Bund**: 8 cm hoch, an der Seitennaht je ein Riegel mit Schnalle.
- **Kragen** aus zwei Teilen, gesamt 13 cm hoch in der hinteren Mitte, 12 cm vorne, obere Vorderecke 3 cm gerundet;
  Ansatz = halbes Halsloch (23,2 cm). Die **Klappnaht** liegt auf **2/3 der Höhe** (8,7 cm in der hinteren Mitte,
  8 cm vorne): darunter der **Kragensteg**, darüber der **Kragenfall** (4,3 cm). An der Naht knickt das dicke Fell
  sauber, der Fall klappt nach außen um und zeigt das Fell. Damit er umgeklappt außen über dem Steg Platz hat, ist
  der Fall an drei Schnitten (5, 11, 17 cm ab hinterer Mitte) je 1 cm an der Außenkante gespreizt (Drehpunkt auf der
  Klappnaht): Außenkante 20,7 → 23,7 cm, Klappnaht an Steg und Fall gleich lang (23,6 / 23,5 cm), Passknipse an
  den Schnittstellen. Mehr oder weniger Spreizung: `kragen_spreizung` in `shearling.py`.
  Kinnriemen quer über den Steg, Schnalle auf der Gegenseite.
- **Ärmel**: zweiteilig mit hinterer Naht, 0,5 cm Ellbogen-Mehrweite (leicht nach vorn gebogen),
  Kugel 0,5 cm Mehrweite.

## Hinweise

- Fellgrößen: Die großen Teile (Oberärmel ca. 45 × 67 cm, Rücken ca. 37 × 64 cm) brauchen große Felle.
  Bei kleineren Fellen Teilungsnähte setzen (z. B. Rückenpasse oder Ellbogennaht) – sag Bescheid, dann baue ich sie ein.
- Vor dem Zuschnitt ein Probeteil aus festem Stoff (z. B. Filz oder Wollstoff in ähnlicher Dicke) nähen.
