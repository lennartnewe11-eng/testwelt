// Produktionsstraße T-Shirt: ereignisdiskrete Simulation (zeitgesteuert) des Materialflusses.
//
// Vorstufe (Batch): Stoffrolle → Legemaschine (L Lagen) → CNC-Cutter → Abnahmetisch.
// Kommissionierung: Roboter mit Nadelgreifer vereinzelt die Teile eines Shirts vom Stapel
// auf einen Werkstückträger. Hauptstrecke: Transfersystem; jede Station holt den Träger über
// einen Querumsetzer in den Nebenschluss (die Strecke bleibt frei), bearbeitet ihn und
// gibt ihn zurück. Leere Träger laufen über Hubstationen und die untere Rücklaufstrecke zurück.
//
// Zykluszeiten: Handhabung (Roboterbewegungen) + Nähzeit aus den Nahtlängen der Schnittteile,
// Stichlänge und Drehzahl. Bei Kurvennähten begrenzt die Drehgeschwindigkeit der Führung
// (C-Achse) die Drehzahl: n ≤ 60·ω_max / (κ_max · Stichlänge).

import { buildGarment, nestMarker, DIM } from './garment.js';

export const STAGES = [
  'Zuschnitt-Kit', 'Schulter rechts', 'Halsbündchen', 'Schulter links', 'Ärmel links', 'Ärmel rechts',
  'Säume', 'gefaltet', 'Seite links', 'Seite rechts', 'gewendet', 'geprüft', 'gebügelt & gefaltet', 'verpackt',
];

// Stationsdefinitionen: Nähte (Länge in m, Kurve ja/nein, max. Krümmung 1/m), Handhabung [s]
export function stationDefs(G) {
  const S = G.seams;
  return [
    { id: 'schulter1', name: 'Schulternaht rechts', machine: 'overlock', seams: [{ len: S.schulter, kmax: 0 }], handling: 6.5, stage: 1, cap: 1 },
    { id: 'hals', name: 'Halsbündchen annähen', machine: 'overlock', seams: [{ len: S.hals, kmax: 22 }], handling: 9.0, stage: 2, cap: 1, note: 'Bündchen 15 % kürzer: Obertransport dehnt es (negative Mehrweite)' },
    { id: 'schulter2', name: 'Schulternaht links', machine: 'overlock', seams: [{ len: S.schulter + 0.036, kmax: 0 }], handling: 6.5, stage: 3, cap: 1 },
    { id: 'aermelL', name: 'Ärmel einsetzen links', machine: 'steppstich', seams: [{ len: S.armloch, kmax: 14 }], handling: 11.0, stage: 4, cap: 1, physics: 'aermel', note: 'Werkstückträger + Ärmelzuführung + Mehrweite (in der Physik-Zelle validiert)' },
    { id: 'aermelR', name: 'Ärmel einsetzen rechts', machine: 'steppstich', seams: [{ len: S.armloch, kmax: 14 }], handling: 11.0, stage: 5, cap: 1, physics: 'aermel' },
    { id: 'saum', name: 'Ärmel- und Saumnaht (Cover)', machine: 'cover', seams: [{ len: S.aermelsaum, kmax: 0 }, { len: S.aermelsaum, kmax: 0 }, { len: DIM.bw * 2, kmax: 0 }, { len: DIM.bw * 2, kmax: 0 }], handling: 12.0, stage: 6, cap: 1 },
    { id: 'falten', name: 'Falten an der Schulter', machine: 'falttisch', seams: [], handling: 7.0, stage: 7, cap: 1 },
    { id: 'seiteL', name: 'Seitennaht links', machine: 'overlock', seams: [{ len: S.seite, kmax: 25 }], handling: 9.0, stage: 8, cap: 1, physics: 'tshirt', note: 'Seite + Achselrundung + Ärmelunterkante in einem Zug (Physik-Zelle: Kurvennaht)' },
    { id: 'seiteR', name: 'Seitennaht rechts', machine: 'overlock', seams: [{ len: S.seite, kmax: 25 }], handling: 9.0, stage: 9, cap: 1, physics: 'tshirt' },
    { id: 'wenden', name: 'Wenden', machine: 'wender', seams: [], handling: 7.5, stage: 10, cap: 1 },
    { id: 'qs', name: 'Fäden kappen & Kameraprüfung', machine: 'pruefung', seams: [], handling: 6.0, stage: 11, cap: 1 },
    { id: 'buegeln', name: 'Bügeln & Falten', machine: 'presse', seams: [], handling: 15.0, stage: 12, cap: 2 },
    { id: 'pack', name: 'Verpacken', machine: 'verpackung', seams: [], handling: 7.0, stage: 13, cap: 1 },
  ];
}

