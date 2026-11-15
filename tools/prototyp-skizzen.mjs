// Prinzipskizzen für die Bauanleitung (nicht maßstäblich, Höhen überhöht).
//   node tools/prototyp-skizzen.mjs [Bildordner]     (Standard: docs/bilder/prototyp/)
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const fig = process.argv[2] || 'docs/bilder/prototyp';
await mkdir(fig, { recursive: true });
const FONT = 'font-family="Arial, Helvetica, sans-serif"';
const C = { body: '#2a78d6', sleeve: '#d98a1f', sep: '#7a8791', mach: '#3d4a45', grip: '#c0392b', feed: '#1a8f4a', ink: '#1c2422', mute: '#6b7773', car: '#9aa7b3', table: '#d9dedb', foam: '#f0c9a0' };
const doc = (w, h, inner, title) => `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${FONT} font-size="13">\n<rect width="100%" height="100%" fill="#fff"/>\n<title>${title}</title>\n<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C.ink}"/></marker></defs>\n${inner}\n</svg>\n`;
const rect = (x, y, w, h, fill, stroke = C.ink, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" ${extra}/>`;
const text = (x, y, t, o = {}) => `<text x="${x}" y="${y}" fill="${o.c || C.ink}" font-size="${o.s || 13}" text-anchor="${o.a || 'start'}"${o.b ? ' font-weight="bold"' : ''}>${t}</text>`;
const line = (x1, y1, x2, y2, o = {}) => `<path d="M${x1},${y1} L${x2},${y2}" stroke="${o.c || C.ink}" stroke-width="${o.w || 1}" fill="none"${o.d ? ` stroke-dasharray="${o.d}"` : ''}${o.m ? ' marker-end="url(#ar)"' : ''}/>`;
const lead = (x1, y1, x2, y2, t, o = {}) => line(x1, y1, x2, y2, { c: C.mute, w: 0.8 }) + text(o.a === 'end' ? x1 - 4 : x1 + 4, y1 + 4, t, { s: 12, ...o });

// ------------------------------------------------------------- Abb. 5: Schnitte durch die Nahtstelle
{
  let s = text(20, 26, 'A – Querschnitt 30 mm vor der Nadel (Blick in Transportrichtung, Höhen 12-fach überhöht)', { b: true });
  // Maßstab: quer 6 px/mm, hoch 12-fach → 1 mm = 72 px wäre zu viel; hier 1 mm Höhe = 22 px
  const x0 = 420, xs = 6, yT = 250, hz = 22;           // x0 = Nahtlinie (X = 0), yT = Tischoberkante
  const X = (mm) => x0 + mm * xs, H = (mm) => mm * hz;
  s += rect(60, yT, 640, 36, C.table) + text(70, yT + 24, 'Tisch / Stichplatte', { c: C.mach });
  // Träger 1 mm bis 16 mm links der Naht
  s += rect(60, yT - H(1), X(-16) - 60, H(1), C.car) + text(70, yT - H(1) + 16, 'Träger 1 mm', { s: 12 });
  // Körper 0,55 mm: auf dem Träger, dann Stufe auf den Tisch bis zur Schnittkante (+10 mm)
  const b = H(0.55);
  s += `<path d="M60,${yT - H(1) - b} L${X(-16) - 4},${yT - H(1) - b} L${X(-12)},${yT - b} L${X(10)},${yT - b} L${X(10)},${yT} L${X(-12) - 6},${yT} L${X(-16) - 4},${yT - H(1)} L60,${yT - H(1)} Z" fill="${C.body}" fill-opacity="0.55" stroke="${C.body}"/>`;
  // Trennblech 0,3 mm: liegt auf dem Körper, über dem Schlitz frei (leicht durchhängend)
  const yS = yT - H(1) - b - H(0.3);
  s += `<path d="M60,${yS} L${X(-16)},${yS} Q${X(-4)},${yS + 6} ${X(13)},${yS + 12} L${X(13)},${yS + 12 + H(0.3)} Q${X(-4)},${yS + 6 + H(0.3)} ${X(-16)},${yS + H(0.3)} L60,${yS + H(0.3)} Z" fill="${C.sep}" stroke="${C.ink}"/>`;
  // Ärmel 0,55 mm auf dem Trennblech bis zur Schnittkante
  s += `<path d="M60,${yS - b} L${X(-16)},${yS - b} Q${X(-4)},${yS - b + 6} ${X(10)},${yS - b + 11} L${X(10)},${yS + 11} Q${X(-4)},${yS + 6} ${X(-16)},${yS} L60,${yS} Z" fill="${C.sleeve}" fill-opacity="0.6" stroke="${C.sleeve}"/>`;
  // Grundplatte mit Moosgummi bis 20 mm links der Naht, Klappfinger von −18 bis +7 mm
  const yP = yS - b;
  s += rect(60, yP - H(1), X(-20) - 60, H(1), C.foam, C.ink) + rect(60, yP - H(1) - 34, X(-20) - 60, 34, '#e7ecea');
  s += text(70, yP - H(1) - 12, 'Grundplatte, unten Moosgummi 1 mm');
  s += `<path d="M${X(-18)},${yP - H(1) - 14} L${X(7)},${yP - H(1) - 4 + 10} L${X(7)},${yP + 10} Q${X(-4)},${yP + 6} ${X(-18)},${yP} Z" fill="#fbe3df" stroke="${C.grip}" stroke-width="1.4"/>`;
  s += `<circle cx="${X(-18)}" cy="${yP - H(1) - 16}" r="6" fill="#fff" stroke="${C.grip}" stroke-width="1.6"/>`;
  // Nahtlinie, Fußbreite
  s += line(x0, 60, x0, yT + 50, { c: C.grip, d: '5,4' }) + text(x0 + 6, 74, 'Nahtlinie = Nadelbahn', { c: C.grip, s: 12 });
  s += rect(X(-9), 86, 18 * xs, 26, 'none', C.grip, 'stroke-dasharray="3,3"') + text(X(11), 104, 'Breite des Nähfußes (18 mm), folgt 14 mm dahinter', { c: C.grip, s: 12 });
  // Maße unten
  const yd = yT + 62;
  s += line(X(-16), yd, x0, yd, { m: true }) + line(x0, yd, X(-16), yd, { m: true }) + text(X(-8), yd + 16, 'Schlitz 16', { a: 'middle', s: 12 });
  s += line(x0, yd, X(10), yd, { m: true }) + line(X(10), yd, x0, yd, { m: true }) + text(X(5), yd + 16, 'Zugabe 10', { a: 'middle', s: 12 });
  s += line(X(-18), yd + 26, X(7), yd + 26, { m: true, c: C.grip }) + line(X(7), yd + 26, X(-18), yd + 26, { m: true, c: C.grip }) + text(X(-5), yd + 42, 'Klappfinger 18 + 7 mm', { a: 'middle', s: 12, c: C.grip });
  // Legende rechts
  const lx = 720;
  [[C.sleeve, 'Ärmel 0,55 mm (oben, rechte Seite unten)'], [C.sep, 'Trennblech 0,3 mm, poliert'], [C.body, 'Körper 0,55 mm (rechte Seite oben)'], [C.car, 'Werkstückträger 1 mm'], ['#fbe3df', 'Klappfinger (Scharnier links)']].forEach(([c, t], i) => { s += rect(lx, 150 + i * 24, 18, 12, c, C.ink) + text(lx + 26, 161 + i * 24, t, { s: 12 }); });
  s += text(lx, 290, 'Die Platte drückt den Ärmel auf das Trennblech.', { s: 12, c: C.mute }) + text(lx, 306, 'Moosgummi haftet (μ ≈ 0,8), das polierte Blech', { s: 12, c: C.mute }) + text(lx, 322, 'gleitet (μ ≈ 0,15): der Ärmel folgt der Platte,', { s: 12, c: C.mute }) + text(lx, 338, 'der Körper darunter dem Träger.', { s: 12, c: C.mute });

  // B – Längsschnitt in der Nahtbahn
  const oy = 400;
  s += text(20, oy + 26, 'B – Längsschnitt in der Nahtbahn (Blick von links, Transport nach rechts)', { b: true });
  const y2 = oy + 250, n0 = 560, ys = 5.2;            // n0 = Nadel, ys px/mm in Transportrichtung
  const Yx = (mm) => n0 + mm * ys;                     // mm: Y-Koordinate (negativ = vor der Nadel)
  s += rect(60, y2, 900, 36, C.table) + rect(Yx(-7), y2 - 6, 14 * ys, 10, '#8b9792') + text(Yx(-7), y2 + 52, 'Transporteur', { s: 12, c: C.mach });
  // Körper durchgehend auf der Stichplatte (im Schlitz kein Träger)
  s += rect(60, y2 - b, 900, b, C.body, C.body, 'fill-opacity="0.55"');
  // Trennblech bis 16 mm vor der Nadel, 2 mm über dem Tisch
  const yS2 = y2 - b - 26;
  s += `<path d="M60,${yS2} L${Yx(-16) - 14},${yS2} L${Yx(-16)},${yS2 + 7} L60,${yS2 + 7} Z" fill="${C.sep}" stroke="${C.ink}"/>`;
  // Ärmel: auf dem Blech, fällt hinter der Kante auf den Körper
  s += `<path d="M60,${yS2 - b} L${Yx(-16) - 10},${yS2 - b} C${Yx(-14)},${yS2 - b} ${Yx(-13)},${y2 - 2 * b} ${Yx(-9)},${y2 - 2 * b} L960,${y2 - 2 * b} L960,${y2 - b} L${Yx(-9)},${y2 - b} C${Yx(-13)},${y2 - b} ${Yx(-13)},${yS2} ${Yx(-16) - 10},${yS2} L60,${yS2} Z" fill="${C.sleeve}" fill-opacity="0.6" stroke="${C.sleeve}"/>`;
  // Finger: einer liegt noch auf (vor der Freigabelinie), einer ist hochgeklappt
  s += rect(Yx(-62), yS2 - b - 16, 20 * ys - 4, 16, '#fbe3df', C.grip) + rect(Yx(-41), yS2 - b - 16, 20 * ys - 4, 16, '#fbe3df', C.grip);
  s += `<path d="M${Yx(-20)},${yS2 - b - 4} L${Yx(-20) + 12},${yS2 - b - 78} L${Yx(-20) + 26},${yS2 - b - 74} L${Yx(-20) + 14},${yS2 - b} Z" fill="#fbe3df" stroke="${C.grip}" stroke-dasharray="4,3"/>`;
  s += text(Yx(-62), yS2 - b - 24, 'Finger liegen auf', { s: 12, c: C.grip }) + text(Yx(-20) - 30, yS2 - b - 86, 'hochgeklappt', { s: 12, c: C.grip });
  // Nähfuß und Nadel
  s += `<path d="M${Yx(-16)},${y2 - 2 * b - 2} L${Yx(-12)},${y2 - 2 * b - 14} L${Yx(-3)},${y2 - 2 * b - 14} L${Yx(-3)},${y2 - 2 * b - 110} L${Yx(3)},${y2 - 2 * b - 110} L${Yx(3)},${y2 - 2 * b - 14} L${Yx(16)},${y2 - 2 * b - 14} L${Yx(16)},${y2 - 2 * b - 2} Z" fill="#eef1ef" stroke="${C.mach}" stroke-width="1.4"/>`;
  s += line(n0, y2 - 2 * b - 170, n0, y2 + 14, { c: C.ink, w: 2 }) + text(n0 + 8, y2 - 2 * b - 150, 'Nadel', { s: 12 }) + text(Yx(18), y2 - 2 * b - 60, 'Nähfuß (PTFE)', { s: 12, c: C.mach });
  // Stiche hinter der Nadel
  for (let k = 1; k <= 12; k++) s += line(Yx(k * 2.5 * 1.6), y2 - 2 * b, Yx(k * 2.5 * 1.6), y2, { c: C.grip, w: 1.2 });
  s += text(Yx(40), y2 - 2 * b - 10, 'vernäht', { s: 12, c: C.grip });
  // Linien: Freigabe 18, Blechkante 16
  s += line(Yx(-18), oy + 60, Yx(-18), y2 + 60, { c: C.grip, d: '3,3' }) + text(Yx(-18) - 6, oy + 56, 'Freigabelinie −18 mm', { s: 12, c: C.grip, a: 'end' });
  s += line(Yx(-16), oy + 78, Yx(-16), y2 + 44, { c: C.sep, d: '3,3' }) + text(Yx(-16) + 6, y2 + 44, 'Blechkante −16 mm', { s: 12, c: '#4f5b63' });
  s += line(700, oy + 60, 800, oy + 60, { m: true, w: 1.5 }) + text(700, oy + 52, 'Transportrichtung', { s: 12 });
  s += text(70, yS2 + 22, 'Trennblech', { s: 12 }) + text(70, yS2 - b - 48, 'Ärmel: von Platte und Fingern geführt', { s: 12, c: C.sleeve }) + text(70, y2 - b + 30, 'Körper liegt hier auf der Stichplatte (Schlitz im Träger)', { s: 12, c: C.body });
  await writeFile(join(fig, 'abb5-schnitt.svg'), doc(1010, 730, s, 'Schnitte durch die Nahtstelle'));
}

// ------------------------------------------------------------- Abb. 6: Klappfinger mit Mikroservo
{
  let s = text(20, 26, 'Klappfinger – Seitenansicht quer zur Naht (nicht maßstäblich)', { b: true });
  const yB = 300;                                     // Oberkante Ärmel
  s += rect(40, yB + 22, 620, 14, C.sep) + rect(40, yB, 500, 22, C.sleeve, C.sleeve, 'fill-opacity="0.6"') + text(48, yB + 16, 'Ärmel', { s: 12 }) + text(48, yB + 52, 'Trennblech', { s: 12 });
  // Grundplatte
  s += rect(40, yB - 46, 280, 34, '#e7ecea') + rect(40, yB - 12, 280, 12, C.foam) + text(52, yB - 24, 'Grundplatte 6 mm (PETG/Alu)');
  s += text(52, yB - 60, 'Moosgummi 1 mm', { s: 12, c: C.mute });
  // Scharnier
  const hx = 336, hy = yB - 30;
  s += `<circle cx="${hx}" cy="${hy}" r="9" fill="#fff" stroke="${C.grip}" stroke-width="2"/><circle cx="${hx}" cy="${hy}" r="2.5" fill="${C.grip}"/>`;
  s += lead(hx - 20, 110, hx, hy - 10, 'Scharnierstift Ø 2 mm, 18 mm neben der Naht', { a: 'end' });
  // Finger unten
  s += `<path d="M${hx + 6},${hy - 8} L${hx + 150},${yB - 22} L${hx + 150},${yB - 8} L${hx + 6},${yB - 8} Z" fill="#fbe3df" stroke="${C.grip}" stroke-width="1.5"/>` + rect(hx + 8, yB - 8, 142, 8, C.foam);
  s += text(hx + 30, yB - 34, 'Finger (liegt auf)', { c: C.grip, s: 12 });
  // Finger oben (gestrichelt)
  s += `<path d="M${hx - 6},${hy - 6} L${hx - 6},${hy - 150} L${hx + 14},${hy - 150} L${hx + 22},${hy - 6} Z" fill="none" stroke="${C.grip}" stroke-dasharray="5,4" stroke-width="1.5"/>` + text(hx + 26, hy - 120, 'hochgeklappt (≥ 85°)', { c: C.grip, s: 12 });
  s += `<path d="M${hx + 120},${yB - 60} A120,120 0 0 0 ${hx + 30},${hy - 118}" fill="none" stroke="${C.grip}" marker-end="url(#ar)"/>`;
  // Servo auf der Grundplatte
  s += rect(150, yB - 110, 86, 64, '#3a4a55') + text(158, yB - 82, 'Mikroservo', { c: '#fff', s: 12 }) + text(158, yB - 66, '9 g', { c: '#fff', s: 12 });
  s += `<circle cx="236" cy="${yB - 96}" r="8" fill="#fff" stroke="${C.ink}"/>` + line(236, yB - 96, 268, yB - 124, { w: 3 }) + line(268, yB - 124, hx + 4, hy - 52, { w: 1.6 }) + `<circle cx="${hx + 4}" cy="${hy - 52}" r="3" fill="${C.ink}"/>`;
  s += lead(300, 150, 268, yB - 124, 'Servohebel und Gestänge (Federstahl 1 mm)', { a: 'end' });
  // Nahtlinie und Fuß
  const nx = hx + 108;
  s += line(nx, 70, nx, yB + 46, { c: C.grip, d: '5,4' }) + text(nx + 6, 84, 'Nahtlinie', { c: C.grip, s: 12 });
  s += rect(nx - 54, yB + 60, 108, 14, 'none', C.grip, 'stroke-dasharray="3,3"') + text(nx + 60, yB + 72, 'Bereich des Nähfußes', { c: C.grip, s: 12 });
  s += line(hx, yB + 96, nx, yB + 96, { m: true }) + line(nx, yB + 96, hx, yB + 96, { m: true }) + text((hx + nx) / 2, yB + 114, '18 mm', { a: 'middle', s: 12 });
  s += line(nx, yB + 96, hx + 150, yB + 96, { m: true }) + line(hx + 150, yB + 96, nx, yB + 96, { m: true }) + text(nx + 22, yB + 114, '7', { a: 'middle', s: 12 });
  s += text(700, 120, 'Ablauf', { b: true });
  ['1  Finger liegt auf: Ärmelkante wird bis', '   an die Naht geführt.', '2  Vorderes Fingerende erreicht die', '   Freigabelinie (18 mm vor der Nadel).', '3  Servo klappt den Finger hoch – er steht', '   jetzt 18 mm links der Naht und läuft', '   neben dem Nähfuß vorbei.', '4  Der Ärmel fällt hinter der Blechkante', '   auf den Körper und wird vernäht.'].forEach((t, i) => { s += text(700, 144 + i * 18, t, { s: 12 }); });
  await writeFile(join(fig, 'abb6-klappfinger.svg'), doc(1010, 440, s, 'Klappfinger mit Mikroservo'));
}

// ------------------------------------------------------------- Abb. 7: Portal und Zuführung, Ansicht von vorn
{
  let s = text(20, 26, 'Ansicht von vorn (Bedienerseite), nicht maßstäblich', { b: true });
  const yT = 430;
  s += rect(40, yT, 930, 22, C.table) + text(50, yT + 16, 'Gleitfläche, bündig mit dem Maschinenbett', { s: 12, c: C.mach });
  // Maschine
  s += rect(560, yT - 150, 250, 52, '#cfd8d3', C.mach) + rect(790, yT - 150, 70, 150, '#b4c0ba', C.mach) + rect(520, yT - 170, 80, 130, '#dfe6e2', C.mach);
  s += line(560, yT - 40, 560, yT - 4, { w: 2 }) + rect(548, yT - 12, 24, 8, '#fff', C.grip) + text(610, yT - 120, 'A6000', { c: C.mach }) + text(798, yT - 70, 'Ständer', { c: C.mach, s: 12 });
  s += lead(470, yT - 190, 540, yT - 160, 'Nähkopf ≈ 200 mm hoch', { a: 'end' });
  // Träger, Körper, Trennblech, Ärmel (schematisch)
  s += rect(150, yT - 5, 560, 5, C.car) + rect(170, yT - 10, 400, 5, C.body, C.body, 'fill-opacity="0.6"') + rect(330, yT - 16, 240, 4, C.sep) + rect(360, yT - 22, 200, 5, C.sleeve, C.sleeve, 'fill-opacity="0.7"');
  s += rect(370, yT - 36, 150, 14, '#e7ecea') + rect(522, yT - 36, 34, 14, '#fbe3df', C.grip);
  // Zuführung von links: Ausleger, θ, Z, XY-Einheit
  s += rect(410, yT - 96, 44, 60, '#3a4a55') + text(432, yT - 62, 'θ', { c: '#fff', a: 'middle' }) + rect(80, yT - 118, 380, 22, C.feed, C.ink, 'fill-opacity="0.35"') + rect(60, yT - 210, 90, 92, '#e7ecea');
  s += text(72, yT - 170, 'X-Y', { b: true }) + text(72, yT - 152, 'Zuführung', { s: 12 }) + text(170, yT - 124, 'Ausleger, Z-Hub 30 mm an der Lagerung', { s: 12, c: C.feed });
  s += line(60, yT - 118, 60, yT, { w: 3 }) + line(150, yT - 118, 150, yT - 0, { w: 0 });
  // Portal: Gestell, Brücke, Z-Säule zum Griffpunkt hinter dem Arm
  s += rect(30, 70, 16, yT - 70, '#c3c9cf') + rect(960, 70, 16, yT - 70, '#c3c9cf') + rect(30, 62, 946, 22, '#c3c9cf') + text(60, 56, 'Portalgestell (eigenes Gestell, Aluprofil 40×80), Brücke ≥ 450 mm über dem Tisch', { s: 12 });
  s += rect(600, 84, 120, 46, '#e7ecea') + text(612, 112, 'X-Y Portal', { b: true }) + rect(640, 130, 40, 60, '#3a4a55') + text(660, 166, 'C', { c: '#fff', a: 'middle' });
  s += rect(652, 190, 16, yT - 190 - 26, '#9aa7b3') + rect(636, yT - 26, 48, 18, C.grip, C.ink, 'fill-opacity="0.5"') + rect(610, yT - 8, 100, 4, C.car);
  s += lead(730, 250, 668, 280, 'Z-Säule Ø ≤ 60 mm, läuft hinter dem Arm');
  s += lead(730, yT - 40, 690, yT - 18, 'Kupplung auf der Trägerlasche');
  s += lead(250, yT - 60, 380, yT - 30, 'Grundplatte, Klappfinger', { a: 'end' });
  s += lead(250, yT - 40, 340, yT - 15, 'Trennblech (Halter von vorn oben)', { a: 'end' });
  // Maße
  s += line(1000, 62, 1000, yT, { m: true }) + line(1000, yT, 1000, 62, { m: true }) + text(992, 250, '≥ 450', { a: 'end', s: 12 });
  await writeFile(join(fig, 'abb7-ansicht.svg'), doc(1020, 470, s, 'Portal und Zuführung von vorn'));
}

// ------------------------------------------------------------- Abb. 8: Elektrik
{
  let s = text(20, 26, 'Blockschaltbild Steuerung', { b: true });
  const box = (x, y, w, h, t1, t2, fill = '#eef1ef') => rect(x, y, w, h, fill, C.ink, 'rx="6"') + text(x + w / 2, y + (t2 ? h / 2 - 3 : h / 2 + 5), t1, { a: 'middle', b: true }) + (t2 ? text(x + w / 2, y + h / 2 + 14, t2, { a: 'middle', s: 11.5, c: C.mute }) : '');
  const wire = (x1, y1, x2, y2, t, o = {}) => line(x1, y1, x2, y2, { m: true, ...o }) + (t ? text((x1 + x2) / 2 + (o.dx ?? 0), (y1 + y2) / 2 - 6 + (o.dy ?? 0), t, { a: 'middle', s: 11, c: C.mute }) : '');
  s += box(30, 190, 130, 60, 'PC / Laptop', 'Python: Bahn, Protokoll');
  s += box(240, 150, 180, 140, 'Teensy 4.1', 'Echtzeit 1 kHz', '#e3eef9');
  s += wire(160, 220, 240, 220, 'USB');
  // links unten: Sensoren
  s += box(30, 60, 150, 54, 'Drehgeber', 'Handrad, 600 Imp. + Z');
  s += wire(180, 87, 262, 150, 'A/B/Z');
  s += box(30, 320, 150, 54, 'Endschalter 7×', 'induktiv / mechanisch');
  s += wire(180, 347, 262, 290, 'Eingänge');
  // rechts: Achsen
  s += box(520, 50, 190, 54, '4 Treiber Portal', 'X1, X2/Y, C – Closed Loop');
  s += box(520, 122, 190, 54, '3 Treiber Zuführung', 'X, Y, θ – Closed Loop');
  s += box(520, 194, 190, 54, 'PCA9685 Servotreiber', '11 Klappfinger');
  s += box(520, 266, 190, 54, 'MOSFET-Karte 24 V', 'Fußlüftung, Z-Zylinder 2×');
  s += box(520, 338, 190, 54, 'DAC MCP4725 + OPV', 'Pedal-Sollwert (Stufe 2)');
  [77, 149, 221, 293, 365].forEach((y, i) => { s += wire(420, 180 + i * 20, 520, y, ['Step/Dir', 'Step/Dir', 'I²C', 'GPIO', 'I²C'][i], { dx: -6 }); });
  s += box(790, 50, 190, 54, 'Motoren Portal', 'NEMA 23, 3 Nm') + box(790, 122, 190, 54, 'Motoren Zuführung', 'NEMA 17') + box(790, 194, 190, 54, 'Mikroservos', '5 V eigenes Netzteil') + box(790, 266, 190, 54, 'Ventile 24 V', '5/2-Wege') + box(790, 338, 190, 54, 'Steuerkasten A6000', 'Pedal-Eingang');
  [77, 149, 221, 293, 365].forEach((y) => { s += wire(710, y, 790, y); });
  // Sicherheit
  s += box(240, 330, 180, 62, 'Not-Aus-Relais', 'zweikanalig', '#fbe3df');
  s += wire(330, 330, 330, 290, '', {}) + text(338, 314, 'Freigabe', { s: 11, c: C.grip });
  s += `<path d="M420,372 L470,372 L470,420 L885,420 L885,392" fill="none" stroke="${C.grip}" stroke-dasharray="5,4" marker-end="url(#ar)"/>` + text(660, 414, 'Not-Aus: Sollwert auf „Ruhe“ (Relaiskontakt), Treiber-Freigabe aus', { a: 'middle', s: 11.5, c: C.grip });
  s += `<path d="M470,372 L470,30 L615,30 L615,50" fill="none" stroke="${C.grip}" stroke-dasharray="5,4" marker-end="url(#ar)"/>`;
  s += text(30, 440, 'Netzteile: 48 V / 10 A (Schrittmotoren) · 24 V / 5 A (Ventile, Sensoren) · 5 V / 5 A (Servos) · Teensy über USB bzw. 5 V', { s: 12, c: C.mute });
  await writeFile(join(fig, 'abb8-elektrik.svg'), doc(1010, 456, s, 'Blockschaltbild'));
}
console.log('Skizzen geschrieben nach', fig);
