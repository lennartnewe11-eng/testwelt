// Einkaufsliste für den Prototyp „Ärmel einsetzen“ an der Zoje A6000.
// Erzeugt prototyp/einkaufsliste.csv und docs/prototyp-einkaufsliste.md.
//   node tools/einkaufsliste.mjs
//
// Preise: Richtwerte in Euro inkl. MwSt. (Stand Ende 2026, Versandhandel; von–bis je Stück).
// Die untere Grenze entspricht Importware/Marktplatz, die obere Markenware vom Fachhandel.
// stufe: ab welcher Ausbaustufe das Teil gebraucht wird (1 … 4); opt: nur bei Bedarf.
import { mkdir, writeFile } from 'node:fs/promises';

const G = (id, name, note) => ({ id, name, note });
const groups = [
  G('A', 'Nähmaschine: Zubehör und Verbrauch', 'Nähmaschinen-Fachhandel'),
  G('B', 'Maschinenanbau: Fußlüftung, Pedal, Drehgeber', 'Pneumatik- und Elektronik-Versand'),
  G('C', 'Gleitfläche und Gestell', 'Baumarkt, Profil-Versand'),
  G('D', 'Werkstückträger und Kalibrierplatte', 'Kunststoffhandel, Laserservice'),
  G('E', 'Körperportal X-Y-C-Z', 'CNC-Zubehör-Versand'),
  G('F', 'Ärmelzuführung X-Y-θ-Z mit Platte und Klappfingern', 'CNC-Zubehör, Modellbau, 3D-Druck'),
  G('G', 'Trennblech', 'Metallhandel, Laserservice'),
  G('H', 'Steuerung und Elektrik', 'Elektronik-Versand, Elektro-Großhandel'),
  G('I', 'Pneumatik-Versorgung', 'Pneumatik-Versand, Baumarkt'),
  G('J', 'Messen, Einrichten, Stufe 4 (Kamera, Sensor)', 'Werkzeughandel, Elektronik-Versand'),
];

