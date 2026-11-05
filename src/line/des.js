// Produktionsstraße T-Shirt: ereignisdiskrete Simulation (zeitgesteuert) des Materialflusses.
//
// Zuschnitt (wählbar):
//   einlagig – Abwickler → Förderband-Cutter schneidet eine Lage → Abnahmeband. Jedes Teil liegt
//              einzeln, das Vereinzeln aus dem Stapel entfällt.
//   stapel   – Legemaschine (L Lagen) → Stapelcutter → Abnahmetisch; Kommissionierroboter
//              vereinzeln mit Nadelgreifern (langsamer, Doppelgriffe).
// Kommissionierung: Roboter legen Vorder-, Rückenteil und Ärmel in Nählage auf einen Klappträger.
// Hauptstrecke: Transfersystem; jede Station holt den Träger in eine Stichstrecke mit getrennter
// Aus- und Einschleusung, bearbeitet ihn und gibt ihn zurück. Leere Träger laufen über
// Hubstationen und die untere Rücklaufstrecke zurück.
//
// Zykluszeiten: Handhabung (Planwert) + Nähzeit aus den Nahtlängen der Schnittteile, Stichlänge
// und Drehzahl. Bei Kurvennähten begrenzt die Drehgeschwindigkeit der Führung (C-Achse) die
// Drehzahl: n ≤ 60·ω_max / (κ_max · Stichlänge). Die Drehzahl kommt aus einer von drei Stufen
// (validiert / Ziel / optimistisch), damit sichtbar bleibt, was nachgewiesen ist und was nicht.
//
// Verfügbarkeit: Fadenbrüche, Handhabungsfehler je Station (Planwerte), Rollenwechsel (Stoff,
// Bündchen) und Ausschuss an der Prüfstation.

import { buildGarment, nestMarker, DIM } from './garment.js';

export const STAGES = [
  'Zuschnitt-Kit', 'Schulter rechts', 'Halsbündchen', 'Schulter links', 'Ärmel links', 'Ärmel rechts',
  'Ärmelsäume', 'Saum', 'Etikett', 'geklappt', 'Seite links', 'Seite rechts', 'geprüft', 'gewendet',
  'gebügelt & gefaltet', 'verpackt',
];

// Drehzahlstufen. „validiert“ nutzt je Naht die in der Nähzelle nachgewiesene Drehzahl.
export const SPEED_PRESETS = {
  validiert: { name: 'in der Nähzelle validiert', rpmStraight: 600, rpmCurveMax: 500, validated: true },
  ziel: { name: 'Entwicklungsziel', rpmStraight: 1500, rpmCurveMax: 1000 },
  optimistisch: { name: 'optimistisch (Industriedrehzahl)', rpmStraight: 4000, rpmCurveMax: 3000 },
};

