// Validierung des Solvers gegen analytische Lösungen und Normprüfungen.
// Läuft im Browser (Schaltfläche „Physik prüfen“) und in Node (npm test).

import { G, AIR } from './constants.js';
import { fabricById, toSI, bendingLength } from './materials.js';
import { Cloth } from './cloth.js';
import { BoxCollider } from './colliders.js';
import { capacityModel } from './grippers.js';
import { World, defaultConfig } from './world.js';

// Minimalwelt ohne Szene: Lage(n) + Kollider + optional Luftwiderstand
export function miniWorld(cloths, colliders = [], { drag = true, substeps = 16 } = {}) {
  const w = Object.create(World.prototype);
  w.cfg = { ...defaultConfig(), substeps, plies: cloths.length };
  w.t = 0; w.events = [];
  w.cloths = cloths;
  w.colliders = colliders; w.staticColliders = colliders;
  w.kinematic = [];
  w.head = { elements: [], extent: { x: 0, z: 0 }, pose: { x: 0, y: -10, z: 0, yaw: 0 }, colliders: [], updateFrame() {}, solve() {}, checkFailure() {}, updateColliders() {}, events: [] };
  w.machine = { footUp: true, sewing: false, needle: [99, 0, 99], update() {}, solve() {}, busy: false };
  w.robot = { pose: { x: 0, y: -10, z: 0, yaw: 0 }, update() {} };
  w.contacts = { detect() {}, solve() {}, n: 0 };
  w.track = new Map(cloths.map((c) => [c.id, { state: '', held: false }]));
  w.cycle = { gripY: null };
  w.stats = {};
  w._afterFrame = () => {};
  w.touchTop = -Infinity;
  if (!drag) w._drag = (c) => { c.acc = c.acc || new Float64Array(3 * c.n); };
  return w;
}

function run(w, seconds, fdt = 1 / 60, each) {
  const n = Math.round(seconds / fdt);
  for (let i = 0; i < n; i++) { w.step(fdt); if (each && each(w) === false) break; }
}

const pct = (a, b) => (100 * (a - b)) / b;

