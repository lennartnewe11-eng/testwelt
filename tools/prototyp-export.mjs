// Fertigungsunterlagen und Abbildungen für den Prototyp „Ärmel einsetzen“ an einer Flachbett-
// Steppstichmaschine (Zoje A6000). Alle Daten kommen aus demselben Modell wie die Simulation
// (setInBody, fitSleeve, Mehrweitenprofil, Freigabelinie).
//
//   node tools/prototyp-export.mjs [Ausgabeordner] [Bildordner]
//        Standard: prototyp/  und  docs/bilder/prototyp/
//
// Maschinenkoordinaten (Draufsicht, Ursprung = Einstichpunkt der Nadel):
//   X nach rechts (zum Ständer), Y nach hinten (Transportrichtung, vom Bediener weg),
//   θ Drehung gegen den Uhrzeigersinn von oben gesehen.
// Die Pose eines Teils ist die Lage seines Schnittteil-Ursprungs (Fadenkreuz in den Zeichnungen).
// Die Zeichnungen der Teile sind Draufsichten bei θ = 0 (oben = hinten).

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { setInBody, fitSleeve, seamPath, pathAt, templateOutline } from '../src/physics/garments.js';
import { pointInPolygon } from '../src/physics/cloth.js';

const out = process.argv[2] || 'prototyp';
const fig = process.argv[3] || 'docs/bilder/prototyp';
await mkdir(out, { recursive: true });
await mkdir(fig, { recursive: true });

// ================================================================ Parameter
const STITCH = 2.5e-3;           // Stichlänge [m]
const RPM = 400;                 // Drehzahl für die Geschwindigkeitsangaben
const EASE_DIST = 0.4;           // Mittelwert des Mehrweitenprofils (wie im Modell)
const SLOT = 0.016;              // halbe Schlitzbreite im Träger [m]
const ALLOW = 0.01;              // Nahtzugabe [m]
const RELEASE = 0.018;           // Freigabelinie vor der Nadel [m] (Finger klappen hier hoch)
const SEP_EDGE = 0.016;          // Hinterkante des Trennblechs vor der Nadel [m] (= Fußspitze)
const FINGER_W = 0.02;           // Breite eines Klappfingers entlang der Naht [m]
const FINGER_DEPTH = 0.018;      // Finger reichen von der Scharnierlinie (so weit neben der Naht) …
const FINGER_OVER = 0.007;       // … bis so weit über die Naht in die Nahtzugabe [m]
const COLUMN_R = 0.03;           // Radius der Senkrechtachse des Portals samt Kupplung [m]
// Sperrbereiche der Maschine in Maschinenkoordinaten [m] (X0, X1, Y0, Y1) – an der eigenen
// Maschine nachmessen (Draufsicht ab Nadel) und hier eintragen, dann das Skript neu ausführen.
const HEAD = [-0.06, 0.06, -0.06, 0.06];   // Nähkopf mit Fadenhebel, Nadel- und Fußstange
const ARM = [0, 0.27, -0.055, 0.055];      // Arm bis zum Ständer
const COLUMN_X = 0.26;                     // Ständer beginnt so weit rechts der Nadel
const FOOT = [-0.009, 0.009, -0.016, 0.016];

// ================================================================ Geometrie aus dem Modell
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
const carrier0 = templateOutline(body.outline, body.chains.armloch_links, ALLOW + SLOT);

// ---------------------------------------------------------------- kleine Geometrie-Helfer
const boxDist = (x, y, [x0, x1, y0, y1]) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L2)) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function polyDist(P, x, y) { // Abstand zur Kontur, innen negativ
  let d = Infinity;
  for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; d = Math.min(d, segDist(x, y, a[0], a[1], b[0], b[1])); }
  return pointInPolygon(P, x, y) ? -d : d;
}
function hull(pts) { // konvexe Hülle (Andrew)
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.slice().reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function clipBelowY(P, ymax) { // Sutherland–Hodgman: nur Y ≤ ymax behalten
  const o = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], ia = a[1] <= ymax, ib = b[1] <= ymax;
    if (ia) o.push(a);
    if (ia !== ib) { const t = (ymax - a[1]) / (b[1] - a[1]); o.push([a[0] + t * (b[0] - a[0]), ymax]); }
  }
  return o;
}
function growConvex(P, d) { // konvexe Kontur um d nach außen (Punkte radial vom Schwerpunkt, konservativ)
  let cx = 0, cy = 0; for (const [x, y] of P) { cx += x; cy += y; } cx /= P.length; cy /= P.length;
  return P.map(([x, y]) => { const dx = x - cx, dy = y - cy, L = Math.hypot(dx, dy) || 1; return [x + (dx / L) * d * 1.25, y + (dy / L) * d * 1.25]; });
}

// ================================================================ Bahn
// Körper: Armlochpunkt s an der Nadel, noch zu nähende Tangente zeigt zum Bediener (−Y).
// Ärmel: Kugelpunkt s_Ä(s) an der Nadel; s_Ä wächst mit dem Mehrweitenverhältnis 1 + E·w(u)/0,4.
const rotPose = (path, s) => {
  const { p, t } = pathAt(path, s);
  const yaw = -Math.atan2(t[0], t[1]);           // wie im Modell (rotY-Konvention)
  const c = Math.cos(yaw), sn = Math.sin(yaw);
  return { x: -(p[0] * c + p[1] * sn), y: -p[0] * sn + p[1] * c, th: yaw }; // Maschine: X = x, Y = −z
};
const ratio = (u) => { const w = u < 0.1 || u > 0.9 ? 0 : Math.sin((Math.PI * (u - 0.1)) / 0.8) ** 2; return 1 + (ease * w) / EASE_DIST; };
const unwrap = (a, ref) => { if (ref === null) return a; while (a - ref > Math.PI) a -= 2 * Math.PI; while (a - ref < -Math.PI) a += 2 * Math.PI; return a; };
const N = Math.floor(armhole.length / STITCH);
const traj = [];
{
  let sS = 0, lb = null, ls = null;
  for (let k = 0; k <= N; k++) {
    const sB = Math.min(armhole.length, k * STITCH);
    if (k > 0) { const u0 = (sB - STITCH) / armhole.length; sS += STITCH * ratio(u0 + STITCH / (2 * armhole.length)); }
    const B = rotPose(armhole, sB), S = rotPose(cap, Math.min(cap.length, sS));
    B.th = lb = unwrap(B.th, lb); S.th = ls = unwrap(S.th, ls);
    traj.push({ k, sB, sS, r: ratio(sB / armhole.length), B, S });
  }
}
// Punkt (u, v) eines Teils → Maschinenkoordinaten
const toM = (pose, u, v) => { const c = Math.cos(pose.th), s = Math.sin(pose.th); return [pose.x + u * c + v * s, pose.y + u * s - v * c]; };