// [Gruppe, Bezeichnung, Spezifikation, Menge, Preis von, Preis bis, Stufe, Hinweis, optional]
const items = [
  ['A', 'Nähfuß mit PTFE-Sohle (Teflonfuß)', 'Standard-Steppstichfuß für Industrie-Flachbett, Schaftbefestigung, z. B. Typ T35/MT-18', 1, 5, 12, 1, 'bremst die obere Lage weniger; Zehenlänge vor der Nadel messen (≤ 16 mm)'],
  ['A', 'Maschinennadeln Kugelspitze', 'System DB×1 / 16×231 / 1738, SUK, Nm 70, 10 Stück', 1, 4, 8, 1, 'Maschenware; Nadelsystem am Typenschild prüfen'],
  ['A', 'Maschinennadeln Kugelspitze', 'wie oben, Nm 75, 10 Stück', 1, 4, 8, 1, 'Ausweichstärke'],
  ['A', 'Nähgarn', 'Polyester-Umspinnzwirn Nm 120 (Tex 25), Kone 5 000 m, Farbe kontrastierend', 2, 6, 14, 1, 'Ober- und Unterfaden; Kontrastfarbe erleichtert das Messen'],
  ['A', 'Spulen', 'passend zum Greifer der A6000 (Standard-Steppstichspule Alu)', 5, 0.5, 1.5, 1, ''],
  ['A', 'Single Jersey', '95 % CO / 5 % EL, ≈ 180 g/m², 150 cm breit', 3, 9, 15, 2, 'Meterware; reicht für rund 25 Körper und Ärmel'],
  ['A', 'Sprühstärke', 'Bügelhilfe/Sprühstärke 400 ml', 1, 3, 6, 3, 'gegen das Einrollen der Schnittkanten'],
  ['A', 'Transporteur und Stichplatte fein', 'Ausführung für leichte Stoffe passend zur A6000', 1, 15, 35, 3, 'nur wenn der Standard-Transporteur den Jersey markiert', true],

  ['B', 'Pneumatikzylinder Fußlüftung', 'doppeltwirkend, Ø 25 mm, Hub 30 mm, ISO 6432 oder Kompaktbauform, mit Gabelkopf und Schwenkbefestigung', 1, 18, 40, 1, 'wirkt auf das Kniehebelgestänge; Hub per Anschlag auf 8 mm Fußhub begrenzen'],
  ['B', '5/2-Wegeventil', '24 V DC, G1/8, monostabil mit Federrückstellung, mit Stecker', 3, 12, 25, 1, 'Fußlüftung, Z-Hub Portal, Z-Hub Zuführung'],
  ['B', 'Drosselrückschlagventil', 'G1/8 auf Schlauch 6 mm, Abluftdrosselung', 6, 3, 6, 1, 'je Zylinder zwei: sanftes Aufsetzen'],
  ['B', 'Stellantrieb für das Pedal (Stufe 1)', 'Modellbau-Servo ≥ 35 kg·cm, Metallgetriebe (z. B. DS3235), mit Servohebel aus Alu', 1, 18, 30, 1, 'bewegt das Originalpedal; kein Eingriff in die Elektrik'],
  ['B', 'Gestänge Pedal', 'Gewindestange M4 200 mm, 2 Kugelgelenkköpfe M4, Winkel', 1, 6, 12, 1, ''],
  ['B', 'Drehgeber inkremental', '600 Impulse/U mit Nullimpuls (A, B, Z), 5–24 V, Welle Ø 6 mm (z. B. Bauart E6B2-CWZ)', 1, 20, 95, 1, 'koaxial am Handrad; unempfindlich gegen das Magnetfeld des Direktantriebs'],
  ['B', 'Wellenkupplung', 'flexibel (Balg oder Klauen), 6 × 6 mm', 1, 4, 10, 1, 'Handrad-Adapter ↔ Drehgeber'],
  ['B', 'Halter Drehgeber', 'Alu-Winkel 50 × 50 × 4, 150 mm, oder 3D-Druck', 1, 3, 6, 1, ''],
  ['B', 'Magnetischer Winkelsensor', 'AS5600-Modul mit diametralem Magnet 6 × 2,5 mm', 1, 3, 8, 1, 'billige Alternative zum Drehgeber; erst bei laufendem Motor auf Störungen prüfen', true],
  ['B', 'Pedal-Sollwert elektrisch (Stufe 2)', 'DAC MCP4725 (Breakout), Operationsverstärker MCP6002, Signalrelais 5 V 2 Wechsler, Lochrasterplatine', 1, 12, 20, 2, 'erst nach dem Ausmessen des Pedalsteckers; Umschalter Pedal/Rechner vorsehen'],

  ['C', 'Tischerweiterung vorn', 'Spanplatte melaminbeschichtet oder Multiplex 19 mm, 1250 × 400 mm', 1, 15, 30, 2, 'bündig mit Tisch und Maschinenbett; der Körper schwenkt 47 cm vor die Nadel'],
  ['C', 'Tischerweiterung hinten und links', 'wie oben, 1250 × 450 mm und 450 × 600 mm', 2, 15, 30, 2, '47 cm hinter und 31 cm links der Nadel werden überstrichen'],
  ['C', 'Tischverbinder und Stützwinkel', 'Flachverbinder, 4 Konsolen 300 mm, Schrauben', 1, 15, 30, 2, ''],
  ['C', 'PTFE-Glasgewebe-Klebeband', '50 mm × 10 m, 0,13 mm', 1, 14, 28, 2, 'über alle Fugen und die Kante zum Maschinenbett'],
  ['C', 'Aluprofil 40 × 40 Nut 8', 'Zuschnitte: 4 × 1 300 mm (Stützen), 2 × 1 300 mm, 2 × 1 100 mm (Rahmen oben)', 9.6, 9, 16, 2, 'Preis je Meter; eigenes Gestell über dem Tisch, nicht auf der Tischplatte'],
  ['C', 'Aluprofil 40 × 80 Nut 8', '2 × 700 mm (Träger der Y-Achse), 1 × 600 mm (Brücke)', 2, 16, 28, 2, 'Preis je Meter'],
  ['C', 'Winkel, Nutensteine, Schrauben', '24 Winkel 40 × 40, 100 Nutensteine M6, 100 Schrauben M6 × 16, 4 Stellfüße M8', 1, 45, 80, 2, ''],

  ['D', 'Polycarbonat-Platte', '1,5 mm, 750 × 500 mm, klar', 3, 10, 20, 2, 'Träger, Kalibrierplatte, Reserve; Zuschnitt nach traeger.svg (Stichsäge, Fräse oder Laserservice)'],
  ['D', 'PTFE-Klebefolie', '0,13–0,25 mm, 300 mm × 2 m', 1, 20, 35, 2, 'Unterseite des Trägers'],
  ['D', 'Sprühkleber wieder ablösbar', 'Textil-Sprühzeitkleber (z. B. Odif 505), 250 ml', 1, 10, 18, 2, 'hält den Jersey flach auf dem Träger, trägt nicht auf'],
  ['D', 'Zentrierstifte und Bohrbuchsen', 'Zylinderstifte Ø 6 m6 und Ø 4 m6, je 2; Bundbohrbuchsen Ø 6 und Ø 4, je 2', 1, 8, 16, 2, 'Kupplung Portal ↔ Trägerlasche'],
  ['D', 'Topfmagnet', 'Neodym Ø 20 mm mit Gewinde M4, ≈ 9 kg; Stahlscheibe Ø 25 mm', 2, 3, 6, 2, 'hält die Kupplung zusammen'],
  ['D', 'Laserzuschnitt Träger', 'Kontur nach traeger.svg und kalibrierplatte.svg in PC 1,5 mm oder Alu 1 mm', 1, 30, 70, 2, 'statt Selbstzuschnitt; genauer', true],

  ['E', 'Linearmodul mit Kugelgewindetrieb', 'Hub 400 mm, Steigung 5 mm (1605), Profilschienen- oder Doppelwellenführung, Flansch NEMA 23 (Bauart FSL40/FSK40)', 2, 85, 160, 2, 'X- und Y-Achse des Portals'],
  ['E', 'Linearführung für die zweite Seite', 'Profilschiene MGN15, 500 mm, mit Wagen MGN15H', 1, 20, 45, 2, 'stützt die Brücke gegenüber dem Y-Modul'],
  ['E', 'Closed-Loop-Schrittmotor mit Treiber', 'NEMA 23, 2 Nm, Geber 1 000 Striche, Treiber HBS57/CL57T, Kabel 3 m', 3, 45, 110, 2, 'X, Y, C'],
  ['E', 'Hohlwellen-Drehtisch', 'Baugröße 60–85, Untersetzung 10:1, Umkehrspiel ≤ 3 Winkelminuten, Flansch passend zum Motor', 1, 110, 300, 2, 'C-Achse; Datenblatt: „Umkehrspiel“ prüfen, nicht nur „Wiederholgenauigkeit“'],
  ['E', 'Führungszylinder Z', 'Kompaktschlitten oder Zwillingskolben Ø 16 mm, Hub 40 mm', 1, 20, 45, 2, 'hebt die Kupplung vom Träger'],
  ['E', 'Z-Säule', 'Alu-Rundrohr Ø 30 × 3 mm, 300 mm; 2 Klemmflansche', 1, 10, 20, 2, 'vom Drehtisch nach unten zur Kupplung'],
  ['E', 'Kupplungsplatte', 'Alu 8 mm, 80 × 60 mm, für Stifte und Magnet', 1, 4, 10, 2, ''],
  ['E', 'Induktiver Näherungsschalter', 'M8 oder M12, NPN Schließer, 10–30 V, Schaltabstand 2–4 mm', 4, 3, 9, 2, 'Referenz X, Y, C und Z oben'],
  ['E', 'Energiekette', '10 × 15 mm, 1 m', 2, 5, 10, 2, ''],

  ['F', 'Linearmodul mit Kugelgewindetrieb', 'Hub 150 mm und Hub 250 mm, Steigung 4–5 mm, Flansch NEMA 17 oder 23', 2, 60, 130, 3, 'X und Y der Zuführung; steht links neben dem Tisch auf dem Gestell'],
  ['F', 'Closed-Loop-Schrittmotor mit Treiber', 'NEMA 17 (0,5–0,7 Nm) oder NEMA 23, Geber 1 000 Striche', 3, 40, 100, 3, 'X, Y, θ'],
  ['F', 'Hohlwellen-Drehtisch klein', 'Baugröße 42–60, Untersetzung 10:1, Umkehrspiel ≤ 3 Winkelminuten', 1, 90, 260, 3, 'θ-Achse am Ende des Auslegers'],
  ['F', 'Führungszylinder Z', 'Ø 12–16 mm, Hub 30 mm', 1, 18, 40, 3, 'senkt die Platte auf das Trennblech'],
  ['F', 'Ausleger', 'Alu-Rechteckrohr 50 × 30 × 3 mm, 600 mm', 1, 8, 16, 3, 'biegesteif: an der Spitze ≤ 0,2 mm Durchbiegung'],
  ['F', 'Grundplatte', 'Alu 5 mm, 260 × 160 mm (Kontur nach aermelplatte.svg) oder 3D-Druck PETG 6 mm', 1, 8, 30, 3, ''],
  ['F', 'Filament', 'PETG 1,75 mm, 1 kg', 1, 18, 28, 3, 'Klappfinger, Servohalter, Adapter'],
  ['F', 'Mikroservo', '9–13 g, Metallgetriebe (Bauart MG90S), 180°', 12, 3, 6, 3, '11 Klappfinger + 1 Reserve'],
  ['F', 'Servotreiber', 'PCA9685, 16 Kanäle, I²C', 1, 5, 12, 3, ''],
  ['F', 'Netzteil Servos', '5 V / 10 A', 1, 10, 20, 3, 'eigene Versorgung, nicht aus dem Teensy'],
  ['F', 'Scharnierstifte und Gestänge', 'Edelstahlstift Ø 2 mm, 1 m; Federstahldraht Ø 1 mm, 1 m', 1, 4, 8, 3, ''],
  ['F', 'Moosgummi selbstklebend', 'Zellkautschuk oder Silikonschaum 1 mm, 200 × 300 mm', 2, 5, 12, 3, 'Reibbelag unter Platte und Fingern'],
  ['F', 'Induktiver Näherungsschalter', 'wie Gruppe E', 3, 3, 9, 3, 'Referenz X, Y, θ'],

  ['G', 'Federstahlblech', '1.4310, 0,3 mm, mindestens 300 × 300 mm, blank', 1, 12, 30, 3, 'Kontur nach trennblech.svg; Blechschere genügt, Kanten polieren'],
  ['G', 'Halter Trennblech', 'Alu-Flach 30 × 5 mm, 400 mm; 2 Rändelschrauben M5; Distanzscheiben', 1, 6, 12, 3, 'greift von vorn oben; Höhe einstellbar'],
  ['G', 'Polierpaste und Schleifvlies', 'fein', 1, 5, 10, 3, 'Blechoberseite und Kante zur Nadel'],
  ['G', 'Laserzuschnitt Trennblech', 'nach trennblech.svg in 1.4310 0,3 mm', 1, 25, 60, 3, 'statt Selbstzuschnitt', true],

  ['H', 'Mikrocontroller', 'Teensy 4.1 mit Stiftleisten', 1, 35, 45, 1, 'Echtzeit: Drehgeber, Schritterzeugung, Abläufe'],
  ['H', 'Klemmenplatine', 'Schraubklemmen-Adapter für Teensy 4.1', 1, 10, 22, 1, ''],
  ['H', 'Pegelwandler Ausgänge', '74HCT245 oder fertige 8-Kanal-Platine 3,3 V → 5 V', 3, 2, 8, 2, 'Teensy liefert 3,3 V, die Treibereingänge brauchen 5 V'],
  ['H', 'Optokoppler-Eingangsplatine', '8 Kanäle, 24 V → 3,3 V', 2, 6, 14, 1, 'Drehgeber, Näherungsschalter, Taster; Teensy ist nicht 5-V-fest'],
  ['H', 'MOSFET-Schaltplatine', '4 Kanäle, 24 V, mit Optokoppler und Freilaufdiode', 1, 6, 12, 1, 'Ventile'],
  ['H', 'Netzteil 48 V', '48 V / 10 A (≈ 480 W), Schaltnetzteil im Gehäuse', 1, 40, 90, 2, 'Schrittmotoren'],
  ['H', 'Netzteil 24 V', '24 V / 5 A (≈ 120 W)', 1, 18, 35, 1, 'Ventile, Sensoren'],
  ['H', 'Not-Aus-Taster', 'Pilztaster rot/gelb, 2 Öffner, im Aufbaugehäuse', 1, 10, 20, 1, ''],
  ['H', 'Sicherheitsrelais', 'Not-Aus-Schaltgerät 24 V, zweikanalig (z. B. Bauart PNOZ X oder gleichwertig)', 1, 50, 150, 2, 'schaltet Treiber-Freigabe und Pedal-Sollwert ab'],
  ['H', 'Zustimmtaster', 'dreistufig, 2 Schließer', 1, 35, 80, 2, 'für das Einrichten mit den Händen in Maschinennähe', true],
  ['H', 'Montageplatte und Hutschiene', 'Stahlblech 400 × 500 mm, Hutschiene 1 m, Verdrahtungskanal 2 m, 30 Reihenklemmen, Leitungsschutzschalter C6', 1, 45, 90, 2, ''],
  ['H', 'Leitungen und Stecker', 'Steuerleitung geschirmt 4 × 0,5 mm² 15 m, Litze 0,5 mm² 5 Farben, Aderendhülsen, 8 Rundstecker 4-polig', 1, 40, 70, 2, ''],
  ['H', 'Bedientaster', 'Leuchttaster grün/rot/gelb 22 mm', 3, 3, 7, 1, 'Start, Stopp, Quittieren'],

  ['I', 'Wartungseinheit', 'Filter-Druckregler G1/4 mit Manometer', 1, 18, 35, 1, ''],
  ['I', 'Schlauch und Verschraubungen', 'PU-Schlauch 6 mm 10 m; Steckverschraubungen G1/8 und T-Stücke, Sortiment', 1, 18, 30, 1, ''],
  ['I', 'Kompressor', 'ölfrei, leise, 24 l, ≥ 6 bar', 1, 110, 220, 1, 'nur falls keine Druckluft vorhanden; Verbrauch ist gering', true],

  ['J', 'Messuhr mit Magnetstativ', 'Ablesung 0,01 mm, Messweg 10 mm', 1, 25, 45, 1, 'Vorschubverlauf, Spiel und Wiederholgenauigkeit der Achsen'],
  ['J', 'Fühlerlehre und Stahlmaßstab', 'Fühlerlehre 0,05–1 mm; Stahlmaßstab 300 mm; Messschieber', 1, 15, 40, 1, 'falls nicht vorhanden'],
  ['J', 'Markierstift selbstlöschend', 'Trickmarker für Textil', 2, 3, 6, 2, 'Sollinie und Passzeichen'],
  ['J', 'Linienlaser', 'Kreuzlinien-Lasermodul 650 nm, 5 mW, fokussierbar, 5 V', 2, 5, 12, 3, 'zeigt beim Auflegen von Hand die Sollage des Ärmels'],
  ['J', 'USB-Kamera', '1080p, manueller Fokus, Objektiv 6–8 mm', 1, 35, 80, 4, 'Lagekorrektur des Ärmels'],
  ['J', 'LED-Leuchtplatte', 'A4, dimmbar', 1, 12, 25, 4, 'Durchlicht für die Konturerkennung'],
  ['J', 'Laser-Distanzsensor', 'Triangulation, Messbereich ≈ 30 ± 5 mm, Auflösung ≤ 0,05 mm, Analog- oder IO-Link-Ausgang', 1, 110, 260, 4, 'Kantensensor über die 0,6-mm-Stufe (gleiche Stofffarbe)', true],
];