export function defaultLineConfig() {
  return {
    width: 1.5, shirtsPerMarker: 6, layers: 20,
    spreadSpeed: 0.6, spreadTurn: 3.0,          // m/s, s je Lage
    cutSpeed: 0.18, cutOverhead: 25,            // m/s im Stapel, s
    pickTime: 2.6, kitRobots: 2,                // s je Teil (Vereinzeln mit Nadelgreifer)
    carriers: 22, conveyorSpeed: 0.25, pitch: 2.8, carrierLen: 0.7,
    rpmStraight: 4000, rpmCurveMax: 3000, omegaMax: 2.0, // 1/min, rad/s (C-Achse)
    seamOverhead: 0.7,                          // Anlauf, Verriegeln, Fadenabschneiden [s]
    threadBreak: 0.004,                         // Fadenbruch je Naht
    repairTime: 45,
    jitter: 0.05,
    caps: {},                                   // Maschinen je Station (Überschreibung)
  };
}

export class LineSim {
  constructor(cfg = defaultLineConfig()) {
    this.cfg = cfg;
    this.G = buildGarment();
    this.marker = nestMarker(this.G, cfg.width, cfg.shirtsPerMarker);
    this.defs = stationDefs(this.G);
    this.reset();
  }

  rng() { this._s = (this._s * 1664525 + 1013904223) >>> 0; return this._s / 4294967296; }

  // Nähzeit einer Naht und die dafür zulässige Drehzahl
  seamTime(seam) {
    const c = this.cfg, st = DIM.stitch;
    const rpm = seam.kmax > 0 ? Math.min(c.rpmCurveMax, (60 * c.omegaMax) / (seam.kmax * st)) : c.rpmStraight;
    return { t: seam.len / ((rpm / 60) * st) + c.seamOverhead, rpm };
  }

  cycleTime(def) {
    let t = def.handling;
    for (const s of def.seams) t += this.seamTime(s).t;
    return t;
  }

  reset() {
    const c = this.cfg;
    this._s = 12345;
    this.t = 0;
    this.done = 0;
    this.events = [];
    this.flowTimes = [];
    this.outputLog = [];
    // Layout: Hauptstrecke ab s = 0 (Beladeplatz), Stationen im Abstand pitch × Maschinenzahl
    let s = 2.2;
    this.stations = this.defs.map((d) => {
      const cap = c.caps[d.id] ?? d.cap;
      const st = { ...d, cap, s, ct: this.cycleTime(d), slots: Array.from({ length: cap }, () => ({ carrier: null, t: 0, T: 0, phase: 'frei', repair: 0 })), busy: 0, blocked: 0, starved: 0, repair: 0, count: 0 };
      s += c.pitch * Math.max(1, cap * 0.75);
      return st;
    });
    this.mainLen = s + 1.0;
    // Werkstückträger: zu Beginn alle leer in der Rücklaufstrecke bzw. am Beladeplatz
    this.carriers = [];
    for (let k = 0; k < c.carriers; k++) this.carriers.push({ id: k + 1, track: 'ret', s: this.mainLen - k * (c.carrierLen + 0.05), stage: -1, next: 0, shirt: null, wait: 0 });
    this.loadSlot = { carrier: null, t: 0, T: 0 };
    this.lifts = { end: { carrier: null, t: 0 }, start: { carrier: null, t: 0 } };
    // Vorstufe
    this.spreader = { state: 'legen', layer: 0, t: 0, x: 0, dir: 1 };
    this.cutter = { state: 'leer', t: 0, T: 0, progress: 0 };
    this.cutStacks = 0;            // fertige Schnittpakete auf dem Abnahmetisch (Shirts)
    this.stackOnCutter = false;
    this.shirtCounter = 0;
    this.layerTime = this.marker.length / c.spreadSpeed + c.spreadTurn;
    this.cutTime = this.marker.contour / c.cutSpeed + c.cutOverhead;
    this.kitTime = (5 * c.pickTime) / c.kitRobots;
  }

  log(msg, level = 'info') { this.events.push({ t: this.t, msg, level }); if (this.events.length > 200) this.events.shift(); }