// ================================================================ Ärmelplatte: Grundplatte und Klappfinger
// Normale der Kugelnaht, die in den Ärmel zeigt
const capIn = (s) => { const { p, t } = pathAt(cap, s); let n = [-t[1], t[0]]; if (!pointInPolygon(sleeve.outline, p[0] + n[0] * 0.012, p[1] + n[1] * 0.012)) n = [-n[0], -n[1]]; return { p, n }; };
const capOff = (s, d) => { const { p, n } = capIn(s); return [p[0] + n[0] * d, p[1] + n[1] * d]; };
const fingers = [];
for (let j = 0; j * FINGER_W < cap.length - 1e-4; j++) {
  const s0 = j * FINGER_W + 0.0008, s1 = Math.min(cap.length, (j + 1) * FINGER_W) - 0.0008;
  const pts = [];
  for (let q = 0; q <= 4; q++) pts.push(capOff(s0 + ((s1 - s0) * q) / 4, -FINGER_OVER));
  for (let q = 4; q >= 0; q--) pts.push(capOff(s0 + ((s1 - s0) * q) / 4, FINGER_DEPTH));
  // klappt hoch, sobald sein vorderes Ende (s0) die Freigabelinie erreicht
  const up = traj.find((T) => T.sS >= j * FINGER_W - RELEASE)?.k ?? 0;
  fingers.push({ j, pts, up, hinge: [capOff(s0, FINGER_DEPTH), capOff(s1, FINGER_DEPTH)], c: capOff((s0 + s1) / 2, FINGER_DEPTH / 2) });
}
// Grundplatte: innen neben der Scharnierlinie, sonst Ärmelkontur − 3 mm
let cxs = 0, cys = 0; for (const [x, y] of sleeve.outline) { cxs += x; cys += y; } cxs /= sleeve.outline.length; cys /= sleeve.outline.length;
const capSet = new Set(sleeve.chains.aermelkugel.map((p) => p.join(',')));
const hemPts = sleeve.outline.filter((p) => !capSet.has(p.join(','))).map(([x, y]) => { const dx = x - cxs, dy = y - cys, L = Math.hypot(dx, dy); return [x - (dx / L) * 0.004, y - (dy / L) * 0.004]; });
const inner = []; for (let s = 0.004; s <= cap.length - 0.004; s += 0.004) inner.push(capOff(s, FINGER_DEPTH + 0.002));
const dEnd = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
if (dEnd(inner.at(-1), hemPts[0]) > dEnd(inner.at(-1), hemPts.at(-1))) hemPts.reverse();
const plate = [...inner, ...hemPts];

// ================================================================ Trennblech: überstrichene Fläche des Ärmels vor dem Fuß
const sweepS = [];
for (const T of traj) for (const [u, v] of sleeve.outline) sweepS.push(toM(T.S, u, v));
let sep = clipBelowY(hull(sweepS), -SEP_EDGE);
sep = clipBelowY(growConvex(sep, 0.008), -SEP_EDGE);

// ================================================================ Anlenkpunkt der Ärmelzuführung (auf der Grundplatte)
let bestF = null;
// (darf bis 40 mm über die Saumkante hinaus auf einer Lasche der Grundplatte liegen: dort ist kein Stoff)
for (let u = -0.1; u <= 0.1; u += 0.005) for (let v = -0.03; v <= 0.14; v += 0.005) {
  const dP = polyDist(plate, u, v);
  if (dP > 0.04 || (dP > -0.012 && dP <= 0) || (dP > 0 && polyDist(sleeve.outline, u, v) < 0.012)) continue;
  let clr = Infinity, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const T of traj) { const [X, Y] = toM(T.S, u, v); clr = Math.min(clr, boxDist(X, Y, HEAD), boxDist(X, Y, ARM)); x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y); }
  const score = Math.min(clr, 0.07) * 100 - ((x1 - x0) + (y1 - y0)) - Math.max(0, dP) * 2;
  if (!bestF || score > bestF.score) bestF = { u, v, clr, score, tab: Math.max(0, dP) };
}
const F = bestF;
for (const T of traj) T.F = toM(T.S, F.u, F.v);

