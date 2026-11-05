// Schnittteile, Nähte und Schnittbild eines T-Shirts Gr. 86 (Kleinkind) für die Produktionsstraße.
// Koordinaten [m]: x quer (Schuss), z längs (Kette). Gleiche Konstruktion wie in der
// Physik-Zelle (setInBody / fitSleeve), hier in die Einzelteile zerlegt.

import { setInBody, fitSleeve, seamPath } from '../physics/garments.js';

function bez(p0, p1, p2, n) {
  const out = [];
  for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); }
  return out;
}
const polyLen = (P) => P.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - P[i][0], p[1] - P[i][1]), 0);
const mirrorX = (P) => P.map(([x, z]) => [-x, z]);
const bbox = (P) => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const [x, z] of P) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); } return { minx: a, maxx: b, minz: c, maxz: d, w: b - a, h: d - c }; };

// Maße (gleich wie setInBody)
export const DIM = { bw: 0.13, len: 0.30, ua: 0.10, shX: 0.105, neckW: 0.05, neckF: 0.045, neckB: 0.015, stitch: 0.0025 };

// Vorder- bzw. Rückenteil (Schulterlinie bei z = 0; Vorderteil z > 0, Rückenteil z < 0)
function panel(sign, neckDepth) {
  const { bw, len, ua, shX, neckW } = DIM;
  const s = sign;
  const rightArm = bez([bw, s * ua], [shX, s * 0.05], [shX, 0], 10);
  const neck = [...bez([neckW, 0], [neckW, s * neckDepth], [0, s * neckDepth], 8), ...bez([0, s * neckDepth], [-neckW, s * neckDepth], [-neckW, 0], 8)];
  const leftArm = mirrorX(rightArm).reverse(); // von (−shX,0) nach (−bw, s·ua)
  return {
    outline: [[bw, s * len], [bw, s * ua], ...rightArm, [neckW, 0], ...neck, [-shX, 0], ...leftArm.slice(1), [-bw, s * len]],
    neck: [[neckW, 0], ...neck],
    armRight: [[bw, s * ua], ...rightArm],
    armLeft: [[-shX, 0], ...leftArm.slice(1)],
  };
}

export function buildGarment() {
  const front = panel(1, DIM.neckF), back = panel(-1, DIM.neckB);
  const body = setInBody();
  const armholeSeam = seamPath(body.outline, body.chains.armloch_links, 0.01);
  const sleeve = fitSleeve(armholeSeam.length, 0.02);
  const sleeveL = { outline: sleeve.outline }, sleeveR = { outline: mirrorX(sleeve.outline).reverse() };
  const neckLen = polyLen(front.neck) + polyLen(back.neck);
  // Halsbündchen: Rippstrick, 85 % der Halslänge (wird beim Annähen gedehnt), doppelt gelegt
  const ribL = neckLen * 0.85, ribW = 0.036;
  const rib = { outline: [[-ribL / 2, -ribW / 2], [ribL / 2, -ribW / 2], [ribL / 2, ribW / 2], [-ribL / 2, ribW / 2]] };
  const capH = -Math.min(...sleeve.outline.map((p) => p[1]));
  const sl = sleeve.outline, hemW = Math.abs(sl[sl.length - 1][0]) * 2;
  const sleeveUnder = Math.hypot(0.11 - hemW / 2, 0.09);
  const seams = {
    schulter: DIM.shX - DIM.neckW,
    hals: neckLen,
    armloch: armholeSeam.length,
    seite: (DIM.len - DIM.ua) + 0.03 + sleeveUnder, // Seite + Achselrundung + Ärmelunterkante
    aermelsaum: hemW,
    saum: 2 * DIM.bw,
  };
  return { front, back, sleeveL, sleeveR, sleeveCap: sleeve.chains.aermelkugel, rib, capH, seams, ribL, ribW, neckLen, armholeSeam };
}

// Schnittbild: Regal-Packung der Hüllrechtecke, Fadenlauf längs (z) bleibt erhalten.
// width: Stoffbreite [m], shirts: Shirts je Schnittbild. Rückgabe: Teile mit Lage im Schnittbild.
// Das Halsbündchen kommt in der Linie von der Rolle (withRib = false) und ist nicht im Schnittbild.
export function nestMarker(G, width = 1.5, shirts = 6, gap = 0.008, withRib = false) {
  const parts = [];
  for (let k = 0; k < shirts; k++) {
    parts.push({ name: 'Vorderteil', shirt: k, outline: G.front.outline });
    parts.push({ name: 'Rückenteil', shirt: k, outline: G.back.outline });
    parts.push({ name: 'Ärmel links', shirt: k, outline: G.sleeveL.outline });
    parts.push({ name: 'Ärmel rechts', shirt: k, outline: G.sleeveR.outline });
    if (withRib) parts.push({ name: 'Bündchen', shirt: k, outline: G.rib.outline, rot: true });
  }
  for (const p of parts) {
    // Bündchen quer legen (Rippen laufen beim Bündchen quer)
    if (p.rot) p.outline = p.outline.map(([x, z]) => [z, x]);
    p.bb = bbox(p.outline);
  }
  parts.sort((a, b) => b.bb.h - a.bb.h);
  let x = gap, z = gap, rowH = 0;
  for (const p of parts) {
    if (x + p.bb.w + gap > width) { x = gap; z += rowH + gap; rowH = 0; }
    p.x = x - p.bb.minx; p.z = z - p.bb.minz;      // Verschiebung des Teils in das Schnittbild
    x += p.bb.w + gap; rowH = Math.max(rowH, p.bb.h);
  }
  const length = z + rowH + gap;
  const area = parts.reduce((a, p) => a + polyArea(p.outline), 0);
  const contour = parts.reduce((a, p) => a + polyLen([...p.outline, p.outline[0]]), 0);
  return { parts, width, length, utilization: area / (width * length), contour };
}

export function polyArea(P) {
  let a = 0;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] + P[i][0]) * (P[j][1] - P[i][1]);
  return Math.abs(a / 2);
}