// Stationsdefinitionen. seams: Länge [m], max. Krümmung [1/m], val = in der Zelle nachgewiesene
// Drehzahl [1/min]. proof: 'zelle' (physikalisch nachgewiesen), 'analog' (Grundfall der Zelle:
// gerade, robotergeführte Naht), 'plan' (Planwert ohne Nachweis). risk: Wahrscheinlichkeit eines
// Handhabungsfehlers je Zyklus (Planwert).
export function stationDefs(G) {
  const S = G.seams;
  return [
    { id: 'schulter1', name: 'Schulternaht rechts', machine: 'overlock', seams: [{ len: S.schulter, kmax: 0, val: 600 }], handling: 6.5, stage: 1, cap: 1, proof: 'analog', risk: 0.005 },
    { id: 'hals', name: 'Halsbündchen (Rolle)', machine: 'overlock', seams: [{ len: S.hals, kmax: 22, val: 400 }], handling: 11.0, stage: 2, cap: 1, physics: 'bund', proof: 'zelle', risk: 0.02, rib: true,
      note: 'Faltapparat hält das Bündchen von der Rolle über der Nadel bereit, Abzug dehnt es um 15 %. Langarm-Maschine, 360°-Umlauf mit Umgreifen (Nadel unten) und Kamera-Neuvermessung. In der Zelle: 116/116 Stiche bei 400 min⁻¹.' },
    { id: 'schulter2', name: 'Schulternaht links', machine: 'overlock', seams: [{ len: S.schulter + 0.036, kmax: 0, val: 600 }], handling: 6.5, stage: 3, cap: 1, proof: 'analog', risk: 0.005 },
    { id: 'aermelL', name: 'Ärmel einsetzen links', machine: 'steppstich', seams: [{ len: S.armloch, kmax: 14, val: 400 }], handling: 13.0, stage: 4, cap: 1, physics: 'aermel', proof: 'zelle', risk: 0.02,
      note: 'Roboter legt den Ärmel auf das Armloch, Ärmelzuführung mit Kamera, Mehrweite über Obertransport. In der Zelle: 83/83 Stiche bei 400 min⁻¹.' },
    { id: 'aermelR', name: 'Ärmel einsetzen rechts', machine: 'steppstich', seams: [{ len: S.armloch, kmax: 14, val: 400 }], handling: 13.0, stage: 5, cap: 1, physics: 'aermel', proof: 'zelle', risk: 0.02 },
    { id: 'saumA', name: 'Ärmelsäume (Cover)', machine: 'cover', seams: [{ len: S.aermelsaum, kmax: 0, val: 600 }, { len: S.aermelsaum, kmax: 0, val: 600 }], handling: 8.0, stage: 6, cap: 1, proof: 'analog', risk: 0.01,
      note: 'Kantenentroller vor dem Saumumleger gegen die Rollkante des Jerseys.' },
    { id: 'saumK', name: 'Saum Vorder- und Rückenteil (Cover)', machine: 'cover', seams: [{ len: S.saum, kmax: 0, val: 600 }, { len: S.saum, kmax: 0, val: 600 }], handling: 9.0, stage: 7, cap: 1, proof: 'analog', risk: 0.01 },
    { id: 'etikett', name: 'Pflegeetikett anheften', machine: 'etikett', seams: [], handling: 6.0, stage: 8, cap: 1, proof: 'plan', risk: 0.005,
      note: 'Etikett vom Band schneiden und falten, mit Heftriegel an den Seitenrand des Rückenteils; die Seitennaht fasst es mit.' },
    { id: 'klappen', name: 'Klappträger schließen', machine: 'klappen', seams: [], handling: 4.5, stage: 9, cap: 1, proof: 'plan', risk: 0.01, noRobot: true,
      note: 'Scharnier klappt die Vorderhälfte samt Nadelleisten auf die Rückenhälfte; Kamera prüft die Kantendeckung.' },
    { id: 'seiteL', name: 'Seitennaht links', machine: 'overlock', seams: [{ len: S.seite, kmax: 25, val: 500 }], handling: 9.0, stage: 10, cap: 1, physics: 'tshirt', proof: 'zelle', risk: 0.015,
      note: 'Geschlossener Klappträger dient als Nähschablone. In der Zelle: Kurvennaht mit Achselrundung bei 500 min⁻¹.' },
    { id: 'seiteR', name: 'Seitennaht rechts', machine: 'overlock', seams: [{ len: S.seite, kmax: 25, val: 500 }], handling: 9.0, stage: 11, cap: 1, physics: 'tshirt', proof: 'zelle', risk: 0.015 },
    { id: 'qs', name: 'Fäden absaugen & Kameraprüfung', machine: 'pruefung', seams: [], handling: 6.0, stage: 12, cap: 1, proof: 'plan', risk: 0.003, reject: 0.015,
      note: 'Vor dem Wenden: die Nähte liegen noch außen und sind für die Kamera sichtbar.' },
    { id: 'wenden', name: 'Wenden auf Formbrett', machine: 'wender', seams: [], handling: 9.0, stage: 13, cap: 1, proof: 'plan', risk: 0.03,
      note: 'Saum direkt vom Träger am Rohrrand klemmen, Unterdruck zieht das Shirt durch, gewendet auf ein Formbrett. Ab hier bleibt die Lage definiert.' },
    { id: 'buegeln', name: 'Dämpfen & Falten', machine: 'presse', seams: [], handling: 15.0, stage: 14, cap: 2, proof: 'plan', risk: 0.01 },
    { id: 'pack', name: 'Verpacken', machine: 'verpackung', seams: [], handling: 7.0, stage: 15, cap: 1, proof: 'plan', risk: 0.005 },
  ];
}