  step(dt) {
    const c = this.cfg;
    this.t += dt;
    this._upstream(dt);
    this._kitting(dt);
    this._stations(dt);
    this._conveyor(dt);
    this._returnLine(dt);
  }

  _upstream(dt) {
    const c = this.cfg, sp = this.spreader, cu = this.cutter;
    // Legemaschine: L Lagen hin und her
    if (sp.state === 'legen') {
      sp.t += dt;
      const tl = this.layerTime;
      sp.x = Math.min(1, (sp.t % tl) / (tl - c.spreadTurn));
      if (sp.t >= tl) { sp.t -= tl; sp.layer++; sp.dir *= -1; }
      if (sp.layer >= c.layers) { sp.state = 'fertig'; sp.t = 0; this.log(`Legemaschine: ${c.layers} Lagen gelegt (${(this.marker.length * c.layers).toFixed(1)} m Stoff)`); }
    } else if (sp.state === 'fertig' && cu.state === 'leer') {
      cu.state = 'einziehen'; cu.t = 0; sp.state = 'uebergabe';
    } else if (sp.state === 'uebergabe' && cu.state !== 'einziehen') {
      sp.state = 'legen'; sp.layer = 0; sp.t = 0;
    }
    // Cutter
    if (cu.state === 'einziehen') { cu.t += dt; if (cu.t > 15) { cu.state = 'schneiden'; cu.t = 0; cu.T = this.cutTime; this.log(`Cutter: Zuschnitt von ${c.layers} Lagen × ${c.shirtsPerMarker} Shirts gestartet`); } }
    else if (cu.state === 'schneiden') { cu.t += dt; cu.progress = Math.min(1, cu.t / cu.T); if (cu.t >= cu.T) { cu.state = 'abgabe'; cu.t = 0; } }
    else if (cu.state === 'abgabe') {
      // Abnahmetisch muss leer sein (ein Paket Puffer)
      if (this.cutStacks === 0) { cu.t += dt; if (cu.t > 12) { this.cutStacks = c.layers * c.shirtsPerMarker; this.stackLayers = c.layers; cu.state = 'leer'; cu.progress = 0; this.log(`Schnittpaket mit ${this.cutStacks} Shirts auf dem Abnahmetisch`); } }
    }
  }

  _kitting(dt) {
    const L = this.loadSlot;
    if (L.carrier) {
      if (L.T === 0) {
        if (this.cutStacks > 0) { L.T = this.kitTime * (1 + (this.rng() - 0.5) * this.cfg.jitter); L.t = 0; this.cutStacks--; L.carrier.shirt = ++this.shirtCounter; L.carrier.tStart = this.t; }
        else { this.kitStarved = (this.kitStarved || 0) + dt; return; }
      }
      L.t += dt;
      if (L.t >= L.T) {
        const car = L.carrier;
        car.stage = 0; car.next = 0;
        // auf die Hauptstrecke, wenn der Anfang frei ist
        if (!this.carriers.some((o) => o.track === 'main' && o.s < this.cfg.carrierLen + 0.05)) {
          car.track = 'main'; car.s = 0; L.carrier = null; L.T = 0;
        }
      }
    }
  }

  _stations(dt) {
    const c = this.cfg;
    for (const st of this.stations) {
      let anyBusy = false;
      for (const sl of st.slots) {
        if (!sl.carrier) continue;
        if (sl.repair > 0) { sl.repair -= dt; st.repair += dt / st.cap; sl.phase = 'Fadenbruch'; continue; }
        if (sl.t < sl.T) {
          sl.t += dt; anyBusy = true;
          const f = sl.t / sl.T;
          sl.phase = f < 0.22 ? 'laden' : f < 0.85 ? 'bearbeiten' : 'entladen';
          // Fadenbruch während der Naht
          if (st.seams.length && sl.phase === 'bearbeiten' && !sl.broke && this.rng() < (c.threadBreak * st.seams.length * dt) / (0.63 * sl.T)) {
            sl.broke = true; sl.repair = c.repairTime;
            this.log(`${st.name}: Fadenbruch, automatisches Einfädeln/Störung (${c.repairTime} s)`, 'warn');
          }
          st.busy += dt / st.cap;
        } else {
          // fertig: zurück auf die Strecke, wenn dort Platz ist
          sl.phase = 'wartet auf Abgabe';
          const sx = st.s + this.cfg.carrierLen + 0.25; // Einschleusstelle hinter der Ausschleusstelle
          if (this._gapFree(sx)) {
            const car = sl.carrier;
            car.stage = st.stage; car.next++; car.track = 'main'; car.s = sx; car.wait = 0;
            sl.carrier = null; sl.phase = 'frei'; st.count++;
          } else st.blocked += dt / st.cap;
        }
      }
      if (st.slots.every((sl) => !sl.carrier)) st.starved += dt;
    }
  }

