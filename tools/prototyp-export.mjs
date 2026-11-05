// Fertigungsunterlagen für den Prototyp „Ärmel einsetzen“ an einer Flachbett-Steppstichmaschine
// (Zoje A6000): Schnittteile, Werkstückträger, Trennblech, Vakuumplatte als 1:1-SVG und die
// Bahntabelle für Körperführung und Ärmelzuführung als CSV. Alle Daten kommen aus demselben
// Modell wie die Simulation (setInBody, fitSleeve, Mehrweitenprofil, Freigabelinie).
//
//   node tools/prototyp-export.mjs [Ausgabeordner]      (Standard: prototyp/)
//
// Maschinenkoordinaten der Bahntabelle (Draufsicht, Ursprung = Einstichpunkt der Nadel):
//   X nach rechts (zum Ständer), Y nach hinten (Transportrichtung, vom Bediener weg),
//   θ Drehung gegen den Uhrzeigersinn von oben gesehen.
// Die Pose eines Teils ist die Lage seines Schnittteil-Ursprungs (Fadenkreuz im SVG).

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setInBody, fitSleeve, seamPath, pathAt, templateOutline } from '../src/physics/garments.js';
import { pointInPolygon } from '../src/physics/cloth.js';

const out = process.argv[2] || 'prototyp';
await mkdir(out, { recursive: true });

// ---------------------------------------------------------------- Geometrie aus dem Modell
const STITCH = 2.5e-3;           // Stichlänge [m]
const EASE_DIST = 0.4;           // Mittelwert des Mehrweitenprofils (wie im Modell)
const SLOT = 0.016;              // halbe Schlitzbreite im Träger [m]
const ALLOW = 0.01;              // Nahtzugabe [m]
const RELEASE = 0.018;           // Freigabelinie der Ärmelplatte vor der Nadel [m]
// Sperrbereiche der Maschine in Maschinenkoordinaten [m] (X0, X1, Y0, Y1) – an der eigenen
// Maschine nachmessen (Draufsicht ab Nadel) und hier eintragen, dann das Skript neu ausführen.
const HEAD = [-0.06, 0.06, -0.06, 0.06];   // Nähkopf mit Fadenhebel, Nadel- und Fußstange
const ARM = [0, 0.32, -0.055, 0.055];      // Arm bis zum Ständer

const body = setInBody();
const armhole = seamPath(body.outline, body.chains.armloch_links, ALLOW);
let sleeve = fitSleeve(armhole.length, 0.02);
// Ärmel so ausrichten wie in der Simulation (beide Teile auf derselben Seite der Naht, rechts auf rechts)
const sideOf = (path, outline) => { const q = pathAt(path, 0.02); return pointInPolygon(outline, q.p[0] - q.t[1] * 0.012, q.p[1] + q.t[0] * 0.012); };
let cap = seamPath(sleeve.outline, sleeve.chains.aermelkugel, ALLOW);
if (sideOf(cap, sleeve.outline) !== sideOf(armhole, body.outline)) {
  const mir = (pts) => pts.map(([x, z]) => [-x, z]);
  sleeve = { outline: mir(sleeve.outline).reverse(), chains: { aermelkugel: mir(sleeve.chains.aermelkugel) } };
  cap = seamPath(sleeve.outline, sleeve.chains.aermelkugel, ALLOW);
}
const ease = cap.length / armhole.length - 1;
const carrier = templateOutline(body.outline, body.chains.armloch_links, ALLOW + SLOT);