export function defaultLineConfig() {
  return {
    cutMode: 'einlagig',                        // 'einlagig' | 'stapel'
    width: 1.5, shirtsPerMarker: 6, layers: 20,
    spreadSpeed: 0.6, spreadTurn: 3.0,          // Legemaschine: m/s, s je Lage
    cutSpeed: 0.18, cutOverhead: 25,            // Stapelcutter: m/s im Stapel, s
    cutSpeed1: 0.8, feedSpeed: 0.3, beltMarkers: 3, // Förderband-Cutter einlagig: m/s, m/s, Puffer
    rollLen: 100, rollChange: 120,              // Stoffrolle [m], Wechsel [s]
    ribRollLen: 50, ribRollChange: 90,          // Bündchenrolle [m], Wechsel [s]
    pickTime: 1.8,                              // s je Teil vom Abnahmeband (einlagig, Vakuum)
    pickTimeStack: 3.5, doublePick: 0.03, doublePickTime: 8, // Stapel: Nadelgreifer, Doppelgriffe
    kitRobots: 2,
    carriers: 24, conveyorSpeed: 0.25, pitch: 2.8, carrierLen: 0.7,
    speed: 'ziel',                              // Drehzahlstufe (SPEED_PRESETS) oder 'eigen'
    rpmStraight: 1500, rpmCurveMax: 1000, omegaMax: 2.0, // 1/min, rad/s (C-Achse)
    seamOverhead: 0.7,                          // Anlauf, Verriegeln, Fadenabschneiden [s]
    faults: true,                               // Störungen und Ausschuss
    threadBreak: 0.004, repairTime: 45,         // Fadenbruch je Naht, automatisches Einfädeln [s]
    retryTime: 25,                              // Handhabungsfehler: Nachgreifen/Neuvermessen [s]
    jitter: 0.05,
    caps: {},                                   // Maschinen je Station (Überschreibung)
  };
}