  _gapFree(s) {
    const gap = this.cfg.carrierLen + 0.05;
    return !this.carriers.some((o) => o.track === 'main' && Math.abs(o.s - s) < gap);
  }

  _conveyor(dt) {
    const c = this.cfg, gap = c.carrierLen + 0.05;
    const main = this.carriers.filter((o) => o.track === 'main').sort((a, b) => b.s - a.s);
    let front = Infinity;
    for (const car of main) {
      let target = car.s + c.conveyorSpeed * dt;
      target = Math.min(target, front - gap);
      const st = this.stations[car.next];
      if (st && car.s <= st.s + 1e-6 && target >= st.s) {
        // an der Station: Querumsetzer nimmt den Träger, wenn ein Platz frei ist
        const slot = st.slots.find((sl) => !sl.carrier);
        if (slot) {
          slot.carrier = car; slot.t = 0; slot.broke = false;
          slot.T = st.ct * (1 + (this.rng() - 0.5) * c.jitter);
          car.track = 'station'; car.station = st; car.slot = st.slots.indexOf(slot);
          continue;
        }
        target = st.s; car.wait += dt;
      }
      if (!st && target >= this.mainLen) {
        // Ende: Hubstation nach unten
        if (!this.lifts.end.carrier) { this.lifts.end.carrier = car; this.lifts.end.t = 0; car.track = 'lift'; this._finish(car); continue; }
        target = this.mainLen;
      }
      car.s = Math.max(car.s, target);
      front = car.s;
    }
  }

  _finish(car) {
    this.done++;
    const ft = this.t - (car.tStart ?? this.t);
    this.flowTimes.push(ft); if (this.flowTimes.length > 200) this.flowTimes.shift();
    this.outputLog.push(this.t);
    car.stage = -1; car.next = 0; car.shirt = null;
  }

  _returnLine(dt) {
    const c = this.cfg, gap = c.carrierLen + 0.05;
    const E = this.lifts.end, S = this.lifts.start;
    if (E.carrier) { E.t += dt; if (E.t > 4 && !this.carriers.some((o) => o.track === 'ret' && o.s > this.mainLen - gap)) { E.carrier.track = 'ret'; E.carrier.s = this.mainLen; E.carrier = null; } }
    // Rücklauf läuft von mainLen nach 0
    const ret = this.carriers.filter((o) => o.track === 'ret').sort((a, b) => a.s - b.s);
    let front = -Infinity;
    for (const car of ret) {
      let target = car.s - c.conveyorSpeed * 1.6 * dt;
      target = Math.max(target, front + gap, 0);
      if (target <= 0 && !S.carrier && car === ret[0]) { S.carrier = car; S.t = 0; car.track = 'liftS'; continue; }
      car.s = Math.min(car.s, target);
      front = car.s;
    }
    if (S.carrier) { S.t += dt; if (S.t > 4 && !this.loadSlot.carrier) { this.loadSlot.carrier = S.carrier; S.carrier.track = 'load'; S.carrier.s = -0.9; S.carrier = null; } }
  }

  // Kennzahlen
  kpis() {
    const tw = 600, recent = this.outputLog.filter((t) => t > this.t - tw).length;
    const rate = this.t > 60 ? (recent / Math.min(tw, this.t)) * 3600 : 0;
    const bottleneck = this.stations.reduce((a, s) => (s.ct / s.cap > a.ct / a.cap ? s : a), this.stations[0]);
    const takt = Math.max(bottleneck.ct / bottleneck.cap, this.kitTime, (this.layerTime * this.cfg.layers + 15) / (this.cfg.layers * this.cfg.shirtsPerMarker), this.cutTime / (this.cfg.layers * this.cfg.shirtsPerMarker));
    const ft = this.flowTimes.length ? this.flowTimes.reduce((a, b) => a + b, 0) / this.flowTimes.length : 0;
    const wip = this.carriers.filter((c) => c.shirt !== null).length;
    return { rate, theo: 3600 / takt, takt, bottleneck, done: this.done, flow: ft, wip };
  }
}
