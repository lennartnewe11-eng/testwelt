// Textillage als diskretes Kontinuum, gelöst mit XPBD (Extended Position Based Dynamics,
// Macklin et al. 2016; "Small Steps", Macklin et al. 2019).
//
// Diskretisierung: quadratisches Gitter mit Abstand h. Kette (warp) läuft entlang der
// lokalen z-Achse, Schuss (weft) entlang x. Die Nachgiebigkeiten (Compliance α = 1/k)
// werden direkt aus den gemessenen Materialkennwerten abgeleitet:
//
//   Zug:    Feder zwischen Gitternachbarn repräsentiert einen Streifen der Breite b·h:
//           k = T · b               (T Zugsteifigkeit [N/m], b Randanteil 0,5 / 1)
//   Scher:  eine Diagonale je Zelle: k = 2G (G Schersteifigkeit [N/m/rad]);
//           der Beitrag der Diagonalen zur Zugsteifigkeit wird von T abgezogen.
//   Biegen: Krümmung κ ≈ |x₀ − 2x₁ + x₂| / h² an jedem inneren Knoten,
//           Energie ½·B·κ²·(b·h)·h  ⇒  k = B·b / h²   (B Biegesteifigkeit [N·m])
//   Masse:  m = ρ_A · h² · bₓ · b_z (exakte Gesamtmasse)

import { toSI } from './materials.js';

export function rotY(x, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}

let NEXT_ID = 0;

