// Ärmelzuführung: segmentierte Vakuumplatte auf einer Servo-Dreh-Schiebeeinheit.
//
// Die Platte hält den noch nicht genähten Teil der oberen Lage (Ärmel) von oben. Sie wird
// synchron zum Untertransport so geführt, dass der Punkt der Kugelnaht, der gerade genäht
// wird, unter der Nadel liegt und die Kugelnaht dort in Transportrichtung zeigt. Der
// Ärmel läuft dabei um die Mehrweite schneller (gleiches Verhältnis wie der Obertransport).
// Segmente in der Nähe der Nadel schalten ab: der genähte Teil ist frei und darf sich
// aufstellen und falten (er hängt über die Naht am Körper).

import { rotY } from './cloth.js';

const compose = (A, B) => { const [rx, rz] = rotY(B.tx, B.tz, A.theta); return { theta: A.theta + B.theta, tx: rx + A.tx, tz: rz + A.tz }; };
const invert = (A) => { const [rx, rz] = rotY(A.tx, A.tz, -A.theta); return { theta: -A.theta, tx: -rx, tz: -rz }; };
const apply = (A, u, v) => { const [x, z] = rotY(u, v, A.theta); return [x + A.tx, z + A.tz]; };

export class SleeveFeeder {
  constructor({ cloth, path, pathAt, needle, slot = 0, release = 0.018, holdY = null }) {
    this.cloth = cloth; this.path = path; this.pathAt = pathAt; this.needle = needle;
    this.slot = slot;          // Abstand der Plattenkante zur Naht [m] (0: Platte deckt die Naht vor der Nadel ab)
    this.release = release;    // Segmente geben frei, wenn ihr Nahtabschnitt näher als dies an der Nadel ist [m]
    this.on = false;
    this.holdY = holdY;        // Höhe der angesaugten Lage (Platte drückt auf das Trennblech)
    this.s = 0;                // genähte Bogenlänge auf der Kugelnaht [m]
    this.att = [];             // {v, u, w (Materialkoordinaten), param}
    this.compliance = 1e-4;
    this.yaw = null;
    // Nahtparameter jedes Knotens (nächster Punkt der Kugelnaht)
    const P = path.points, cum = path.cum;
    this.param = new Float64Array(cloth.n);
    this.dist = new Float64Array(cloth.n);
    for (let v = 0; v < cloth.n; v++) {
      const u = cloth.rest[2 * v], w = cloth.rest[2 * v + 1];
      let bd = Infinity, bs = 0;
      for (let k = 0; k < P.length - 1; k++) {
        const dx = P[k + 1][0] - P[k][0], dz = P[k + 1][1] - P[k][1], L2 = dx * dx + dz * dz;
        const t = L2 > 0 ? Math.max(0, Math.min(1, ((u - P[k][0]) * dx + (w - P[k][1]) * dz) / L2)) : 0;
        const d = Math.hypot(u - P[k][0] - t * dx, w - P[k][1] - t * dz);
        if (d < bd) { bd = d; bs = cum[k] + t * (cum[k + 1] - cum[k]); }
      }
      this.param[v] = bs; this.dist[v] = bd;
    }
  }

  // Sollage des Ärmels (Material → Welt), wenn Bahnpunkt s unter der Nadel liegt
  analytic(s) {
    const { p, t } = this.pathAt(this.path, s);
    let yaw = -Math.atan2(t[0], t[1]); // Nahttangente (noch zu nähende Richtung) zeigt nach +z
    if (this.yaw !== null) { while (yaw - this.yaw > Math.PI) yaw -= 2 * Math.PI; while (yaw - this.yaw < -Math.PI) yaw += 2 * Math.PI; }
    this.yaw = yaw;
    const [rx, rz] = rotY(p[0], p[1], yaw);
    return { theta: yaw, tx: this.needle[0] - rx, tz: this.needle[2] - rz };
  }