const rows = items.map(([g, name, spec, qty, lo, hi, stage, note, opt], i) => ({ pos: 0, g, name, spec, qty, lo, hi, stage, note: note || '', opt: !!opt, i }));
const byG = (id) => rows.filter((r) => r.g === id);
for (const g of groups) byG(g.id).forEach((r, k) => { r.pos = `${g.id}${k + 1}`; });
const eur = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const eur2 = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: v < 10 && v % 1 ? 2 : 0, maximumFractionDigits: 2 });
const sum = (list, f) => list.reduce((a, r) => a + r.qty * f(r), 0);

await mkdir('prototyp', { recursive: true });
const csv = ['pos;gruppe;bezeichnung;spezifikation;menge;einzelpreis_von_eur;einzelpreis_bis_eur;summe_von_eur;summe_bis_eur;ab_stufe;optional;hinweis'];
for (const r of rows) csv.push([r.pos, groups.find((g) => g.id === r.g).name, r.name, r.spec, String(r.qty).replace('.', ','), String(r.lo).replace('.', ','), String(r.hi).replace('.', ','), (r.qty * r.lo).toFixed(2).replace('.', ','), (r.qty * r.hi).toFixed(2).replace('.', ','), r.stage, r.opt ? 'ja' : 'nein', r.note].map((x) => `"${String(x).replace(/"/g, '""')}"`).join(';'));
await writeFile('prototyp/einkaufsliste.csv', '﻿' + csv.join('\r\n') + '\r\n');

