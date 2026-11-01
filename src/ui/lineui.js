// Bedienung der Produktionsstraße (Konfiguration, Kennzahlen, Kamera).
import { LineSim, defaultLineConfig, STAGES } from '../line/des.js';
import { LineView } from '../line/lineview.js';

const $ = (id) => document.getElementById(id);
const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
const hms = (t) => { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60); return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };

export class LineUI {
  constructor({ onOpenPhysics }) {
    this.cfg = defaultLineConfig();
    this.view = new LineView($('viewport'));
    this.onOpenPhysics = onOpenPhysics;
    this.running = true;
    this.speed = 4;
    this.lastUi = 0; this.lastLog = 0;
    this._bind();
    this.rebuild();
  }

  _bind() {
    const C = this.cfg;
    const fields = [['lnWidth', 'width', 100], ['lnShirts', 'shirtsPerMarker', 1], ['lnLayers', 'layers', 1], ['lnCut', 'cutSpeed', 1], ['lnCarriers', 'carriers', 1], ['lnConv', 'conveyorSpeed', 1], ['lnKit', 'kitRobots', 1], ['lnRpmS', 'rpmStraight', 1], ['lnRpmC', 'rpmCurveMax', 1], ['lnOmega', 'omegaMax', 1]];
    for (const [id, key, sc] of fields) {
      $(id).value = +(C[key] * sc).toFixed(3);
      $(id).onchange = () => { C[key] = +$(id).value / sc; this.rebuild(); };
    }
    $('lineRun').onclick = () => { this.running = !this.running; $('lineRun').textContent = this.running ? 'Pause' : 'Weiter'; };
    $('lineReset').onclick = () => this.rebuild();
    $('lineSpeed').onchange = (e) => { this.speed = +e.target.value; };
    $('lnView').onchange = (e) => this.view.setPreset(e.target.value);
    $('lnLabels').onclick = () => { this.view.showLabels = !this.view.showLabels; $('lnLabels').setAttribute('aria-pressed', String(this.view.showLabels)); };
  }

  rebuild() {
    this.sim = new LineSim(this.cfg);
    this.view.build(this.sim);
    this.lastLog = 0; $('lkLog').innerHTML = '';
    const M = this.sim.marker;
    $('lnMarker').textContent = `Schnittbild ${fmt(M.length * 100, 0)} cm × ${fmt(M.width * 100, 0)} cm, Ausnutzung ${fmt(M.utilization * 100, 0)} %, Schnittkontur ${fmt(M.contour, 1)} m. Ein Stapel = ${this.cfg.layers * this.cfg.shirtsPerMarker} Shirts.`;
    // Stationstabelle
    const rows = this.sim.stations.map((st) => `<tr><td>${st.name}${st.note ? `<span class="note">${st.note}</span>` : ''}</td>
      <td title="Zykluszeit einer Maschine">${fmt(st.ct, 1)} s</td>
      <td><input type="number" min="1" max="3" step="1" value="${st.cap}" data-cap="${st.id}" style="width:48px" aria-label="Maschinen ${st.name}"></td>
      <td>${st.physics ? `<button class="btn small" data-phys="${st.physics}" type="button">Physik</button>` : ''}</td></tr>`).join('');
    $('lnStations').innerHTML = '<colgroup><col><col class="c2"><col class="c3"><col class="c4"></colgroup><tr><th>Station</th><th>Zyklus</th><th>Masch.</th><th></th></tr>' + rows;
    $('lnStations').querySelectorAll('[data-cap]').forEach((inp) => { inp.onchange = () => { this.cfg.caps[inp.dataset.cap] = Math.max(1, Math.min(3, +inp.value)); this.rebuild(); }; });
    $('lnStations').querySelectorAll('[data-phys]').forEach((b) => { b.onclick = () => this.onOpenPhysics(b.dataset.phys); });
    // Kamera-Auswahl
    const opts = [['gesamt', 'Gesamtansicht'], ['zuschnitt', 'Legen und Zuschnitt'], ['kommission', 'Kommissionierung'], ...this.sim.stations.map((s) => [s.id, s.name]), ['follow', 'Werkstückträger verfolgen']];
    $('lnView').innerHTML = opts.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  }

  setVisible(v) { this.view.setVisible(v); }
  setTheme(dark) { this.view.setTheme(dark); }

  tick(real, now) {
    if (this.running) {
      const t0 = performance.now();
      let simDt = real * this.speed;
      while (simDt > 0 && performance.now() - t0 < 20) { const d = Math.min(0.05, simDt); this.sim.step(d); simDt -= d; }
    }
    this.view.update(this.sim, this.sim.t);
    if (now - this.lastUi > 250) { this.lastUi = now; this.renderUi(); }
  }

  renderUi() {
    const s = this.sim, k = s.kpis();
    $('clock').textContent = `t = ${hms(s.t)}`;
    $('lkRate').textContent = s.t > 120 ? fmt(k.rate, 0) : '–';
    $('lkRateSub').textContent = `Stück/h (theoretisch ${fmt(k.theo, 0)})`;
    $('lkDone').textContent = k.done;
    $('lkTime').textContent = `Laufzeit ${hms(s.t)}`;
    $('lkTakt').textContent = `${fmt(k.takt, 1)} s`;
    $('lkBneck').textContent = `Engpass: ${k.bottleneck.name}`;
    $('lkFlow').textContent = k.flow ? `${fmt(k.flow / 60, 1)} min` : '–';
    $('lkWip').textContent = `Umlaufbestand ${k.wip} Shirts`;
    const T = Math.max(1, s.t);
    $('lkUtil').innerHTML = s.stations.map((st) => {
      const b = (st.busy / T) * 100, bl = (st.blocked / T) * 100, r = (st.repair / T) * 100;
      const isB = st === k.bottleneck;
      return `<div class="ubar${isB ? ' bneck' : ''}"><span>${st.name}${st.cap > 1 ? ` (${st.cap}×)` : ''}</span><span class="mono">${fmt(b, 0)} %</span>
        <div class="ub"><i style="width:${b}%;background:var(--good)"></i><i style="width:${bl}%;background:var(--warn)"></i><i style="width:${r}%;background:var(--crit)"></i></div></div>`;
    }).join('');
    const log = $('lkLog');
    if (s.events.length < this.lastLog) this.lastLog = 0;
    for (; this.lastLog < s.events.length; this.lastLog++) {
      const e = s.events[this.lastLog];
      const li = document.createElement('li'); li.className = e.level;
      li.innerHTML = `<time>${hms(e.t)}</time><span></span>`; li.lastChild.textContent = e.msg;
      log.prepend(li);
      while (log.children.length > 60) log.lastChild.remove();
    }
    const rt = $('rtf'); rt.textContent = `${this.speed}× Tempo`; rt.className = 'chip accent';
  }
}
