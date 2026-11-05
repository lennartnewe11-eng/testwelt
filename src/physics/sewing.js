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
//  • Fadenspannung: Ober- und Unterfaden ziehen die Naht in Längsrichtung zusammen
//    (Stauchung ε = F_Faden / (T · b_Naht)); bei dünnen Stoffen entsteht Nahtkräuseln.
//  • Kurvennaht: Führt der Roboter das Teil (SEWPATH), folgt der Transporteur der
//    Starrkörperbewegung des Teils (Drehung um die Nadel), statt nur geradeaus zu schieben.
//  • Ärmel einsetzen: Die obere Lage wird separat geführt. Ein Kantensensor vor der Nadel
//    misst die Lage der Ärmelkante, eine Führungsrolle verschiebt die Lage quer (P-Regler,
//    begrenzt durch Reibung), ein Trennblech entkoppelt die Lagen vor dem Fuß. Der
//    Obertransport schiebt die obere Lage um die Mehrweite schneller (Differentialtransport).

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
    this.pinned = [];
    this.order = new Map();             // Lagenreihenfolge unter dem Fuß
    this.threadTension = 1.2;           // Fadenspannung [N]
    this.seamLinks = [];                // Fadenzug entlang der Naht
    this.deviations = [];               // Abstand Einstich ↔ Sollbahn [m]
    this.follow = null;                 // Starrkörperbewegung des geführten Teils (Kurvennaht)
    this.foot = new BoxCollider({ name: 'Nähfuß', center: [needle[0], needle[1] + this.footLift + 0.004, needle[2]], half: [this.half[0], 0.004, this.half[1]], material: 'stahl', kinematic: true, visual: false });
    this.footY = needle[1] + this.footLift;
  }

  startSew(length, rpm, stitch, path = null, pathCloth = null) {
    if (rpm) this.rpm = rpm;
    if (stitch) this.stitchLength = stitch;
    this.sewTarget = Math.max(1, Math.round((length * 1000) / this.stitchLength));
    this.stitches = 0;
    this.sewing = true;
    this.activePath = path;
    this.pathCloth = pathCloth;
    // Teilnaht (Fortsetzung nach dem Umgreifen): Messwerte und Fadenzug laufen weiter
    if (!this.sOffset) {
      this.deviations = [];
      this.devSleeve = [];
      this.easeTrack = [];
      this.lastHits = null;
    }
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
    // Lagenreihenfolge beim ersten Erfassen festhalten (die Höhenunterschiede liegen im
    // Bereich der Stoffdicke; eine laufende Neusortierung könnte Lagen vertauschen)
    for (const g of groups) if (!this.order.has(g.c.id)) this.order.set(g.c.id, g.y);
    groups.sort((a, b) => this.order.get(a.c.id) - this.order.get(b.c.id));
    return groups;
  }

  setEdgeGuide(cfg) {
    const Lb = cfg.bodyPath.length, Ls = cfg.path.length;
    this.edge = {
      ...cfg, on: false, sensor: 0.045, allowance: 0.01, gain: 10, ki: 30, vmax: 0.1, roller: 0.02,
      ease: Ls / Lb - 1, err: null, errLog: [],
    };
    // Seite der Schnittkante relativ zur Nahtrichtung (für die Krümmungsvorsteuerung)
    const P = cfg.path.points, k = Math.min(10, P.length - 1);
    const tx = P[k][0] - P[0][0], tz = P[k][1] - P[0][1], L = Math.hypot(tx, tz);
    const rn = [tz / L, -tx / L];
    this.edge.edgeSide = cfg.inside && cfg.inside(P[0][0] + rn[0] * 0.012, P[0][1] + rn[1] * 0.012) ? -1 : 1;
    const N = this.needle;
    // Trennblech: die noch nicht genähte obere Lage liegt vor und neben der Nadel auf einem
    // glatten Blech über der unteren Lage (ca. 25 × 23 cm)
    this.separatorZone = (x, z) => x > N[0] - 0.2 && x < N[0] + 0.05 && z > N[2] + this.half[1] && z < N[2] + 0.25;
  }

  // Obertransport: Verhältnis zum Untertransport, Mehrweite konzentriert im mittleren Kugelbereich
  topFeedRatio() {
    const E = this.edge;
    if (!E || !(E.on || this.feeder?.on) || !this.activePath) return 1;
    // Halsbündchen: gleichmäßige Dehnung über die ganze Naht (Verhältnis < 1)
    if (E.profile === 'const') return 1 + E.ease;
    const u = Math.min(1, (this.stitches * this.stitchLength * 1e-3) / this.activePath.length);
    const w = u < 0.1 || u > 0.9 ? 0 : Math.sin((Math.PI * (u - 0.1)) / 0.8) ** 2;
    return 1 + (E.ease * w) / 0.4; // Mittelwert von w über die Naht = 0,4
  }

  // Kantenführer: Sensor misst die Ärmelkante, Rolle verschiebt die obere Lage quer
  solveEdgeGuide(dt) {
    const E = this.edge;
    if (!E || !(E.on || this.feeder?.on) || this.footUp) { if (E) E.err = null; return; }
    const c = E.cloth, p = c.pos, h = c.h, N = this.needle;
    const zs = N[2] - this.feedDir[2] * E.sensor, xt = N[0] + E.allowance;
    let sw = 0, sx = 0;
    for (let v = 0; v < c.n; v++) {
      if (!E.capEdge[v]) continue;
      const dz = Math.abs(p[3 * v + 2] - zs);
      if (dz >= h || Math.abs(p[3 * v] - xt) > 0.05) continue;
      const wgt = 1 - dz / h;
      sx += wgt * p[3 * v]; sw += wgt;
    }
    if (sw < 0.2) { E.err = null; return; }
    // Vorsteuerung: bekannte Kugelkrümmung – wo liegt die Kante im Abstand des Sensors,
    // wenn die Naht an der Nadel tangential in Transportrichtung läuft?
    let ff = 0;
    if (this.activePath && this.pathAt) {
      const sb = (this.sOffset || 0) + this.stitches * this.stitchLength * 1e-3; // Teilnaht: Versatz auf der Gesamtnaht
      const ss = sb * (E.path.length / E.bodyPath.length);
      const a = this.pathAt(E.path, ss), b = this.pathAt(E.path, ss + E.sensor);
      const dx0 = b.p[0] - a.p[0], dz0 = b.p[1] - a.p[1];
      ff = E.edgeSide * (dx0 * a.t[1] - dz0 * a.t[0]); // Querabstand zur Tangente, positiv zur Kante hin
    }
    E.ff = ff;
    const xe = sx / sw, err = xe - (xt + ff);
    E.err = err;
    // PI-Regler mit Begrenzung (Anti-Windup)
    E.integ = Math.max(-0.02, Math.min(0.02, (E.integ || 0) + err * dt));
    if (this.feeder?.on) return; // Ärmelzuführung führt; der Sensor überwacht nur
    const dx = Math.max(-E.vmax, Math.min(E.vmax, -E.gain * err - E.ki * E.integ)) * dt;
    const rx = xe - E.roller, r2 = E.roller * E.roller;
    for (let v = 0; v < c.n; v++) {
      if (!c.w[v]) continue;
      const ddx = p[3 * v] - rx, ddz = p[3 * v + 2] - zs;
      if (ddx * ddx + ddz * ddz > r2) continue;
      p[3 * v] += dx;
    }
  }

  // Nach dem Teilschritt aufrufen: kinematisch geführte Knoten wieder freigeben
  unpin() {
    const P = this.pinned;
    for (let k = 0; k < P.length; k += 3) P[k].w[P[k + 1]] = P[k + 2];
    P.length = 0;
  }

  solve(cloths, dt, t) {
    // Stiche (bleibende Verbindungen der Lagen)
    for (const j of this.joins) this._solveJoin(j);
    for (const l of this.seamLinks) this._solveSeamLink(l);
    if (this.footUp) { this.order.clear(); return; }
    const groups = this._zone(cloths);
    if (!groups.length) {
      this.footY = this.needle[1];
      if (this._pendingStitch) { this._pendingStitch = false; this.stitches++; this.emptyStitches = (this.emptyStitches || 0) + 1; if (this.stitches >= this.sewTarget) this.sewing = false; }
      return;
    }
    let stack = 0;
    for (const g of groups) stack += 2 * g.c.radius;
    this.footY = this.needle[1] + stack;

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
      // Nähfuß drückt von oben, Stichplatte stützt von unten
      const yMin = yBase + c.radius;
      yBase += 2 * c.radius;
      const yCap = this.needle[1] + stack - c.radius * (2 * (groups.length - 1 - k) + 1);
      let mdx = 0, mdz = 0;
      for (const v of idx) {
        const i = 3 * v, w = c.w[v];
        if (w === 0) continue;
        const lim = (mu) => mu * Fn * dt2 * w;
        let dx = p[i] - pp[i], dz = p[i + 2] - pp[i + 2];
        // Sollverschiebung aus der Lage darunter bzw. dem Transporteur
        let tx, tz, mu;
        if (k === 0) {
          mu = this.dogMu;
          if (this.follow && vf > 0) { const d = this.follow(pp[i], pp[i + 2]); tx = d[0]; tz = d[1]; }
          else { tx = fx; tz = fz; }
        }
        else if ((this.edge?.on || this.feeder?.on) && k === groups.length - 1) {
          // Obertransport (Laufzahn) treibt die obere Lage mit Mehrweitenverhältnis
          const r = this.topFeedRatio();
          tx = below[0] * r; tz = below[1] * r; mu = this.dogMu;
        } else { tx = below[0]; tz = below[1]; mu = 0.5 * (c.m.muSelfS + groups[k - 1].c.m.muSelfS); }
        let cx = tx - dx, cz = tz - dz;
        let cl = Math.hypot(cx, cz), L = lim(mu);
        if (cl > L) { cx *= L / cl; cz *= L / cl; }
        p[i] += cx; p[i + 2] += cz; dx += cx; dz += cz;
        // oberste Lage: Der Nähfuß bremst mit μ_Fuß·F_N, die Lage darunter treibt mit μ_SS·F_N.
        // Ist die Bremsreibung größer, bleibt die obere Lage am Fuß hängen (Lagenverschiebung).
        if (k > 0 && k === groups.length - 1 && !this.edge?.on && !this.feeder?.on && c.m.muSteelK * muFoot > mu) {
          p[i] -= dx; p[i + 2] -= dz; dx = 0; dz = 0;
        }
        if (needleIn) { p[i] -= dx; p[i + 2] -= dz; dx = 0; dz = 0; }
        if (p[i + 1] > yCap) p[i + 1] = yCap;
        if (p[i + 1] < yMin) p[i + 1] = yMin;
        mdx += dx; mdz += dz;
        // Haftreibung erfüllt: Knoten bis zum Ende des Teilschritts kinematisch führen
        if (Math.hypot(cx, cz) < L * 0.999) { this.pinned.push(c, v, w); c.w[v] = 0; }
      }
      below = [mdx / idx.length, mdz / idx.length];
    }

    this.solveEdgeGuide(dt);
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
    // Nahtabweichung: Einstichstelle im Zuschnitt gegen die Sollbahn
    if (this.activePath && this.distToPath) {
      const h = hits.find((x) => x.c === this.pathCloth) || top;
      const [u, v] = h.c.restPoint(h.hit.tri, h.hit.b0, h.hit.b1, h.hit.b2);
      this.deviations.push(this.distToPath(this.activePath, u, v));
      // zweites Teil (Ärmel): Abweichung von der Kugelnaht und eingenähte Länge
      const E = this.edge;
      if (E && (E.on || this.feeder?.on)) {
        const hs = hits.find((x) => x.c === E.cloth);
        if (hs) {
          const q = hs.c.restPoint(hs.hit.tri, hs.hit.b0, hs.hit.b1, hs.hit.b2);
          (this.devSleeve ||= []).push(this.distToPath(E.path, q[0], q[1]));
          this.easeTrack.push({ b: [u, v], s: q, pb: projParam(this.activePath.parent || this.activePath, u, v), ps: projParam(E.path, q[0], q[1]) });
        } else (this.devSleeve ||= []).push(NaN);
      }
    }
    // Fadenzug zum vorigen Einstich in jeder Lage (nur Zug, verkürzte Ruhelänge)
    if (this.lastHits) {
      for (const hcur of hits) {
        const hprev = this.lastHits.find((x) => x.c === hcur.c);
        if (!hprev) continue;
        const c = hcur.c;
        const pa = triPoint(c, hprev.hit), pb = triPoint(c, hcur.hit);
        const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]);
        if (L < 1e-4 || L > 3 * this.stitchLength * 1e-3) continue;
        const eps = Math.min(0.05, this.threadTension / (Math.min(c.m.Tw, c.m.Tf) * 0.01));
        this.seamLinks.push({ c, a: hprev.hit, b: hcur.hit, rest: L * (1 - eps) });
      }
    }
    this.lastHits = hits;
    // Der Faden verbindet benachbarte Lagen an der Einstichstelle (trägt nur Zug)
    for (let k = 1; k < hits.length; k++) {
      const a = hits[k - 1], b = hits[k];
      this.joins.push({ ca: a.c, ta: a.hit.tri, ba: [a.hit.b0, a.hit.b1, a.hit.b2], cb: b.c, tb: b.hit.tri, bb: [b.hit.b0, b.hit.b1, b.hit.b2], rest: a.c.radius + b.c.radius });
    }
  }

  _solveSeamLink(l) {
    const c = l.c, p = c.pos, T = c.tri;
    const ia = [T[3 * l.a.tri], T[3 * l.a.tri + 1], T[3 * l.a.tri + 2]], ba = [l.a.b0, l.a.b1, l.a.b2];
    const ib = [T[3 * l.b.tri], T[3 * l.b.tri + 1], T[3 * l.b.tri + 2]], bb = [l.b.b0, l.b.b1, l.b.b2];
    let ax = 0, ay = 0, az = 0, bx = 0, by = 0, bz = 0, W = 0;
    for (let k = 0; k < 3; k++) {
      ax += ba[k] * p[3 * ia[k]]; ay += ba[k] * p[3 * ia[k] + 1]; az += ba[k] * p[3 * ia[k] + 2];
      bx += bb[k] * p[3 * ib[k]]; by += bb[k] * p[3 * ib[k] + 1]; bz += bb[k] * p[3 * ib[k] + 2];
      W += c.w[ia[k]] * ba[k] ** 2 + c.w[ib[k]] * bb[k] ** 2;
    }
    const dx = bx - ax, dy = by - ay, dz = bz - az, len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len <= l.rest || !W) return;
    const s = (len - l.rest) / (len * W);
    for (let k = 0; k < 3; k++) {
      const fa = c.w[ia[k]] * ba[k] * s, fb = c.w[ib[k]] * bb[k] * s;
      p[3 * ia[k]] += fa * dx; p[3 * ia[k] + 1] += fa * dy; p[3 * ia[k] + 2] += fa * dz;
      p[3 * ib[k]] -= fb * dx; p[3 * ib[k] + 1] -= fb * dy; p[3 * ib[k] + 2] -= fb * dz;
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
    this.stitchPoints = []; this.joins = []; this.seamLinks = []; this.sewing = false; this.footUp = true; this.phase = 0.6;
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

function triPoint(c, hit) {
  const T = c.tri, p = c.pos, a = 3 * T[3 * hit.tri], b = 3 * T[3 * hit.tri + 1], d = 3 * T[3 * hit.tri + 2];
  return [0, 1, 2].map((k) => hit.b0 * p[a + k] + hit.b1 * p[b + k] + hit.b2 * p[d + k]);
}

// Bogenlänge des nächsten Bahnpunkts
export function projParam(path, x, z) {
  const P = path.points, cum = path.cum;
  let bd = Infinity, bs = 0;
  for (let k = 0; k < P.length - 1; k++) {
    const dx = P[k + 1][0] - P[k][0], dz = P[k + 1][1] - P[k][1], L2 = dx * dx + dz * dz;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((x - P[k][0]) * dx + (z - P[k][1]) * dz) / L2)) : 0;
    const d = Math.hypot(x - P[k][0] - t * dx, z - P[k][1] - t * dz);
    if (d < bd) { bd = d; bs = cum[k] + t * (cum[k + 1] - cum[k]); }
  }
  return bs;
}
