// Starre (statische oder kinematisch bewegte) Quader-Kollider mit Coulomb-Reibung.
// Reibung nach PBD (Müller et al. 2007 / Macklin 2014): die tangentiale Relativverschiebung
// während eines Teilschritts wird bis μ_H·d vollständig aufgehoben (Haften), darüber um μ_G·d
// reduziert (Gleiten). d ist die Normalkorrektur; d/Δt² = F_N/m, also exakt Coulomb.

import { SOLIDS } from './materials.js';

function matFromEuler(yaw = 0, pitch = 0, roll = 0) {
  // R = Ry(yaw) · Rx(pitch) · Rz(roll), zeilenweise gespeichert
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  const Ry = [cy, 0, sy, 0, 1, 0, -sy, 0, cy];
  const Rx = [1, 0, 0, 0, cp, -sp, 0, sp, cp];
  const Rz = [cr, -sr, 0, sr, cr, 0, 0, 0, 1];
  return mul3(mul3(Ry, Rx), Rz);
}
function mul3(a, b) {
  const r = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
    r[3 * i + j] = a[3 * i] * b[j] + a[3 * i + 1] * b[3 + j] + a[3 * i + 2] * b[6 + j];
  }
  return r;
}

export class BoxCollider {
  constructor({ name = 'Quader', center, half, yaw = 0, pitch = 0, roll = 0, material = 'stahl', kinematic = false, visual = true, color }) {
    this.name = name;
    this.c = [...center];
    this.half = [...half];
    this.R = matFromEuler(yaw, pitch, roll);
    this.euler = [yaw, pitch, roll];
    this.material = material;
    this.solid = SOLIDS[material];
    this.kinematic = kinematic;
    this.enabled = true;
    this.visual = visual;
    this.color = color;
    this.pc = [...this.c];
    this.pR = [...this.R];
  }

  setPose(center, yaw = 0) {
    this.c[0] = center[0]; this.c[1] = center[1]; this.c[2] = center[2];
    if (yaw !== this.euler[0]) { this.euler[0] = yaw; this.R = matFromEuler(yaw, this.euler[1], this.euler[2]); }
  }

  beginSubstep() {
    this.pc[0] = this.c[0]; this.pc[1] = this.c[1]; this.pc[2] = this.c[2];
    for (let k = 0; k < 9; k++) this.pR[k] = this.R[k];
  }

  // Liegt Punkt (x,y,z) innerhalb (mit Aufmaß r)?
  contains(x, y, z, r = 0) {
    const dx = x - this.c[0], dy = y - this.c[1], dz = z - this.c[2], R = this.R;
    const qx = R[0] * dx + R[3] * dy + R[6] * dz;
    const qy = R[1] * dx + R[4] * dy + R[7] * dz;
    const qz = R[2] * dx + R[5] * dy + R[8] * dz;
    return Math.abs(qx) < this.half[0] + r && Math.abs(qy) < this.half[1] + r && Math.abs(qz) < this.half[2] + r;
  }

  // Projiziert alle Partikel einer Lage aus dem Quader heraus und wendet Reibung an.
  collideCloth(cloth, muS, muK) {
    if (!this.enabled) return;
    const p = cloth.pos, pp = cloth.prev, w = cloth.w, r = cloth.radius;
    const R = this.R, c = this.c, h = this.half;
    const hx = h[0] + r, hy = h[1] + r, hz = h[2] + r;
    // grobe Kugel-Vorauswahl
    const br = Math.sqrt(hx * hx + hy * hy + hz * hz);
    for (let v = 0, n = cloth.n; v < n; v++) {
      if (w[v] === 0) continue;
      const i = 3 * v;
      const dx = p[i] - c[0], dy = p[i + 1] - c[1], dz = p[i + 2] - c[2];
      if (dx * dx + dy * dy + dz * dz > br * br) continue;
      const qx = R[0] * dx + R[3] * dy + R[6] * dz;
      const qy = R[1] * dx + R[4] * dy + R[7] * dz;
      const qz = R[2] * dx + R[5] * dy + R[8] * dz;
      const px = hx - Math.abs(qx), py = hy - Math.abs(qy), pz = hz - Math.abs(qz);
      if (px <= 0 || py <= 0 || pz <= 0) continue;
      let nx, ny, nz, pen;
      if (py <= px && py <= pz) { pen = py; const s = qy >= 0 ? 1 : -1; nx = R[1] * s; ny = R[4] * s; nz = R[7] * s; }
      else if (px <= pz) { pen = px; const s = qx >= 0 ? 1 : -1; nx = R[0] * s; ny = R[3] * s; nz = R[6] * s; }
      else { pen = pz; const s = qz >= 0 ? 1 : -1; nx = R[2] * s; ny = R[5] * s; nz = R[8] * s; }
      p[i] += nx * pen; p[i + 1] += ny * pen; p[i + 2] += nz * pen;

      // Oberflächenverschiebung des Kolliders am Kontaktpunkt (kinematisch bewegt)
      let sx = 0, sy = 0, sz = 0;
      if (this.kinematic) {
        const pc = this.pc, pR = this.pR;
        const ax = pp[i] - pc[0], ay = pp[i + 1] - pc[1], az = pp[i + 2] - pc[2];
        const lx = pR[0] * ax + pR[3] * ay + pR[6] * az;
        const ly = pR[1] * ax + pR[4] * ay + pR[7] * az;
        const lz = pR[2] * ax + pR[5] * ay + pR[8] * az;
        sx = c[0] + R[0] * lx + R[1] * ly + R[2] * lz - pp[i];
        sy = c[1] + R[3] * lx + R[4] * ly + R[5] * lz - pp[i + 1];
        sz = c[2] + R[6] * lx + R[7] * ly + R[8] * lz - pp[i + 2];
      }
      let rx = p[i] - pp[i] - sx, ry = p[i + 1] - pp[i + 1] - sy, rz = p[i + 2] - pp[i + 2] - sz;
      const rn = rx * nx + ry * ny + rz * nz;
      rx -= rn * nx; ry -= rn * ny; rz -= rn * nz;
      const rt = Math.sqrt(rx * rx + ry * ry + rz * rz);
      if (rt < 1e-15) continue;
      const k = rt < muS * pen ? 1 : Math.min(1, (muK * pen) / rt);
      p[i] -= rx * k; p[i + 1] -= ry * k; p[i + 2] -= rz * k;
    }
  }

  // Oberkante unterhalb Punkt (für Tastfahrt), nur für achsparallele Quader exakt.
  topAt(x, z) {
    const dx = x - this.c[0], dz = z - this.c[2], R = this.R;
    const qx = R[0] * dx + R[6] * dz, qz = R[2] * dx + R[8] * dz;
    if (Math.abs(qx) > this.half[0] || Math.abs(qz) > this.half[2]) return -Infinity;
    return this.c[1] + this.half[1];
  }
}