// ---------------------------------------------------------------- SVG-Hilfen (Einheiten mm, 1:1)
const mm = (v) => +(v * 1000).toFixed(2);
function svgDoc(title, items, note) {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const it of items) for (const [x, y] of it.pts) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  const pad = 0.02, W = maxx - minx + 2 * pad, H = maxy - miny + 2 * pad + 0.03;
  const X = (x) => mm(x - minx + pad), Y = (y) => mm(y - miny + pad);
  const body = items.map((it) => {
    const d = it.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x)},${Y(y)}`).join(' ') + (it.open ? '' : ' Z');
    return `<path d="${d}" fill="${it.fill || 'none'}" stroke="${it.stroke || '#000'}" stroke-width="${it.w || 0.3}"${it.dash ? ` stroke-dasharray="${it.dash}"` : ''}/>` + (it.label ? `<text x="${X(it.lx ?? it.pts[0][0])}" y="${Y(it.ly ?? it.pts[0][1])}" font-size="4" font-family="sans-serif">${it.label}</text>` : '');
  }).join('\n');
  // Ursprung (Fadenkreuz) und Maßstab 100 mm zur Kontrolle des Ausdrucks
  const ox = X(0), oy = Y(0);
  const cross = `<path d="M${ox - 5},${oy} L${ox + 5},${oy} M${ox},${oy - 5} L${ox},${oy + 5}" stroke="#c00" stroke-width="0.3"/><text x="${ox + 2}" y="${oy - 2}" font-size="3" fill="#c00" font-family="sans-serif">Ursprung</text>`;
  const sy = mm(H - 0.012);
  const scale = `<path d="M10,${sy} L110,${sy}" stroke="#000" stroke-width="0.6"/><path d="M10,${sy - 2} L10,${sy + 2} M110,${sy - 2} L110,${sy + 2}" stroke="#000" stroke-width="0.4"/><text x="10" y="${sy - 3}" font-size="3.5" font-family="sans-serif">100 mm (Ausdruck in Originalgröße prüfen)</text>`;
  const head = `<text x="10" y="8" font-size="5" font-family="sans-serif" font-weight="bold">${title}</text>` + (note ? `<text x="10" y="14" font-size="3.2" font-family="sans-serif">${note}</text>` : '');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${mm(W)}mm" height="${mm(H)}mm" viewBox="0 0 ${mm(W)} ${mm(H)}">\n${head}\n${body}\n${cross}\n${scale}\n</svg>\n`;
}

// Schnittteile: Körper (Vorder- und Rückenteil aufgeklappt, Schultern verbunden) und linker Ärmel
const shiftX = (pts, dx) => pts.map(([x, y]) => [x + dx, y]);
await writeFile(join(out, 'schnittteile.svg'), svgDoc('Schnittteile Gr. 86 (Schnittkante = Linie, Naht = gestrichelt)', [
  { pts: body.outline, label: 'Körper (Vorderteil unten, Rückenteil oben)', lx: -0.12, ly: 0.2 },
  { pts: body.holes[0], label: 'Hals', lx: -0.01, ly: 0.01 },
  { pts: armhole.points, open: true, dash: '2,1.5', stroke: '#06c', label: 'Armlochnaht', lx: armhole.points[0][0] + 0.012, ly: armhole.points[0][1] - 0.03 },
  { pts: shiftX(sleeve.outline, 0.32), label: 'Ärmel links (Kugel oben)', lx: 0.24, ly: 0.12 },
  { pts: shiftX(cap.points, 0.32), open: true, dash: '2,1.5', stroke: '#06c' },
], `Single Jersey, Fadenlauf längs (Y). Kugelnaht ${(cap.length * 1000).toFixed(1)} mm, Armlochnaht ${(armhole.length * 1000).toFixed(1)} mm, Mehrweite ${(ease * 100).toFixed(1)} %. Ärmelursprung = Ursprung + 320 mm in X.`));

// Werkstückträger: Körperkontur, entlang des Armlochs um Zugabe + Schlitz ausgespart
await writeFile(join(out, 'traeger.svg'), svgDoc('Werkstückträger (Alu 1 mm oder PC 1,5 mm), Schlitz entlang des Armlochs', [
  { pts: carrier, w: 0.4, label: 'Trägerkontur – lasern/fräsen', lx: -0.1, ly: 0.25 },
  { pts: body.outline, dash: '1,1', stroke: '#999', label: 'Körper (Lage)', lx: -0.1, ly: -0.28 },
  { pts: armhole.points, open: true, dash: '2,1.5', stroke: '#06c' },
], `Schlitz ${(SLOT * 1000).toFixed(0)} mm ab Naht. Hakenband (Klett, Hakenseite) an den Rändern als Nadelleiste. Griffpunkt/Zentrierung am Ursprung.`));