export function applySpeedPreset(cfg, name) {
  const p = SPEED_PRESETS[name];
  cfg.speed = p ? name : 'eigen';
  if (p) { cfg.rpmStraight = p.rpmStraight; cfg.rpmCurveMax = p.rpmCurveMax; }
  return cfg;
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
    const validated = c.speed === 'validiert';
    let rpm = seam.kmax > 0 ? Math.min(c.rpmCurveMax, (60 * c.omegaMax) / (seam.kmax * st)) : c.rpmStraight;
    if (validated && seam.val) rpm = Math.min(rpm, seam.val);
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
    this.done = 0; this.rejects = 0; this.faultCount = 0;
    this.events = [];
    this.flowTimes = [];
    this.outputLog = [];
    // Layout: Hauptstrecke ab s = 0 (Beladeplatz), Stationen im Abstand pitch × Maschinenzahl
    let s = 2.2;
    this.stations = this.defs.map((d) => {
      const cap = c.caps[d.id] ?? d.cap;
      const st = { ...d, cap, s, ct: this.cycleTime(d), rpm: d.seams.map((x) => this.seamTime(x).rpm), slots: Array.from({ length: cap }, () => ({ carrier: null, t: 0, T: 0, phase: 'frei', repair: 0 })), busy: 0, blocked: 0, starved: 0, repair: 0, count: 0 };
      s += c.pitch * Math.max(1, cap * 0.75);
      return st;
    });
    this.mainLen = s + 1.0;
    // Werkstückträger: zu Beginn alle leer in der Rücklaufstrecke
    this.carriers = [];
    for (let k = 0; k < c.carriers; k++) this.carriers.push({ id: k + 1, track: 'ret', s: this.mainLen - k * (c.carrierLen + 0.05), stage: -1, next: 0, shirt: null, wait: 0 });
    this.loadSlot = { carrier: null, t: 0, T: 0 };
    this.lifts = { end: { carrier: null, t: 0 }, start: { carrier: null, t: 0 } };
    // Zuschnitt
    this.avail = 0;                // Shirts, deren Teile zum Kommissionieren bereitliegen
    this.belt = [];                // einlagig: Schnittbilder auf dem Abnahmeband { left }
    this.fabricUsed = 0; this.rollPause = 0;
    this.ribUsed = 0;
    this.shirtCounter = 0;
    if (c.cutMode === 'stapel') {
      this.spreader = { state: 'legen', layer: 0, t: 0, x: 0, dir: 1 };
      this.cutter = { state: 'leer', t: 0, T: 0, progress: 0 };
      this.layerTime = this.marker.length / c.spreadSpeed + c.spreadTurn;
      this.cutTime = this.marker.contour / c.cutSpeed + c.cutOverhead;
      this.kitTime = (4 * c.pickTimeStack) / c.kitRobots;
    } else {
      this.cutter = { state: 'vorschub', t: 0, T: 0, progress: 0 };
      this.feedTime = this.marker.length / c.feedSpeed + 2;
      this.cutTime = this.marker.contour / c.cutSpeed1 + 6;
      this.cutter.T = this.feedTime;
      this.kitTime = (4 * c.pickTime) / c.kitRobots;
    }
  }

  log(msg, level = 'info') { this.events.push({ t: this.t, msg, level }); if (this.events.length > 200) this.events.shift(); }

  step(dt) {
    this.t += dt;
    if (this.cfg.cutMode === 'stapel') this._upstreamStack(dt); else this._upstreamSingle(dt);
    this._kitting(dt);
    this._stations(dt);
    this._conveyor(dt);
    this._returnLine(dt);
  }

  // Stoffverbrauch; bei leerer Rolle Wechsel (Pause)
  _useFabric(m) {
    const c = this.cfg;
    this.fabricUsed += m;
    if (c.faults && this.fabricUsed >= c.rollLen) { this.fabricUsed -= c.rollLen; this.rollPause = c.rollChange; this.log(`Stoffrolle leer: Rollenwechsel (${c.rollChange} s)`, 'warn'); }
  }

  _upstreamSingle(dt) {
    const c = this.cfg, cu = this.cutter;
    if (this.rollPause > 0) { this.rollPause -= dt; cu.paused = true; return; }
    cu.paused = false;
    cu.t += dt;
    if (cu.state === 'vorschub') {
      if (cu.t >= cu.T) { cu.state = 'schneiden'; cu.t = 0; cu.T = this.cutTime; this._useFabric(this.marker.length); }
    } else if (cu.state === 'schneiden') {
      cu.progress = Math.min(1, cu.t / cu.T);
      if (cu.t >= cu.T) { cu.state = 'abgabe'; cu.t = 0; cu.T = 3; }
    } else if (cu.state === 'abgabe') {
      // Abnahmeband muss Platz haben
      if (this.belt.length >= c.beltMarkers) { cu.t = 0; return; }
      if (cu.t >= cu.T) {
        this.belt.push({ left: c.shirtsPerMarker });
        this.avail += c.shirtsPerMarker;
        cu.state = 'vorschub'; cu.t = 0; cu.T = this.feedTime; cu.progress = 0;
      }
    }
  }

  _upstreamStack(dt) {
    const c = this.cfg, sp = this.spreader, cu = this.cutter;
    // Legemaschine: L Lagen hin und her
    if (sp.state === 'legen') {
      if (this.rollPause > 0) { this.rollPause -= dt; }
      else {
        sp.t += dt;
        const tl = this.layerTime;
        sp.x = Math.min(1, (sp.t % tl) / (tl - c.spreadTurn));
        if (sp.t >= tl) { sp.t -= tl; sp.layer++; sp.dir *= -1; this._useFabric(this.marker.length); }
        if (sp.layer >= c.layers) { sp.state = 'fertig'; sp.t = 0; this.log(`Legemaschine: ${c.layers} Lagen gelegt (${(this.marker.length * c.layers).toFixed(1)} m Stoff)`); }
      }
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
      if (this.avail === 0) { cu.t += dt; if (cu.t > 12) { this.avail = c.layers * c.shirtsPerMarker; this.stackLayers = c.layers; cu.state = 'leer'; cu.progress = 0; this.log(`Schnittpaket mit ${this.avail} Shirts auf dem Abnahmetisch`); } }
    }
  }

  _kitting(dt) {
    const L = this.loadSlot, c = this.cfg;
    if (!L.carrier) return;
    if (L.T === 0) {
      if (this.avail > 0) {
        L.T = this.kitTime * (1 + (this.rng() - 0.5) * c.jitter); L.t = 0;
        // Stapel: Doppelgriffe erkennen (Dicke/Gewicht) und zurücklegen
        if (c.cutMode === 'stapel' && c.faults) for (let k = 0; k < 4; k++) if (this.rng() < c.doublePick) { L.T += c.doublePickTime / c.kitRobots; this.log('Kommissionierung: Doppelgriff erkannt, Lage zurückgelegt', 'warn'); }
        this.avail--;
        if (c.cutMode !== 'stapel' && this.belt.length) { this.belt[0].left--; if (this.belt[0].left <= 0) this.belt.shift(); }
        L.carrier.shirt = ++this.shirtCounter; L.carrier.tStart = this.t;
      } else { this.kitStarved = (this.kitStarved || 0) + dt; return; }
    }
    L.t += dt;
    if (L.t >= L.T) {
      const car = L.carrier;
      car.stage = 0; car.next = 0;
      // auf die Hauptstrecke, wenn der Anfang frei ist
      if (!this.carriers.some((o) => o.track === 'main' && o.s < c.carrierLen + 0.05)) {
        car.track = 'main'; car.s = 0; L.carrier = null; L.T = 0;
      }
    }
  }

  _stations(dt) {
    const c = this.cfg;
    for (const st of this.stations) {
      for (const sl of st.slots) {
        if (!sl.carrier) continue;
        if (sl.repair > 0) { sl.repair -= dt; st.repair += dt / st.cap; sl.phase = sl.fault || 'Störung'; continue; }
        if (sl.t < sl.T) {
          sl.t += dt;
          const f = sl.t / sl.T;
          sl.phase = f < 0.22 ? 'laden' : f < 0.85 ? 'bearbeiten' : 'entladen';
          if (c.faults) {
            // Fadenbruch während der Naht
            if (st.seams.length && sl.phase === 'bearbeiten' && !sl.broke && this.rng() < (c.threadBreak * st.seams.length * dt) / (0.63 * sl.T)) {
              sl.broke = true; sl.repair = c.repairTime; sl.fault = 'Fadenbruch'; this.faultCount++;
              this.log(`${st.name}: Fadenbruch, automatisches Einfädeln (${c.repairTime} s)`, 'warn');
            }
            // Handhabungsfehler (Greifer verliert Lage, Kamera findet Kante nicht …)
            if (sl.failAt !== undefined && f >= sl.failAt) {
              sl.failAt = undefined; sl.repair = c.retryTime; sl.fault = 'Handhabungsfehler'; this.faultCount++;
              this.log(`${st.name}: Handhabungsfehler, Nachgreifen und Neuvermessen (${c.retryTime} s)`, 'warn');
            }
          }
          st.busy += dt / st.cap;
        } else {
          // fertig: zurück auf die Strecke, wenn dort Platz ist
          sl.phase = 'wartet auf Abgabe';
          const sx = st.s + c.carrierLen + 0.25; // Einschleusstelle hinter der Ausschleusstelle
          if (this._gapFree(sx)) {
            const car = sl.carrier;
            car.stage = st.stage; car.next++; car.track = 'main'; car.s = sx; car.wait = 0;
            sl.carrier = null; sl.phase = 'frei'; st.count++;
            // Prüfstation: Ausschuss geht in die Nacharbeit, der Träger läuft leer weiter
            if (st.reject && c.faults && this.rng() < st.reject) {
              this.rejects++; car.shirt = null; car.stage = -1; car.next = this.stations.length; car.rejected = true;
              this.log(`${st.name}: Fehler erkannt (Nahtfehler/Loch), Shirt in die Nacharbeit`, 'crit');
            }
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

  _startCycle(st, slot, car) {
    const c = this.cfg;
    slot.carrier = car; slot.t = 0; slot.broke = false; slot.fault = null;
    slot.T = st.ct * (1 + (this.rng() - 0.5) * c.jitter);
    slot.failAt = c.faults && this.rng() < st.risk ? 0.1 + 0.8 * this.rng() : undefined;
    // Bündchen von der Rolle: Verbrauch, Rollenwechsel
    if (st.rib && c.faults) {
      this.ribUsed += this.G.ribL;
      if (this.ribUsed >= c.ribRollLen) { this.ribUsed -= c.ribRollLen; slot.repair = c.ribRollChange; slot.fault = 'Bündchenrolle wechseln'; this.log(`${st.name}: Bündchenrolle leer, Wechsel (${c.ribRollChange} s)`, 'warn'); }
    }
    car.track = 'station'; car.station = st; car.slot = st.slots.indexOf(slot);
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
        if (slot) { this._startCycle(st, slot, car); continue; }
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
    if (!car.rejected && car.shirt !== null) {
      this.done++;
      const ft = this.t - (car.tStart ?? this.t);
      this.flowTimes.push(ft); if (this.flowTimes.length > 200) this.flowTimes.shift();
      this.outputLog.push(this.t);
    }
    car.stage = -1; car.next = 0; car.shirt = null; car.rejected = false;
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

  // Zuschnitt je Shirt (Engpass-Kandidat)
  cutPerShirt() {
    const c = this.cfg;
    if (c.cutMode === 'stapel') return Math.max((this.layerTime * c.layers + 15) / (c.layers * c.shirtsPerMarker), this.cutTime / (c.layers * c.shirtsPerMarker));
    return (this.feedTime + this.cutTime + 3) / c.shirtsPerMarker;
  }

  // Kennzahlen
  kpis() {
    const tw = 600, recent = this.outputLog.filter((t) => t > this.t - tw).length;
    const rate = this.t > 60 ? (recent / Math.min(tw, this.t)) * 3600 : 0;
    const bottleneck = this.stations.reduce((a, s) => (s.ct / s.cap > a.ct / a.cap ? s : a), this.stations[0]);
    const takt = Math.max(bottleneck.ct / bottleneck.cap, this.kitTime, this.cutPerShirt());
    const ft = this.flowTimes.length ? this.flowTimes.reduce((a, b) => a + b, 0) / this.flowTimes.length : 0;
    const wip = this.carriers.filter((c) => c.shirt !== null).length;
    const started = this.done + this.rejects;
    return { rate, theo: 3600 / takt, takt, bottleneck, done: this.done, flow: ft, wip, rejects: this.rejects, rejectRate: started ? this.rejects / started : 0, faults: this.faultCount };
  }
}
