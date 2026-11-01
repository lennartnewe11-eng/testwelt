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

export class Cloth {
  constructor({ fabric, width, length, spacing, center, yaw = 0, name, tint }) {
    this.id = NEXT_ID++;
    this.fabric = fabric;
    this.m = toSI(fabric);
    this.name = name || `Lage ${this.id + 1}`;
    this.tint = tint || fabric.color;
    const h = spacing;
    const nx = Math.max(2, Math.round(width / h) + 1);
    const nz = Math.max(2, Math.round(length / h) + 1);
    this.h = h; this.nx = nx; this.nz = nz;
    this.width = (nx - 1) * h; this.length = (nz - 1) * h;
    const n = nx * nz;
    this.n = n;
    this.pos = new Float64Array(3 * n);
    this.prev = new Float64Array(3 * n);
    this.vel = new Float64Array(3 * n);
    this.mass = new Float64Array(n);
    this.w = new Float64Array(n);            // inverse Masse (0 = fixiert)
    this.attached = new Int16Array(n).fill(-1); // Index des haltenden Greiferelements
    this.radius = Math.max(this.m.t * 0.5, 5e-5);
    this.area = this.width * this.length;
    this.totalMass = this.m.rho * this.area;

    const share = (i, N) => (i === 0 || i === N - 1 ? 0.5 : 1);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const v = j * nx + i;
        const lx = i * h - this.width / 2, lz = j * h - this.length / 2;
        const [rx, rz] = rotY(lx, lz, yaw);
        this.pos[3 * v] = center[0] + rx;
        this.pos[3 * v + 1] = center[1];
        this.pos[3 * v + 2] = center[2] + rz;
        const m = this.m.rho * h * h * share(i, nx) * share(j, nz);
        this.mass[v] = m; this.w[v] = 1 / m;
      }
    }
    this.prev.set(this.pos);
    this._buildConstraints(share);
    this._buildTriangles();
  }

  idx(i, j) { return j * this.nx + i; }

  // ---- Long Range Attachments (Kim, Chentanez, Müller 2012) -------------------
  // Gewebe sind in der Ebene nahezu undehnbar (Dehnung unter Eigengewicht ~10⁻⁴). Ein
  // Gauss-Seidel-Löser mit wenigen Iterationen konvergiert dafür zu langsam und würde
  // die Lage hängend um ein Vielfaches zu stark längen. Einseitige Fesseln von jedem Knoten
  // zu den nächstgelegenen gehaltenen Knoten begrenzen den Abstand auf die geodätische
  // Ruhelänge (hier = Abstand im ebenen Ausgangszuschnitt) zuzüglich der elastischen
  // Dehnung, die bei der Materialsteifigkeit physikalisch möglich ist.
  updateTethers(K = 4) {
    const { n, nx, h } = this;
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
    const best = [];
    for (let v = 0; v < n; v++) {
      if (this.attached[v] >= 0) continue;
      const vi = v % nx, vj = (v / nx) | 0;
      best.length = 0;
      for (const list of groups.values()) {
        let bd = Infinity, bi = -1;
        for (const a of list) {
          const di = (a % nx) - vi, dj = ((a / nx) | 0) - vj;
          const d = di * di + dj * dj;
          if (d < bd) { bd = d; bi = a; }
        }
        best.push([bd, bi]);
      }
      best.sort((x, y) => x[0] - y[0]);
      for (let k = 0; k < Math.min(K, best.length); k++) {
        this.tetherIdx[v * K + k] = best[k][1];
        this.tetherRest[v * K + k] = Math.sqrt(best[k][0]) * h;
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

  _buildConstraints(share) {
    const { nx, nz, h } = this;
    const { Tw, Tf, Gs, Bw, Bf } = this.m;
    const G = Math.max(Gs, 1e-3);
    const TwEff = Math.max(Tw - G, 0.2 * Tw);
    const TfEff = Math.max(Tf - G, 0.2 * Tf);
    const I = [], J = [], R = [], A = [];
    // Zug: Schuss (x-Richtung)
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx - 1; i++) {
      I.push(this.idx(i, j)); J.push(this.idx(i + 1, j)); R.push(h); A.push(1 / (TfEff * share(j, nz)));
    }
    // Zug: Kette (z-Richtung)
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx; i++) {
      I.push(this.idx(i, j)); J.push(this.idx(i, j + 1)); R.push(h); A.push(1 / (TwEff * share(i, nx)));
    }
    this.nStruct = I.length;
    // Scherung: eine Diagonale je Zelle (die Dreieckskante, Richtung alternierend).
    // Zwei Diagonalen würden jede Zelle gegen Verwölbung versteifen (4 Punkte, 6 Abstände
    // = starr) und doppelt gekrümmtes Drapieren verhindern. Energie je Zelle
    // ½·k_d·(h·√2·γ/2)² = ½·G·γ²·h²  ⇒  k_d = 2·G.
    const d = h * Math.SQRT2;
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      if ((i + j) % 2 === 0) { I.push(this.idx(i + 1, j)); J.push(this.idx(i, j + 1)); }
      else { I.push(this.idx(i, j)); J.push(this.idx(i + 1, j + 1)); }
      R.push(d); A.push(1 / (2 * G));
    }
    this.sI = Int32Array.from(I); this.sJ = Int32Array.from(J);
    this.sRest = Float64Array.from(R); this.sAlpha = Float64Array.from(A);
    this.sDir = new Uint8Array(this.nStruct); // 0 = Schuss, 1 = Kette
    for (let c = (nx - 1) * nz; c < this.nStruct; c++) this.sDir[c] = 1;

    // Biegung: Knotentripel entlang beider Fadenrichtungen
    const a = [], b = [], c = [], al = [];
    for (let j = 0; j < nz; j++) for (let i = 1; i < nx - 1; i++) {
      a.push(this.idx(i - 1, j)); b.push(this.idx(i, j)); c.push(this.idx(i + 1, j));
      al.push((h * h) / (Math.max(Bf, 1e-12) * share(j, nz)));
    }
    for (let j = 1; j < nz - 1; j++) for (let i = 0; i < nx; i++) {
      a.push(this.idx(i, j - 1)); b.push(this.idx(i, j)); c.push(this.idx(i, j + 1));
      al.push((h * h) / (Math.max(Bw, 1e-12) * share(i, nx)));
    }
    this.bA = Int32Array.from(a); this.bB = Int32Array.from(b); this.bC = Int32Array.from(c);
    this.bAlpha = Float64Array.from(al);
  }

  // Hierarchische Dehnungsbegrenzung (Provot 1995, Müller 2008): einseitige Bedingungen
  // über 1, 2, 4, 8 und 16 Gitterabstände entlang Kette und Schuss. Sie wirken nur auf
  // Zug, behindern Biegen/Falten also nicht, und übertragen Zugkräfte in einem
  // Teilschritt über die ganze Lage. Grenze: Dehnung bei der Linienlast limitLoad.
  _buildLimits() {
    const { nx, nz, h } = this;
    const I = [], J = [], R = [], D = [];
    for (const span of [1, 2, 4, 8, 16]) {
      for (let j = 0; j < nz; j++) for (let i = 0; i + span < nx; i++) { I.push(this.idx(i, j)); J.push(this.idx(i + span, j)); R.push(span * h); D.push(0); }
      for (let j = 0; j + span < nz; j++) for (let i = 0; i < nx; i++) { I.push(this.idx(i, j)); J.push(this.idx(i, j + span)); R.push(span * h); D.push(1); }
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

  _buildTriangles() {
    const { nx, nz } = this;
    const T = [];
    for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = this.idx(i, j), b = this.idx(i + 1, j), c = this.idx(i, j + 1), d = this.idx(i + 1, j + 1);
      if ((i + j) % 2 === 0) { T.push(a, c, b, b, c, d); } else { T.push(a, c, d, a, d, b); }
    }
    this.tri = Int32Array.from(T);
    this.nTri = T.length / 3;
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

  // Lage in der Ebene: Schwerpunkt (x, z) und Winkel der Kettrichtung.
  pose2D() {
    const [cx, , cz] = this.centroid();
    let wx = 0, wz = 0;
    for (let i = 0; i < this.nx; i++) {
      const a = this.idx(i, 0) * 3, b = this.idx(i, this.nz - 1) * 3;
      wx += this.pos[b] - this.pos[a]; wz += this.pos[b + 2] - this.pos[a + 2];
    }
    return { x: cx, z: cz, theta: Math.atan2(wx, wz) };
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