// Trennblech: vor dem Fuß, Bedienerseite; Hinterkante 16 mm vor der Nadel (Fußspitze)
const sep = [[-0.2, -0.25], [0.05, -0.25], [0.05, -0.024], [0.04, -0.016], [-0.19, -0.016], [-0.2, -0.026]];
await writeFile(join(out, 'trennblech.svg'), svgDoc('Trennblech (Federstahl 0,3 mm, poliert) – Draufsicht in Maschinenkoordinaten', [
  { pts: sep.map(([x, y]) => [x, -y]), w: 0.4, label: 'Trennblech', lx: -0.15, ly: 0.12 },
  { pts: [[-0.009, -0.016], [0.009, -0.016], [0.009, 0.016], [-0.009, 0.016]], stroke: '#c00', label: 'Nähfuß', lx: 0.012, ly: 0.0 },
], 'Ursprung = Nadel. Oben = hinten (Transportrichtung). Kanten entgraten, Vorderkante zur Nadel 30° anfasen, 2,5 mm über dem Tisch.'));

// Vakuumplatte der Ärmelzuführung: Ärmelkontur 3 mm nach innen, Raster der Saugkammern 30 mm
const inset = (P, d) => { // einfache Parallelverschiebung nach innen (für konvexe/flache Konturen ausreichend)
  let cx = 0, cy = 0; for (const [x, y] of P) { cx += x; cy += y; } cx /= P.length; cy /= P.length;
  return P.map(([x, y]) => { const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1; return [x - (dx / L) * d, y - (dy / L) * d]; });
};
const plate = inset(sleeve.outline, 0.003);
let pminx = Infinity, pmaxx = -Infinity, pminy = Infinity, pmaxy = -Infinity;
for (const [x, y] of plate) { pminx = Math.min(pminx, x); pmaxx = Math.max(pmaxx, x); pminy = Math.min(pminy, y); pmaxy = Math.max(pmaxy, y); }
const cells = [];
const CELL = 0.04;   // Kammerraster [m]
for (let x = pminx; x < pmaxx; x += CELL) for (let y = pminy; y < pmaxy; y += CELL) {
  const c = [x + CELL / 2, y + CELL / 2];
  if (pointInPolygon(plate, c[0], c[1])) cells.push({ pts: [[x + 0.001, y + 0.001], [x + CELL - 0.001, y + 0.001], [x + CELL - 0.001, y + CELL - 0.001], [x + 0.001, y + CELL - 0.001]], stroke: '#06c', w: 0.2, c });
}
// ---------------------------------------------------------------- Bahntabelle
// Körper: Armlochpunkt s an der Nadel, noch zu nähende Tangente zeigt zum Bediener (−Y).
// Ärmel: Kugelpunkt s_Ä(s) an der Nadel; s_Ä wächst mit dem Mehrweitenverhältnis 1 + E·w(u)/0,4.
const rotPose = (path, s) => {
  const { p, t } = pathAt(path, s);
  const yaw = -Math.atan2(t[0], t[1]);           // wie im Modell (rotY-Konvention)
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  const wx = p[0] * c + p[1] * sn, wz = -p[0] * sn + p[1] * c;
  return { x: -wx, z: -wz, yaw };                  // relativ zur Nadel (Modellkoordinaten)
};
const ratio = (u) => { const w = u < 0.1 || u > 0.9 ? 0 : Math.sin((Math.PI * (u - 0.1)) / 0.8) ** 2; return 1 + (ease * w) / EASE_DIST; };
const rows = ['stich;s_koerper_mm;s_aermel_mm;verhaeltnis;koerper_x_mm;koerper_y_mm;koerper_theta_grad;aermel_x_mm;aermel_y_mm;aermel_theta_grad'];
let sS = 0, lastYawB = null, lastYawS = null;
const unwrap = (a, ref) => { if (ref === null) return a; while (a - ref > Math.PI) a -= 2 * Math.PI; while (a - ref < -Math.PI) a += 2 * Math.PI; return a; };
const N = Math.floor(armhole.length / STITCH);
for (let k = 0; k <= N; k++) {
  const sB = Math.min(armhole.length, k * STITCH);
  if (k > 0) { const u0 = (sB - STITCH) / armhole.length; sS += STITCH * ratio(u0 + STITCH / (2 * armhole.length)); }
  const B = rotPose(armhole, sB), S = rotPose(cap, Math.min(cap.length, sS));
  B.yaw = lastYawB = unwrap(B.yaw, lastYawB); S.yaw = lastYawS = unwrap(S.yaw, lastYawS);
  // Modell (x, z) → Maschine (X = x, Y = −z); Drehsinn bleibt (siehe Kopf)
  rows.push([k, (sB * 1000).toFixed(2), (sS * 1000).toFixed(2), ratio(sB / armhole.length).toFixed(4),
    (B.x * 1000).toFixed(2), (-B.z * 1000).toFixed(2), (B.yaw * 180 / Math.PI).toFixed(2),
    (S.x * 1000).toFixed(2), (-S.z * 1000).toFixed(2), (S.yaw * 180 / Math.PI).toFixed(2)].join(';'));
}
// Griffpunkt des Körperportals auf dem Träger: maximaler Abstand über die ganze Naht zu
// Nähkopf (|X| ≤ 60, |Y| ≤ 60 mm), Arm (X 0…320, |Y| ≤ 55 mm) und der Senkrechtachse der
// Ärmelzuführung (Kreis 70 mm um den Ärmelursprung). Maschinenkoordinaten in m.
const traj = rows.slice(1).map((r) => r.split(';').map(Number)).map((r) => ({ bx: r[4] / 1000, by: r[5] / 1000, bt: r[6] * Math.PI / 180, sx: r[7] / 1000, sy: r[8] / 1000 }));
const boxDist = (x, y, x0, x1, y0, y1) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
let best = null;
for (let u = -0.13; u <= 0.13; u += 0.01) for (let v = -0.29; v <= 0.29; v += 0.01) {
  if (!pointInPolygon(carrier, u, v) || !pointInPolygon(carrier, u + 0.02, v) || !pointInPolygon(carrier, u - 0.02, v)) continue;
  let clr = Infinity, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const T of traj) {
    // Punkt (u, v) des Teils → Maschine: Modellrotation, dann Y = −z
    const c = Math.cos(T.bt), sn = Math.sin(T.bt);
    const X = T.bx + (u * c + v * sn), Y = T.by - (-u * sn + v * c);
    clr = Math.min(clr, boxDist(X, Y, ...HEAD), boxDist(X, Y, ...ARM), Math.hypot(X - T.sx, Y - T.sy) - 0.07);
    x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
  }
  // mindestens 90 mm Abstand, dann möglichst kleiner Verfahrweg des Portals
  const score = Math.min(clr, 0.09) * 100 - ((x1 - x0) + (y1 - y0));
  if (!best || score > best.score) best = { u, v, clr, score };
}
const G = best;
// Anlenkpunkt der Ärmelzuführung auf der Platte: Abstand zu Nähkopf/Arm und zur Portalachse (Griffpunkt)
const trajS = rows.slice(1).map((r) => r.split(';').map(Number)).map((r) => ({ sx: r[7] / 1000, sy: r[8] / 1000, st: r[9] * Math.PI / 180 }));
let bestF = null;
for (let u = -0.1; u <= 0.1; u += 0.005) for (let v = -0.03; v <= 0.09; v += 0.005) {
  if (!pointInPolygon(plate, u, v)) continue;
  let clr = Infinity, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  traj.forEach((T, i) => {
    const S = trajS[i], c = Math.cos(S.st), sn = Math.sin(S.st);
    const X = S.sx + (u * c + v * sn), Y = S.sy - (-u * sn + v * c);
    const cb = Math.cos(T.bt), sb = Math.sin(T.bt);
    const GX = T.bx + (G.u * cb + G.v * sb), GY = T.by - (-G.u * sb + G.v * cb);
    clr = Math.min(clr, boxDist(X, Y, ...HEAD), boxDist(X, Y, ...ARM), Math.hypot(X - GX, Y - GY) - 0.07);
    x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
  });
  const score = Math.min(clr, 0.04) * 100 - ((x1 - x0) + (y1 - y0));
  if (!bestF || score > bestF.score) bestF = { u, v, clr, score };
}
const F = bestF;
rows[0] += ';greif_x_mm;greif_y_mm;zufuehr_x_mm;zufuehr_y_mm';
for (let k = 1; k < rows.length; k++) {
  const T = traj[k - 1], c = Math.cos(T.bt), sn = Math.sin(T.bt), S = trajS[k - 1], cs = Math.cos(S.st), ss = Math.sin(S.st);
  rows[k] += ';' + ((T.bx + (G.u * c + G.v * sn)) * 1000).toFixed(2) + ';' + ((T.by - (-G.u * sn + G.v * c)) * 1000).toFixed(2)
    + ';' + ((S.sx + (F.u * cs + F.v * ss)) * 1000).toFixed(2) + ';' + ((S.sy - (-F.u * ss + F.v * cs)) * 1000).toFixed(2);
}
await writeFile(join(out, 'bahn_aermel.csv'), rows.join('\n') + '\n');
// Griffpunkt im Trägerplan nachtragen
await writeFile(join(out, 'traeger.svg'), svgDoc('Werkstückträger (Alu 1 mm oder PC 1,5 mm), Schlitz entlang des Armlochs', [
  { pts: carrier, w: 0.4, label: 'Trägerkontur – lasern/fräsen', lx: -0.1, ly: 0.25 },
  { pts: body.outline, dash: '1,1', stroke: '#999', label: 'Körper (Lage)', lx: -0.1, ly: -0.28 },
  { pts: armhole.points, open: true, dash: '2,1.5', stroke: '#06c' },
  { pts: Array.from({ length: 25 }, (_, i) => [G.u + 0.012 * Math.cos(i * Math.PI / 12), G.v + 0.012 * Math.sin(i * Math.PI / 12)]), stroke: '#c00', w: 0.4, label: `Griffpunkt Portal (C-Achse), Ø 24 mm – Abstand min. ${(G.clr * 1000).toFixed(0)} mm`, lx: G.u + 0.016, ly: G.v },
], `Schlitz ${(SLOT * 1000).toFixed(0)} mm ab Naht. Hakenband (Klett, Hakenseite) an den Rändern als Nadelleiste. Griffpunkt ${(G.u * 1000).toFixed(0)} / ${(G.v * 1000).toFixed(0)} mm vom Ursprung.`));