// ================================================================ Griffpunkt des Portals am Träger
// Die Senkrechtachse des Portals darf Nähkopf, Arm, Trennblech (liegt über dem Träger!) und den
// Ausleger der Ärmelzuführung (kommt von links) nie berühren. Liegt der beste Punkt außerhalb
// der Körperkontur, bekommt der Träger dort eine Lasche. Gesucht: kleinster Hebelarm zur Nadel.
const obstacle = (X, Y, T) => Math.min(
  boxDist(X, Y, HEAD), boxDist(X, Y, ARM), X > COLUMN_X ? 0 : COLUMN_X - X,
  polyDist(sep, X, Y),
  segDist(X, Y, T.F[0], T.F[1], -0.6, T.F[1]) - 0.03,      // Ausleger der Zuführung nach links
  Math.hypot(X - T.F[0], Y - T.F[1]) - 0.045,              // Dreh- und Hubeinheit über dem Anlenkpunkt
  polyDist(T.plateM, X, Y),                                // mitwandernde Ärmelplatte samt Fingern
);
for (const T of traj) T.plateM = hull(sleeve.outline.map(([u, v]) => toM(T.S, u, v)));
let bestG = null;
for (let u = -0.3; u <= 0.3; u += 0.01) for (let v = -0.46; v <= 0.46; v += 0.01) {
  // Die Kupplung muss frei zugänglich sein: mindestens 25 mm außerhalb der Stoffkontur (Lasche am Träger)
  const dC = polyDist(body.outline, u, v), tab = dC;
  if (dC < 0.025 || tab > 0.16) continue;
  let clr = Infinity, lever = 0, x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const T of traj) {
    const [X, Y] = toM(T.B, u, v);
    clr = Math.min(clr, obstacle(X, Y, T)); lever = Math.max(lever, Math.hypot(X, Y));
    x0 = Math.min(x0, X); x1 = Math.max(x1, X); y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
  }
  if (clr < COLUMN_R + 0.02) continue;
  const score = -(lever + 0.6 * tab + 0.15 * ((x1 - x0) + (y1 - y0)));
  if (!bestG || score > bestG.score) bestG = { u, v, clr, lever, tab, score, x0, x1, y0, y1 };
}
if (!bestG) throw new Error('kein kollisionsfreier Griffpunkt gefunden – Sperrbereiche prüfen');
bestG.tab = Math.max(bestG.tab, 0.001);
const G = bestG;
for (const T of traj) T.G = toM(T.B, G.u, G.v);
// Träger mit Lasche (falls der Griffpunkt außerhalb liegt): Kreisscheibe Ø 60 um den Griffpunkt
// und Steg zum nächsten Konturpunkt – als zweite Kontur in der Zeichnung, wird mit verschweißt/verklebt
// oder gleich in einem Stück ausgeschnitten (Vereinigung beider Konturen).
let tabPoly = null;
if (G.tab > 0) {
  let near = null, nd = Infinity;
  for (let i = 0; i < carrier0.length; i++) { const a = carrier0[i], b = carrier0[(i + 1) % carrier0.length]; for (let t = 0; t <= 1; t += 0.1) { const p = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], d = Math.hypot(p[0] - G.u, p[1] - G.v); if (d < nd) { nd = d; near = p; } } }
  const dx = near[0] - G.u, dy = near[1] - G.v, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, w = 0.03, ov = 0.03;
  tabPoly = [[G.u + nx * w, G.v + ny * w], [near[0] + (dx / L) * ov + nx * w, near[1] + (dy / L) * ov + ny * w], [near[0] + (dx / L) * ov - nx * w, near[1] + (dy / L) * ov - ny * w], [G.u - nx * w, G.v - ny * w]];
  for (let a = 0; a <= 12; a++) { const ang = Math.atan2(-ny, -nx) + (Math.PI * a) / 12; tabPoly.push([G.u + 0.03 * Math.cos(ang), G.v + 0.03 * Math.sin(ang)]); }
}
// überstrichene Fläche des Trägers (Tischgröße, Ständer)
const sweepB = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
for (const T of traj) for (const [u, v] of [...body.outline, ...(tabPoly || [])]) { const [X, Y] = toM(T.B, u, v); sweepB.x0 = Math.min(sweepB.x0, X); sweepB.x1 = Math.max(sweepB.x1, X); sweepB.y0 = Math.min(sweepB.y0, Y); sweepB.y1 = Math.max(sweepB.y1, Y); }

// ================================================================ Zeichnungen 1:1 (mm)
const mm = (v) => +(v * 1000).toFixed(2);
const FONT = 'font-family="Arial, Helvetica, sans-serif"';
function svgDoc(title, items, note) {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const it of items) for (const [x, y] of it.pts) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); }
  const pad = 0.02, W = Math.max(maxx - minx + 2 * pad, 0.2), H = maxy - miny + 2 * pad + 0.04;
  const X = (x) => mm(x - minx + pad), Y = (y) => mm(y - miny + pad + 0.012);
  const g = items.map((it) => {
    const d = it.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x)},${Y(y)}`).join(' ') + (it.open ? '' : ' Z');
    return `<path d="${d}" fill="${it.fill || 'none'}" stroke="${it.stroke || '#000'}" stroke-width="${it.w || 0.3}"${it.dash ? ` stroke-dasharray="${it.dash}"` : ''}/>` + (it.label ? `<text x="${X(it.lx ?? it.pts[0][0])}" y="${Y(it.ly ?? it.pts[0][1])}" font-size="${it.fs || 4}" fill="${it.tc || '#000'}" ${FONT}>${it.label}</text>` : '');
  }).join('\n');
  const ox = X(0), oy = Y(0);
  const cross = `<path d="M${ox - 5},${oy} L${ox + 5},${oy} M${ox},${oy - 5} L${ox},${oy + 5}" stroke="#c00" stroke-width="0.3"/><text x="${ox + 2}" y="${oy - 2}" font-size="3" fill="#c00" ${FONT}>Ursprung</text>`;
  const sy = mm(H - 0.01);
  const scale = `<path d="M10,${sy} L110,${sy}" stroke="#000" stroke-width="0.6"/><path d="M10,${sy - 2} L10,${sy + 2} M110,${sy - 2} L110,${sy + 2}" stroke="#000" stroke-width="0.4"/><text x="10" y="${sy - 3}" font-size="3.5" ${FONT}>100 mm (Ausdruck in Originalgröße prüfen)</text>`;
  const head = `<text x="10" y="8" font-size="5" font-weight="bold" ${FONT}>${title}</text>` + (note ? `<text x="10" y="14" font-size="3.2" ${FONT}>${note}</text>` : '');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${mm(W)}mm" height="${mm(H)}mm" viewBox="0 0 ${mm(W)} ${mm(H)}">\n<rect width="100%" height="100%" fill="#fff"/>\n${head}\n${g}\n${cross}\n${scale}\n</svg>\n`;
}
const circle = (c, r, n = 32) => Array.from({ length: n }, (_, i) => [c[0] + r * Math.cos((2 * Math.PI * i) / n), c[1] + r * Math.sin((2 * Math.PI * i) / n)]);
const shiftX = (pts, dx) => pts.map(([x, y]) => [x + dx, y]);
// Passzeichen alle 50 mm entlang der Naht (Körper) bzw. an den zugehörigen Kugelpunkten (Ärmel)
const notch = (path, s, outline) => { const { p, t } = pathAt(path, s); let n = [-t[1], t[0]]; if (pointInPolygon(outline, p[0] + n[0] * 0.012, p[1] + n[1] * 0.012)) n = [-n[0], -n[1]]; return [[p[0] + n[0] * 0.004, p[1] + n[1] * 0.004], [p[0] + n[0] * 0.01, p[1] + n[1] * 0.01]]; };
const marks = [];
for (let sB = 0.05; sB < armhole.length - 0.01; sB += 0.05) { const T = traj[Math.round(sB / STITCH)]; marks.push({ sB: T.sB, sS: T.sS }); }

