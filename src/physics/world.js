// Simulationswelt: Halle, Stapeltisch, Nähtisch mit Industrienähmaschine, Portalroboter
// mit Greiferkopf und ein Stapel Zuschnitte. Zeitintegration mit festen Teilschritten.

import { G, AIR } from './constants.js';
import { fabricById } from './materials.js';
import { Cloth, rotY } from './cloth.js';
import { BoxCollider } from './colliders.js';
import { ClothContacts } from './collision.js';
import { GripperHead, defaultParams } from './grippers.js';
import { SewingMachine } from './sewing.js';
import { GantryRobot } from './robot.js';

export const TABLE_TOP = 0.80;
export const STACK_POS = [-0.5, 0.05];
export const NEEDLE = [0.62, TABLE_TOP, -0.12];

export const DEFAULT_PROGRAM = `# Pick & Place zweier Zuschnitte und Naht an der Nähmaschine
# Koordinaten in m (y = Höhe der Greiferfläche), Drehung in °
SPEED 0.5
ACCEL 2
MOVE -0.5 0.95 0.05 0       # über den Stapel
SPEED 0.12
MOVE -0.5 0.81 0.05
TOUCH 0.01                  # Tastfahrt bis Kontakt mit der obersten Lage
GRIP ON
WAIT 0.3                    # Haltekraft aufbauen
SPEED 0.03
MOVEREL 0 0.02 0            # langsam abheben (Lagentrennung)
SPEED 0.5
MOVE -0.5 0.95 0.05
MOVE 0.48 0.95 0.12         # Transport zur Nähmaschine
SPEED 0.12
MOVE 0.48 0.815 0.12
TOUCH 0.01
SPEED 0.05
MOVEREL 0 0.003 -0.05       # Vorderkante unter den Nähfuß schieben
GRIP OFF
WAIT 0.4
SPEED 0.3
MOVEREL 0 0.12 0

# zweite Lage deckungsgleich auflegen
SPEED 0.5
MOVE -0.5 0.95 0.05
SPEED 0.12
MOVE -0.5 0.81 0.05
TOUCH 0.01
GRIP ON
WAIT 0.3
SPEED 0.03
MOVEREL 0 0.02 0
SPEED 0.5
MOVE -0.5 0.95 0.05
MOVE 0.48 0.95 0.12
SPEED 0.12
MOVE 0.48 0.815 0.12
TOUCH 0.01
SPEED 0.05
MOVEREL 0 0.003 -0.05       # ebenfalls unter den Nähfuß schieben

# robotergeführte Naht: 20 cm, 600 1/min, 3 mm Stichlänge.
# Der Greifer hält die obere Lage und fährt mit der mittleren
# Transportgeschwindigkeit (3 mm × 600/min = 30 mm/s) mit.
FOOT DOWN
WAIT 0.2
SEW 0.20 600 3
SPEED 0.03
MOVEREL 0 0 -0.20
WAITSEW
FOOT UP
GRIP OFF
WAIT 0.4
SPEED 0.3
MOVEREL 0 0.12 0
HOME
`;

