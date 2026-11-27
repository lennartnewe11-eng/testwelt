# Grundschnitt Jacke – Größe L, slim (Trucker-Form)

Zwei Varianten, Rumpf identisch:

| Variante | Teile |
|---|---|
| **zweiteilig** – hintere Ärmelnaht, Ärmel biegt leicht nach vorn | Rücken (1× im Stoffbruch), Vorderteil (2×), Oberärmel (2×), Hinterärmel (2×) |
| **einteilig** – ohne hintere Ärmelnaht | Rücken (1× im Stoffbruch), Vorderteil (2×), Ärmel (2×) |

Details (Übertritt, Knopfleiste, Kragen, Passe, Taschen, Bund, Manschetten) folgen im nächsten Schritt.

| Datei (je Variante `zweiteilig` / `einteilig`) | Zweck |
|---|---|
| `grundschnitt_<variante>_A4.pdf` | Seite 1 Übersicht + Kontrollmaße, danach A4-Seiten zum Zusammenkleben (22 bzw. 20) |
| `grundschnitt_<variante>_A0.pdf` | eine große Seite 1:1 für Copyshop / Plotter |
| `grundschnitt_<variante>_1zu1.svg` | dasselbe als SVG 1:1 |
| `masse_<variante>.json` | alle verwendeten Maße und Kontrollmaße |
| `grundschnitt.py` | Konstruktion; nach Maßänderung `python3 grundschnitt.py` neu ausführen |

**Maße auf dem Schnitt (rot):** alle auf der Nahtlinie, ohne Zugaben, in cm – Längen (Rücken, Vorderteil, Ärmel,
Kugelhöhe), Weiten auf Brust-, Taillen-, Oberarm- und Ellbogenlinie und am Saum (Rumpf als halbe Weiten),
Nahtlängen (Halsloch, Schulter, Armloch, Seitennaht, Kugel vorne/hinten, Unterarmnaht, hintere Ärmelnaht).

**Drucken:** 100 % / „Tatsächliche Größe“. Kontrollquadrat (10 × 10 cm, oben rechts) nachmessen.
Nahtzugabe 1,5 cm und Saumzugabe 3 cm sind enthalten. Durchgezogene Linie = Schnittkante, gestrichelt = Nahtlinie.

## Maße

| Maß | Wert | Quelle |
|---|---|---|
| Vorderlänge, Halsloch vordere Mitte bis Saum | 59 cm | deine Vorgabe |
| Schulterbreite Jacke | 50 cm | deine Vorgabe (49–51) |
| Körperumfang auf Saumhöhe (dort endet die Jacke) | 96 cm | deine Vorgabe |
| Brustumfang Körper | 106 cm | **Annahme Gr. L** |
| Halsumfang | 41 cm | **Annahme Gr. L** |
| Oberarmumfang | 34 cm | **Annahme Gr. L** |
| Ärmellänge ab Schulterpunkt | 64 cm | **Annahme Gr. L** |

## Fertigmaße der Jacke (Mehrweite gegenüber Körper)

| | Jacke | Mehrweite |
|---|---|---|
| Brust | 114 cm | + 8 cm |
| in Taillenlinie (Orientierung) | 109 cm | – |
| Saum | 105 cm (Rücken ½ 26,5 · vorne ½ 26) | + 9 cm |
| Oberarm | 42 cm | + 8 cm |
| Ärmelsaum | 27 cm | – |
| Rückenlänge hintere Mitte | 64,4 cm | – |

Armloch 55,0 cm, Armkugel 56,2 cm (1,2 cm Mehrweite, wenig wegen Denim), Kugelhöhe 17,5 cm.
Schulternaht hinten 0,5 cm länger (einhalten). Halsloch gesamt 42,6 cm (Grundlage für den Kragen).

### Variante zweiteilig: Ärmel mit Vorschub

Der Ärmel hat eine zweite Naht hinten am Arm (vom hinteren Armloch zum Ärmelsaum). Der Oberärmel ist unterhalb
der Ellbogenlinie um die vordere Unterarmnaht nach vorn gedreht. Dadurch:

- ist die hintere Naht am Oberärmel 1,0 cm länger als am Hinterärmel (56,7 / 55,7 cm). Diese Mehrweite zwischen
  den beiden Knipsen am Ellbogen einhalten, dann biegt sich der Ärmel leicht nach vorn;
- sitzt der Ärmelsaum 1,1 cm weiter vorn, die vordere Unterarmnaht ist am Ellbogen leicht hohl;
- misst der Oberärmel in der Mitte 64,7 cm (64 cm + Ellbogenweite), der Hinterärmel bleibt bei 64 cm;
- bleibt die Unterarmnaht an beiden Teilen gleich lang (47,1 cm).

Mehr Biegung: `ellbogen_mehrweite` in `grundschnitt.py` erhöhen (bei Denim höchstens etwa 1,5 cm).

## Probeteil

1. Aus Nessel oder einem alten, festen Baumwollstoff zuschneiden. Knipse übertragen (vorne 1 Knips, hinten 2 Knipse im Armloch, Schulterknips oben auf der Kugel, Ellbogenknipse).
2. Zweiteilig: Ärmel zuerst an der hinteren Naht schließen (Mehrweite am Ellbogen einhalten), dann wie einen einteiligen Ärmel behandeln.
3. Schulter- und Seitennähte schließen, Ärmel einsetzen. Vordere Mitten zur Anprobe aufeinander stecken.
4. Prüfen: Brust und Rücken beim Armeheben, Schulterpunkt auf der Schulterkante, Saumhöhe, Ärmellänge, Biegung des Ärmels, Halsloch (liegt es am Hals an?).