await writeFile(join(out, 'schnittteile.svg'), svgDoc('Schnittteile Gr. 86 – Schnittkante = Linie, Naht = gestrichelt, Passzeichen = rote Striche', [
  { pts: body.outline, label: 'Körper (Vorderteil unten, Rückenteil oben)', lx: -0.12, ly: 0.2 },
  { pts: body.holes[0], label: 'Hals', lx: -0.01, ly: 0.012 },
  { pts: armhole.points, open: true, dash: '2,1.5', stroke: '#06c', label: 'Armlochnaht', lx: armhole.points[0][0] + 0.012, ly: armhole.points[0][1] - 0.03, tc: '#06c' },
  ...marks.map((m) => ({ pts: notch(armhole, m.sB, body.outline), open: true, stroke: '#c00', w: 0.5 })),
  { pts: shiftX(sleeve.outline, 0.32), label: 'Ärmel links', lx: 0.27, ly: 0.06 },
  { pts: shiftX(cap.points, 0.32), open: true, dash: '2,1.5', stroke: '#06c' },
  ...marks.map((m) => ({ pts: shiftX(notch(cap, m.sS, sleeve.outline), 0.32), open: true, stroke: '#c00', w: 0.5 })),
], `Single Jersey, Fadenlauf längs. Kugelnaht ${(cap.length * 1000).toFixed(1)} mm, Armlochnaht ${(armhole.length * 1000).toFixed(1)} mm, Mehrweite ${(ease * 100).toFixed(1)} %. Ärmelursprung = Ursprung + 320 mm nach rechts. Passzeichen treffen nach dem Nähen aufeinander.`));

await writeFile(join(out, 'traeger.svg'), svgDoc('Werkstückträger (PC 1,5 mm oder Alu 1 mm), Schlitz am Armloch, Griffpunkt Portal', [
  { pts: carrier0, w: 0.4, label: 'Trägerkontur', lx: -0.1, ly: 0.25 },
  ...(tabPoly ? [{ pts: tabPoly, w: 0.4, label: 'Lasche (mit ausschneiden)', lx: G.u + 0.035, ly: G.v + 0.02 }] : []),
  { pts: body.outline, dash: '1,1', stroke: '#999', label: 'Körper (Lage)', lx: -0.1, ly: -0.28, tc: '#777' },
  { pts: armhole.points, open: true, dash: '2,1.5', stroke: '#06c' },
  { pts: circle([G.u, G.v], 0.003), stroke: '#c00', w: 0.4, label: `Griffpunkt: Zentrierbohrung Ø 6 (${(G.u * 1000).toFixed(0)} / ${(G.v * 1000).toFixed(0)} mm)`, lx: G.u + 0.01, ly: G.v - 0.006, tc: '#c00' },
  { pts: circle([G.u + 0.03, G.v], 0.002), stroke: '#c00', w: 0.4, label: 'Verdrehsicherung Ø 4', lx: G.u + 0.036, ly: G.v + 0.006, fs: 3, tc: '#c00' },
], `Schlitz ${(SLOT * 1000).toFixed(0)} mm ab Naht. Oberseite: wieder ablösbarer Sprühkleber. Unterseite: PTFE-Folie. Griffpunkt bleibt ≥ ${(G.clr * 1000).toFixed(0)} mm von Kopf, Arm, Trennblech und Zuführung entfernt.`));

await writeFile(join(out, 'trennblech.svg'), svgDoc('Trennblech (Federstahl 1.4310, 0,3 mm, poliert) – Draufsicht in Maschinenkoordinaten', [
  { pts: sep.map(([x, y]) => [x, -y]), w: 0.4, label: 'Trennblech', lx: sep[0][0] + 0.04, ly: 0.1 },
  { pts: [[FOOT[0], -FOOT[3]], [FOOT[1], -FOOT[3]], [FOOT[1], -FOOT[2]], [FOOT[0], -FOOT[2]]], stroke: '#c00', label: 'Nähfuß', lx: 0.012, ly: 0.0, tc: '#c00' },
], `Ursprung = Nadel, oben = hinten. Kontur = vom Ärmel überstrichene Fläche + 8 mm. Hinterkante ${(SEP_EDGE * 1000).toFixed(0)} mm vor der Nadel, 30° angefast. Befestigung an der Vorderkante von oben.`));

await writeFile(join(out, 'aermelplatte.svg'), svgDoc(`Ärmelplatte: Grundplatte und ${fingers.length} Klappfinger (Draufsicht, Ärmelkoordinaten)`, [
  { pts: sleeve.outline, dash: '1,1', stroke: '#999', label: 'Ärmel (Lage)', lx: cxs - 0.02, ly: cys + 0.03, tc: '#777' },
  { pts: plate, w: 0.4, label: 'Grundplatte', lx: cxs - 0.02, ly: cys + 0.012 },
  ...fingers.map((f) => ({ pts: f.pts, stroke: '#c00', w: 0.35, label: `F${f.j + 1} ↑${f.up}`, lx: f.c[0] - 0.008, ly: f.c[1] + 0.001, fs: 2.6, tc: '#c00' })),
  { pts: cap.points, open: true, dash: '2,1.5', stroke: '#06c', label: 'Kugelnaht', lx: cap.points[0][0] - 0.002, ly: cap.points[0][1] - 0.012, tc: '#06c' },
  ...(F.tab > 0 ? [{ pts: [[F.u - 0.025, F.v - F.tab - 0.01], [F.u + 0.025, F.v - F.tab - 0.01], [F.u + 0.025, F.v + 0.02], [F.u - 0.025, F.v + 0.02]], w: 0.4, label: 'Lasche', lx: F.u + 0.028, ly: F.v + 0.012 }] : []),
  { pts: circle([F.u, F.v], 0.006), stroke: '#080', w: 0.4, label: 'Anlenkpunkt (θ-Achse)', lx: F.u + 0.009, ly: F.v + 0.002, tc: '#080' },
], `F1…F${fingers.length}: Klappfinger ${(FINGER_W * 1000).toFixed(0)} mm breit, Scharnier ${(FINGER_DEPTH * 1000).toFixed(0)} mm neben der Naht; „↑k“ = klappt bei Stich k hoch. Unterseite von Platte und Fingern: Silikon-Moosgummi 1 mm.`));