  // Platte setzt auf: tatsächliche Lage einmessen (Procrustes), dann programmiert weiterführen
  engage() {
    const c = this.cloth;
    this.att = [];
    let cu = 0, cw = 0, cx = 0, cz = 0, n = 0;
    for (let v = 0; v < c.n; v++) {
      if ((this.slot > 0 && this.dist[v] < this.slot) || c.pos[3 * v + 2] < this.needle[2] + this.release) continue;
      this.att.push(v);
      cu += c.rest[2 * v]; cw += c.rest[2 * v + 1]; cx += c.pos[3 * v]; cz += c.pos[3 * v + 2]; n++;
    }
    if (n < 5) return false;
    cu /= n; cw /= n; cx /= n; cz /= n;
    let A = 0, B = 0;
    for (const v of this.att) {
      const u = c.rest[2 * v] - cu, w = c.rest[2 * v + 1] - cw, x = c.pos[3 * v] - cx, z = c.pos[3 * v + 2] - cz;
      A += x * u + z * w; B += x * w - z * u;
    }
    const theta = Math.atan2(B, A), [rx, rz] = rotY(cu, cw, theta);
    const measured = { theta, tx: cx - rx, tz: cz - rz };
    this.yaw = null;
    // Kamera-Lagekorrektur: die Platte greift den Ärmel dort, wo er liegt (gemessen), und
    // schiebt ihn in 0,4 s in die Soll-Lage (Nahtanfang unter der Nadel, Tangente in Transportrichtung)
    this.measured = measured;
    this.blend = 0;
    this.correction = { dx: 0, dz: 0, dtheta: 0 };
    const S = this.analytic(this.s);
    this.correction = { dx: S.tx - measured.tx, dz: S.tz - measured.tz, dtheta: S.theta - measured.theta };
    this.frame = measured;
    for (const v of this.att) c.attached[v] = 99;
    return true;
  }

  disengage() {
    for (const v of this.att) if (this.cloth.attached[v] === 99) this.cloth.attached[v] = -1;
    this.att = [];
    this.frame = null;
  }

  // Bahnfortschritt (aus dem Untertransport) und Segmentfreigabe
  advance(ds, dt = 0) {
    if (!this.on || !this.frame) return;
    this.s = Math.min(this.path.length, this.s + ds);
    const A = this.analytic(this.s);
    if (this.blend < 1) {
      // Korrekturbewegung (glatt, Cosinus-Rampe) von der gegriffenen in die Soll-Lage
      this.blend = Math.min(1, this.blend + dt / 0.4);
      const k = 0.5 - 0.5 * Math.cos(Math.PI * this.blend), M = this.measured;
      let dth = A.theta - M.theta;
      while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
      // Drehung um den Nahtpunkt unter der Nadel interpolieren
      const th = M.theta + dth * k;
      const { p } = this.pathAt(this.path, this.s);
      const [mx, mz] = apply(M, p[0], p[1]);
      const nx = mx + (this.needle[0] - mx) * k, nz = mz + (this.needle[2] - mz) * k;
      const [rx, rz] = rotY(p[0], p[1], th);
      this.frame = { theta: th, tx: nx - rx, tz: nz - rz };
    } else this.frame = A;
    // Plattenvorderkante: Linie quer zur Transportrichtung, release vor der Nadel.
    // Stoff, der diese Linie passiert hat (oder im Nahtschlitz liegt), wird freigegeben.
    const keep = [], p = this.cloth.pos, zLine = this.needle[2] + this.release;
    for (const v of this.att) {
      if (p[3 * v + 2] < zLine) this.cloth.attached[v] = -1;
      else keep.push(v);
    }
    this.att = keep;
  }

  // Knoten in der Ebene an die Platte binden (Höhe bleibt frei, die Platte liegt auf)
  solve(dt) {
    if (!this.on || !this.frame) return;
    const c = this.cloth, p = c.pos, at = this.compliance / (dt * dt);
    for (const v of this.att) {
      const w = c.w[v];
      if (!w) continue;
      const [tx, tz] = apply(this.frame, c.rest[2 * v], c.rest[2 * v + 1]);
      const k = w / (w + at);
      p[3 * v] += (tx - p[3 * v]) * k;
      p[3 * v + 2] += (tz - p[3 * v + 2]) * k;
      if (this.holdY !== null) p[3 * v + 1] += (this.holdY - p[3 * v + 1]) * k;
    }
  }
}
