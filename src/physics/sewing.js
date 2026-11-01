// Industrienähmaschine mit Untertransport (Transporteur), Nähfuß und Nadel.
//
// Stofftransport (explizites Reibmodell im Nähfußbereich):
//  • Normalkraft: Nähfußdruck F_F verteilt auf die Knoten unter dem Fuß.
//  • Untere Lage: vom Transporteur mitgenommen, solange μ_T·F_N reicht (sonst Schlupf).
//  • Obere Lagen: Reibkopplung zur Lage darunter (μ Stoff/Stoff), gebremst durch die
//    Reibung am Nähfuß (μ Stoff/Stahl bzw. PTFE). Daraus entsteht die bekannte
//    Lagenverschiebung beim Nähen mehrerer Lagen.
//  • Nadel im Stoff (Phase 0…0,45): alle Lagen an der Einstichstelle fixiert.
//  • Jeder Einstich erzeugt einen Stich, der die Lagen mechanisch verbindet.

import { BoxCollider } from './colliders.js';
import { SOLIDS } from './materials.js';

export class SewingMachine {
  constructor({ needle = [0.62, 0.8, -0.12], feedDir = [0, 0, -1] } = {}) {
    this.needle = [...needle];       // Einstichpunkt auf Stichplattenhöhe
    this.feedDir = feedDir;
    this.rpm = 600;
    this.stitchLength = 3.0;         // mm
    this.footForce = 40;             // N
    this.footMaterial = 'stahl';
    this.dogMu = 0.9;                // Transporteur (gezahnt) gegen Stoff
    this.footUp = true;
    this.footLift = 8e-3;
    this.half = [0.009, 0.016];      // Nähfuß halbe Breite (x) / Länge (z)
    this.sewing = false;
    this.sewTarget = 0;
    this.stitches = 0;
    this.phase = 0.6;
    this.lastPhase = 0.6;
    this.stitchPoints = [];          // {cloth, tri, b0, b1, b2}
    this.joins = [];                 // {ca, va, cb, vb, rest}
    this.needleDepth = 0;            // für Darstellung (0 = oben, 1 = unten)
    this.foot = new BoxCollider({ name: 'Nähfuß', center: [needle[0], needle[1] + this.footLift + 0.004, needle[2]], half: [this.half[0], 0.004, this.half[1]], material: 'stahl', kinematic: true, visual: false });
    this.footY = needle[1] + this.footLift;
  }

  startSew(length, rpm, stitch) {
    if (rpm) this.rpm = rpm;
    if (stitch) this.stitchLength = stitch;
    this.sewTarget = Math.max(1, Math.round((length * 1000) / this.stitchLength));
    this.stitches = 0;
    this.sewing = true;
  }

  get busy() { return this.sewing; }

  update(t, dt) {
    if (this.sewing) {
      this.lastPhase = this.phase;
      this.phase += (this.rpm / 60) * dt;
      if (this.phase >= 1) {
        this.phase -= 1;
        this._pendingStitch = true;
      }
    } else if (this.phase < 0.5 || this.phase > 0.95) {
      // Nadel in Hochstellung fahren
      this.phase = Math.min(0.6, this.phase + (this.rpm / 60) * dt);
      if (this.phase > 0.95) this.phase = 0.6;
    }
    const ph = this.phase;
    this.needleDepth = 0.5 + 0.5 * Math.cos(2 * Math.PI * (ph - 0.2));
    const top = this.footUp ? this.needle[1] + this.footLift : this.footY;
    this.foot.setPose([this.needle[0], top + this.foot.half[1], this.needle[2]]);
    this.foot.enabled = this.footUp;
  }

  feedVelocity() {
    const ph = this.phase;
    if (!this.sewing || ph < 0.5 || ph > 0.95) return 0;
    const u = (ph - 0.5) / 0.45;
    // Transporteurbahn: s(u) = L·(u − sin(2πu)/2π)  →  v = L·(1 − cos 2πu)/T
    const L = this.stitchLength * 1e-3;
    return (L * (1 - Math.cos(2 * Math.PI * u)) * (this.rpm / 60)) / 0.45;
  }

