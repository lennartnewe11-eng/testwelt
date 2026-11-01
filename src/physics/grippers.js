// Greifersysteme für biegeschlaffe Halbzeuge.
//
// Jedes Greiferelement berechnet aus einem physikalischen Modell die maximale Haltekraft
// (normal C_n und tangential C_t) für jede Lage, die unter ihm liegt. Gegriffene Partikel
// werden über eine nachgiebige XPBD-Bindung an das Element gekoppelt. Die tatsächlich
// übertragene Kraft (Gewicht, Trägheit, Luftwiderstand, Reibung und Haftung zur
// Nachbarlage) ergibt sich aus der Simulation. Überschreitet sie das Versagenskriterium
// (F_n/C_n)² + (F_t/C_t)² > 1, löst sich die Lage. Doppelgriffe (2. Lage wird mitgenommen)
// entstehen dadurch von selbst, wenn das Modell genug Haltekraft auf tiefere Lagen ergibt.

import { EPS0, UNIT } from './constants.js';
import { rotY } from './cloth.js';
import { BoxCollider } from './colliders.js';

export const GRIPPER_TYPES = {
  vakuum: {
    name: 'Vakuum-Sauggreifer',
    short: 'Vakuum',
    params: [
      ['diameter', 'Saugfläche Ø', 'mm', 20, 5, 80, 1],
      ['dpMax', 'Max. Unterdruck', 'kPa', 60, 5, 90, 1],
      ['qMax', 'Saugvermögen', 'l/min', 12, 2, 400, 1],
    ],
    tauOn: 0.08, tauOff: 0.05, gap: 3e-3, shape: 'round',
    note: 'Unterdruck-Leiternetzwerk: Volumenstrom durch die Lagen (Darcy, Luftdurchlässigkeit), seitliche Leckage zwischen den Lagen, Kennlinie des Vakuumerzeugers.',
  },
  nadel: {
    name: 'Nadelgreifer',
    short: 'Nadel',
    params: [
      ['needles', 'Nadelanzahl', '–', 12, 1, 60, 1],
      ['depth', 'Einstechtiefe', 'mm', 0.3, 0.05, 5, 0.05],
      ['size', 'Nadelfeld (Kante)', 'mm', 24, 10, 60, 1],
    ],
    tauOn: 0.12, tauOff: 0.1, gap: 0.3e-3, shape: 'square',
    note: 'Haltekraft = Nadelanzahl × Auszugskraft je Nadel × Eingriffsgrad. Alle Lagen innerhalb der Einstechtiefe werden durchstochen.',
  },
  ea: {
    name: 'Elektroadhäsionsgreifer',
    short: 'Elektroadhäsion',
    params: [
      ['voltage', 'Spannung', 'kV', 2, 0.5, 8, 0.1],
      ['pitch', 'Elektrodenteilung', 'mm', 1.0, 0.5, 6, 0.1],
      ['size', 'Padkante', 'mm', 50, 15, 120, 1],
    ],
    tauOn: 0.25, tauOff: 0.9, gap: 2e-3, shape: 'square',
    note: 'Maxwell-Spannung p = ½·ε₀·εr·E², Streufeld fällt mit exp(−2π·z/Teilung) ab. Restladung verzögert das Ablegen.',
  },
  schablone: {
    name: 'Nähschablone (Klemmrahmen)',
    short: 'Schablone',
    params: [
      ['pressure', 'Klemmdruck', 'kPa', 3, 0.5, 20, 0.5],
      ['slot', 'Nahtschlitz (halbe Breite)', 'mm', 16, 8, 30, 1],
      ['clampGap', 'Klemmspalt', 'mm', 2.5, 0.5, 10, 0.1],
    ],
    tauOn: 0.3, tauOff: 0.25, gap: 2e-3, shape: 'template',
    note: 'Teilespezifische Schablone: klemmt alle Lagen flächig (Reibschluss μ·p·A) und lässt nur einen Schlitz entlang der Naht frei. Industriestandard für automatisches Konturnähen.',
  },
  traeger: {
    name: 'Werkstückträger mit Nadelleisten',
    short: 'Träger',
    params: [
      ['hold', 'Haltekraft Nadelleisten', 'N', 30, 5, 120, 1],
      ['slot', 'Nahtschlitz (halbe Breite)', 'mm', 16, 8, 30, 1],
    ],
    tauOn: 0.2, tauOff: 0.2, gap: 2e-3, shape: 'carrier',
    note: 'Dünnes Trägerblech (0,5 mm) unter dem Körperteil; Nadelleisten halten den Stoff von unten, entlang der Naht bleibt ein Schlitz frei. Die Oberseite bleibt frei, darauf liegt der zuzuführende Ärmel lose auf.',
  },
  kryo: {
    name: 'Kryogreifer (Gefrieren)',
    short: 'Kryo',
    params: [
      ['diameter', 'Gefrierfläche Ø', 'mm', 16, 5, 40, 1],
      ['sigma', 'Eis-Haftfestigkeit', 'kPa', 30, 5, 200, 1],
    ],
    tauOn: 1.4, tauOff: 1.1, gap: 0.8e-3, shape: 'round',
    note: 'Ein Wassertropfen gefriert im Gewebe. Haftung ∝ Benetzbarkeit; poröse dünne Lagen lassen Wasser in die nächste Lage durch.',
  },
};