// Schaltzeitpunkte der Saugkammern: Kammer aus, sobald ihr Mittelpunkt die Freigabelinie
// (18 mm vor der Nadel, quer zur Transportrichtung) erreicht. Kammern, die die Linie nie
// erreichen, hängen am gemeinsamen Hauptventil.
for (const k of cells) k.off = null;
{
  let sSx = 0;
  for (let k = 0; k <= N; k++) {
    const sB = Math.min(armhole.length, k * STITCH);
    if (k > 0) { const u0 = (sB - STITCH) / armhole.length; sSx += STITCH * ratio(u0 + STITCH / (2 * armhole.length)); }
    const S = rotPose(cap, Math.min(cap.length, sSx)), c = Math.cos(S.yaw), sn = Math.sin(S.yaw);
    for (const cell of cells) {
      if (cell.off !== null) continue;
      const wz = -cell.c[0] * sn + cell.c[1] * c + S.z;   // Modell-z relativ zur Nadel (Bediener = +z)
      if (wz < RELEASE) cell.off = k;
      // Kammer nach der Freigabe im Bereich von Nähfuß/Nadel (quer ±(9 + 20 + 3) mm, bis 20 mm vor der Nadel)?
      const wx = cell.c[0] * c + cell.c[1] * sn + S.x;
      if (cell.off !== null && Math.abs(wx) < 0.032 && wz < 0.02 && wz > -0.04) cell.lift = true;
    }
  }
}
const switched = cells.filter((k) => k.off !== null).sort((a, b) => a.off - b.off);
switched.forEach((k, i) => { k.label = `V${i + 1}${k.lift ? '↑' : ''} (Stich ${k.off})`; if (k.lift) k.stroke = '#c00'; });
cells.filter((k) => k.off === null).forEach((k) => { k.label = 'H'; k.stroke = '#999'; });
for (const k of cells) { k.lx = k.c[0] - 0.012; k.ly = k.c[1] + 0.002; }
await writeFile(join(out, 'vakuumplatte.svg'), svgDoc(`Vakuumplatte Ärmelzuführung (${cells.length} Kammern à 38 × 38 mm, ${switched.length} schaltbar, Bohrungen Ø 1,5 mm im Raster 6 mm)`, [
  { pts: plate, w: 0.4, label: 'Plattenkontur (Ärmel − 3 mm)', lx: pminx, ly: pmaxy + 0.008 },
  ...cells,
  { pts: cap.points, open: true, dash: '2,1.5', stroke: '#c60', label: 'Kugelnaht', lx: cap.points[0][0], ly: cap.points[0][1] - 0.004 },
  { pts: Array.from({ length: 25 }, (_, i) => [F.u + 0.008 * Math.cos(i * Math.PI / 12), F.v + 0.008 * Math.sin(i * Math.PI / 12)]), stroke: '#c00', w: 0.4, label: 'Anlenkpunkt Zuführung (θ-Achse)', lx: F.u + 0.01, ly: F.v + 0.012 },
], `Ursprung = Ärmelursprung. V1…V${switched.length}: eigenes 3/2-Ventil, aus beim angegebenen Stich; ↑ (rot) = Segment muss zusätzlich 5 mm abheben (läuft sonst in den Nähfuß).`));



