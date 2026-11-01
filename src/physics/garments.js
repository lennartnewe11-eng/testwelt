// Schnittteile und Nahtbahnen.
//
// Koordinaten im Zuschnitt [m]: x quer (Schussrichtung), z längs (Kettrichtung).
// z < 0 zeigt zur Schulter, z > 0 zum Saum.

import { pointInPolygon } from './cloth.js';

function bezier(p0, p1, p2, n) {
  const out = [];
  for (let k = 1; k <= n; k++) {
    const t = k / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
  }
  return out;
}

// Kinder-T-Shirt Gr. 104/110 im Kimonoschnitt (angeschnittener Ärmel).
// Rückgabe: Kontur (Polygon) und benannte Konturabschnitte (Indexbereiche) für Nähte.
export function tshirtPanel({ neckDepth = 0.06 } = {}) {
  const bw = 0.165;   // halbe Körperweite
  const hem = 0.21, sh = -0.212;   // Saum, Schulterhöhe am Hals
  const st = 0.27;    // Ärmelspitze (halbe Spannweite)
  const cuffTop = -0.195, cuffBot = -0.11;
  const ua = -0.025;  // Beginn der Achselrundung an der Seitennaht
  const neckW = 0.065;
  const right = [];
  right.push([bw, hem]);
  right.push([bw, 0.1], [bw, 0.0]);
  right.push([bw, ua]);
  right.push(...bezier([bw, ua], [bw + 0.006, -0.088], [0.215, -0.097], 8));   // Achselrundung
  right.push([st, cuffBot]);                                                     // Ärmelunterkante
  right.push([st, cuffTop]);                                                     // Ärmelsaum
  right.push([neckW, sh]);                                                       // Schulter
  right.push(...bezier([neckW, sh], [neckW - 0.005, sh + neckDepth], [0, sh + neckDepth], 6)); // Halsausschnitt
  // spiegeln (ohne die Mittelpunkte doppelt)
  const left = right.slice(0, -1).map(([x, z]) => [-x, z]).reverse();
  const outline = [...right, ...left];
  const iUa = 3, iCuff = right.findIndex((p) => p[0] === st && p[1] === cuffBot);
  const nR = right.length;
  return {
    outline,
    // Linke Seitennaht inkl. Ärmelunternaht: Saum → Achsel → Ärmelsaum (links liegt das
    // Teil beim Nähen außerhalb des Maschinenarms)
    chains: {
      seite_links: outline.slice(nR - 1).reverse().slice(0, iCuff + 1),
      seite_rechts: right.slice(0, iCuff + 1),
    },
    iUa,
  };
}

// Abschnitt der Kontur um die Nahtzugabe nach innen versetzen und gleichmäßig abtasten.
// trim: Abstand der ersten/letzten Einstichstelle von der Schnittkante [m]
export function seamPath(outline, chain, allowance = 0.01, step = 0.002, trim = 0.004) {
  // Normale je Segment, die ins Teil zeigt
  const segN = [];
  for (let k = 0; k < chain.length - 1; k++) {
    const [ax, az] = chain[k], [bx, bz] = chain[k + 1];
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
    let nx = -dz / L, nz = dx / L;
    const mx = (ax + bx) / 2 + nx * 1e-3, mz = (az + bz) / 2 + nz * 1e-3;
    if (!pointInPolygon(outline, mx, mz)) { nx = -nx; nz = -nz; }
    segN.push([nx, nz]);
  }
  // Gehrung an den Ecken
  const pts = chain.map((p, k) => {
    const n0 = segN[Math.max(0, k - 1)], n1 = segN[Math.min(segN.length - 1, k)];
    let nx = n0[0] + n1[0], nz = n0[1] + n1[1];
    const L = Math.hypot(nx, nz) || 1;
    nx /= L; nz /= L;
    const c = Math.max(0.3, nx * n1[0] + nz * n1[1]);
    return [p[0] + (nx * allowance) / c, p[1] + (nz * allowance) / c];
  });
  // Endpunkte auf die Kanten zurückziehen (Saum- und Ärmelkante liegen senkrecht zur Naht)
  const resampled = [];
  const cum = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  const total = cum[cum.length - 1];
  const at = (s) => {
    let k = 1;
    while (k < cum.length - 1 && cum[k] < s) k++;
    const t = (s - cum[k - 1]) / Math.max(1e-12, cum[k] - cum[k - 1]);
    return [pts[k - 1][0] + t * (pts[k][0] - pts[k - 1][0]), pts[k - 1][1] + t * (pts[k][1] - pts[k - 1][1])];
  };
  for (let s = trim; s <= total - trim + 1e-9; s += step) resampled.push(at(s));
  return makePath(resampled);
}

export function makePath(points) {
  const cum = [0];
  for (let k = 1; k < points.length; k++) cum.push(cum[k - 1] + Math.hypot(points[k][0] - points[k - 1][0], points[k][1] - points[k - 1][1]));
  return { points, cum, length: cum[cum.length - 1] };
}

// Punkt und geglättete Tangente bei Bogenlänge s (Fenster ±win für ruhige Drehbewegung)
export function pathAt(path, s, win = 0.006) {
  const { points: P, cum } = path;
  s = Math.max(0, Math.min(path.length, s));
  const interp = (q) => {
    q = Math.max(0, Math.min(path.length, q));
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= q) lo = m; else hi = m; }
    const t = (q - cum[lo]) / Math.max(1e-12, cum[hi] - cum[lo]);
    return [P[lo][0] + t * (P[hi][0] - P[lo][0]), P[lo][1] + t * (P[hi][1] - P[lo][1])];
  };
  const p = interp(s), a = interp(s - win), b = interp(s + win);
  const tx = b[0] - a[0], tz = b[1] - a[1], L = Math.hypot(tx, tz) || 1;
  return { p, t: [tx / L, tz / L] };
}

// Abstand eines Punkts zur Bahn (Polylinie)
export function distToPath(path, x, z) {
  let bd = Infinity;
  const P = path.points;
  for (let k = 0; k < P.length - 1; k++) {
    const [ax, az] = P[k], [bx, bz] = P[k + 1];
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)) : 0;
    bd = Math.min(bd, Math.hypot(x - ax - t * dx, z - az - t * dz));
  }
  return bd;
}

// Schablonenkontur: Zuschnittkontur, deren Nahtabschnitt durch eine um (Zugabe + Schlitz)
// nach innen versetzte Linie ersetzt ist (für die Darstellung der Schablone mit Nahtschlitz).
export function templateOutline(outline, chain, inset) {
  const key = (p) => `${p[0].toFixed(6)},${p[1].toFixed(6)}`;
  const idx = outline.map(key);
  const i0 = idx.indexOf(key(chain[0])), i1 = idx.indexOf(key(chain[chain.length - 1]));
  if (i0 < 0 || i1 < 0) return outline;
  const inner = seamPath(outline, chain, inset, 0.004, 0).points;
  // Kontur ab dem Ende des Nahtabschnitts bis zu seinem Anfang durchlaufen, dann die Innenlinie
  const n = outline.length, rest = [];
  const forward = (i0 + chain.length - 1) % n === i1;
  if (forward) { for (let k = i1; k !== i0; k = (k + 1) % n) rest.push(outline[k]); }
  else { for (let k = i0; k !== i1; k = (k + 1) % n) rest.push(outline[k]); }
  return forward ? [...rest, outline[i0], ...inner, outline[i1]] : [...rest, outline[i1], ...inner.slice().reverse(), outline[i0]];
}