export function runValidation() {
  const rows = [];
  const add = (name, sim, ref, unit, tol, note) => {
    const dev = pct(sim, ref);
    rows.push({ name, sim, ref, unit, dev, ok: Math.abs(dev) <= tol, tol, note });
  };

  // 1) Freier Fall ohne Luft: t = √(2h/g)
  {
    const c = new Cloth({ fabric: fabricById('denim'), width: 0.02, length: 0.02, spacing: 0.01, center: [0, 2, 0] });
    const w = miniWorld([c], [], { drag: false });
    let tHit = null;
    run(w, 1.0, 1 / 600, (ww) => { if (c.centroid()[1] <= 1.0) { tHit = ww.t; return false; } });
    add('Freier Fall 1 m (ohne Luft)', tHit, Math.sqrt(2 / G), 's', 1, 'Zeitintegration, g = 9,80665 m/s²');
  }

  // 2) Sinkgeschwindigkeit einer flach fallenden Lage: v = √(2·ρA·g / (ρL·cd))
  {
    const f = fabricById('popeline'), m = toSI(f);
    const c = new Cloth({ fabric: f, width: 0.2, length: 0.2, spacing: 0.02, center: [0, 10, 0] });
    const w = miniWorld([c]);
    // nach ~1 s ist die stationäre Sinkgeschwindigkeit erreicht; später kippt die Lage
    // (wie reales Papier/Gewebe) seitlich ab und taumelt
    run(w, 1.0);
    const vt = -avgVy(c);
    add('Sinkgeschwindigkeit Popeline (flach)', vt, Math.sqrt((2 * m.rho * G) / (AIR.density * 1.17)), 'm/s', 3, 'v = √(2·ρA·g/(ρL·cd)), cd = 1,17');
  }

  // 3) Haftreibung auf schiefer Ebene (Stahl): haftet für tan α < μH
  {
    const f = fabricById('popeline'), m = toSI(f);
    const aCrit = Math.atan(m.muSteelS);
    const res = [];
    for (const a of [aCrit - (3 * Math.PI) / 180, aCrit + (3 * Math.PI) / 180]) {
      const plate = new BoxCollider({ name: 'Rampe', center: [0, 1, 0], half: [0.5, 0.01, 0.5], roll: a, material: 'stahl' });
      const top = 1 + 0.01 / Math.cos(a);
      const c = new Cloth({ fabric: f, width: 0.1, length: 0.1, spacing: 0.0125, center: [0, top + m.t / 2 + 1e-5, 0] });
      // Lage in die Ebene drehen (um z)
      for (let v = 0; v < c.n; v++) {
        const x = c.pos[3 * v], y = c.pos[3 * v + 1] - top;
        c.pos[3 * v] = x * Math.cos(a) - y * Math.sin(a);
        c.pos[3 * v + 1] = top + x * Math.sin(a) + y * Math.cos(a);
      }
      c.prev.set(c.pos);
      const w = miniWorld([c], [plate], { drag: false });
      const x0 = c.centroid();
      run(w, 0.25, 1 / 60);
      const x1 = c.centroid();
      run(w, 0.5, 1 / 60);
      const x2 = c.centroid();
      res.push({ a, d01: Math.hypot(x1[0] - x0[0], x1[1] - x0[1]), d12: Math.hypot(x2[0] - x1[0], x2[1] - x1[1]) });
    }
    const [stick, slide] = res;
    rows.push({ name: `Haften bei α = ${(stick.a * 180 / Math.PI).toFixed(1)}° (< arctan μH = ${(aCrit * 180 / Math.PI).toFixed(1)}°)`, sim: stick.d12 * 1000, ref: 0, unit: 'mm', dev: null, ok: stick.d12 < 0.5e-3, tol: null, note: 'Weg in 0,5 s, Soll ≈ 0' });
    // Gleiten: s = ½·g·(sin α − μG·cos α)·t² über das Intervall 0,25…0,75 s
    const acc = G * (Math.sin(slide.a) - m.muSteelK * Math.cos(slide.a));
    const ref = 0.5 * acc * (0.75 ** 2 - 0.25 ** 2);
    add(`Gleiten bei α = ${(slide.a * 180 / Math.PI).toFixed(1)}° (Weg 0,25…0,75 s)`, slide.d12 * 1000, ref * 1000, 'mm', 10, 'a = g·(sin α − μG·cos α)');
  }

  // 4) Biegelänge nach ASTM D1388 (Cantilever, Peirce): Überhang l, Tipwinkel θ
  //    c = l · (cos(θ/2) / (8·tan θ))^(1/3)
  for (const id of ['popeline', 'denim', 'leder']) {
    const f = fabricById(id);
    const cRef = bendingLength(f, 'warp');
    const l = 2 * cRef;
    const h = Math.min(0.006, l / 8);
    const len = l + 0.05;
    const c = new Cloth({ fabric: f, width: 2 * h, length: len, spacing: h, center: [0, 1, len / 2 - 0.05] });
    // Teil auf der Plattform (z < 0) einspannen
    for (let v = 0; v < c.n; v++) if (c.pos[3 * v + 2] <= 1e-9) c.w[v] = 0;
    const w = miniWorld([c], [], { drag: true, substeps: 24 });
    run(w, 4);
    // Spitze: letzte Reihe, Mittel
    let ty = 0, tz = 0, k = 0;
    for (let i = 0; i < c.nx; i++) { const v = c.idx(i, c.nz - 1); ty += c.pos[3 * v + 1]; tz += c.pos[3 * v + 2]; k++; }
    ty /= k; tz /= k;
    const theta = Math.atan2(1 - ty, tz);
    const cSim = l * Math.cbrt(Math.cos(theta / 2) / (8 * Math.tan(theta)));
    add(`Biegelänge ${f.name} (ASTM D1388)`, cSim * 100, cRef * 100, 'cm', 10, `Überhang ${(l * 100).toFixed(1)} cm, Tipwinkel ${(theta * 180 / Math.PI).toFixed(1)}° (Soll 41,5°)`);
  }

  // 5) Zugversuch: hängender Streifen mit Endlast (Linienlast unterhalb der Dehnungsbegrenzung)
  {
    const f = fabricById('jersey'), m = toSI(f);
    const q = 3; // N/m Linienlast am unteren Rand
    const L = 0.2, h = 0.0125;
    const c = new Cloth({ fabric: f, width: 0.05, length: L, spacing: h, center: [0, 1, 0] });
    for (let v = 0; v < c.n; v++) { const z = c.pos[3 * v + 2]; c.pos[3 * v + 1] = 1 - (z + L / 2); c.pos[3 * v + 2] = 0; }
    c.prev.set(c.pos);
    for (let i = 0; i < c.nx; i++) c.w[c.idx(i, 0)] = 0;
    const w = miniWorld([c], [], { drag: true });
    w.cfg.iterations = 200;         // voll konvergiertes XPBD (Materialgesetz prüfen)
    w.cfg.limitLoad = 1e6;          // ohne Dehnungsbegrenzung
    // Endlast als Zusatzmasse am unteren Rand: F = q·b
    const b = c.width;
    const extraPerNode = (q * b) / G / c.nx;
    for (let i = 0; i < c.nx; i++) { const v = c.idx(i, c.nz - 1); c.mass[v] += extraPerNode; c.w[v] = 1 / c.mass[v]; }
    run(w, 3);
    let y0 = 0, y1 = 0;
    for (let i = 0; i < c.nx; i++) { y0 += c.pos[3 * c.idx(i, 0) + 1]; y1 += c.pos[3 * c.idx(i, c.nz - 1) + 1]; }
    const strainSim = (y0 - y1) / c.nx / L - 1;
    // analytisch: Endlast + halbes Eigengewicht
    const strainRef = (q + 0.5 * m.rho * G * L) / m.Tw;
    add('Zugversuch Single Jersey (3 N/m)', strainSim * 100, strainRef * 100, '%', 10, 'ε = F/(T·b), XPBD 200 Iterationen ohne Dehnungsbegrenzung');
  }

  // 6) Sauggreifer auf luftdichtem Material: F → Δp·A
  {
    const m = { ...toSI(fabricById('leder')), k: 1e-12 };
    const p = { diameter: 20, dpMax: 60, qMax: 25 };
    const cap = capacityModel('vakuum', p, [{ m, depthTop: 0 }], 1);
    add('Vakuum, luftdicht: F = Δp·A (Ø 20 mm, 60 kPa)', cap[0].Cn, 60e3 * Math.PI * 0.01 ** 2, 'N', 2, 'Grenzfall des Leiternetzwerks');
  }

  return rows;
}

function avgVy(c) {
  let s = 0;
  for (let v = 0; v < c.n; v++) s += c.vel[3 * v + 1];
  return s / c.n;
}