const summary = {
  stichlaenge_mm: STITCH * 1000, stiche: N, armlochnaht_mm: +(armhole.length * 1000).toFixed(1), kugelnaht_mm: +(cap.length * 1000).toFixed(1),
  mehrweite_prozent: +(ease * 100).toFixed(2), schlitz_mm: SLOT * 1000, freigabe_mm: RELEASE * 1000, saugkammern: cells.length,
  kammern_schaltbar: switched.map((k) => ({ ventil: k.label.split(' ')[0].replace('↑', ''), aus_bei_stich: k.off, abheben: !!k.lift })),
  griffpunkt_traeger_mm: [+(G.u * 1000).toFixed(0), +(G.v * 1000).toFixed(0)], griff_abstand_min_mm: +(G.clr * 1000).toFixed(0),
  anlenkpunkt_platte_mm: [+(F.u * 1000).toFixed(0), +(F.v * 1000).toFixed(0)], anlenk_abstand_min_mm: +(F.clr * 1000).toFixed(0),
  drehung_koerper_grad: +(rows.length > 2 ? (parseFloat(rows.at(-1).split(';')[6]) - parseFloat(rows[1].split(';')[6])).toFixed(1) : 0),
  drehung_aermel_grad: +(rows.length > 2 ? (parseFloat(rows.at(-1).split(';')[9]) - parseFloat(rows[1].split(';')[9])).toFixed(1) : 0),
};
await writeFile(join(out, 'kennwerte.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(`geschrieben nach ${out}/:`, ['schnittteile.svg', 'traeger.svg', 'trennblech.svg', 'vakuumplatte.svg', 'bahn_aermel.csv', 'kennwerte.json'].join(', '));
console.log(summary);