  // Gruppiert die Knoten unter dem Fuß nach Lagen (von unten nach oben)
  _zone(cloths) {
    const [nx0, ny0, nz0] = this.needle;
    const groups = [];
    for (const c of cloths) {
      const p = c.pos, idx = [];
      let ys = 0;
      for (let v = 0; v < c.n; v++) {
        const dx = p[3 * v] - nx0, dz = p[3 * v + 2] - nz0;
        if (Math.abs(dx) > this.half[0] || Math.abs(dz) > this.half[1]) continue;
        if (p[3 * v + 1] > ny0 + 0.012) continue;
        idx.push(v); ys += p[3 * v + 1];
      }
      if (idx.length) groups.push({ c, idx, y: ys / idx.length });
    }
    groups.sort((a, b) => a.y - b.y);
    return groups;
  }

  solve(cloths, dt, t) {
    // Stiche (bleibende Verbindungen der Lagen)
    for (const j of this.joins) this._solveJoin(j);
    if (this.footUp) return;
    const groups = this._zone(cloths);
    if (!groups.length) {
      this.footY = this.needle[1];
      if (this._pendingStitch) { this._pendingStitch = false; this.stitches++; this.emptyStitches = (this.emptyStitches || 0) + 1; if (this.stitches >= this.sewTarget) this.sewing = false; }
      return;
    }
    let stack = 0;
    for (const g of groups) stack += 2 * g.c.radius;
    this.footY = this.needle[1] + stack * 0.85; // Stoff unter Fußdruck leicht komprimiert

    const dt2 = dt * dt;
    const vf = this.feedVelocity();
    const fx = this.feedDir[0] * vf * dt, fz = this.feedDir[2] * vf * dt;
    const needleIn = this.sewing && this.phase < 0.45;
    const muFoot = (SOLIDS[this.footMaterial]?.frictionFactor ?? 1);
    let below = null, yBase = this.needle[1];
    for (let k = 0; k < groups.length; k++) {
      const { c, idx } = groups[k];
      const p = c.pos, pp = c.prev;
      const Fn = this.footForce / idx.length;
      const comp = (2 * c.radius) * 0.85;
      const yTarget = yBase + comp / 2;
      yBase += comp;
      let mdx = 0, mdz = 0;
      for (const v of idx) {
        const i = 3 * v, w = c.w[v];
        if (w === 0) continue;
        const lim = (mu) => mu * Fn * dt2 * w;
        let dx = p[i] - pp[i], dz = p[i + 2] - pp[i + 2];
        // Sollverschiebung aus der Lage darunter bzw. dem Transporteur
        let tx, tz, mu;
        if (k === 0) { tx = fx; tz = fz; mu = this.dogMu; }
        else { tx = below[0]; tz = below[1]; mu = 0.5 * (c.m.muSelfS + groups[k - 1].c.m.muSelfS); }
        let cx = tx - dx, cz = tz - dz;
        let cl = Math.hypot(cx, cz), L = lim(mu);
        if (cl > L) { cx *= L / cl; cz *= L / cl; }
        p[i] += cx; p[i + 2] += cz; dx += cx; dz += cz;
        // oberste Lage: Reibung am (stehenden) Nähfuß
        if (k === groups.length - 1) {
          const Lf = lim(c.m.muSteelK * muFoot);
          cl = Math.hypot(dx, dz);
          if (cl > 1e-15) {
            const s = Math.min(1, Lf / cl);
            p[i] -= dx * s; p[i + 2] -= dz * s; dx -= dx * s; dz -= dz * s;
          }
        }
        if (needleIn) { p[i] -= dx; p[i + 2] -= dz; dx = 0; dz = 0; }
        p[i + 1] = yTarget;
        mdx += dx; mdz += dz;
      }
      below = [mdx / idx.length, mdz / idx.length];
    }

    if (this._pendingStitch) {
      this._pendingStitch = false;
      this._makeStitch(groups);
      this.stitches++;
      if (this.stitches >= this.sewTarget) this.sewing = false;
    }
  }

