// Kontakt zwischen Textillagen (und Selbstkontakt) als Punkt-Dreieck-Bedingung mit
// Materialdicke, Coulomb-Reibung (Stoff/Stoff) und Lagenhaftung (Kohäsion).
// Kandidatensuche einmal pro Bildschritt über ein räumliches Hashgitter, Auflösung in
// jedem Teilschritt. Die Seite (oben/unten) wird bei der Erkennung festgehalten, damit
// dünne Lagen auch bei großen Verschiebungen nicht durchtunneln.

const P1 = 73856093, P2 = 19349663, P3 = 83492791;
function computeAABB(c) {
  const p = c.pos, b = c.aabb || (c.aabb = new Float64Array(6));
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0, N = 3 * c.n; i < N; i += 3) {
    const x = p[i], y = p[i + 1], z = p[i + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  b[0] = x0; b[1] = y0; b[2] = z0; b[3] = x1; b[4] = y1; b[5] = z1;
}
function hashCell(x, y, z, mask) { return ((Math.imul(x, P1) ^ Math.imul(y, P2) ^ Math.imul(z, P3)) >>> 0) & mask; }

export class ClothContacts {
  constructor() {
    this.cap = 1 << 16;
    this._alloc(this.cap);
    this.n = 0;
    this.selfCollision = true;
    this.cohesionRange = 0.4e-3; // Reichweite der Lagenhaftung [m]
    this._stamp = 0;
  }

  _alloc(cap) {
    const old = this.n ? { a: this.vc, b: this.vi, c: this.tc, d: this.ti, e: this.side } : null;
    this.vc = new Int16Array(cap); this.vi = new Int32Array(cap);
    this.tc = new Int16Array(cap); this.ti = new Int32Array(cap);
    this.side = new Int8Array(cap);
    if (old) { this.vc.set(old.a); this.vi.set(old.b); this.tc.set(old.c); this.ti.set(old.d); this.side.set(old.e); }
    this.cap = cap;
  }

  // Hashgitter über die Dreiecke einer Lage; AABB je Dreieck um die Eigenbewegung m erweitert
  _buildHash(c, m, inv) {
    const nT = c.nTri;
    const size = 1 << Math.ceil(Math.log2(Math.max(256, nT * 4)));
    const mask = size - 1;
    const count = new Int32Array(size + 1);
    const ranges = new Int32Array(nT * 6);
    const p = c.pos, T = c.tri;
    let entries = 0;
    for (let t = 0; t < nT; t++) {
      const a = T[3 * t] * 3, b = T[3 * t + 1] * 3, d = T[3 * t + 2] * 3, o = t * 6;
      for (let k = 0; k < 3; k++) {
        const pa = p[a + k], pb = p[b + k], pd = p[d + k];
        ranges[o + k] = Math.floor((Math.min(pa, pb, pd) - m) * inv);
        ranges[o + 3 + k] = Math.floor((Math.max(pa, pb, pd) + m) * inv);
      }
      for (let x = ranges[o]; x <= ranges[o + 3]; x++)
        for (let y = ranges[o + 1]; y <= ranges[o + 4]; y++)
          for (let z = ranges[o + 2]; z <= ranges[o + 5]; z++) { count[hashCell(x, y, z, mask)]++; entries++; }
    }
    for (let i = 1; i <= size; i++) count[i] += count[i - 1];
    // Dreiecksgeometrie vorberechnen: a, e1, e2, n, d00, d01, d11, 1/den
    const G = new Float64Array(nT * 16);
    for (let t = 0; t < nT; t++) {
      const a = T[3 * t] * 3, b = T[3 * t + 1] * 3, d = T[3 * t + 2] * 3, o = t * 16;
      const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
      const e2x = p[d] - p[a], e2y = p[d + 1] - p[a + 1], e2z = p[d + 2] - p[a + 2];
      let nX = e1y * e2z - e1z * e2y, nY = e1z * e2x - e1x * e2z, nZ = e1x * e2y - e1y * e2x;
      const nl = Math.sqrt(nX * nX + nY * nY + nZ * nZ);
      const d00 = e1x * e1x + e1y * e1y + e1z * e1z, d01 = e1x * e2x + e1y * e2y + e1z * e2z, d11 = e2x * e2x + e2y * e2y + e2z * e2z;
      const den = d00 * d11 - d01 * d01;
      if (nl < 1e-14 || Math.abs(den) < 1e-20) { G[o + 15] = 0; continue; }
      G[o] = p[a]; G[o + 1] = p[a + 1]; G[o + 2] = p[a + 2];
      G[o + 3] = e1x; G[o + 4] = e1y; G[o + 5] = e1z; G[o + 6] = e2x; G[o + 7] = e2y; G[o + 8] = e2z;
      G[o + 9] = nX / nl; G[o + 10] = nY / nl; G[o + 11] = nZ / nl;
      G[o + 12] = d00; G[o + 13] = d01; G[o + 14] = d11; G[o + 15] = 1 / den;
    }
    const E = new Int32Array(entries);
    for (let t = 0; t < nT; t++) {
      const o = t * 6;
      for (let x = ranges[o]; x <= ranges[o + 3]; x++)
        for (let y = ranges[o + 1]; y <= ranges[o + 4]; y++)
          for (let z = ranges[o + 2]; z <= ranges[o + 5]; z++) E[--count[hashCell(x, y, z, mask)]] = t;
    }
    return { count, E, mask, G, stamp: new Int32Array(nT).fill(-1) };
  }

  // Kandidatensuche für ein Zeitintervall span. Je Lage wird zwischen Starrkörperbewegung
  // (mittlere Geschwindigkeit vbulk) und Eigenbewegung (vrel) unterschieden; der Suchradius
  // eines Lagenpaars ergibt sich aus Eigenbewegungen + Relativgeschwindigkeit der Lagen.
  detect(cloths, span) {
    this.n = 0;
    if (!cloths.length) return;
    const inv = 1 / cloths[0].h;
    for (const c of cloths) if (!c.sleeping) computeAABB(c);
    const mi = cloths.map((c) => (c.sleeping ? 0.2e-3 : Math.min(0.01, (c.vrel || 0) * span * 1.5 + 0.4e-3)));
    const H = new Array(cloths.length).fill(null);
    for (let vc = 0; vc < cloths.length; vc++) {
      const C = cloths[vc], A = C.aabb;
      for (let tc = 0; tc < cloths.length; tc++) {
        const D = cloths[tc], B = D.aabb;
        if (C.sleeping && D.sleeping) continue;
        if (tc === vc && !this.selfCollision) continue;
        const vb = C.vbulk && D.vbulk ? Math.hypot(C.vbulk[0] - D.vbulk[0], C.vbulk[1] - D.vbulk[1], C.vbulk[2] - D.vbulk[2]) : 0;
        const rel = Math.min(0.03, vb * span * 1.5);
        const mSurf = mi[vc] + mi[tc] + rel;
        const m = mSurf + C.radius + D.radius;
        if (A[0] > B[3] + m || A[3] < B[0] - m || A[1] > B[4] + m || A[4] < B[1] - m || A[2] > B[5] + m || A[5] < B[2] - m) continue;
        if (!H[tc]) H[tc] = this._buildHash(D, mi[tc] + 2 * D.radius, inv);
        this._query(cloths, vc, tc, H[tc], m, mSurf, mi[vc] + rel, inv);
      }
    }
  }

  _query(cloths, vc, tc, H, margin, mSurf, qr, inv) {
    const { count, E, mask, stamp, G } = H;
    const C = cloths[vc], D = cloths[tc], p = C.pos, gi = C.gi, gj = C.gj, B = D.aabb;
    const T = D.tri;
    const self = tc === vc;
    const rr = C.radius + D.radius;
    for (let v = 0; v < C.n; v++) {
      const x = p[3 * v], y = p[3 * v + 1], z = p[3 * v + 2];
      if (x < B[0] - margin || x > B[3] + margin || y < B[1] - margin || y > B[4] + margin || z < B[2] - margin || z > B[5] + margin) continue;
      const vi = gi[v], vj = gj[v];
      const sv = ++this._stamp;
      let bestT = -1, bestQ = -Infinity, bestSide = 1;
      const x0 = Math.floor((x - qr) * inv), x1 = Math.floor((x + qr) * inv);
      const y0 = Math.floor((y - qr) * inv), y1 = Math.floor((y + qr) * inv);
      const z0 = Math.floor((z - qr) * inv), z1 = Math.floor((z + qr) * inv);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) for (let cz = z0; cz <= z1; cz++) {
        const hsh = hashCell(cx, cy, cz, mask);
        for (let e = count[hsh], end = count[hsh + 1]; e < end; e++) {
          const t = E[e];
          if (stamp[t] === sv) continue;
          stamp[t] = sv;
          const i0 = T[3 * t], i1 = T[3 * t + 1], i2 = T[3 * t + 2];
          if (self) {
            if (i0 === v || i1 === v || i2 === v) continue;
            if (Math.abs(gi[i0] - vi) <= 2 && Math.abs(gj[i0] - vj) <= 2) continue;
            if (Math.abs(gi[i1] - vi) <= 2 && Math.abs(gj[i1] - vj) <= 2) continue;
            if (Math.abs(gi[i2] - vi) <= 2 && Math.abs(gj[i2] - vj) <= 2) continue;
          }
          const o = t * 16;
          const iden = G[o + 15];
          if (iden === 0) continue;
          const wx = x - G[o], wy = y - G[o + 1], wz = z - G[o + 2];
          const nX = G[o + 9], nY = G[o + 10], nZ = G[o + 11];
          const dist = wx * nX + wy * nY + wz * nZ;
          if (Math.abs(dist) - rr > mSurf) continue;
          const px = wx - dist * nX, py = wy - dist * nY, pz = wz - dist * nZ;
          const d20 = px * G[o + 3] + py * G[o + 4] + pz * G[o + 5], d21 = px * G[o + 6] + py * G[o + 7] + pz * G[o + 8];
          const b1 = (G[o + 14] * d20 - G[o + 13] * d21) * iden, b2 = (G[o + 12] * d21 - G[o + 13] * d20) * iden, b0 = 1 - b1 - b2;
          const qmin = Math.min(b0, b1, b2);
          if (qmin < -0.05) continue;
          if (self) { this._push(vc, v, tc, t, dist >= 0 ? 1 : -1); continue; }
          // je Punkt und Nachbarlage nur das am besten passende Dreieck
          const score = qmin - Math.abs(dist) * 100;
          if (score > bestQ) { bestQ = score; bestT = t; bestSide = dist >= 0 ? 1 : -1; }
        }
      }
      if (bestT >= 0) this._push(vc, v, tc, bestT, bestSide);
    }
  }

  _push(vc, v, tc, t, side) {
    if (this.n >= this.cap) this._alloc(this.cap * 2);
    const k = this.n++;
    this.vc[k] = vc; this.vi[k] = v; this.tc[k] = tc; this.ti[k] = t; this.side[k] = side;
  }

  solve(cloths, dt) {
    const dt2 = dt * dt;
    // Spalt zur Lage darunter je Knoten (für das Luftpolster)
    for (const c of cloths) { if (!c.gapBelow) c.gapBelow = new Float64Array(c.n); c.gapBelow.fill(Infinity); }
    for (let k = 0; k < this.n; k++) {
      const C = cloths[this.vc[k]], D = cloths[this.tc[k]];
      const v = this.vi[k], t = this.ti[k], s = this.side[k];
      const p = C.pos, pp = C.prev, q = D.pos, qp = D.prev;
      const T = D.tri, i0 = T[3 * t], i1 = T[3 * t + 1], i2 = T[3 * t + 2];
      const a = i0 * 3, b = i1 * 3, d = i2 * 3, x = v * 3;
      const e1x = q[b] - q[a], e1y = q[b + 1] - q[a + 1], e1z = q[b + 2] - q[a + 2];
      const e2x = q[d] - q[a], e2y = q[d + 1] - q[a + 1], e2z = q[d + 2] - q[a + 2];
      let nX = e1y * e2z - e1z * e2y, nY = e1z * e2x - e1x * e2z, nZ = e1x * e2y - e1y * e2x;
      const nl = Math.sqrt(nX * nX + nY * nY + nZ * nZ);
      if (nl < 1e-14) continue;
      nX = (nX / nl) * s; nY = (nY / nl) * s; nZ = (nZ / nl) * s; // zeigt zur Seite des Punkts
      const wx = p[x] - q[a], wy = p[x + 1] - q[a + 1], wz = p[x + 2] - q[a + 2];
      const dist = wx * nX + wy * nY + wz * nZ;
      const thick = C.radius + D.radius;
      const coh = Math.min(C.m.cohesion, D.m.cohesion);
      if (nY > 0.7 && dist > thick && dist - thick < C.gapBelow[v]) C.gapBelow[v] = dist - thick;
      if (dist >= thick + (coh > 0 ? this.cohesionRange : 0)) continue;
      const px = wx - dist * nX, py = wy - dist * nY, pz = wz - dist * nZ;
      const d00 = e1x * e1x + e1y * e1y + e1z * e1z, d01 = e1x * e2x + e1y * e2y + e1z * e2z;
      const d11 = e2x * e2x + e2y * e2y + e2z * e2z;
      const d20 = px * e1x + py * e1y + pz * e1z, d21 = px * e2x + py * e2y + pz * e2z;
      const den = d00 * d11 - d01 * d01;
      const b1 = (d11 * d20 - d01 * d21) / den, b2 = (d00 * d21 - d01 * d20) / den, b0 = 1 - b1 - b2;
      if (b0 < -0.08 || b1 < -0.08 || b2 < -0.08) continue;
      const cs = C.sleeping, ds = D.sleeping;
      const w = cs ? 0 : C.w[v], w0 = ds ? 0 : D.w[i0], w1 = ds ? 0 : D.w[i1], w2 = ds ? 0 : D.w[i2];
      const W = w + w0 * b0 * b0 + w1 * b1 * b1 + w2 * b2 * b2;
      if (W === 0) continue;
      const Cval = dist - thick;
      if (Cval < -0.5 * thick) { if (cs) C.wake = true; if (ds) D.wake = true; }
      let dl;
      if (Cval < 0) dl = -Cval / W;                       // Durchdringung auflösen
      else dl = -Math.min(Cval / W, coh * (C.mass[v] / C.m.rho) * dt2); // Haftung (Zug begrenzt)
      // Korrektur entlang n: Punkt +, Dreieck −
      p[x] += w * dl * nX; p[x + 1] += w * dl * nY; p[x + 2] += w * dl * nZ;
      q[a] -= w0 * b0 * dl * nX; q[a + 1] -= w0 * b0 * dl * nY; q[a + 2] -= w0 * b0 * dl * nZ;
      q[b] -= w1 * b1 * dl * nX; q[b + 1] -= w1 * b1 * dl * nY; q[b + 2] -= w1 * b1 * dl * nZ;
      q[d] -= w2 * b2 * dl * nX; q[d + 1] -= w2 * b2 * dl * nY; q[d + 2] -= w2 * b2 * dl * nZ;
      if (Cval >= 0) continue;
      // Reibung
      const muS = 0.5 * (C.m.muSelfS + D.m.muSelfS), muK = 0.5 * (C.m.muSelfK + D.m.muSelfK);
      let rx = (p[x] - pp[x]) - (b0 * (q[a] - qp[a]) + b1 * (q[b] - qp[b]) + b2 * (q[d] - qp[d]));
      let ry = (p[x + 1] - pp[x + 1]) - (b0 * (q[a + 1] - qp[a + 1]) + b1 * (q[b + 1] - qp[b + 1]) + b2 * (q[d + 1] - qp[d + 1]));
      let rz = (p[x + 2] - pp[x + 2]) - (b0 * (q[a + 2] - qp[a + 2]) + b1 * (q[b + 2] - qp[b + 2]) + b2 * (q[d + 2] - qp[d + 2]));
      const rn = rx * nX + ry * nY + rz * nZ;
      rx -= rn * nX; ry -= rn * nY; rz -= rn * nZ;
      const rt = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (rt < 1e-15) continue;
      const pen = -Cval;
      const f = (rt < muS * pen ? 1 : Math.min(1, (muK * pen) / rt)) / W;
      p[x] -= w * f * rx; p[x + 1] -= w * f * ry; p[x + 2] -= w * f * rz;
      q[a] += w0 * b0 * f * rx; q[a + 1] += w0 * b0 * f * ry; q[a + 2] += w0 * b0 * f * rz;
      q[b] += w1 * b1 * f * rx; q[b + 1] += w1 * b1 * f * ry; q[b + 2] += w1 * b1 * f * rz;
      q[d] += w2 * b2 * f * rx; q[d + 1] += w2 * b2 * f * ry; q[d + 2] += w2 * b2 * f * rz;
    }
  }
}