const must = rows.filter((r) => !r.opt), opt = rows.filter((r) => r.opt);
let md = `# Einkaufsliste Prototyp „Ärmel einsetzen“ (Zoje A6000)\n\n`;
md += `Zur Bauanleitung [prototyp-aermel-a6000.md](prototyp-aermel-a6000.md). Dieselbe Liste als Tabelle für Excel/Numbers: [\`prototyp/einkaufsliste.csv\`](../prototyp/einkaufsliste.csv).\n\n`;
md += `**Preise:** Richtwerte in Euro inkl. MwSt., von–bis je Stück. Die untere Grenze entspricht Importware vom Marktplatz, die obere Markenware vom Fachhandel. Es sind Schätzungen, keine Angebote; vor dem Bestellen aktuelle Preise prüfen. Die Nähmaschine selbst, ein Rechner, ein 3D-Drucker und Handwerkzeug sind nicht enthalten.\n\n`;
md += `**Spalte „ab Stufe“:** Die Teile werden erst in der genannten Ausbaustufe gebraucht. So lässt sich schrittweise bestellen.\n\n`;
md += `## Summen\n\n| Gruppe | Pflichtteile | optionale Teile |\n|---|---|---|\n`;
for (const g of groups) { const m = byG(g.id).filter((r) => !r.opt), o = byG(g.id).filter((r) => r.opt); md += `| ${g.id} – ${g.name} | ${eur(sum(m, (r) => r.lo))}–${eur(sum(m, (r) => r.hi))} € | ${o.length ? `${eur(sum(o, (r) => r.lo))}–${eur(sum(o, (r) => r.hi))} €` : '–'} |\n`; }
md += `| **Gesamt** | **${eur(sum(must, (r) => r.lo))}–${eur(sum(must, (r) => r.hi))} €** | ${eur(sum(opt, (r) => r.lo))}–${eur(sum(opt, (r) => r.hi))} € |\n\n`;
md += `### Nach Ausbaustufe (Pflichtteile, aufsummiert)\n\n| bis einschließlich | zusätzlich nötig | Summe bis hier |\n|---|---|---|\n`;
let acc = [0, 0];
for (const s of [1, 2, 3, 4]) { const l = must.filter((r) => r.stage === s), a = sum(l, (r) => r.lo), b = sum(l, (r) => r.hi); acc = [acc[0] + a, acc[1] + b]; md += `| Stufe ${s} | ${eur(a)}–${eur(b)} € | ${eur(acc[0])}–${eur(acc[1])} € |\n`; }
md += `\n`;
for (const g of groups) {
  md += `## ${g.id} – ${g.name}\n\nBezug: ${g.note}.\n\n| Pos. | Teil | Spezifikation | Menge | Stückpreis | ab Stufe | Hinweis |\n|---|---|---|---|---|---|---|\n`;
  for (const r of byG(g.id)) md += `| ${r.pos} | ${r.name}${r.opt ? ' *(optional)*' : ''} | ${r.spec} | ${String(r.qty).replace('.', ',')} | ${eur2(r.lo)}–${eur2(r.hi)} € | ${r.stage} | ${r.note} |\n`;
  md += `\n`;
}
md += `## Selbst anzufertigen (kein Kauf)\n\n| Teil | Vorlage | Verfahren |\n|---|---|---|\n`;
md += `| Werkstückträger mit Lasche | \`prototyp/traeger.svg\` | PC 1,5 mm sägen/fräsen oder Laserservice |\n| Kalibrierplatte | \`prototyp/kalibrierplatte.svg\` | wie Träger, Löcher Ø 1,5 mm bohren |\n| Trennblech | \`prototyp/trennblech.svg\` | Blechschere, Kanten polieren |\n| Grundplatte und 11 Klappfinger | \`prototyp/aermelplatte.svg\` | Alu sägen bzw. 3D-Druck |\n| Handrad-Adapter für den Drehgeber | nach Maß am Handrad | 3D-Druck oder Drehteil |\n| Hebel der Fußlüftung | nach Maß am Kniehebelgestänge | Alu-Flach 30 × 6 mm |\n| Zuschnitte Körper und Ärmel | \`prototyp/schnittteile.svg\` | 1:1 drucken, zuschneiden |\n`;
await writeFile('docs/prototyp-einkaufsliste.md', md);
console.log(`Positionen: ${rows.length} (${must.length} Pflicht, ${opt.length} optional)`);
console.log(`Pflichtteile: ${eur(sum(must, (r) => r.lo))}–${eur(sum(must, (r) => r.hi))} €, optional ${eur(sum(opt, (r) => r.lo))}–${eur(sum(opt, (r) => r.hi))} €`);
for (const g of groups) console.log(g.id, eur(sum(byG(g.id).filter((r) => !r.opt), (r) => r.lo)), '–', eur(sum(byG(g.id).filter((r) => !r.opt), (r) => r.hi)));
