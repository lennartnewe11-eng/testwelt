# Automatische Produktionsstraße T-Shirt

Vom Stoffballen bis zum verpackten Shirt: eine vollautomatische Linie für ein Kinder-T-Shirt
(Gr. 86, Single Jersey). Sie baut auf den Techniken auf, die in der Nähzelle physikalisch
simuliert sind:
- robotergeführtes Nähen von Kurvennähten,
- Werkstückträger mit Nadelleisten,
- Ärmelzuführung mit Mehrweite,
- Bündchenzuführung mit Dehnung.

In der Oberfläche oben rechts auf **Produktionsstraße** umschalten (oder `index.html#linie`).

## Was die Simulation ist und was nicht

Die Linie ist ein **digitaler Zwilling als ereignisdiskrete Simulation (DES)**. Jedes Shirt ist
ein Auftrag, der auf einem Werkstückträger durch die Stationen läuft. Die Nähzeiten kommen aus
der Geometrie der Schnittteile und einer wählbaren Drehzahlstufe:

```
Zykluszeit = Handhabung + Σ Nähte ( Nahtlänge / (Drehzahl/60 · Stichlänge) + 0,7 s )
Drehzahl   = min( Stufe, 60 · ω_max / (κ_max · Stichlänge) )   bei Kurvennähten
```

Die Stoffphysik (XPBD, Kontakt, Reibung, Greifer) rechnet die Nähzelle. In der Linie wird sie
nicht an jeder Station neu gerechnet. Jede Station zeigt in der Tabelle, wie gut sie belegt ist:

| Nachweis | Bedeutung | Stationen |
|---|---|---|
| **Zelle** | in der Nähzelle physikalisch simuliert („Physik“ öffnet das Szenario) | Halsbündchen, Ärmel einsetzen, Seitennähte |
| **analog** | gerade, robotergeführte Naht wie der Grundfall der Zelle | Schulternähte, Säume |
| **Plan** | Planwert ohne Nachweis | Etikett, Klappen, Prüfen, Wenden, Dämpfen, Verpacken |

Handhabungszeiten und Störraten sind Planwerte aus vergleichbaren Roboterzellen.

## Drehzahlstufen

| Stufe | gerade / Kurve | Bedeutung |
|---|---|---|
| in der Zelle validiert | je Naht die nachgewiesene Drehzahl: 600 / 400–500 min⁻¹ | belegt, aber langsam |
| Entwicklungsziel (Standard) | 1 500 / 1 000 min⁻¹ | realistisch nach Prototyp und Regelungsentwicklung |
| optimistisch | 4 000 / 3 000 min⁻¹ | Drehzahlen manueller Nähplätze, für robotergeführtes Nähen nicht belegt |

## Ablauf

| # | Station | Technik | Zyklus (Ziel / validiert) |
|---|---|---|---|
| 1 | Zuschnitt einlagig | Abwickler mit Kantensteuerung, Förderband-Cutter (0,8 m/s), Abnahmeband als Puffer für 3 Schnittbilder | 6,8 s je Shirt |
| 2 | Kommissionierung | 2 Roboter greifen die einzeln liegenden Teile mit Vakuum und legen sie in Nählage auf den Klappträger | 3,6 s je Shirt |
| 3 | Schulternaht rechts | Overlock | 8,1 / 9,4 s |
| 4 | Halsbündchen (Rolle) | Faltapparat und Abzug (15 % Dehnung), Langarm-Maschine, 360° mit Umgreifen | 18,1 / 27,6 s |
| 5 | Schulternaht links | Overlock, schließt über die Bündchenenden | 8,7 / 10,8 s |
| 6 | Ärmel einsetzen links / rechts | Roboter legt den Ärmel auf, Ärmelzuführung, Mehrweite | je 18,7 / 26,2 s |
| 7 | Ärmelsäume | Coverstich, Kantenentroller vor dem Saumumleger | 15,5 / 24,6 s |
| 8 | Saum Vorder- und Rückenteil | Coverstich | 18,7 / 31,2 s |
| 9 | Pflegeetikett anheften | Etikett vom Band schneiden, falten, mit Heftriegel an den Seitenrand des Rückenteils | 6,0 s |
| 10 | Klappträger schließen | Scharnier klappt die Vorderhälfte samt Nadelleisten auf die Rückenhälfte, Kamera prüft die Kanten | 4,5 s |
| 11 | Seitennaht links / rechts | Overlock, Klappträger als Nähschablone | je 17,4 / 25,1 s |
| 12 | Fäden absaugen, Kameraprüfung | vor dem Wenden: Nähte liegen außen | 6,0 s |
| 13 | Wenden auf Formbrett | Saum am Rohrrand klemmen, Unterdruck zieht das Shirt durch, gewendet auf ein Formbrett | 9,0 s |
| 14 | Dämpfen und Falten | Shirt bleibt auf dem Formbrett, 2 Maschinen | 15,0 s |
| 15 | Verpacken | Folienbeutel, Schweißbalken, Palette | 7,0 s |