export function defaultParams(type) {
  const o = {};
  for (const [k, , , def] of GRIPPER_TYPES[type].params) o[k] = def;
  return o;
}

function footprintArea(type, p) {
  if (type === 'schablone' || type === 'traeger') return 0.1;
  if (type === 'vakuum') return Math.PI * (p.diameter * 0.5e-3) ** 2;
  if (type === 'kryo') return Math.PI * (p.diameter * 0.5e-3) ** 2;
  return (p.size * 1e-3) ** 2;
}

export function footprintHalf(type, p) {
  if (type === 'schablone' || type === 'traeger') return 0.3;
  if (type === 'vakuum' || type === 'kryo') return p.diameter * 0.5e-3;
  return p.size * 0.5e-3;
}

// Trifft die Senkrechte durch (x, z) das Dreieck t? Liefert die interpolierte Höhe.
export function triHit(c, t, x, z) {
  const p = c.pos, T = c.tri;
  const a = T[3 * t] * 3, b = T[3 * t + 1] * 3, d = T[3 * t + 2] * 3;
  const v0x = p[d] - p[a], v0z = p[d + 2] - p[a + 2];
  const v1x = p[b] - p[a], v1z = p[b + 2] - p[a + 2];
  const v2x = x - p[a], v2z = z - p[a + 2];
  const den = v0x * v1z - v1x * v0z;
  if (Math.abs(den) < 1e-14) return null;
  const u = (v2x * v1z - v1x * v2z) / den, v = (v0x * v2z - v2x * v0z) / den;
  if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) return null;
  return { y: p[a + 1] + u * (p[d + 1] - p[a + 1]) + v * (p[b + 1] - p[a + 1]), u, v };
}

// Thomas-Algorithmus für tridiagonale Systeme
function solveTri(a, b, c, d) {
  const n = b.length, cp = new Array(n), dp = new Array(n), x = new Array(n);
  cp[0] = c[0] / b[0]; dp[0] = d[0] / b[0];
  for (let i = 1; i < n; i++) {
    const m = b[i] - a[i] * cp[i - 1];
    cp[i] = c[i] / m; dp[i] = (d[i] - a[i] * dp[i - 1]) / m;
  }
  x[n - 1] = dp[n - 1];
  for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
  return x;
}

