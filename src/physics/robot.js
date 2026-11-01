// Kartesischer Portalroboter (X, Y, Z, Drehachse C) mit ruckbegrenzungsfreiem
// Trapez-Geschwindigkeitsprofil und einer einfachen Ablaufsprache.
//
// Befehle (eine Anweisung je Zeile, Kommentare mit # oder ;):
//   SPEED v            max. Bahngeschwindigkeit [m/s]
//   ACCEL a            max. Bahnbeschleunigung [m/s²]
//   MOVE x y z [c°]    absolute Zielposition der Greiferfläche [m], Drehung [°]
//   MOVEREL dx dy dz [dc°]
//   TOUCH [v]          senkrecht absenken bis Kontakt (Tastsensor), v [m/s]
//   GRIP ON|OFF [1,2…] Greiferelemente (alle oder Auswahl)
//   WAIT t             warten [s]
//   FOOT UP|DOWN       Nähfuß heben/senken
//   TABLEVAC ON|OFF    Saugtisch im Nähbereich
//   SEW L [rpm] [mm] [SYNC]  Naht starten (läuft parallel weiter); SYNC koppelt den
//                      Greifer an die Transporteurbewegung (synchrones Mitführen)
//   WAITSEW            warten, bis die Naht fertig ist
//   HOME               Grundstellung

export const ROT_WEIGHT = 0.2; // m je rad für die Bahnlänge

