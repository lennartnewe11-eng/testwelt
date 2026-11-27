# Grundschnitt Jacke – Größe L, slim (Trucker-Form)

Vier Teile: **Rücken** (1× im Stoffbruch), **Vorderteil** (2×), **Oberärmel** (2×), **Hinterärmel** (2×).
Details (Übertritt, Knopfleiste, Kragen, Passe, Taschen, Bund, Manschetten) folgen im nächsten Schritt.

| Datei | Zweck |
|---|---|
| `grundschnitt_A4.pdf` | Seite 1 Übersicht + Kontrollmaße, danach 22 A4-Seiten zum Zusammenkleben |
| `grundschnitt_A0.pdf` | eine große Seite 1:1 für Copyshop / Plotter (142 × 77 cm) |
| `grundschnitt_1zu1.svg` | dasselbe als SVG 1:1 |
| `masse.json` | alle verwendeten Maße und Kontrollmaße |
| `grundschnitt.py` | Konstruktion; nach Maßänderung `python3 grundschnitt.py` neu ausführen |

**Drucken:** 100 % / „Tatsächliche Größe“. Kontrollquadrat (10 × 10 cm, oben rechts auf Seite H1) nachmessen.
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
| in Taillenlinie (Orientierung) | 108,9 cm | – |
| Saum | 105 cm | + 9 cm |
| Oberarm | 42 cm | + 8 cm |
| Ärmelsaum | 27 cm | – |
| Rückenlänge hintere Mitte | 64,4 cm | – |

Armloch 55,0 cm, Armkugel 56,2 cm (1,2 cm Mehrweite, wenig wegen Denim), Kugelhöhe 17,5 cm.
Schulternaht hinten 0,5 cm länger (einhalten). Halsloch gesamt 42,6 cm (Grundlage für den Kragen).

### Zweiteiliger Ärmel mit Vorschub

Der Ärmel hat eine zweite Naht hinten am Arm (vom hinteren Armloch zum Ärmelsaum). Der Oberärmel ist unterhalb
der Ellbogenlinie um die vordere Unterarmnaht nach vorn gedreht. Dadurch:

- ist die hintere Naht am Oberärmel 1,0 cm länger als am Hinterärmel (56,7 / 55,7 cm). Diese Mehrweite zwischen
  den beiden Knipsen am Ellbogen einhalten, dann biegt sich der Ärmel leicht nach vorn;
- sitzt der Ärmelsaum 1,1 cm weiter vorn, die vordere Unterarmnaht ist am Ellbogen leicht hohl;
- bleibt die Unterarmnaht an beiden Teilen gleich lang (47,1 cm).

Mehr Biegung: `ellbogen_mehrweite` in `grundschnitt.py` erhöhen (bei Denim höchstens etwa 1,5 cm).

## Probeteil

1. Aus Nessel oder einem alten, festen Baumwollstoff zuschneiden. Knipse übertragen (vorne 1 Knips, hinten 2 Knipse im Armloch, Schulterknips oben auf der Kugel, Ellbogenknipse).
2. Ärmel zuerst an der hinteren Naht schließen (Mehrweite am Ellbogen einhalten), dann wie einen einteiligen Ärmel behandeln.
3. Schulter- und Seitennähte schließen, Ärmel einsetzen. Vordere Mitten zur Anprobe aufeinander stecken.
4. Prüfen: Brust und Rücken beim Armeheben, Schulterpunkt auf der Schulterkante, Saumhöhe, Ärmellänge, Biegung des Ärmels, Halsloch (liegt es am Hals an?).