// Haltekraftmodell. column: [{ m: SI-Material, depthTop: Abstand Greiferfläche→Lagenoberseite [m] }]
// covered: Bedeckungsgrad der Greiferfläche durch die oberste Lage (0…1).
// Rückgabe: [{ Cn, Ct, info }] je Lage, ohne Aktivierungsgrad.
export function capacityModel(type, p, column, covered = 1) {
  const A = footprintArea(type, p);
  const out = column.map(() => ({ Cn: 0, Ct: 0 }));
  if (!column.length) return out;

  if (type === 'vakuum') {
    const N = column.length;
    const Qm = (p.qMax * UNIT.lPerMin) / A;      // Pumpenvolumenstrom je Fläche [m/s]
    const pm = p.dpMax * 1e3;                    // [Pa]
    const gRim = 2e-7 + (1 - covered) * 0.02;    // Leckage Lippenrand + offene Teilfläche (Blendenströmung, linearisiert) [m/(s·Pa)]
    const gLat = 2e-2;                           // seitlicher Leitwert der Lagenfuge [m/(s·Pa)]
    const k = column.map((c) => Math.max(c.m.k, 1e-9));
    // Unbekannte u0..uN (Unterdruck in Kammer und unter den Lagen)
    const a = [], b = [], c = [], d = [];
    a.push(0); b.push(Qm / pm + k[0] + gRim); c.push(-k[0]); d.push(Qm);
    for (let i = 1; i <= N; i++) {
      const ki = k[i - 1], kn = i < N ? k[i] : 0;
      a.push(-ki); b.push(ki + kn + gLat); c.push(i < N ? -kn : 0); d.push(0);
    }
    const u = solveTri(a, b, c, d);
    for (let i = 0; i < N; i++) {
      const F = Math.max(0, A * (u[i] - u[i + 1]));
      out[i].Cn = F;
      out[i].Ct = F * (i === 0 ? 0.8 : column[i].m.muSelfS);
      out[i].info = { pressure: u[i] };
    }
    out.chamber = u[0];
    out.flow = (Qm * A * (1 - u[0] / pm)) / UNIT.lPerMin;
    return out;
  }

  if (type === 'nadel') {
    const P = p.depth * 1e-3;
    for (let i = 0; i < column.length; i++) {
      const { m, depthTop } = column[i];
      const e = Math.min(1, Math.max(0, (P - depthTop) / m.t));
      const eng = e <= 0.15 ? 0 : e >= 1 ? 1 : ((e - 0.15) / 0.85) ** 1.5;
      out[i].Cn = p.needles * m.needleHold * eng * covered;
      out[i].Ct = 2.5 * out[i].Cn;
      out[i].info = { engagement: e };
    }
    return out;
  }

  if (type === 'ea') {
    const pitch = p.pitch * 1e-3;
    const E0 = (p.voltage * 1e3) / (pitch / 2);
    for (let i = 0; i < column.length; i++) {
      const { m, depthTop } = column[i];
      const z = depthTop + m.t / 2;
      const pr = 0.5 * EPS0 * m.epsR * E0 * E0 * Math.exp((-2 * Math.PI * z) / pitch);
      out[i].Cn = pr * A * covered;
      out[i].Ct = 2.0 * out[i].Cn;
      out[i].info = { pressure: pr };
    }
    out.field = E0;
    return out;
  }

  if (type === 'schablone') {
    // Klemmung: Reibschluss oben (Stahl) bzw. zur Nachbarlage, alle Lagen im Klemmspalt
    const P = p.pressure * 1e3, A = column.areas || column.map(() => 0.05);
    for (let i = 0; i < column.length; i++) {
      const { m, depthTop } = column[i];
      const inGap = depthTop + m.t <= p.clampGap * 1e-3 + 1e-4;
      const mu = i === 0 ? m.muSteelS : m.muSelfS;
      out[i].Cn = inGap ? P * A[i] : 0;        // Klemmkraft (formschlüssig zwischen den Platten)
      out[i].Ct = inGap ? mu * P * A[i] : 0;
    }
    return out;
  }

  if (type === 'kryo') {
    let phi = 1;
    const sigma = p.sigma * 1e3;
    for (let i = 0; i < column.length; i++) {
      const { m } = column[i];
      out[i].Cn = sigma * A * m.wetting * phi * (i === 0 ? covered : 1);
      out[i].Ct = out[i].Cn;
      // Anteil des Wassers, der durch diese Lage in die nächste dringt
      phi *= Math.min(1, m.airPerm / 3000) ** 1.5 * Math.min(1, 0.15e-3 / m.t);
      if (phi < 1e-4) phi = 0;
    }
    return out;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Greiferkopf mit Raster aus Elementen, kinematisch vom Portal geführt.
export class GripperHead {
  constructor({ type = 'vakuum', params, rows = 3, cols = 2, pitchX = 0.14, pitchZ = 0.12 }) {
    this.type = type;
    this.params = params || defaultParams(type);
    this.def = GRIPPER_TYPES[type];
    this.pose = { x: 0, y: 1, z: 0, yaw: 0 };
    this.elements = [];
    this.compliance = 2e-5; // Nachgiebigkeit der Bindung Stoff–Greiferfläche [m/N]
    const half = footprintHalf(type, this.params);
    let n = 0;
    if (type === 'schablone' || type === 'traeger') { rows = 1; cols = 1; }
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const ox = (c - (cols - 1) / 2) * pitchX, oz = (r - (rows - 1) / 2) * pitchZ;
      const el = {
        index: n++, ox, oz, on: false, act: 0, half,
        att: [],                    // {cloth, v, lx, ly, lz}
        load: new Map(),            // cloth.id -> [Lx,Ly,Lz] gefiltert
        acc: new Map(),             // cloth.id -> Summe im Teilschritt
        cap: new Map(),             // cloth.id -> {Cn, Ct, ply}
        cooldown: new Map(),        // cloth.id -> Zeit
        since: new Map(),           // cloth.id -> Zeitpunkt des Greifens
        frozen: new Map(),          // cloth.id -> Haltekraft beim Greifen (Aktivierung 1)
        blocked: new Set(),         // in dieser Aktivierung bereits abgelöste Lagen
        column: [],
        chamber: 0,
      };
      const h = Math.max(half, 0.008);
      el.collider = new BoxCollider({ name: `Greifer ${n}`, center: [0, 0, 0], half: [h, 0.015, h], material: type === 'vakuum' ? 'gummi' : 'alu', kinematic: true, visual: false });
      this.elements.push(el);
    }
    this.extent = {
      x: ((cols - 1) * pitchX) / 2 + half + 0.02,
      z: ((rows - 1) * pitchZ) / 2 + half + 0.02,
    };
    this.plate = new BoxCollider({ name: 'Greiferplatte', center: [0, 0, 0], half: [this.extent.x, 0.008, this.extent.z], material: 'alu', kinematic: true, visual: false });
    this.colliders = [...this.elements.map((e) => e.collider), this.plate];
    if (type === 'schablone' || type === 'traeger') {
      // Die Schablone liegt flach auf dem Stoff; Stoff außerhalb des Schlitzes ist geklemmt
      for (const k of this.colliders) { k.enabled = false; k.half[1] = 0.002; }
      this.extent = { x: 0.3, z: 0.25 };
    }
    this.events = [];
  }

  // Schablonengeometrie: Kontur und Nahtbahn im Zuschnittkoordinatensystem
  setTemplate(tpl) { this.template = tpl; }

  // Werkstückträger: Nadelleisten halten das zugeordnete Teil von unten (außerhalb des Schlitzes)
  _carrierFrame(el, cloths, t) {
    const tpl = this.template, P = this.params;
    if (!tpl || !el.on || el.act < 0.5) return;
    const c = tpl.cloth;
    if (!c || el.since.has(c.id)) return;
    const [cx, fy, cz] = this.elementCenter(el);
    const yaw = this.pose.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw);
    const verts = [];
    for (let v = 0; v < c.n; v++) {
      const gap = c.pos[3 * v + 1] - c.radius - fy;
      if (gap < -3e-3 || gap > 4e-3) continue;
      if (tpl.dist(c.rest[2 * v], c.rest[2 * v + 1]) < P.slot * 1e-3) continue;
      verts.push(v);
    }
    if (verts.length < 20) return;
    for (const v of verts) {
      if (c.attached[v] >= 0) continue;
      const dx = c.pos[3 * v] - cx, dz = c.pos[3 * v + 2] - cz;
      c.attached[v] = el.index;
      el.att.push({ cloth: c, v, lx: dx * cs - dz * sn, ly: c.radius, lz: dx * sn + dz * cs });
    }
    el.since.set(c.id, t);
    el.frozen.set(c.id, { cloth: c, ply: 0, Cn: P.hold, Ct: P.hold });
  }

  // Nähschablone: alle Knoten außerhalb des Nahtschlitzes klemmen (einmal je Schließen)
  _templateFrame(el, cloths, t) {
    const tpl = this.template, P = this.params;
    if (!tpl || !el.on || el.act < 0.5) return;
    const [cx, fy, cz] = this.elementCenter(el);
    const yaw = this.pose.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw);
    const groups = [];
    for (const c of cloths) {
      if (el.since.has(c.id)) continue;
      const verts = [];
      let dsum = 0;
      for (let v = 0; v < c.n; v++) {
        const depthTop = fy - (c.pos[3 * v + 1] + c.radius);
        if (depthTop < -3e-3 || depthTop > P.clampGap * 1e-3) continue;
        const dx = c.pos[3 * v] - cx, dz = c.pos[3 * v + 2] - cz;
        if (Math.abs(dx) > 0.4 || Math.abs(dz) > 0.4) continue;
        if (tpl.dist(c.rest[2 * v], c.rest[2 * v + 1]) < P.slot * 1e-3) continue;
        verts.push(v); dsum += depthTop;
      }
      if (verts.length > 20) groups.push({ c, verts, depth: dsum / verts.length });
    }
    if (!groups.length) return;
    groups.sort((a, b) => a.depth - b.depth);
    const col = groups.map((g) => ({ m: g.c.m, depthTop: Math.max(0, g.depth) }));
    col.areas = groups.map((g) => g.verts.reduce((a, v) => a + g.c.mass[v] / g.c.m.rho, 0));
    const caps = capacityModel('schablone', P, col, 1);
    let above = 0;
    groups.forEach((g, k) => {
      if (caps[k].Cn <= 0) return;
      const ly = -(above + g.c.radius);
      for (const v of g.verts) {
        if (g.c.attached[v] >= 0) continue;
        const dx = g.c.pos[3 * v] - cx, dz = g.c.pos[3 * v + 2] - cz;
        g.c.attached[v] = el.index;
        el.att.push({ cloth: g.c, v, lx: dx * cs - dz * sn, ly, lz: dx * sn + dz * cs });
      }
      el.since.set(g.c.id, t);
      el.frozen.set(g.c.id, { cloth: g.c, ply: k, Cn: caps[k].Cn, Ct: caps[k].Ct });
      above += 2 * g.c.radius;
    });
    el.column = groups.map((g, k) => ({ cloth: g.c, ply: k, depth: g.depth, Cn: caps[k].Cn * el.act, Ct: caps[k].Ct * el.act }));
  }

  elementCenter(el) {
    const [rx, rz] = rotY(el.ox, el.oz, this.pose.yaw);
    return [this.pose.x + rx, this.pose.y, this.pose.z + rz];
  }

  updateColliders() {
    for (const el of this.elements) {
      const c = this.elementCenter(el);
      el.collider.setPose([c[0], c[1] + el.collider.half[1], c[2]], this.pose.yaw);
    }
    this.plate.setPose([this.pose.x, this.pose.y + 0.03 + this.plate.half[1], this.pose.z], this.pose.yaw);
  }

  setActive(indices, on) {
    for (const el of this.elements) if (!indices || indices.includes(el.index)) el.on = on;
  }

  // Abtastpunkte der Greiferfläche im Elementkoordinatensystem
  _samples(half) {
    const pts = [[0, 0]];
    if (this.def.shape === 'round') {
      for (let k = 0; k < 6; k++) { const a = (k * Math.PI) / 3; pts.push([0.65 * half * Math.cos(a), 0.65 * half * Math.sin(a)]); }
      for (let k = 0; k < 6; k++) { const a = ((k + 0.5) * Math.PI) / 3; pts.push([0.95 * half * Math.cos(a), 0.95 * half * Math.sin(a)]); }
    } else {
      for (const u of [-0.9, -0.3, 0.3, 0.9]) for (const v of [-0.9, -0.3, 0.3, 0.9]) pts.push([u * half, v * half]);
    }
    return pts;
  }

  // Einmal pro Bildschritt: Aktivierung, Lagenspalte, Haltekräfte, neue Bindungen.
  // Die Bedeckung der Greiferfläche wird über Abtastpunkte auf den Dreiecken der Lage
  // bestimmt und ist damit unabhängig von der Netzauflösung.
  updateFrame(dt, cloths, t) {
    const def = this.def;
    const yaw = this.pose.yaw, cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (const el of this.elements) {
      const tau = el.on ? def.tauOn : def.tauOff;
      el.act += ((el.on ? 1 : 0) - el.act) * (1 - Math.exp(-dt / tau));
      if (!el.on) el.blocked.clear();
      if (!el.on && el.act < 0.02) {
        if (el.att.length) this._release(el, null);
        el.column = []; el.cap.clear();
        continue;
      }
      if (def.shape === 'template' || def.shape === 'carrier') {
        if (def.shape === 'carrier') this._carrierFrame(el, cloths, t); else this._templateFrame(el, cloths, t);
        el.cap = new Map();
        for (const [id, f] of el.frozen) el.cap.set(id, { ...f, Cn: f.Cn * el.act, Ct: f.Ct * el.act });
        el.column = [...el.frozen.values()].map((f) => ({ cloth: f.cloth, ply: f.ply, Cn: f.Cn * el.act, Ct: f.Ct * el.act }));
        continue;
      }
      const [cx, fy, cz] = this.elementCenter(el);
      const half = el.half, round = def.shape === 'round';
      const maxDepth = 8e-3;
      const samples = this._samples(half).map(([u, v]) => [cx + u * cs + v * sn, cz - u * sn + v * cs]);
      const groups = [];
      for (const c of cloths) {
        const p = c.pos, h = c.h, R = half + 1.5 * h;
        const cand = [], cells = new Set();
        for (let v = 0; v < c.n; v++) {
          const dx = p[3 * v] - cx, dz = p[3 * v + 2] - cz;
          if (Math.abs(dx) > R || Math.abs(dz) > R) continue;
          const depthTop = fy - (p[3 * v + 1] + c.radius);
          if (depthTop < -3e-3 || depthTop > maxDepth + h) continue;
          const lx = dx * cs - dz * sn, lz = dx * sn + dz * cs;
          const inside = round ? lx * lx + lz * lz <= half * half : Math.abs(lx) <= half && Math.abs(lz) <= half;
          if (inside) cand.push(v);
          for (let e = c.nodeTriStart[v]; e < c.nodeTriStart[v + 1]; e++) cells.add(c.nodeTriList[e]);
        }
        if (!cells.size) continue;
        let hits = 0, dsum = 0;
        const extra = new Set();
        for (const [sx, sz] of samples) {
          for (const cell of cells) {
            let found = false;
            for (let q = 0; q < 1; q++) {
              const tIdx = cell;
              const r = triHit(c, tIdx, sx, sz);
              if (!r) continue;
              const depthTop = fy - (r.y + c.radius);
              if (depthTop < -3e-3 || depthTop > maxDepth) continue;
              hits++; dsum += depthTop; found = true;
              const T = c.tri;
              extra.add(T[3 * tIdx]); extra.add(T[3 * tIdx + 1]); extra.add(T[3 * tIdx + 2]);
              break;
            }
            if (found) break;
          }
        }
        if (!hits) continue;
        // Greiferfläche größer als Netzweite: Knoten in der Fläche; sonst Knoten der getroffenen Dreiecke
        const verts = cand.length >= 3 ? cand : [...new Set([...cand, ...extra])];
        groups.push({ c, depth: dsum / hits, coverage: hits / samples.length, verts });
      }
      groups.sort((a, b) => a.depth - b.depth);
      const col = groups.map((g) => ({ m: g.c.m, depthTop: Math.max(0, g.depth) }));
      const caps = capacityModel(this.type, this.params, col, groups.length ? groups[0].coverage : 0);
      el.chamber = caps.chamber || 0;
      el.column = groups.map((g, k) => ({
        cloth: g.c, ply: k, depth: g.depth, coverage: g.coverage,
        Cn: caps[k].Cn * el.act * (k === 0 || this.type === 'vakuum' ? 1 : g.coverage),
        Ct: caps[k].Ct * el.act * (k === 0 || this.type === 'vakuum' ? 1 : g.coverage),
      }));
      // Gehaltene Lagen sind relativ zur Greiferfläche fixiert; Bedeckung und Lagenaufbau
      // ändern sich nicht mehr. Ihre Haltekraft wird beim Greifen bestimmt (× Aktivierung).
      const held = new Set(el.att.map((a) => a.cloth.id));
      const next = new Map();
      for (const e of el.column) next.set(e.cloth.id, e);
      for (const id of held) {
        const f = el.frozen.get(id);
        if (f) next.set(id, { ...(next.get(id) || {}), cloth: f.cloth, ply: f.ply, Cn: f.Cn * el.act, Ct: f.Ct * el.act });
      }
      el.cap = next;

      if (!el.on || el.act < 0.5) continue;
      // Neue Bindungen: nur zusammenhängend von oben, innerhalb des Fangbereichs
      let above = 0;
      for (let k = 0; k < groups.length; k++) {
        const g = groups[k], cap = el.column[k];
        const cd = el.cooldown.get(g.c.id);
        const limit = this.type === 'nadel' ? this.params.depth * 1e-3 : k === 0 ? def.gap : above + 0.3e-3;
        if (g.depth > limit) break;
        if (cap.Cn < 2e-3 || (cd && t < cd) || el.blocked.has(g.c.id)) break;
        const ly = -(above + g.c.radius);
        // Gegenhalter: Liegt die Lage auf einem aktiven Saugtisch, muss die Haltekraft
        // dessen Niederhaltekraft (Unterdruck × Greiferfläche) übersteigen.
        const tv = this.tableVac;
        if (tv && tv.on) {
          const v0 = g.verts[0], P = g.c.pos;
          const onTable = P[3 * v0 + 1] - g.c.radius < tv.top + 0.05e-3 && P[3 * v0] > tv.region[0] && P[3 * v0] < tv.region[1] && P[3 * v0 + 2] > tv.region[2] && P[3 * v0 + 2] < tv.region[3];
          const area = def.shape === 'round' ? Math.PI * half * half : 4 * half * half;
          if (onTable && cap.Cn <= tv.pressure * area) break;
        }
        // eine Lage wird je Aktivierung einmal angesaugt/eingestochen, danach nicht nachgefasst
        if (el.since.has(g.c.id)) { above += 2 * g.c.radius; continue; }
        let added = 0;
        for (const v of g.verts) {
          if (g.c.attached[v] >= 0) continue;
          const dx = g.c.pos[3 * v] - cx, dz = g.c.pos[3 * v + 2] - cz;
          g.c.attached[v] = el.index;
          el.att.push({ cloth: g.c, v, lx: dx * cs - dz * sn, ly, lz: dx * sn + dz * cs });
          added++;
        }
        if (added && !el.since.has(g.c.id)) {
          el.since.set(g.c.id, t);
          el.frozen.set(g.c.id, { cloth: g.c, ply: k, Cn: cap.Cn / Math.max(el.act, 1e-6), Ct: cap.Ct / Math.max(el.act, 1e-6) });
          el.cap.set(g.c.id, cap);
        }
        above += 2 * g.c.radius;
      }
    }
  }

  // Jeder Teilschritt: Bindungen lösen (XPBD), übertragene Kräfte summieren.
  solve(dt) {
    const inv = 1 / (dt * dt);
    const at = this.compliance * inv;
    const yaw = this.pose.yaw;
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (const el of this.elements) {
      if (!el.att.length) continue;
      el.acc.clear();
      const [cx, cy, cz] = this.elementCenter(el);
      for (const a of el.att) {
        const c = a.cloth, p = c.pos, i = 3 * a.v, w = c.w[a.v];
        const tx = cx + a.lx * cs + a.lz * sn, ty = cy + a.ly, tz = cz - a.lx * sn + a.lz * cs;
        const dx = p[i] - tx, dy = p[i + 1] - ty, dz = p[i + 2] - tz;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-12 || w === 0) continue;
        const dl = -len / (w + at);
        const s = (w * dl) / len;
        p[i] += s * dx; p[i + 1] += s * dy; p[i + 2] += s * dz;
        // Kraft auf das Partikel = dl·n/Δt²; Last am Greifer = −Kraft
        const f = (-dl * inv) / len;
        let L = el.acc.get(c.id);
        if (!L) { L = [0, 0, 0]; el.acc.set(c.id, L); }
        L[0] += f * dx; L[1] += f * dy; L[2] += f * dz;
      }
    }
  }

  // Nach jedem Teilschritt: Last filtern und Versagen prüfen.
  checkFailure(dt, t) {
    const k = 1 - Math.exp(-dt / 0.01);
    for (const el of this.elements) {
      if (!el.att.length) { el.load.clear(); continue; }
      for (const [id, L] of el.acc) {
        let F = el.load.get(id);
        if (!F) { F = [0, 0, 0]; el.load.set(id, F); }
        F[0] += (L[0] - F[0]) * k; F[1] += (L[1] - F[1]) * k; F[2] += (L[2] - F[2]) * k;
        const cap = el.cap.get(id);
        const Cn = cap ? cap.Cn : 0, Ct = cap ? cap.Ct : 0;
        const Fn = Math.max(0, -F[1]), Ft = Math.hypot(F[0], F[2]);
        const u = (Cn > 0 ? (Fn / Cn) ** 2 : Fn > 1e-6 ? 1e9 : 0) + (Ct > 0 ? (Ft / Ct) ** 2 : Ft > 1e-6 ? 1e9 : 0);
        if (u > 1) {
          const cloth = el.att.find((a) => a.cloth.id === id)?.cloth;
          if (!cloth) continue;
          const regular = !el.on;
          const ply = el.frozen.get(id)?.ply ?? 0;
          this._release(el, id);
          el.cooldown.set(id, t + 0.4);
          if (el.on) el.blocked.add(id);
          if (!regular) this.events.push({ t, type: ply === 0 ? 'loss' : 'separate', el: el.index, cloth, Fn, Ft, Cn, Ct });
        }
      }
    }
  }

  _release(el, clothId) {
    const keep = [];
    for (const a of el.att) {
      if (clothId === null || a.cloth.id === clothId) a.cloth.attached[a.v] = -1;
      else keep.push(a);
    }
    el.att = keep;
    if (clothId === null) { el.load.clear(); el.since.clear(); el.frozen.clear(); }
    else { el.load.delete(clothId); el.since.delete(clothId); el.frozen.delete(clothId); }
  }

  releaseAll() { for (const el of this.elements) { el.on = false; el.act = 0; this._release(el, null); } }

  // Telemetrie je Element: gegriffene Lagen mit Last und Kapazität
  // Lage des gegriffenen (obersten) Zuschnitts im Kopfkoordinatensystem:
  // kopf = R(θ)·zuschnitt + t, bestimmt aus den Bindungspunkten (2D-Procrustes).
  // Entspricht dem Einmessen der Teillage, z. B. mit einer Kamera am Greifer.
  partMap() {
    let cloth = null;
    for (const el of this.elements) for (const [id, f] of el.frozen) if (f.ply === 0 && el.att.some((a) => a.cloth.id === id)) cloth = f.cloth;
    if (!cloth) return null;
    const P = [], Q = [];
    for (const el of this.elements) for (const a of el.att) {
      if (a.cloth !== cloth) continue;
      P.push([cloth.rest[2 * a.v], cloth.rest[2 * a.v + 1]]);
      Q.push([el.ox + a.lx, el.oz + a.lz]);
    }
    if (P.length < 3) return null;
    const cp = [0, 0], cq = [0, 0];
    for (let k = 0; k < P.length; k++) { cp[0] += P[k][0]; cp[1] += P[k][1]; cq[0] += Q[k][0]; cq[1] += Q[k][1]; }
    cp[0] /= P.length; cp[1] /= P.length; cq[0] /= P.length; cq[1] /= P.length;
    let A = 0, B = 0;
    for (let k = 0; k < P.length; k++) {
      const u = P[k][0] - cp[0], v = P[k][1] - cp[1], x = Q[k][0] - cq[0], z = Q[k][1] - cq[1];
      A += x * u + z * v; B += x * v - z * u;
    }
    const theta = Math.atan2(B, A);
    const [rx, rz] = rotY(cp[0], cp[1], theta);
    return { cloth, theta, tx: cq[0] - rx, tz: cq[1] - rz };
  }

  status() {
    return this.elements.map((el) => {
      const held = new Map();
      for (const a of el.att) held.set(a.cloth.id, (held.get(a.cloth.id) || 0) + 1);
      const plies = [];
      for (const e of el.column) {
        const F = el.load.get(e.cloth.id) || [0, 0, 0];
        plies.push({ cloth: e.cloth, ply: e.ply, held: held.get(e.cloth.id) || 0, Fn: Math.max(0, -F[1]), Ft: Math.hypot(F[0], F[2]), Cn: e.Cn, Ct: e.Ct });
      }
      return { index: el.index, on: el.on, act: el.act, plies, chamber: el.chamber };
    });
  }
}