// Kalibrierplatte: Trägerkontur mit drei Nadellöchern auf der Armlochnaht (Anfang, Mitte, Ende)
const calS = [0, armhole.length / 2, armhole.length].map((s) => pathAt(armhole, s).p);
await writeFile(join(out, 'kalibrierplatte.svg'), svgDoc('Kalibrierplatte (wie Träger, ohne Schlitz) mit drei Nadellöchern Ø 1,5 auf der Naht', [
  { pts: body.outline, w: 0.4 },
  ...(tabPoly ? [{ pts: tabPoly, w: 0.4 }] : []),
  ...calS.map((p, i) => ({ pts: circle(p, 0.00075), stroke: '#c00', w: 0.3, label: `K${i + 1} (Stich ${[0, Math.round(N / 2), N][i]})`, lx: p[0] + 0.006, ly: p[1] + 0.002, fs: 3.2, tc: '#c00' })),
  { pts: armhole.points, open: true, dash: '2,1.5', stroke: '#06c' },
  { pts: circle([G.u, G.v], 0.003), stroke: '#c00', w: 0.4, label: 'Griffpunkt Ø 6', lx: G.u + 0.01, ly: G.v - 0.004, tc: '#c00' },
  { pts: circle([G.u + 0.03, G.v], 0.002), stroke: '#c00', w: 0.4 },
], 'Zum Einmessen: Portal fährt die Sollpose für Stich 0, N/2 und N; die Nadel muss jeweils in das Loch K1, K2, K3 eintauchen (Handrad von Hand).'));

// ================================================================ Bahntabelle und Kennwerte
const deg = (a) => ((a * 180) / Math.PI).toFixed(2), m2 = (v) => (v * 1000).toFixed(2);
const rows = ['stich;s_koerper_mm;s_aermel_mm;verhaeltnis;koerper_x_mm;koerper_y_mm;koerper_theta_grad;aermel_x_mm;aermel_y_mm;aermel_theta_grad;greif_x_mm;greif_y_mm;zufuehr_x_mm;zufuehr_y_mm;finger_oben'];
for (const T of traj) rows.push([T.k, m2(T.sB), m2(T.sS), T.r.toFixed(4), m2(T.B.x), m2(T.B.y), deg(T.B.th), m2(T.S.x), m2(T.S.y), deg(T.S.th), m2(T.G[0]), m2(T.G[1]), m2(T.F[0]), m2(T.F[1]), fingers.filter((f) => f.up <= T.k).length].join(';'));
await writeFile(join(out, 'bahn_aermel.csv'), rows.join('\n') + '\n');

const dtS = 60 / RPM, rng = (f) => [Math.min(...traj.map(f)), Math.max(...traj.map(f))].map((v) => +(v * 1000).toFixed(0));
let vB = 0, wB = 0, vS = 0, wS = 0;
for (let k = 1; k < traj.length; k++) {
  const a = traj[k - 1], b = traj[k];
  vB = Math.max(vB, Math.hypot(b.G[0] - a.G[0], b.G[1] - a.G[1]) / dtS); wB = Math.max(wB, Math.abs(b.B.th - a.B.th) / dtS);
  vS = Math.max(vS, Math.hypot(b.F[0] - a.F[0], b.F[1] - a.F[1]) / dtS); wS = Math.max(wS, Math.abs(b.S.th - a.S.th) / dtS);
}
const summary = {
  stichlaenge_mm: STITCH * 1000, stiche: N, armlochnaht_mm: +(armhole.length * 1000).toFixed(1), kugelnaht_mm: +(cap.length * 1000).toFixed(1),
  mehrweite_prozent: +(ease * 100).toFixed(2), schlitz_mm: SLOT * 1000, freigabe_mm: RELEASE * 1000, trennblech_hinterkante_mm: SEP_EDGE * 1000,
  drehung_koerper_grad: +deg(traj.at(-1).B.th - traj[0].B.th), drehung_aermel_grad: +deg(traj.at(-1).S.th - traj[0].S.th),
  griffpunkt_traeger_mm: [+(G.u * 1000).toFixed(0), +(G.v * 1000).toFixed(0)], griff_lasche_mm: +(G.tab * 1000).toFixed(0), griff_abstand_min_mm: +(G.clr * 1000).toFixed(0),
  griff_hebelarm_max_mm: +(G.lever * 1000).toFixed(0), griff_weg_x_mm: rng((T) => T.G[0]), griff_weg_y_mm: rng((T) => T.G[1]),
  anlenkpunkt_platte_mm: [+(F.u * 1000).toFixed(0), +(F.v * 1000).toFixed(0)], anlenk_abstand_kopf_min_mm: +(F.clr * 1000).toFixed(0),
  anlenk_weg_x_mm: rng((T) => T.F[0]), anlenk_weg_y_mm: rng((T) => T.F[1]),
  traeger_ueberstreicht_x_mm: [+(sweepB.x0 * 1000).toFixed(0), +(sweepB.x1 * 1000).toFixed(0)], traeger_ueberstreicht_y_mm: [+(sweepB.y0 * 1000).toFixed(0), +(sweepB.y1 * 1000).toFixed(0)],
  staender_frei: sweepB.x1 < COLUMN_X - 0.02,
  [`v_max_bei_${RPM}`]: { portal_mm_s: +(vB * 1000).toFixed(1), koerper_grad_s: +deg(wB), zufuehrung_mm_s: +(vS * 1000).toFixed(1), aermel_grad_s: +deg(wS) },
  klappfinger: fingers.map((f) => ({ finger: `F${f.j + 1}`, hoch_bei_stich: f.up })),
};
await writeFile(join(out, 'kennwerte.json'), JSON.stringify(summary, null, 2) + '\n');
await rm(join(out, 'vakuumplatte.svg'), { force: true });