export function defaultConfig() {
  return {
    fabricId: 'popeline',
    customFabric: null,
    plies: 4,
    plyW: 0.30,
    plyL: 0.40,
    spacing: 0.0125,
    substeps: 16,
    iterations: 1,
    limitLoad: 10,       // Linienlast [N/m], ab der die Dehnungsbegrenzung greift
    gripper: 'vakuum',
    gripperParams: defaultParams('vakuum'),
    rows: 3, cols: 2, pitchX: 0.14, pitchZ: 0.12,
    rpm: 600, stitch: 3, footForce: 40, footMaterial: 'stahl',
    tableMaterial: 'hpl',
    selfCollision: true,
    program: DEFAULT_PROGRAM,
    seed: 7,
  };
}

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export class World {
  constructor(cfg = defaultConfig()) {
    this.cfg = cfg;
    this.build();
  }

  build() {
    const c = this.cfg;
    this.t = 0;
    this.events = [];
    this.fabric = c.customFabric || fabricById(c.fabricId);
    const T = TABLE_TOP;
    this.colliders = [
      new BoxCollider({ name: 'Hallenboden', center: [0, -0.05, 0], half: [4, 0.05, 4], material: 'beton', visual: false }),
      new BoxCollider({ name: 'Stapeltisch', center: [STACK_POS[0], T - 0.02, STACK_POS[1]], half: [0.35, 0.02, 0.3], material: c.tableMaterial }),
      new BoxCollider({ name: 'Nähtisch', center: [0.55, T - 0.02, 0.05], half: [0.45, 0.02, 0.3], material: c.tableMaterial }),
      new BoxCollider({ name: 'Stichplatte', center: [NEEDLE[0] + 0.13, T - 0.004, NEEDLE[2]], half: [0.18, 0.004, 0.07], material: 'stahl', color: '#c9cdd2' }),
      new BoxCollider({ name: 'Nähkopf', center: [NEEDLE[0] + 0.02, T + 0.2, NEEDLE[2]], half: [0.05, 0.08, 0.05], material: 'guss' }),
      new BoxCollider({ name: 'Arm', center: [NEEDLE[0] + 0.2, T + 0.23, NEEDLE[2]], half: [0.16, 0.04, 0.045], material: 'guss' }),
      new BoxCollider({ name: 'Ständer', center: [NEEDLE[0] + 0.33, T + 0.12, NEEDLE[2]], half: [0.05, 0.12, 0.055], material: 'guss' }),
    ];
    this.staticColliders = this.colliders.slice();

    // Stapel aus Zuschnitten mit realistischer Legetoleranz (±1,5 mm, ±0,5°)
    const R = rng(c.seed);
    this.cloths = [];
    const t = this.fabric.thickness * 1e-3;
    for (let i = 0; i < c.plies; i++) {
      const y = T + t * (i + 0.5) + 1e-5;
      const cloth = new Cloth({
        fabric: this.fabric, width: c.plyW, length: c.plyL, spacing: c.spacing,
        center: [STACK_POS[0] + (R() - 0.5) * 0.003, y, STACK_POS[1] + (R() - 0.5) * 0.003],
        yaw: ((R() - 0.5) * Math.PI) / 180, name: `Lage ${c.plies - i}`,
      });
      cloth.stackIndex = c.plies - i; // 1 = oberste
      this.cloths.push(cloth);
    }
    this.cloths.sort((a, b) => a.stackIndex - b.stackIndex);
    this.cloths.reverse(); // unterste zuerst (Darstellungsreihenfolge egal)

    this.head = new GripperHead({ type: c.gripper, params: { ...defaultParams(c.gripper), ...c.gripperParams }, rows: c.rows, cols: c.cols, pitchX: c.pitchX, pitchZ: c.pitchZ });
    this.robot = new GantryRobot();
    this.machine = new SewingMachine({ needle: NEEDLE });
    Object.assign(this.machine, { rpm: c.rpm, stitchLength: c.stitch, footForce: c.footForce, footMaterial: c.footMaterial });
    this.contacts = new ClothContacts();
    this.contacts.selfCollision = c.selfCollision;
    this.kinematic = [...this.head.colliders, this.machine.foot];
    this.colliders.push(...this.kinematic);
    this.head.pose = { ...this.robot.pose };
    this.head.updateColliders();
    this.track = new Map(this.cloths.map((cl) => [cl.id, { state: 'Stapel', held: false, error: null, warnedStrain: false }]));
    this.cycle = { gripY: null, double: false };
    this.robot.load(c.program);
    this.stats = { maxSpeed: 0 };
  }

  log(msg, level = 'info') {
    this.events.push({ t: this.t, msg, level });
    if (this.events.length > 300) this.events.shift();
  }

  // Tastsensor: höchste Oberfläche unter den Greiferelementen (inkl. gehaltener Lagen).
  // Einmal pro Bildschritt berechnet; die Tastfahrt stoppt, sobald die Greiferfläche sie erreicht.
  _touchSurface() {
    const head = this.head;
    let held = 0;
    const heldIds = new Set();
    for (const el of head.elements) for (const a of el.att) heldIds.add(a.cloth.id);
    for (const cl of this.cloths) if (heldIds.has(cl.id)) held += 2 * cl.radius;
    let top = -Infinity;
    for (const el of head.elements) {
      const [cx, , cz] = head.elementCenter(el);
      for (const col of this.staticColliders) top = Math.max(top, col.topAt(cx, cz));
      for (const cl of this.cloths) {
        if (heldIds.has(cl.id)) continue;
        const b = cl.aabb;
        if (b && (cx < b[0] - el.half || cx > b[3] + el.half || cz < b[2] - el.half || cz > b[5] + el.half)) continue;
        const p = cl.pos, r2 = Math.max(el.half, cl.h * 0.75) ** 2;
        for (let v = 0; v < cl.n; v++) {
          const dx = p[3 * v] - cx, dz = p[3 * v + 2] - cz;
          if (dx * dx + dz * dz > r2) continue;
          top = Math.max(top, p[3 * v + 1] + cl.radius);
        }
      }
    }
    return top + held;
  }

  headContact() { return this.robot.pose.y <= this.touchTop + 0.1e-3; }

  _updateSleep(frameDt) {
    const head = this.head, m = this.machine;
    for (const c of this.cloths) {
      const p = c.pos, b = c.aabb || (c.aabb = new Float64Array(6));
      b[0] = b[1] = b[2] = Infinity; b[3] = b[4] = b[5] = -Infinity;
      let vmax = 0, bx = 0, by = 0, bz = 0;
      const V = c.vel;
      for (let v = 0; v < c.n; v++) {
        const i = 3 * v;
        for (let k = 0; k < 3; k++) { const x = p[i + k]; if (x < b[k]) b[k] = x; if (x > b[3 + k]) b[3 + k] = x; }
        const s = V[i] * V[i] + V[i + 1] * V[i + 1] + V[i + 2] * V[i + 2];
        if (s > vmax) vmax = s;
        bx += V[i]; by += V[i + 1]; bz += V[i + 2];
      }
      c.vmax = Math.sqrt(vmax);
      c.vbulk = [bx / c.n, by / c.n, bz / c.n];
      let vr = 0;
      for (let v = 0; v < c.n; v++) {
        const i = 3 * v;
        const dx = V[i] - c.vbulk[0], dy = V[i + 1] - c.vbulk[1], dz = V[i + 2] - c.vbulk[2];
        const s = dx * dx + dy * dy + dz * dz;
        if (s > vr) vr = s;
      }
      c.vrel = Math.sqrt(vr);
    }
    const hx = head.extent.x + 0.03, hz = head.extent.z + 0.03, hp = head.pose;
    const hr = Math.hypot(hx, hz);
    // die beiden obersten Lagen unter einem tief stehenden Greiferkopf aufwecken
    const under = this.cloths.filter((c) => { const b = c.aabb; return hp.y - b[4] < 0.03 && hp.x + hr > b[0] && hp.x - hr < b[3] && hp.z + hr > b[2] && hp.z - hr < b[5]; })
      .sort((a, b) => b.aabb[4] - a.aabb[4]).slice(0, 2);
    for (const c of this.cloths) {
      const b = c.aabb;
      let disturbed = c.wake || c.attachedCount() > 0 || c.vmax > 0.012 || under.includes(c);
      if (!disturbed && (!m.footUp || m.sewing) && m.needle[0] > b[0] - 0.02 && m.needle[0] < b[3] + 0.02 && m.needle[2] > b[2] - 0.02 && m.needle[2] < b[5] + 0.02) disturbed = true;
      if (!disturbed) for (const o of this.cloths) {
        if (o === c || o.sleeping || o.vmax < 0.02) continue;
        const a = o.aabb;
        if (a[0] < b[3] + 0.01 && a[3] > b[0] - 0.01 && a[2] < b[5] + 0.01 && a[5] > b[2] - 0.01 && a[1] < b[4] + 0.03 && a[4] > b[1] - 0.03) { disturbed = true; break; }
      }
      c.wake = false;
      if (disturbed) { c.sleeping = false; c.sleepTimer = 0; }
      else {
        c.sleepTimer = (c.sleepTimer || 0) + frameDt;
        if (c.sleepTimer > 0.3 && !c.sleeping) { c.sleeping = true; c.vel.fill(0); }
      }
    }
  }

  // Aerodynamische Kräfte je Dreieck -> Beschleunigung je Knoten (cloth.acc).
  // Wird alle 4 Teilschritte neu berechnet (Kräfte ändern sich langsam).
  _drag(cloth, dt) {
    const p = cloth.pos, v = cloth.vel, w = cloth.w, T = cloth.tri;
    const acc = cloth.acc || (cloth.acc = new Float64Array(3 * cloth.n));
    acc.fill(0);
    const rho = AIR.density, Cd = 1.17, Cf = 0.02, kP = cloth.m.k;
    for (let t = 0; t < cloth.nTri; t++) {
      const a = T[3 * t] * 3, b = T[3 * t + 1] * 3, c = T[3 * t + 2] * 3;
      const e1x = p[b] - p[a], e1y = p[b + 1] - p[a + 1], e1z = p[b + 2] - p[a + 2];
      const e2x = p[c] - p[a], e2y = p[c + 1] - p[a + 1], e2z = p[c + 2] - p[a + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const n2 = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (n2 < 1e-14) continue;
      const A = 0.5 * n2;
      nx /= n2; ny /= n2; nz /= n2;
      const vx = (v[a] + v[b] + v[c]) / 3, vy = (v[a + 1] + v[b + 1] + v[c + 1]) / 3, vz = (v[a + 2] + v[b + 2] + v[c + 2]) / 3;
      const vn = vx * nx + vy * ny + vz * nz;
      const tx = vx - vn * nx, ty = vy - vn * ny, tz = vz - vn * nz;
      const vt = Math.sqrt(tx * tx + ty * ty + tz * tz);
      // Druckwiderstand, reduziert um Durchströmung (Darcy): p = ½ρCd(|vn| − k·p)²
      const avn = Math.abs(vn);
      let pr = 0.5 * rho * Cd * avn * avn;
      for (let it = 0; it < 2; it++) { const ve = Math.max(0, avn - kP * pr); pr = 0.5 * rho * Cd * ve * ve; }
      const Fn = -Math.sign(vn) * pr * A;
      const Ft = 0.5 * rho * Cf * A * vt;
      const fx = (Fn * nx - Ft * tx) / 3, fy = (Fn * ny - Ft * ty) / 3, fz = (Fn * nz - Ft * tz) / 3;
      for (let q = 0; q < 3; q++) {
        const i = q === 0 ? a : q === 1 ? b : c;
        const wi = w[i / 3];
        if (!wi) continue;
        let ax = fx * wi, ay = fy * wi, az = fz * wi;
        // Widerstand darf die Normalgeschwindigkeit innerhalb des Intervalls nicht umkehren
        const an = Math.abs(ax * nx + ay * ny + az * nz) * dt;
        if (an > avn && avn > 0) { const s = avn / an; ax *= s; ay *= s; az *= s; }
        acc[i] += ax; acc[i + 1] += ay; acc[i + 2] += az;
      }
    }
  }

  step(frameDt) {
    const n = this.cfg.substeps;
    const dt = frameDt / n;
    const cloths = this.cloths;
    this._updateSleep(frameDt);
    // Kontaktsuche alle k Teilschritte; k so, dass sich keine Lage dazwischen mehr als ~3 mm bewegt
    let vmax = 0;
    for (const c of cloths) if (!c.sleeping) vmax = Math.max(vmax, c.vrel);
    for (const a of cloths) for (const b of cloths) {
      if (a === b || (a.sleeping && b.sleeping)) continue;
      const A = a.aabb, B = b.aabb, g = 0.02;
      if (A[0] > B[3] + g || A[3] < B[0] - g || A[1] > B[4] + g || A[4] < B[1] - g || A[2] > B[5] + g || A[5] < B[2] - g) continue;
      vmax = Math.max(vmax, Math.hypot(a.vbulk[0] - b.vbulk[0], a.vbulk[1] - b.vbulk[1], a.vbulk[2] - b.vbulk[2]));
    }
    const detectEvery = Math.max(Math.min(2, n), Math.min(n, Math.floor(3e-3 / Math.max(1e-9, 1.5 * vmax * dt))));
    this.stats.detectEvery = detectEvery;
    this.head.updateFrame(frameDt, cloths, this.t);
    for (const c of cloths) {
      const sig = c.attachedCount();
      if (sig !== c.tetherSig) { c.tetherSig = sig; c.updateTethers(); }
      // zulässige elastische Dehnung: Eigengewicht + 5 g Trägheitsreserve bei der Zugsteifigkeit
      c.tetherSlack = Math.min(0.05, (c.m.rho * G * 5 * Math.max(c.width, c.length)) / Math.min(c.m.Tw, c.m.Tf));
    }
    this.touchTop = this._touchSurface();

    const ctx = { head: this.head, machine: this.machine, contact: () => this.headContact(), log: (m) => this.log(m) };
    for (let s = 0; s < n; s++) {
      if (s % detectEvery === 0) {
        this.contacts.detect(cloths, Math.min(detectEvery, n - s) * dt);
      }
      this.t += dt;
      for (const k of this.kinematic) k.beginSubstep();
      const wasOn = this.head.elements.some((e) => e.on);
      this.robot.update(this.t, dt, ctx);
      const isOn = this.head.elements.some((e) => e.on);
      if (!wasOn && isOn) this.cycle = { gripY: this.robot.pose.y, double: false };
      this.head.pose = this.robot.pose;
      this.head.updateColliders();
      this.machine.update(this.t, dt);

      for (const c of cloths) {
        if (c.sleeping) continue;
        if (s % 4 === 0 || !c.acc) this._drag(c, dt * Math.min(4, n - s));
        const p = c.pos, pp = c.prev, v = c.vel, w = c.w, acc = c.acc;
        for (let i = 0, N = c.n; i < N; i++) {
          const k = 3 * i;
          pp[k] = p[k]; pp[k + 1] = p[k + 1]; pp[k + 2] = p[k + 2];
          if (!w[i]) continue;
          v[k] += acc[k] * dt; v[k + 2] += acc[k + 2] * dt;
          v[k + 1] += (acc[k + 1] - G) * dt;
          p[k] += v[k] * dt; p[k + 1] += v[k + 1] * dt; p[k + 2] += v[k + 2] * dt;
        }
      }
      const iters = this.cfg.iterations || 1;
      for (const c of cloths) {
        if (c.sleeping) continue;
        c.resetLambda();
        for (let it = 0; it < iters; it++) c.solveInternal(dt, iters === 1);
        c.solveLimits(this.cfg.limitLoad);
      }
      this.machine.solve(cloths, dt, this.t);
      this.head.solve(dt);
      for (const c of cloths) if (!c.sleeping) c.solveTethers(c.tetherSlack);
      this.contacts.solve(cloths, dt);
      for (const col of this.colliders) {
        if (!col.enabled) continue;
        const ff = col.solid.frictionFactor;
        const br = Math.hypot(col.half[0], col.half[1], col.half[2]) + 0.03;
        for (const c of cloths) {
          if (c.sleeping) continue;
          const b = c.aabb;
          if (col.c[0] + br < b[0] || col.c[0] - br > b[3] || col.c[1] + br < b[1] || col.c[1] - br > b[4] || col.c[2] + br < b[2] || col.c[2] - br > b[5]) continue;
          col.collideCloth(c, c.m.muSteelS * ff, c.m.muSteelK * ff);
        }
      }
      for (const c of cloths) if (!c.sleeping) c.solveLimits(this.cfg.limitLoad);
      const inv = 1 / dt;
      for (const c of cloths) {
        if (c.sleeping) continue;
        const p = c.pos, pp = c.prev, v = c.vel;
        for (let k = 0, N = 3 * c.n; k < N; k++) {
          let vk = (p[k] - pp[k]) * inv;
          if (vk > 20) vk = 20; else if (vk < -20) vk = -20;
          v[k] = vk;
        }
        c.damp(dt);
      }
      this.head.checkFailure(dt, this.t);
    }
    this._afterFrame();
  }

  _afterFrame() {
    for (const e of this.head.events.splice(0)) {
      if (e.type === 'separate') { this.log(`${e.cloth.name} von Greifer ${e.el + 1} getrennt (Last ${e.Fn.toFixed(3)} N > Haltekraft ${e.Cn.toFixed(3)} N)`); continue; }
      this.log(`${e.cloth.name} von Greifer ${e.el + 1} abgelöst (F_n ${e.Fn.toFixed(2)} N / C_n ${e.Cn.toFixed(2)} N, F_t ${e.Ft.toFixed(2)} N / C_t ${e.Ct.toFixed(2)} N)`, 'warn');
    }
    const anyOn = this.head.elements.some((e) => e.on);
    let heldCount = 0;
    for (const c of this.cloths) {
      const tr = this.track.get(c.id);
      const held = c.attachedCount() > 0;
      if (held) heldCount++;
      if (held && !tr.held) {
        tr.held = true; tr.state = 'gegriffen'; tr.error = null; tr.ideal = null;
        tr.pick = c.pose2D(); tr.gpick = { ...this.head.pose };
      } else if (!held && tr.held) {
        tr.held = false;
        if (anyOn) { tr.state = 'verloren'; this.log(`${c.name} verloren`, 'error'); }
        else {
          const g0 = tr.gpick, g1 = this.head.pose;
          const [dx, dz] = rotY(tr.pick.x - g0.x, tr.pick.z - g0.z, -g0.yaw);
          const [rx, rz] = rotY(dx, dz, g1.yaw);
          tr.ideal = { x: g1.x + rx, z: g1.z + rz, theta: tr.pick.theta - g0.yaw + g1.yaw };
          tr.state = 'abgelegt';
        }
      }
      if (!c.sleeping || tr.strain === undefined) {
        const st = c.strainStats();
        tr.strain = st.p99; tr.strainMax = st.max;
      }
      const strain = tr.strain;
      if (!tr.warnedStrain && strain > 0.5 * (c.fabric.breakStrain / 100)) {
        tr.warnedStrain = true;
        this.log(`${c.name}: Dehnung ${(strain * 100).toFixed(1)} % (> 50 % der Bruchdehnung)`, 'warn');
      }
      if (tr.ideal && !tr.error) {
        const speed = c.meanSpeed();
        if (speed < 0.004) {
          const pz = c.pose2D();
          let dth = pz.theta - tr.ideal.theta;
          dth = Math.atan2(Math.sin(dth), Math.cos(dth));
          tr.error = { dx: pz.x - tr.ideal.x, dz: pz.z - tr.ideal.z, dth };
        }
      }
    }
    if (this.cycle.gripY !== null && !this.cycle.double && heldCount >= 2 && this.robot.pose.y > this.cycle.gripY + 0.01) {
      this.cycle.double = true;
      this.log(`Doppelgriff: ${heldCount} Lagen gleichzeitig gegriffen`, 'error');
    }
    if (!anyOn) this.cycle.gripY = null;
  }

  // Lage, die zuerst unter dem Stapel ausgegeben wird (für UI)
  plyReport() {
    return this.cloths.map((c) => {
      const tr = this.track.get(c.id);
      const pose = c.pose2D();
      return { cloth: c, name: c.name, state: tr.state, pose, strain: tr.strain || 0, strainMax: tr.strainMax || 0, error: tr.error, wav: c.waviness(), speed: c.meanSpeed() };
    }).sort((a, b) => a.cloth.stackIndex - b.cloth.stackIndex);
  }
}