Der Zuschnitt im Stapel (Legemaschine, Stapelcutter, Vereinzeln mit Nadelgreifern) ist zum
Vergleich wählbar. Rechnerisch ist er nicht langsamer. Das Vereinzeln einzelner Jersey-Lagen
aus einem Stapel von 20 ist aber technisch das größte Risiko. Deshalb ist der einlagige
Zuschnitt der Standard.

## Ergebnisse (4 h Laufzeit, letzte Stunde)

| Stufe | Takt | ohne Störungen | mit Störungen | Engpass |
|---|---|---|---|---|
| validiert | 31,2 s | 115 Shirts/h | 109 Shirts/h | Saum (Cover) |
| Entwicklungsziel | 18,7 s | 190 Shirts/h | 161 Shirts/h | Saum (Cover), Ärmel |
| optimistisch | 15,4 s | 205 Shirts/h | 173 Shirts/h | Ärmel |

Bei „optimistisch“ begrenzen zusätzlich die Werkstückträger und der Transport (theoretisch wären
234 Shirts pro Stunde möglich).

Störungen in der Simulation:

| Störung | Häufigkeit | Behebung |
|---|---|---|
| Fadenbruch | 0,4 % je Naht | 45 s automatisches Einfädeln |
| Handhabungsfehler | je Station 0,3 % bis 3 %, am häufigsten Wenden, Ärmel, Bündchen | 25 s Nachgreifen und Neuvermessen |
| Stoffrolle wechseln | alle 100 m | 120 s |
| Bündchenrolle wechseln | alle 50 m (etwa 220 Shirts) | 90 s |
| Ausschuss an der Kameraprüfung | 1,5 % | Shirt geht in die Nacharbeit |

Weil 15 Stationen hintereinander arbeiten, summieren sich die Störungen. Die Ausbringung sinkt
dadurch um etwa 15 %.

## Klappträger und Formbrett

- **Klappträger**: zwei Hälften mit Nadelleisten, das Scharnier liegt auf der Schulterlinie. Vom
  Kommissionieren bis zur Seitennaht wird kein Stoff mehr frei gehandhabt. Die Klapphälfte ist
  ein Rahmen, damit das Teil für Nadel und Kamera zugänglich bleibt.
- **Formbrett**: Das Wenden legt das Shirt direkt auf ein Formbrett, das auf dem Träger
  mitfährt. Dämpfen, Falten und Verpacken arbeiten mit definierter Lage. Ohne diesen Schritt
  müsste ein Roboter ein loses Shirt glatt auslegen; das ist bis heute ein Forschungsthema.

## Tests

```bash
node tests/line.mjs
```

Prüft:
- Nahtlängen und die Ausnutzung des Schnittbilds (ohne Bündchen),
- dass die Linie in beiden Zuschnittverfahren ohne Stau ≥ 90 % des Takts erreicht,
- dass Störungen die Ausbringung auf 70–97 % senken,
- die Reihenfolge der Drehzahlstufen,
- die Wirkung einer verdoppelten Engpassstation,
- die Begrenzung durch zu wenige Werkstückträger.

## Grenzen

- Handhabungszeiten und Störraten sind Planwerte.
- Etikett, Klappen, Wenden, Dämpfen und Verpacken sind Zeitmodelle ohne Stoffsimulation.
- Größenwechsel, Rüsten, Schichtmodell und Nacharbeit sind nicht modelliert.
- Die Schulternaht links schließt über die Bündchenenden. Das ist in der Zelle nicht eigens
  simuliert.