// ================================================================ Abbildungen (Maßstab frei)
const C = { body: '#2a78d6', sleeve: '#d98a1f', sep: '#7a8791', mach: '#3d4a45', grip: '#c0392b', feed: '#1a8f4a', ink: '#1c2422', mute: '#6b7773' };
function figure(w, h, inner, title) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" ${FONT} font-size="13">\n<rect width="100%" height="100%" fill="#fff"/>\n<title>${title}</title>\n${inner}\n</svg>\n`;
}
const view = (sc, ox, oy) => ({ X: (x) => +(ox + x * sc).toFixed(1), Y: (y) => +(oy - y * sc).toFixed(1), sc });
const pathM = (V, pts, close = true) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${V.X(x)},${V.Y(y)}`).join(' ') + (close ? ' Z' : '');
const partM = (V, pose, pts, close = true) => pathM(V, pts.map(([u, v]) => toM(pose, u, v)), close);
const rectM = (V, [x0, x1, y0, y1]) => `M${V.X(x0)},${V.Y(y0)} L${V.X(x1)},${V.Y(y0)} L${V.X(x1)},${V.Y(y1)} L${V.X(x0)},${V.Y(y1)} Z`;
function machine(V, labels = true) {
  let s = `<path d="${rectM(V, [-0.14, COLUMN_X + 0.12, -0.09, 0.09])}" fill="#eef1ef" stroke="#b9c2be" stroke-dasharray="4,3"/>`;   // Maschinenbett
  s += `<path d="${rectM(V, ARM)}" fill="#cfd8d3" stroke="${C.mach}"/><path d="${rectM(V, [COLUMN_X, COLUMN_X + 0.1, -0.07, 0.07])}" fill="#b4c0ba" stroke="${C.mach}"/>`;
  s += `<path d="${rectM(V, HEAD)}" fill="#dfe6e2" stroke="${C.mach}"/>`;
  s += `<path d="${rectM(V, FOOT)}" fill="#fff" stroke="${C.grip}" stroke-width="1.2"/><circle cx="${V.X(0)}" cy="${V.Y(0)}" r="2.6" fill="${C.grip}"/>`;
  if (labels) s += `<text x="${V.X(0.12)}" y="${V.Y(0.02)}" fill="${C.mach}">Arm</text><text x="${V.X(COLUMN_X + 0.008)}" y="${V.Y(-0.005)}" fill="${C.mach}">Ständer</text><text x="${V.X(-0.055)}" y="${V.Y(0.066)}" fill="${C.mach}" font-size="11">Nähkopf</text>`;
  return s;
}
const arrow = '<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#1c2422"/></marker></defs>';

// Abb. 1: Draufsicht der ganzen Anordnung, Anfangs- und Endlage
{
  const V = view(800, 390, 470), T0 = traj[0], T1 = traj.at(-1);
  let s = arrow;
  s += `<path d="${rectM(V, [sweepB.x0 - 0.03, Math.max(sweepB.x1, COLUMN_X + 0.12) + 0.03, sweepB.y0 - 0.03, sweepB.y1 + 0.03])}" fill="#f7f8f7" stroke="#c9d0cc"/>`;
  s += `<text x="${V.X(sweepB.x0 - 0.02)}" y="${V.Y(sweepB.y1 + 0.008)}" fill="${C.mute}" font-size="12">Gleitfläche: mindestens ${(((Math.max(sweepB.x1, COLUMN_X + 0.12) - sweepB.x0) + 0.06) * 100).toFixed(0)} × ${((sweepB.y1 - sweepB.y0 + 0.06) * 100).toFixed(0)} cm, bündig mit dem Maschinenbett</text>`;
  s += machine(V);
  for (const [T, op, dash] of [[T1, 0.35, '6,4'], [T0, 1, '']]) {
    s += `<path d="${partM(V, T.B, body.outline)}" fill="${C.body}" fill-opacity="${0.10 * op}" stroke="${C.body}" stroke-width="1.6" stroke-opacity="${op}" stroke-dasharray="${dash}"/>`;
    if (tabPoly) s += `<path d="${partM(V, T.B, tabPoly)}" fill="${C.body}" fill-opacity="${0.10 * op}" stroke="${C.body}" stroke-opacity="${op}" stroke-dasharray="${dash}"/>`;
  }
  s += `<path d="${pathM(V, sep)}" fill="${C.sep}" fill-opacity="0.28" stroke="${C.sep}" stroke-width="1.4"/>`;
  for (const [T, op, dash] of [[T1, 0.4, '6,4'], [T0, 1, '']]) s += `<path d="${partM(V, T.S, sleeve.outline)}" fill="${C.sleeve}" fill-opacity="${0.25 * op}" stroke="${C.sleeve}" stroke-width="1.6" stroke-opacity="${op}" stroke-dasharray="${dash}"/>`;
  s += `<path d="${pathM(V, traj.map((T) => T.G), false)}" fill="none" stroke="${C.grip}" stroke-width="2.2"/><circle cx="${V.X(T0.G[0])}" cy="${V.Y(T0.G[1])}" r="${COLUMN_R * V.sc}" fill="${C.grip}" fill-opacity="0.15" stroke="${C.grip}"/><circle cx="${V.X(T1.G[0])}" cy="${V.Y(T1.G[1])}" r="${COLUMN_R * V.sc}" fill="none" stroke="${C.grip}" stroke-dasharray="4,3"/>`;
  s += `<path d="${pathM(V, traj.map((T) => T.F), false)}" fill="none" stroke="${C.feed}" stroke-width="2.2"/><path d="M${V.X(T0.F[0])},${V.Y(T0.F[1])} L${V.X(sweepB.x0 - 0.03)},${V.Y(T0.F[1])}" stroke="${C.feed}" stroke-width="6" stroke-opacity="0.35"/><circle cx="${V.X(T0.F[0])}" cy="${V.Y(T0.F[1])}" r="7" fill="${C.feed}"/>`;
  s += `<path d="M${V.X(-0.2)},${V.Y(-RELEASE)} L${V.X(0.065)},${V.Y(-RELEASE)}" stroke="${C.grip}" stroke-dasharray="2,3"/>`;
  // Beschriftung
  const lab = (x, y, t, c = C.ink, anchor = 'start') => `<text x="${V.X(x)}" y="${V.Y(y)}" fill="${c}" text-anchor="${anchor}">${t}</text>`;
  s += lab(0.06, -0.3, 'Körper auf Träger (Start)', C.body, 'middle') + lab(-0.02, 0.4, 'Körper (Ende, gestrichelt)', C.body, 'middle');
  s += lab(T0.S.x - 0.03, T0.S.y - 0.125, 'Ärmel (Start)', C.sleeve) + lab(T1.S.x - 0.24, T1.S.y + 0.05, 'Ärmel (Ende)', C.sleeve);
  s += lab(sep[0][0] - 0.085, -0.19, 'Trennblech', '#4f5b63');
  s += lab(T0.G[0] + 0.04, T0.G[1] + 0.004, 'Griffpunkt Portal (Start)', C.grip) + lab(T1.G[0] + 0.04, T1.G[1] + 0.03, 'Griffpunkt (Ende)', C.grip);
  s += lab(sweepB.x0 - 0.02, T0.F[1] - 0.022, 'Ausleger der Ärmelzuführung (von links)', C.feed) + lab(0.075, -0.075, '↖ Freigabelinie 18 mm vor der Nadel', C.grip);
  s += `<path d="M${V.X(0.2)},${V.Y(-0.42)} L${V.X(0.2)},${V.Y(-0.33)}" stroke="${C.ink}" stroke-width="1.5" marker-end="url(#ar)"/><text x="${V.X(0.215)}" y="${V.Y(-0.37)}">Transportrichtung (+Y)</text>`;
  s += `<text x="${V.X(0.2)}" y="${V.Y(-0.455)}" fill="${C.mute}">Bediener</text><path d="M${V.X(0.2)},${V.Y(-0.49)} L${V.X(0.3)},${V.Y(-0.49)}" stroke="${C.ink}" stroke-width="2"/><text x="${V.X(0.2)}" y="${V.Y(-0.5)}" fill="${C.mute}" font-size="11">100 mm</text>`;
  await writeFile(join(fig, 'abb1-draufsicht.svg'), figure(780, 880, s, 'Draufsicht der Anordnung'));
}

// Abb. 2: Bewegungsfolge in vier Bildern
{
  const ks = [0, Math.round(N / 3), Math.round((2 * N) / 3), N];
  let s = '';
  ks.forEach((k, i) => {
    const V = view(420, 150 + i * 235, 215), T = traj[k];
    s += `<g><rect x="${8 + i * 235}" y="8" width="225" height="404" fill="#f7f8f7" stroke="#c9d0cc"/>`;
    s += `<clipPath id="c${i}"><rect x="${8 + i * 235}" y="8" width="225" height="404"/></clipPath><g clip-path="url(#c${i})">`;
    s += `<path d="${partM(V, T.B, body.outline)}" fill="${C.body}" fill-opacity="0.12" stroke="${C.body}" stroke-width="1.4"/>`;
    s += `<path d="${pathM(V, sep)}" fill="${C.sep}" fill-opacity="0.25" stroke="${C.sep}"/>`;
    s += `<path d="${partM(V, T.S, sleeve.outline)}" fill="${C.sleeve}" fill-opacity="0.3" stroke="${C.sleeve}" stroke-width="1.4"/>`;
    const sewn = armhole.points.filter((_, q) => armhole.cum[q] <= T.sB);
    if (sewn.length > 1) s += `<path d="${partM(V, T.B, sewn, false)}" fill="none" stroke="${C.grip}" stroke-width="2.4"/>`;
    s += `<path d="${rectM(V, HEAD)}" fill="#dfe6e2" fill-opacity="0.7" stroke="${C.mach}"/><path d="${rectM(V, [0, 0.2, -0.055, 0.055])}" fill="#cfd8d3" fill-opacity="0.7" stroke="${C.mach}"/><circle cx="${V.X(0)}" cy="${V.Y(0)}" r="3" fill="${C.grip}"/>`;
    s += `<circle cx="${V.X(T.G[0])}" cy="${V.Y(T.G[1])}" r="6" fill="none" stroke="${C.grip}" stroke-width="2"/><circle cx="${V.X(T.F[0])}" cy="${V.Y(T.F[1])}" r="5" fill="${C.feed}"/>`;
    s += `</g><text x="${16 + i * 235}" y="28" font-weight="bold">Stich ${k}</text><text x="${16 + i * 235}" y="402" fill="${C.mute}" font-size="11.5">Körper ${deg(T.B.th - traj[0].B.th)}°, Ärmel ${(+deg(T.S.th - traj[0].S.th) >= 0 ? '+' : '') + deg(T.S.th - traj[0].S.th)}°</text></g>`;
  });
  s += `<text x="10" y="436" fill="${C.mute}" font-size="12">Blau: Körper · Orange: Ärmel · Grau: Trennblech · Rot: fertige Naht, Ring = Griffpunkt des Portals · Grün: Anlenkpunkt der Zuführung. Körper und Ärmel drehen gegenläufig.</text>`;
  await writeFile(join(fig, 'abb2-bewegung.svg'), figure(956, 446, s, 'Bewegungsfolge'));
}

// Abb. 3: Ärmelplatte mit Klappfingern (Draufsicht in Ärmelkoordinaten, mit Klappzeitpunkten)
{
  const all = [...sleeve.outline, [F.u, F.v + 0.03]];
  const bx0 = Math.min(...all.map((p) => p[0])), bx1 = Math.max(...all.map((p) => p[0])), by0 = Math.min(...all.map((p) => p[1])), by1 = Math.max(...all.map((p) => p[1]));
  const sc = 2500, W = Math.round((bx1 - bx0) * sc + 80), Hh = Math.round((by1 - by0) * sc + 110);
  const X = (x) => +(40 + (x - bx0) * sc).toFixed(1), Y = (y) => +(70 + (y - by0) * sc).toFixed(1);
  const P = (pts, close = true) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x)},${Y(y)}`).join(' ') + (close ? ' Z' : '');
  let s = `<path d="${P(sleeve.outline)}" fill="${C.sleeve}" fill-opacity="0.12" stroke="${C.sleeve}" stroke-dasharray="5,3"/>`;
  s += `<path d="${P(plate)}" fill="#e7ecea" stroke="${C.ink}" stroke-width="1.5"/>`;
  if (F.tab > 0) s += `<rect x="${X(F.u - 0.025)}" y="${Y(F.v - F.tab - 0.008)}" width="${0.05 * sc}" height="${(F.tab + 0.03) * sc}" fill="#e7ecea" stroke="${C.ink}" stroke-width="1.5"/>`;
  for (const f of fingers) s += `<path d="${P(f.pts)}" fill="#fbe3df" stroke="${C.grip}" stroke-width="1.3"/><text x="${X(f.c[0])}" y="${Y(f.c[1]) + 1}" text-anchor="middle" font-size="12" fill="${C.grip}">F${f.j + 1}</text><text x="${X(f.c[0])}" y="${Y(f.c[1]) + 14}" text-anchor="middle" font-size="10" fill="${C.grip}">↑${f.up}</text>`;
  s += `<path d="${P(cap.points, false)}" fill="none" stroke="${C.body}" stroke-width="1.6" stroke-dasharray="6,3"/>`;
  s += `<circle cx="${X(F.u)}" cy="${Y(F.v)}" r="14" fill="${C.feed}" fill-opacity="0.2" stroke="${C.feed}" stroke-width="2"/><text x="${X(F.u) + 22}" y="${Y(F.v) + 5}" fill="${C.feed}">Anlenkpunkt (θ-Achse) auf Lasche</text>`;
  s += `<text x="${X(cxs)}" y="${Y((by0 + by1) / 2 + 0.012)}" text-anchor="middle">Grundplatte (starr), Unterseite Moosgummi</text>`;
  s += `<text x="${X(cxs)}" y="${Y(by1) - 10}" text-anchor="middle" fill="${C.sleeve}" font-size="12">Saumkante des Ärmels</text>`;
  s += `<text x="20" y="24" font-weight="bold">Ärmelplatte von oben</text><text x="20" y="43" fill="${C.mute}" font-size="12">F1…F${fingers.length}: Klappfinger (rot), „↑k“ = klappt bei Stich k hoch · blau gestrichelt: Kugelnaht · orange gestrichelt: Ärmelkontur</text>`;
  await writeFile(join(fig, 'abb3-aermelplatte.svg'), figure(Math.max(W, 700), Hh, s, 'Ärmelplatte mit Klappfingern'));
}