// ---- Geometrie-Hilfen für Zuschnittkonturen ----------------------------------
function closestOnSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2)) : 0;
  return [ax + t * dx, az + t * dz];
}
export function closestOnOutline(poly, px, pz) {
  let best = null, bd = Infinity;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k], b = poly[(k + 1) % poly.length];
    const q = closestOnSegment(px, pz, a[0], a[1], b[0], b[1]);
    const d = (q[0] - px) ** 2 + (q[1] - pz) ** 2;
    if (d < bd) { bd = d; best = q; }
  }
  return { q: best, d: Math.sqrt(bd) };
}
export function pointInPolygon(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export class Cloth {
  // outline: Zuschnittkontur in lokalen Koordinaten [m] (x = Schuss, z = Kette), Polygon.
  // Ohne outline entsteht ein Rechteck width × length.
  constructor({ fabric, width = 0.3, length = 0.4, spacing, center, yaw = 0, name, tint, outline = null }) {
    this.id = NEXT_ID++;
    this.fabric = fabric;
    this.m = toSI(fabric);
    this.name = name || `Lage ${this.id + 1}`;
    this.tint = tint || fabric.color;
    const h = spacing;
    this.h = h;
    this.isRect = !outline;
    if (!outline) {
      const W = (Math.max(2, Math.round(width / h) + 1) - 1) * h, L = (Math.max(2, Math.round(length / h) + 1) - 1) * h;
      outline = [[-W / 2, -L / 2], [W / 2, -L / 2], [W / 2, L / 2], [-W / 2, L / 2]];
    }
    this.outline = outline;
    let minx = Infinity, maxx = -Infinity, minz = Infinity, maxz = -Infinity;
    for (const [x, z] of outline) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z); }
    const nx = Math.round((maxx - minx) / h + 0.499) + 1, nz = Math.round((maxz - minz) / h + 0.499) + 1;
    this.nx = nx; this.nz = nz;
    this.width = maxx - minx; this.length = maxz - minz;

    // 1) Gitterknoten: innen, oder Randknoten (auf die Kontur projiziert)
    const G = nx * nz, gx = new Float64Array(G), gz = new Float64Array(G);
    const state = new Int8Array(G); // 0 = aus, 1 = innen, 2 = Rand
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const g = j * nx + i, x = minx + i * h, z = minz + j * h;
      gx[g] = x; gz[g] = z;
      if (pointInPolygon(outline, x, z) || closestOnOutline(outline, x, z).d < 1e-7) state[g] = 1;
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const g = j * nx + i;
      if (state[g]) continue;
      const nb = [[i - 1, j], [i + 1, j], [i, j - 1], [i, j + 1]].some(([a, b]) => a >= 0 && b >= 0 && a < nx && b < nz && state[b * nx + a] === 1);
      if (!nb) continue;
      const { q, d } = closestOnOutline(outline, gx[g], gz[g]);
      if (d > 0.95 * h) continue;
      gx[g] = q[0]; gz[g] = q[1]; state[g] = 2;
    }
    // 2) Dreiecke je Zelle (voll: 2 Dreiecke, 3 Ecken aktiv: 1 Dreieck)
    const tris = [], cellOf = [];
    const area2 = (a, b, c) => (gx[b] - gx[a]) * (gz[c] - gz[a]) - (gx[c] - gx[a]) * (gz[b] - gz[a]);
    const okTri = (a, b, c) => Math.abs(area2(a, b, c)) > 0.08 * h * h;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      const act = [a, b, c, d].filter((g) => state[g]);
      if (act.length === 4) {
        const T = (i + j) % 2 === 0 ? [[a, c, b], [b, c, d]] : [[a, c, d], [a, d, b]];
        if (T.every((t) => okTri(...t))) { for (const t of T) { tris.push(t); cellOf.push(4); } continue; }
        for (const t of T) if (okTri(...t)) { tris.push(t); cellOf.push(3); }
      } else if (act.length === 3) {
        let t = act; // Orientierung wie die übrigen Dreiecke (gegen den Uhrzeigersinn in x/z negativ)
        if (area2(t[0], t[1], t[2]) > 0) t = [t[0], t[2], t[1]];
        if (okTri(...t)) { tris.push(t); cellOf.push(3); }
      }
    }
    // 3) nur Knoten, die in Dreiecken vorkommen; neu nummerieren
    const map = new Int32Array(G).fill(-1);
    let n = 0;
    for (const t of tris) for (const g of t) if (map[g] < 0) map[g] = n++;
    this.gridMap = map;
    this.n = n;
    this.gi = new Int32Array(n); this.gj = new Int32Array(n); this.rest = new Float64Array(2 * n);
    this.border = new Uint8Array(n);
    for (let g = 0; g < G; g++) {
      const v = map[g];
      if (v < 0) continue;
      this.gi[v] = g % nx; this.gj[v] = (g / nx) | 0;
      this.rest[2 * v] = gx[g]; this.rest[2 * v + 1] = gz[g];
      this.border[v] = state[g] === 2 ? 1 : 0;
    }
    this.tri = Int32Array.from(tris.flatMap((t) => t.map((g) => map[g])));
    this.nTri = tris.length;

    this.pos = new Float64Array(3 * n);
    this.prev = new Float64Array(3 * n);
    this.vel = new Float64Array(3 * n);
    this.mass = new Float64Array(n);
    this.w = new Float64Array(n);
    this.attached = new Int16Array(n).fill(-1);
    this.radius = Math.max(this.m.t * 0.5, 5e-5);

    // Masse: volle Zellen zu je einem Viertel auf ihre vier Ecken (gleichmäßig wie im
    // Rechteckgitter), Randdreiecke zu je einem Drittel auf ihre Ecken
    let area = 0;
    const R = this.rest, T = this.tri;
    const triA = (t) => { const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2]; return 0.5 * Math.abs((R[2 * b] - R[2 * a]) * (R[2 * c + 1] - R[2 * a + 1]) - (R[2 * c] - R[2 * a]) * (R[2 * b + 1] - R[2 * a + 1])); };
    for (let t = 0; t < this.nTri; t++) {
      if (cellOf[t] === 4) {
        const A = triA(t) + triA(t + 1);
        const corners = new Set([T[3 * t], T[3 * t + 1], T[3 * t + 2], T[3 * t + 3], T[3 * t + 4], T[3 * t + 5]]);
        for (const v of corners) this.mass[v] += (this.m.rho * A) / 4;
        area += A; t++;
        continue;
      }
      const A = triA(t);
      area += A;
      for (let q = 0; q < 3; q++) this.mass[T[3 * t + q]] += (this.m.rho * A) / 3;
    }
    this.area = area;
    this.totalMass = this.m.rho * area;
    for (let v = 0; v < n; v++) {
      this.w[v] = 1 / this.mass[v];
      const [rx, rz] = rotY(R[2 * v], R[2 * v + 1], yaw);
      this.pos[3 * v] = center[0] + rx; this.pos[3 * v + 1] = center[1]; this.pos[3 * v + 2] = center[2] + rz;
    }
    this.prev.set(this.pos);

    // Abstand jedes Knotens zum Zuschnittrand (für das Luftpolster beim Ablegen)
    this.edgeDist = new Float64Array(n);
    for (let v = 0; v < n; v++) this.edgeDist[v] = closestOnOutline(outline, R[2 * v], R[2 * v + 1]).d;

    // Knoten → Dreiecke (CSR)
    const cnt = new Int32Array(n + 1);
    for (let k = 0; k < T.length; k++) cnt[T[k] + 1]++;
    for (let v = 0; v < n; v++) cnt[v + 1] += cnt[v];
    const list = new Int32Array(T.length), fill = cnt.slice(0, n);
    for (let t = 0; t < this.nTri; t++) for (let q = 0; q < 3; q++) list[fill[T[3 * t + q]]++] = t;
    this.nodeTriStart = cnt; this.nodeTriList = list;

    this._buildConstraints(tris, cellOf);
  }

  // Knotenindex an Gitterposition (−1, wenn außerhalb des Zuschnitts)
  idx(i, j) { return i < 0 || j < 0 || i >= this.nx || j >= this.nz ? -1 : this.gridMap[j * this.nx + i]; }

  restDist(a, b) { const R = this.rest; return Math.hypot(R[2 * a] - R[2 * b], R[2 * a + 1] - R[2 * b + 1]); }

  // ---- Long Range Attachments (Kim, Chentanez, Müller 2012) -------------------
  // Gewebe sind in der Ebene nahezu undehnbar (Dehnung unter Eigengewicht ~10⁻⁴). Ein
  // Gauss-Seidel-Löser mit wenigen Iterationen konvergiert dafür zu langsam und würde
  // die Lage hängend um ein Vielfaches zu stark längen. Einseitige Fesseln von jedem Knoten
  // zu den nächstgelegenen gehaltenen Knoten begrenzen den Abstand auf die geodätische
  // Ruhelänge (kürzester Weg im ebenen Zuschnitt, Dijkstra) zuzüglich der elastischen
  // Dehnung, die bei der Materialsteifigkeit physikalisch möglich ist.
  updateTethers(K = 4) {
    const n = this.n;
    const groups = new Map();
    for (let v = 0; v < n; v++) {
      const a = this.attached[v];
      if (a < 0) continue;
      if (!groups.has(a)) groups.set(a, []);
      groups.get(a).push(v);
    }
    if (!this.tetherIdx) { this.tetherIdx = new Int32Array(n * K); this.tetherRest = new Float64Array(n * K); }
    this.tetherIdx.fill(-1);
    this.tetherK = K;
    this.hasTethers = groups.size > 0;
    if (!this.hasTethers) return;
    // Nachbarschaft (alle Kanten) einmalig aufbauen
    if (!this.adjStart) {
      const deg = new Int32Array(n + 1);
      for (let c = 0; c < this.sI.length; c++) { deg[this.sI[c] + 1]++; deg[this.sJ[c] + 1]++; }
      for (let v = 0; v < n; v++) deg[v + 1] += deg[v];
      const adj = new Int32Array(deg[n]), len = new Float64Array(deg[n]), f = deg.slice(0, n);
      for (let c = 0; c < this.sI.length; c++) {
        const a = this.sI[c], b = this.sJ[c];
        adj[f[a]] = b; len[f[a]++] = this.sRest[c];
        adj[f[b]] = a; len[f[b]++] = this.sRest[c];
      }
      this.adjStart = deg; this.adj = adj; this.adjLen = len;
    }
    const dists = [], srcs = [];
    for (const list of groups.values()) {
      const d = new Float64Array(n).fill(Infinity), src = new Int32Array(n).fill(-1);
      const heap = [];
      const push = (v, dv) => { heap.push([dv, v]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
      const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
      for (const a of list) { d[a] = 0; src[a] = a; push(a, 0); }
      while (heap.length) {
        const [dv, v] = pop();
        if (dv > d[v]) continue;
        for (let e = this.adjStart[v]; e < this.adjStart[v + 1]; e++) {
          const u = this.adj[e], nd = dv + this.adjLen[e];
          if (nd < d[u]) { d[u] = nd; src[u] = src[v]; push(u, nd); }
        }
      }
      dists.push(d); srcs.push(src);
    }
    const order = dists.map((_, k) => k);
    for (let v = 0; v < n; v++) {
      if (this.attached[v] >= 0) continue;
      order.sort((x, y) => dists[x][v] - dists[y][v]);
      for (let k = 0; k < Math.min(K, order.length); k++) {
        const g = order[k];
        if (!Number.isFinite(dists[g][v])) break;
        // geodätische Länge über den Quellknoten (≥ euklidisch)
        this.tetherIdx[v * K + k] = srcs[g][v];
        this.tetherRest[v * K + k] = Math.max(dists[g][v], this.restDist(v, srcs[g][v]));
      }
    }
  }

  solveTethers(slack) {
    if (!this.hasTethers) return;
    const p = this.pos, K = this.tetherK, T = this.tetherIdx, R = this.tetherRest, w = this.w;
    for (let v = 0; v < this.n; v++) {
      if (!w[v]) continue;
      const i = 3 * v;
      for (let k = 0; k < K; k++) {
        const a = T[v * K + k];
        if (a < 0) break;
        const j = 3 * a;
        const dx = p[i] - p[j], dy = p[i + 1] - p[j + 1], dz = p[i + 2] - p[j + 2];
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz), r = R[v * K + k] * (1 + slack);
        if (L <= r) continue;
        const s = (L - r) / L;
        p[i] -= dx * s; p[i + 1] -= dy * s; p[i + 2] -= dz * s;
      }
    }
  }

  _buildConstraints(tris, cellOf) {
    const { h } = this;
    const { Tw, Tf, Gs, Bw, Bf } = this.m;
    const G = Math.max(Gs, 1e-3);
    const TwEff = Math.max(Tw - G, 0.2 * Tw);
    const TfEff = Math.max(Tf - G, 0.2 * Tf);
    const T = this.tri, gi = this.gi, gj = this.gj;
    // Kanten sammeln: Achskanten zählen angrenzende Zellen (Randanteil), Diagonalen = Scherung
    const edges = new Map();
    for (let t = 0; t < this.nTri; t++) {
      for (let q = 0; q < 3; q++) {
        const a = T[3 * t + q], b = T[3 * t + (q + 1) % 3];
        const k = a < b ? a * this.n + b : b * this.n + a;
        const e = edges.get(k);
        if (e) e.cnt++; else edges.set(k, { a: Math.min(a, b), b: Math.max(a, b), cnt: 1, full: cellOf[t] === 4 });
      }
    }
    const axis = [], diag = [];
    for (const e of edges.values()) {
      const di = Math.abs(gi[e.a] - gi[e.b]), dj = Math.abs(gj[e.a] - gj[e.b]);
      if (di + dj === 1) axis.push({ ...e, dir: dj ? 1 : 0 }); else diag.push(e);
    }
    const I = [], J = [], RL = [], A = [], D = [];
    this.edgeShare = new Map();
    for (const e of axis) {
      const share = e.cnt / 2;
      I.push(e.a); J.push(e.b); RL.push(this.restDist(e.a, e.b)); D.push(e.dir);
      A.push(1 / ((e.dir ? TwEff : TfEff) * share));
      this.edgeShare.set(e.a * this.n + e.b, share);
    }
    this.nStruct = I.length;
    // Scherung: Dreiecksdiagonale je Zelle, k = 2G (halbe Zelle: G). Zwei Diagonalen je Zelle
    // würden jede Zelle gegen Verwölbung versteifen und das Drapieren verhindern.
    for (const e of diag) { I.push(e.a); J.push(e.b); RL.push(this.restDist(e.a, e.b)); A.push(1 / (2 * G * (e.full ? 1 : 0.5))); }
    this.sI = Int32Array.from(I); this.sJ = Int32Array.from(J);
    this.sRest = Float64Array.from(RL); this.sAlpha = Float64Array.from(A);
    this.sDir = Uint8Array.from(D);

    // Biegung: Knotentripel entlang beider Fadenrichtungen (nur gerade, gleichmäßige Ruhelage)
    const share = (a, b) => this.edgeShare.get(Math.min(a, b) * this.n + Math.max(a, b));
    const a = [], b = [], c = [], al = [];
    const R = this.rest;
    for (let v = 0; v < this.n; v++) {
      for (const dir of [0, 1]) {
        const i = gi[v], j = gj[v];
        const u = dir ? this.idx(i, j - 1) : this.idx(i - 1, j), w = dir ? this.idx(i, j + 1) : this.idx(i + 1, j);
        if (u < 0 || w < 0) continue;
        const s1 = share(u, v), s2 = share(v, w);
        if (!s1 || !s2) continue;
        const ex = R[2 * u] + R[2 * w] - 2 * R[2 * v], ez = R[2 * u + 1] + R[2 * w + 1] - 2 * R[2 * v + 1];
        if (Math.hypot(ex, ez) > 0.1 * h) continue;
        a.push(u); b.push(v); c.push(w);
        al.push((h * h) / (Math.max(dir ? Bw : Bf, 1e-12) * Math.min(s1, s2)));
      }
    }
    this.bA = Int32Array.from(a); this.bB = Int32Array.from(b); this.bC = Int32Array.from(c);
    this.bAlpha = Float64Array.from(al);
  }

  // Hierarchische Dehnungsbegrenzung (Provot 1995, Müller 2008): einseitige Bedingungen
  // über 1, 2, 4, 8 und 16 Gitterabstände entlang Kette und Schuss. Sie wirken nur auf
  // Zug, behindern Biegen/Falten also nicht, und übertragen Zugkräfte in einem
  // Teilschritt über die ganze Lage. Grenze: Dehnung bei der Linienlast limitLoad.
  _buildLimits() {
    const I = [], J = [], R = [], D = [];
    const hasEdge = (a, b) => this.edgeShare.has(Math.min(a, b) * this.n + Math.max(a, b));
    for (let v = 0; v < this.n; v++) {
      for (const dir of [0, 1]) {
        let prev = v, len = 0, step = 0;
        for (const span of [1, 2, 4, 8, 16]) {
          // entlang der Gitterlinie bis span laufen, nur über vorhandene Kanten
          let ok = true;
          while (step < span) {
            const i = this.gi[prev] + (dir ? 0 : 1), j = this.gj[prev] + (dir ? 1 : 0);
            const nx = this.idx(i, j);
            if (nx < 0 || !hasEdge(prev, nx)) { ok = false; break; }
            len += this.restDist(prev, nx); prev = nx; step++;
          }
          if (!ok) break;
          I.push(v); J.push(prev); R.push(len); D.push(dir);
        }
      }
    }
    this.lI = Int32Array.from(I); this.lJ = Int32Array.from(J); this.lR = Float64Array.from(R); this.lD = Uint8Array.from(D);
  }

  solveLimits(limitLoad = 30) {
    if (!this.lI) this._buildLimits();
    const p = this.pos, w = this.w;
    const ef = 1 + Math.max(1e-3, limitLoad / this.m.Tf), ew = 1 + Math.max(1e-3, limitLoad / this.m.Tw);
    const { lI, lJ, lR, lD } = this;
    for (let c = 0, N = lI.length; c < N; c++) {
      const a = lI[c], b = lJ[c], wa = w[a], wb = w[b], ws = wa + wb;
      if (!ws) continue;
      const i = 3 * a, j = 3 * b;
      const dx = p[j] - p[i], dy = p[j + 1] - p[i + 1], dz = p[j + 2] - p[i + 2];
      const L2 = dx * dx + dy * dy + dz * dz, r = lR[c] * (lD[c] ? ew : ef);
      if (L2 <= r * r) continue;
      const L = Math.sqrt(L2), s = (L - r) / (L * ws);
      p[i] += wa * s * dx; p[i + 1] += wa * s * dy; p[i + 2] += wa * s * dz;
      p[j] -= wb * s * dx; p[j + 1] -= wb * s * dy; p[j + 2] -= wb * s * dz;
    }
  }



  // Interne Materialkräfte, XPBD-Gauss-Seidel-Durchlauf mit Lagrange-Multiplikatoren.
  // iters = 1 (Echtzeit): Bei einem Durchlauf je Teilschritt wirkt eine Bedingung mit der
  // Nachgiebigkeit α + Σw·Δt² statt α (statischer Fixpunkt). Das wird kompensiert, indem
  // α̃' = max(0, α̃ − Σw) verwendet wird; damit ist die statische Steifigkeit exakt, solange
  // die Bedingung weicher als die Massenträgheit im Teilschritt ist (Biegung). Steifere
  // Bedingungen (Zug) werden starr projiziert und durch die Dehnungsbegrenzung ergänzt.
  // iters > 1: klassisches XPBD mit λ-Akkumulation (konvergiert gegen die exakte Lösung).
  resetLambda() {
    if (!this.sLambda) { this.sLambda = new Float64Array(this.sI.length); this.bLambda = new Float64Array(this.bA.length); }
    this.sLambda.fill(0); this.bLambda.fill(0);
  }

  solveInternal(dt, compensate = true) {
    const p = this.pos, w = this.w, inv = 1 / (dt * dt);
    const { sI, sJ, sRest, sAlpha, sLambda } = this;
    for (let c = 0, N = sI.length; c < N; c++) {
      const i = sI[c] * 3, j = sJ[c] * 3;
      const wi = w[sI[c]], wj = w[sJ[c]], ws = wi + wj;
      if (ws === 0) continue;
      const dx = p[i] - p[j], dy = p[i + 1] - p[j + 1], dz = p[i + 2] - p[j + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-12) continue;
      let at = sAlpha[c] * inv;
      if (compensate) at = Math.max(0, at - ws);
      const dl = (-(len - sRest[c]) - at * sLambda[c]) / (ws + at);
      sLambda[c] += dl;
      const s = dl / len;
      p[i] += wi * s * dx; p[i + 1] += wi * s * dy; p[i + 2] += wi * s * dz;
      p[j] -= wj * s * dx; p[j + 1] -= wj * s * dy; p[j + 2] -= wj * s * dz;
    }
    const { bA, bB, bC, bAlpha, bLambda } = this;
    for (let c = 0, N = bA.length; c < N; c++) {
      const ia = bA[c], ib = bB[c], ic = bC[c];
      const wa = w[ia], wb = w[ib], wc = w[ic];
      const ws = wa + 4 * wb + wc;
      if (ws === 0) continue;
      const a = ia * 3, b = ib * 3, cc = ic * 3;
      const ex = p[a] + p[cc] - 2 * p[b], ey = p[a + 1] + p[cc + 1] - 2 * p[b + 1], ez = p[a + 2] + p[cc + 2] - 2 * p[b + 2];
      const len = Math.sqrt(ex * ex + ey * ey + ez * ez);
      if (len < 1e-12) continue;
      let at = bAlpha[c] * inv;
      if (compensate) at = Math.max(0, at - ws);
      const dl = (-len - at * bLambda[c]) / (ws + at);
      bLambda[c] += dl;
      const s = dl / len;
      p[a] += wa * s * ex; p[a + 1] += wa * s * ey; p[a + 2] += wa * s * ez;
      p[cc] += wc * s * ex; p[cc + 1] += wc * s * ey; p[cc + 2] += wc * s * ez;
      p[b] -= 2 * wb * s * ex; p[b + 1] -= 2 * wb * s * ey; p[b + 2] -= 2 * wb * s * ez;
    }
  }

  // Innere Dämpfung (Garnreibung, Hysterese): Dämpfer parallel zu Zug-, Scher- und
  // Biegeelementen, wirkt nur auf Relativgeschwindigkeiten (keine Starrkörperdämpfung).
  damp(dt, betaIn = 80, betaBend = 25) {
    const v = this.vel, p = this.pos, w = this.w;
    const ci = 1 - Math.exp(-betaIn * dt), cb = 1 - Math.exp(-betaBend * dt);
    const { sI, sJ } = this;
    for (let c = 0, N = sI.length; c < N; c++) {
      const a = sI[c], b = sJ[c], wa = w[a], wb = w[b], ws = wa + wb;
      if (!ws) continue;
      const i = 3 * a, j = 3 * b;
      let nx = p[i] - p[j], ny = p[i + 1] - p[j + 1], nz = p[i + 2] - p[j + 2];
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (l < 1e-12) continue;
      nx /= l; ny /= l; nz /= l;
      const dv = ((v[i] - v[j]) * nx + (v[i + 1] - v[j + 1]) * ny + (v[i + 2] - v[j + 2]) * nz) * ci / ws;
      v[i] -= wa * dv * nx; v[i + 1] -= wa * dv * ny; v[i + 2] -= wa * dv * nz;
      v[j] += wb * dv * nx; v[j + 1] += wb * dv * ny; v[j + 2] += wb * dv * nz;
    }
    const { bA, bB, bC } = this;
    for (let c = 0, N = bA.length; c < N; c++) {
      const a = 3 * bA[c], b = 3 * bB[c], d = 3 * bC[c];
      const wa = w[bA[c]], wb = w[bB[c]], wd = w[bC[c]], W = wa + 4 * wb + wd;
      if (!W) continue;
      for (let k = 0; k < 3; k++) {
        const r = (v[b + k] - 0.5 * (v[a + k] + v[d + k])) * cb;
        const f = (2 * r) / W;
        v[b + k] -= 2 * wb * f; v[a + k] += wa * f; v[d + k] += wd * f;
      }
    }
  }

  // ---- Auswertung ----------------------------------------------------------
  centroid() {
    let x = 0, y = 0, z = 0, M = 0;
    for (let v = 0; v < this.n; v++) {
      const m = this.mass[v];
      x += m * this.pos[3 * v]; y += m * this.pos[3 * v + 1]; z += m * this.pos[3 * v + 2]; M += m;
    }
    return [x / M, y / M, z / M];
  }

  // Lage in der Ebene: Schwerpunkt (x, z) und Winkel der Kettrichtung (Procrustes-Anpassung
  // des Ausgangszuschnitts an die aktuelle Lage).
  pose2D() {
    const [cx, , cz] = this.centroid();
    let ru = 0, rv = 0, M = 0;
    for (let v = 0; v < this.n; v++) { ru += this.mass[v] * this.rest[2 * v]; rv += this.mass[v] * this.rest[2 * v + 1]; M += this.mass[v]; }
    ru /= M; rv /= M;
    let A = 0, B = 0;
    for (let v = 0; v < this.n; v++) {
      const u = this.rest[2 * v] - ru, w = this.rest[2 * v + 1] - rv;
      const x = this.pos[3 * v] - cx, z = this.pos[3 * v + 2] - cz, m = this.mass[v];
      A += m * (x * u + z * w); B += m * (x * w - z * u);
    }
    return { x: cx, z: cz, theta: Math.atan2(B, A) };
  }

  // Materialkoordinate (Ausgangszuschnitt) eines Punkts in Dreieck t mit baryzentrischen Koordinaten
  restPoint(t, b0, b1, b2) {
    const T = this.tri, R = this.rest, a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
    return [b0 * R[2 * a] + b1 * R[2 * b] + b2 * R[2 * c], b0 * R[2 * a + 1] + b1 * R[2 * b + 1] + b2 * R[2 * c + 1]];
  }

  maxStrain() {
    let mx = 0;
    const p = this.pos;
    for (let c = 0; c < this.nStruct; c++) {
      const i = this.sI[c] * 3, j = this.sJ[c] * 3;
      const dx = p[i] - p[j], dy = p[i + 1] - p[j + 1], dz = p[i + 2] - p[j + 2];
      const e = Math.sqrt(dx * dx + dy * dy + dz * dz) / this.sRest[c] - 1;
      if (e > mx) mx = e;
    }
    return mx;
  }

  // Dehnungsstatistik der Fadenabschnitte: 99%-Quantil (robust gegen Einzelknoten) und Maximum
  strainStats() {
    const N = this.nStruct, p = this.pos;
    const e = this._strainBuf || (this._strainBuf = new Float64Array(N));
    let mx = 0;
    for (let c = 0; c < N; c++) {
      const i = this.sI[c] * 3, j = this.sJ[c] * 3;
      const dx = p[i] - p[j], dy = p[i + 1] - p[j + 1], dz = p[i + 2] - p[j + 2];
      e[c] = Math.sqrt(dx * dx + dy * dy + dz * dz) / this.sRest[c] - 1;
      if (e[c] > mx) mx = e[c];
    }
    const sorted = Float64Array.from(e).sort();
    return { p99: sorted[Math.floor(0.99 * (N - 1))], p50: sorted[Math.floor(0.5 * (N - 1))], max: mx };
  }

  // Dehnung je Knoten (max. der angrenzenden Fadenabschnitte) für die Falschfarbendarstellung.
  nodeStrain(out) {
    out.fill(0);
    const p = this.pos;
    for (let c = 0; c < this.nStruct; c++) {
      const a = this.sI[c], b = this.sJ[c], i = a * 3, j = b * 3;
      const dx = p[i] - p[j], dy = p[i + 1] - p[j + 1], dz = p[i + 2] - p[j + 2];
      const e = Math.sqrt(dx * dx + dy * dy + dz * dz) / this.sRest[c] - 1;
      if (e > out[a]) out[a] = e;
      if (e > out[b]) out[b] = e;
    }
    return out;
  }

  meanSpeed() {
    let s = 0;
    for (let v = 0; v < this.n; v++) {
      const x = this.vel[3 * v], y = this.vel[3 * v + 1], z = this.vel[3 * v + 2];
      s += Math.sqrt(x * x + y * y + z * z);
    }
    return s / this.n;
  }

  // Welligkeit: Standardabweichung der Höhe [m] (aussagekräftig für abgelegte Lagen).
  waviness() {
    let s = 0, s2 = 0;
    for (let v = 0; v < this.n; v++) { const y = this.pos[3 * v + 1]; s += y; s2 += y * y; }
    const m = s / this.n;
    return Math.sqrt(Math.max(0, s2 / this.n - m * m));
  }

  attachedCount() {
    let c = 0;
    for (let v = 0; v < this.n; v++) if (this.attached[v] >= 0) c++;
    return c;
  }
}

// Dreieck und baryzentrische Koordinaten eines Punkts im Ausgangszuschnitt (u, v)
export function locateRest(c, u, v) {
  const R = c.rest, T = c.tri;
  for (let t = 0; t < c.nTri; t++) {
    const a = T[3 * t], b = T[3 * t + 1], d = T[3 * t + 2];
    const v0x = R[2 * d] - R[2 * a], v0z = R[2 * d + 1] - R[2 * a + 1];
    const v1x = R[2 * b] - R[2 * a], v1z = R[2 * b + 1] - R[2 * a + 1];
    const v2x = u - R[2 * a], v2z = v - R[2 * a + 1];
    const den = v0x * v1z - v1x * v0z;
    if (Math.abs(den) < 1e-14) continue;
    const s = (v2x * v1z - v1x * v2z) / den, w = (v0x * v2z - v2x * v0z) / den;
    if (s >= -1e-9 && w >= -1e-9 && s + w <= 1 + 1e-9) return { tri: t, b0: 1 - s - w, b1: w, b2: s };
  }
  return null;
}