  _makeStitch(groups) {
    // Einstichpunkt in jeder Lage als materieller Punkt (baryzentrisch im Dreieck)
    const hits = groups.map((g) => ({ c: g.c, hit: locateTriangle(g.c, this.needle[0], this.needle[2]) })).filter((h) => h.hit);
    if (!hits.length) return;
    const top = hits[hits.length - 1];
    this.stitchPoints.push({ cloth: top.c, ...top.hit });
    // Der Faden verbindet benachbarte Lagen an der Einstichstelle (trägt nur Zug)
    for (let k = 1; k < hits.length; k++) {
      const a = hits[k - 1], b = hits[k];
      this.joins.push({ ca: a.c, ta: a.hit.tri, ba: [a.hit.b0, a.hit.b1, a.hit.b2], cb: b.c, tb: b.hit.tri, bb: [b.hit.b0, b.hit.b1, b.hit.b2], rest: a.c.radius + b.c.radius });
    }
  }

  _solveJoin(j) {
    const A = j.ca, B = j.cb, pa = A.pos, pb = B.pos;
    const ia = [A.tri[3 * j.ta], A.tri[3 * j.ta + 1], A.tri[3 * j.ta + 2]];
    const ib = [B.tri[3 * j.tb], B.tri[3 * j.tb + 1], B.tri[3 * j.tb + 2]];
    let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0, W = 0;
    for (let k = 0; k < 3; k++) {
      const u = 3 * ia[k], v = 3 * ib[k];
      ax += j.ba[k] * pa[u]; ay += j.ba[k] * pa[u + 1]; az += j.ba[k] * pa[u + 2];
      bx += j.bb[k] * pb[v]; by += j.bb[k] * pb[v + 1]; bz += j.bb[k] * pb[v + 2];
      W += A.w[ia[k]] * j.ba[k] ** 2 + B.w[ib[k]] * j.bb[k] ** 2;
    }
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len <= j.rest || len < 1e-12 || !W) return;
    const s = (len - j.rest) / (len * W);
    for (let k = 0; k < 3; k++) {
      const u = 3 * ia[k], v = 3 * ib[k];
      const fa = A.w[ia[k]] * j.ba[k] * s, fb = B.w[ib[k]] * j.bb[k] * s;
      pa[u] += fa * dx; pa[u + 1] += fa * dy; pa[u + 2] += fa * dz;
      pb[v] -= fb * dx; pb[v + 1] -= fb * dy; pb[v + 2] -= fb * dz;
    }
  }

  reset() {
    this.stitchPoints = []; this.joins = []; this.sewing = false; this.footUp = true; this.phase = 0.6;
  }
}

// Sucht das Dreieck einer Lage, das den Punkt (x, z) in Draufsicht enthält.
export function locateTriangle(c, x, z) {
  const p = c.pos, T = c.tri;
  for (let t = 0; t < c.nTri; t++) {
    const a = T[3 * t] * 3, b = T[3 * t + 1] * 3, d = T[3 * t + 2] * 3;
    const v0x = p[d] - p[a], v0z = p[d + 2] - p[a + 2];
    const v1x = p[b] - p[a], v1z = p[b + 2] - p[a + 2];
    const v2x = x - p[a], v2z = z - p[a + 2];
    const d00 = v0x * v0x + v0z * v0z, d01 = v0x * v1x + v0z * v1z, d02 = v0x * v2x + v0z * v2z;
    const d11 = v1x * v1x + v1z * v1z, d12 = v1x * v2x + v1z * v2z;
    const den = d00 * d11 - d01 * d01;
    if (Math.abs(den) < 1e-14) continue;
    const u = (d11 * d02 - d01 * d12) / den, v = (d00 * d12 - d01 * d02) / den;
    if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) return { tri: t, b0: 1 - u - v, b1: v, b2: u };
  }
  return null;
}