export function parseProgram(text) {
  const lines = text.split(/\r?\n/);
  const out = [];
  lines.forEach((raw, i) => {
    const line = raw.replace(/[#;].*$/, '').trim();
    if (!line) return;
    const parts = line.split(/[\s]+/);
    const cmd = parts[0].toUpperCase();
    const nums = parts.slice(1).map((s) => s.replace(',', '.'));
    out.push({ line: i, cmd, args: parts.slice(1), nums: nums.map(Number), raw: line });
  });
  return out;
}

const KNOWN = new Set(['SPEED', 'ACCEL', 'MOVE', 'MOVEREL', 'TOUCH', 'GRIP', 'WAIT', 'FOOT', 'SEW', 'WAITSEW', 'HOME', 'TABLEVAC']);

export function validateProgram(prog) {
  const errs = [];
  for (const p of prog) {
    if (!KNOWN.has(p.cmd)) errs.push(`Zeile ${p.line + 1}: unbekannter Befehl „${p.cmd}“`);
    if ((p.cmd === 'MOVE' || p.cmd === 'MOVEREL') && (p.nums.length < 3 || p.nums.slice(0, 3).some(Number.isNaN)))
      errs.push(`Zeile ${p.line + 1}: ${p.cmd} braucht drei Zahlen`);
  }
  return errs;
}

export class GantryRobot {
  constructor({ home = { x: 0, y: 1.15, z: 0.05, yaw: 0 }, limits } = {}) {
    this.home = { ...home };
    this.pose = { ...home };
    this.vmax = 0.5; this.amax = 2.0;
    this.limits = limits || { x: [-0.95, 1.05], y: [0.78, 1.5], z: [-0.4, 0.45] };
    this.reset();
  }

  reset() {
    this.pose = { ...this.home };
    this.vmax = 0.5; this.amax = 2.0;
    this.prog = [];
    this.pc = 0;
    this.running = false;
    this.seg = null;
    this.waitUntil = 0;
    this.current = null;
    this.speed = 0;
    this.follow = false;
  }

  load(text) {
    this.prog = parseProgram(text);
    this.pc = 0; this.seg = null; this.current = null;
    return validateProgram(this.prog);
  }

  start() { if (this.pc >= this.prog.length) this.pc = 0; this.running = true; }
  stop() { this.running = false; }

  _clamp(p) {
    const L = this.limits;
    p.x = Math.min(L.x[1], Math.max(L.x[0], p.x));
    p.y = Math.min(L.y[1], Math.max(L.y[0], p.y));
    p.z = Math.min(L.z[1], Math.max(L.z[0], p.z));
    return p;
  }

  moveTo(target, t) {
    const a = { ...this.pose }, b = this._clamp({ ...target });
    const D = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z, (b.yaw - a.yaw) * ROT_WEIGHT);
    const v = this.vmax, ac = this.amax;
    let ta, tc, vp;
    if (D < 1e-9) { this.seg = { a, b, t0: t, T: 0, D, ta: 0, tc: 0, vp: 0 }; return; }
    if (D > (v * v) / ac) { ta = v / ac; tc = (D - v * ta) / v; vp = v; }
    else { ta = Math.sqrt(D / ac); tc = 0; vp = ac * ta; }
    this.seg = { a, b, t0: t, T: 2 * ta + tc, D, ta, tc, vp, ac };
  }

  _segPose(seg, t) {
    const tau = Math.min(seg.T, Math.max(0, t - seg.t0));
    let s, v;
    const { ta, tc, vp, ac, D } = seg;
    if (seg.T === 0) { s = 0; v = 0; }
    else if (tau < ta) { s = 0.5 * ac * tau * tau; v = ac * tau; }
    else if (tau < ta + tc) { s = 0.5 * ac * ta * ta + vp * (tau - ta); v = vp; }
    else { const r = seg.T - tau; s = D - 0.5 * ac * r * r; v = ac * r; }
    const f = seg.D > 0 ? s / seg.D : 1;
    const { a, b } = seg;
    return { pose: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, yaw: a.yaw + (b.yaw - a.yaw) * f }, v };
  }

  // ctx: { head, machine, contact(): bool, log(msg) }
  update(t, dt, ctx) {
    // synchrones Mitführen mit dem Transporteur
    if (this.follow) {
      if (ctx.machine.sewing) {
        const v = ctx.machine.feedVelocity(), d = ctx.machine.feedDir;
        this.pose = { ...this.pose, x: this.pose.x + d[0] * v * dt, z: this.pose.z + d[2] * v * dt };
        this.speed = v;
      } else this.follow = false;
    }
    // laufende Bewegung
    if (this.seg) {
      if (this.seg.touch) {
        const step = this.seg.v * dt;
        if (ctx.contact() || this.pose.y - step < this.limits.y[0] || this.seg.travel > 0.3) {
          this.seg = null; this.speed = 0;
        } else { this.pose.y -= step; this.seg.travel += step; this.speed = this.seg.v; }
      } else {
        const r = this._segPose(this.seg, t);
        this.pose = r.pose; this.speed = r.v;
        if (t - this.seg.t0 >= this.seg.T) { this.pose = { ...this.seg.b }; this.seg = null; this.speed = 0; }
      }
      if (this.seg) return;
    }
    if (!this.running) return;
    if (t < this.waitUntil) return;
    if (this.current && this.current.cmd === 'WAITSEW' && ctx.machine.busy) return;
    // nächste Anweisung
    while (this.running && !this.seg && t >= this.waitUntil) {
      if (this.pc >= this.prog.length) { this.running = false; this.current = null; ctx.log?.('Programm beendet'); return; }
      const ins = this.prog[this.pc++];
      this.current = ins;
      const n = ins.nums;
      switch (ins.cmd) {
        case 'SPEED': this.vmax = Math.max(0.001, n[0]); break;
        case 'ACCEL': this.amax = Math.max(0.01, n[0]); break;
        case 'MOVE': this.moveTo({ x: n[0], y: n[1], z: n[2], yaw: Number.isFinite(n[3]) ? (n[3] * Math.PI) / 180 : this.pose.yaw }, t); break;
        case 'MOVEREL': this.moveTo({ x: this.pose.x + n[0], y: this.pose.y + n[1], z: this.pose.z + n[2], yaw: this.pose.yaw + (Number.isFinite(n[3]) ? (n[3] * Math.PI) / 180 : 0) }, t); break;
        case 'HOME': this.moveTo(this.home, t); break;
        case 'TOUCH': this.seg = { touch: true, v: Number.isFinite(n[0]) ? n[0] : 0.02, travel: 0 }; break;
        case 'WAIT': this.waitUntil = t + (n[0] || 0); break;
        case 'GRIP': {
          const on = (ins.args[0] || '').toUpperCase() === 'ON';
          const sel = ins.args[1] ? ins.args.slice(1).join(',').split(',').map((s) => parseInt(s, 10) - 1).filter((x) => x >= 0) : null;
          ctx.head.setActive(sel, on);
          ctx.log?.(`Greifer ${on ? 'EIN' : 'AUS'}${sel ? ' (' + sel.map((s) => s + 1).join(',') + ')' : ''}`);
          break;
        }
        case 'FOOT': ctx.machine.footUp = (ins.args[0] || '').toUpperCase() === 'UP'; break;
        case 'TABLEVAC':
          if (ctx.machine.tableVac) ctx.machine.tableVac.on = (ins.args[0] || '').toUpperCase() === 'ON';
          ctx.log?.(`Saugtisch ${ctx.machine.tableVac?.on ? 'EIN' : 'AUS'}`);
          break;
        case 'SEW':
          ctx.machine.startSew(n[0] || 0.1, Number.isFinite(n[1]) ? n[1] : undefined, Number.isFinite(n[2]) ? n[2] : undefined);
          this.follow = ins.args.some((a) => a.toUpperCase() === 'SYNC');
          ctx.log?.(`Nähen ${((n[0] || 0.1) * 100).toFixed(1)} cm`);
          break;
        case 'WAITSEW': if (ctx.machine.busy) return; break;
        default: break;
      }
    }
  }
}