// Abb. 4: Nadelphase – Nadelhöhe, Transportfenster, Achsbewegung
{
  const x0 = 70, w = 560, yN = 60, hN = 90;
  const xs = (ph) => x0 + ph * w;
  let d = ''; for (let i = 0; i <= 120; i++) { const ph = i / 120, depth = 0.5 + 0.5 * Math.cos(2 * Math.PI * (ph - 0.2)); d += `${i ? 'L' : 'M'}${xs(ph).toFixed(1)},${(yN + depth * hN).toFixed(1)} `; }
  let f = ''; for (let i = 0; i <= 120; i++) { const ph = i / 120, u = Math.max(0, Math.min(1, (ph - 0.5) / 0.45)), sfeed = u - Math.sin(2 * Math.PI * u) / (2 * Math.PI); f += `${i ? 'L' : 'M'}${xs(ph).toFixed(1)},${(300 - sfeed * 70).toFixed(1)} `; }
  let s = `<text x="20" y="24" font-weight="bold">Eine Umdrehung des Handrads (Modellwerte, an der Maschine nachmessen)</text>`;
  s += `<rect x="${xs(0.5)}" y="46" width="${0.45 * w}" height="270" fill="${C.feed}" fill-opacity="0.10"/><text x="${xs(0.725)}" y="330" text-anchor="middle" fill="${C.feed}">Transporteur schiebt – Achsen fahren mit</text>`;
  s += `<rect x="${xs(0)}" y="46" width="${0.45 * w}" height="270" fill="${C.grip}" fill-opacity="0.07"/><text x="${xs(0.225)}" y="330" text-anchor="middle" fill="${C.grip}">Nadel im Stoff – Achsen stehen</text>`;
  s += `<path d="M${x0},${yN + 0.55 * hN} L${x0 + w},${yN + 0.55 * hN}" stroke="${C.mute}" stroke-dasharray="3,3"/><text x="${x0 + w + 6}" y="${yN + 0.55 * hN + 4}" fill="${C.mute}" font-size="11">Stoff</text>`;
  s += `<path d="${d}" fill="none" stroke="${C.ink}" stroke-width="2"/><text x="14" y="${yN + 8}" font-size="12">Nadel oben</text><text x="14" y="${yN + hN + 4}" font-size="12">unten</text>`;
  s += `<path d="${f}" fill="none" stroke="${C.body}" stroke-width="2.4"/><text x="14" y="234" font-size="12" fill="${C.body}">Vorschub</text><text x="${x0 + w + 6}" y="234" font-size="11" fill="${C.body}">2,5 mm</text><text x="${x0 + w + 6}" y="304" font-size="11" fill="${C.body}">0</text>`;
  for (const a of [0, 90, 180, 270, 360]) s += `<path d="M${xs(a / 360)},346 L${xs(a / 360)},352" stroke="${C.ink}"/><text x="${xs(a / 360)}" y="366" text-anchor="middle" font-size="11.5">${a}°</text>`;
  s += `<path d="M${x0},346 L${x0 + w},346" stroke="${C.ink}"/><text x="${x0 + w / 2}" y="384" text-anchor="middle" fill="${C.mute}" font-size="12">Handradwinkel φ ab Einstich</text>`;
  await writeFile(join(fig, 'abb4-nadelphase.svg'), figure(700, 396, s, 'Nadelphase und Transportfenster'));
}

console.log(`geschrieben nach ${out}/ und ${fig}/`);
console.log(summary);
