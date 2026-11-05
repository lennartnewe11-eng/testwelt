// Bedienoberfläche: verbindet Simulation, 3D-Ansicht und Messwerte.
import { World, defaultConfig, SCENARIOS, applyScenario, programFor } from '../physics/world.js';
import { FABRICS, FABRIC_FIELDS, SOLIDS, fabricById, toSI, bendingLength } from '../physics/materials.js';
import { GRIPPER_TYPES, defaultParams, capacityModel } from '../physics/grippers.js';
import { validateProgram, parseProgram } from '../physics/robot.js';
import { runValidation } from '../physics/validation.js';
import { G, AIR } from '../physics/constants.js';
import { SceneView } from '../render/scene.js';
import { LoadChart } from './chart.js';
import { MODEL_INFO } from './modelinfo.js';
import { LineUI } from './lineui.js';

const $ = (id) => document.getElementById(id);
const fmt = (x, d = 2) => (Number.isFinite(x) ? x.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–');
const QUALITY = { fast: { spacing: 0.02, substeps: 10 }, std: { spacing: 0.0125, substeps: 16 }, fine: { spacing: 0.01, substeps: 24 } };
// große Teile (T-Shirt): gröberes Netz bei gleicher Stufe, damit die Rechenzeit vergleichbar bleibt
const QUALITY_LARGE = { fast: { spacing: 0.022, substeps: 10 }, std: { spacing: 0.015, substeps: 14 }, fine: { spacing: 0.011, substeps: 20 } };

const cfg = defaultConfig();
cfg.quality = 'std';
let world, view, chart, lineUi = null;
let mode = 'zelle';
let running = true;           // Physik läuft (auch ohne Programm)
let timeScale = 1;
let acc = 0, last = performance.now(), rtf = 1, lastUi = 0;
const csvRows = [];

// ---------------------------------------------------------------- Aufbau ----
function currentFabric() { return cfg.customFabric || fabricById(cfg.fabricId); }

let rebuildTimer = 0;
// Aufbau geändert: Welt neu aufbauen und das Programm wieder starten
function setupChanged() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => { rebuild(); startProgram(); }, 350);
}

function buildSetupUI() {
  const sc = $('scenario');
  sc.innerHTML = Object.entries(SCENARIOS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
  sc.value = cfg.scenario;
  $('scenarioNote').textContent = cfg.scenario === 'bund'
    ? 'Halsbündchen (1×1-Rippe, doppelt) wird um 15 % gedehnt an den Halsausschnitt genäht. Der Körper liegt auf einem Werkstückträger mit Ausschnitt; der Abzug der Bündchenzuführung läuft um 1/1,15 langsamer als der Körper. Langarm-Maschine, 360°-Umlauf mit einmaligem Umgreifen in der Nahtmitte.'
    : cfg.scenario === 'aermel'
    ? 'Separater Ärmel wird flach in das Armloch eingenäht. Der Körper (Schulternähte geschlossen, aufgeklappt) liegt auf einem Werkstückträger, den der Roboter entlang des Armlochs führt. Die Ärmelzuführung führt den Ärmel gegenläufig und mit 2 % Mehrweite; Obertransport, Trennblech und Kantensensor arbeiten mit.'
    : cfg.scenario === 'tshirt'
    ? 'Vorder- und Rückenteil eines Kinder-T-Shirts (Kimonoschnitt). Eine Nähschablone klemmt beide Teile, der Roboter führt die Seitennaht mit Achselrundung und Ärmelunternaht in einem Zug.'
    : 'Stapel rechteckiger Zuschnitte: vereinzeln, ablegen, zwei Lagen gerade zusammennähen.';
  sc.onchange = () => {
    applyScenario(cfg, sc.value);
    cfg.customFabric = null;
    $('program').value = cfg.program; renderGutter();
    buildSetupUI();
    setupChanged();
  };
  const sel = $('fabric');
  sel.innerHTML = FABRICS.map((f) => `<option value="${f.id}">${f.name}</option>`).join('');
  sel.value = cfg.fabricId;
  sel.onchange = () => { cfg.fabricId = sel.value; cfg.customFabric = null; renderMaterial(); renderPredict(); setupChanged(); };
  $('tableMat').innerHTML = ['hpl', 'stahl', 'ptfe', 'buche', 'gummi'].map((k) => `<option value="${k}">${SOLIDS[k].name}</option>`).join('');
  $('tableMat').value = cfg.tableMaterial;
  const g = $('gripper');
  g.innerHTML = Object.entries(GRIPPER_TYPES).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
  g.value = cfg.gripper;
  g.onchange = () => { cfg.gripper = g.value; cfg.gripperParams = defaultParams(g.value); renderGripper(); renderPredict(); setupChanged(); };
  for (const [id, key, scale] of [['plies', 'plies', 1], ['plyW', 'plyW', 100], ['plyL', 'plyL', 100], ['rows', 'rows', 1], ['cols', 'cols', 1], ['rpm', 'rpm', 1], ['stitch', 'stitch', 1], ['footForce', 'footForce', 1], ['threadTension', 'threadTension', 1], ['servoKv', 'servoKv', 1], ['servoFF', 'servoFF', 100]]) {
    $(id).value = +(cfg[key] * scale).toFixed(3);
    $(id).onchange = () => { cfg[key] = +$(id).value / scale; renderPredict(); setupChanged(); };
  }
  $('footMat').value = cfg.footMaterial;
  $('quality').value = cfg.quality;
  $('selfColl').checked = cfg.selfCollision;
  $('airCushion').checked = cfg.airCushion !== false;
  $('selfColl').onchange = $('airCushion').onchange = $('quality').onchange = $('tableMat').onchange = $('footMat').onchange = () => setupChanged();
  renderMaterial();
  renderGripper();
  renderPredict();
}

function renderMaterial() {
  const f = currentFabric();
  $('fabricMeta').textContent = `${f.composition} · ${f.construction}`;
  $('matTable').innerHTML = FABRIC_FIELDS.map(([k, label, unit]) => `<tr><td>${label}</td><td><input type="number" step="any" data-key="${k}" value="${f[k]}" aria-label="${label}"></td><td class="unit">${unit}</td></tr>`).join('');
  $('matTable').querySelectorAll('input').forEach((inp) => {
    inp.onchange = () => {
      const base = currentFabric();
      cfg.customFabric = { ...base, [inp.dataset.key]: +inp.value, name: base.name.replace(/ \(angepasst\)$/, '') + ' (angepasst)' };
      renderDerived(); renderPredict(); setupChanged();
    };
  });
  renderDerived();
}

function renderDerived() {
  const f = currentFabric(), m = toSI(f);
  const vt = Math.sqrt((2 * m.rho * G) / (AIR.density * 1.17));
  const mass = m.rho * (cfg.scenario === 'tshirt' ? 0.155 : cfg.plyW * cfg.plyL) * 1000;
  $('derived').innerHTML = [
    ['Biegelänge Kette / Schuss', `${fmt(bendingLength(f, 'warp') * 100, 1)} / ${fmt(bendingLength(f, 'weft') * 100, 1)}`, 'cm'],
    ['Masse je Zuschnitt', fmt(mass, 1), 'g'],
    ['Sinkgeschwindigkeit flach', fmt(vt, 2), 'm/s'],
    ['Dehnung bei 10 N/m (K / S)', `${fmt((10 / m.Tw) * 100, 2)} / ${fmt((10 / m.Tf) * 100, 2)}`, '%'],
  ].map(([a, b, u]) => `<tr><td>${a}</td><td class="mono">${b}</td><td class="unit">${u}</td></tr>`).join('');
}

function renderGripper() {
  const def = GRIPPER_TYPES[cfg.gripper];
  $('gripperNote').textContent = def.note;
  const box = $('gripperParams');
  box.innerHTML = def.params.map(([k, label, unit, , min, max, step]) => `
    <div class="slider"><label for="gp-${k}">${label} <b><span id="gpv-${k}">${cfg.gripperParams[k]}</span> ${unit}</b></label>
    <input type="range" id="gp-${k}" min="${min}" max="${max}" step="${step}" value="${cfg.gripperParams[k]}">
    <input type="number" id="gpn-${k}" min="${min}" max="${max}" step="${step}" value="${cfg.gripperParams[k]}" aria-label="${label}"></div>`).join('');
  for (const [k] of def.params) {
    const set = (v) => { cfg.gripperParams[k] = +v; $(`gp-${k}`).value = v; $(`gpn-${k}`).value = v; $(`gpv-${k}`).textContent = v; renderPredict(); };
    $(`gp-${k}`).onchange = () => setupChanged();
    $(`gp-${k}`).oninput = (e) => set(e.target.value);
    $(`gpn-${k}`).onchange = (e) => { set(e.target.value); setupChanged(); };
  }
}

// Vorhersage aus dem Haltekraftmodell (ohne Dynamik): reicht die Kraft für Lage 1, nicht für Lage 2?
function renderPredict() {
  const f = currentFabric(), m = toSI(f);
  const col = [0, 1, 2].map((k) => ({ m, depthTop: k * m.t }));
  const p = { ...defaultParams(cfg.gripper), ...cfg.gripperParams };
  const caps = capacityModel(cfg.gripper, p, col, 1);
  const nEl = cfg.rows * cfg.cols;
  const weight = (m.rho * G * cfg.plyW * cfg.plyL) / nEl;            // Gewicht je Element
  const cling = (m.cohesion * cfg.plyW * cfg.plyL) / nEl;            // Lagenhaftung je Element
  const need = weight + cling;
  let chip;
  const want = cfg.pickPlies || 1;
  if (cfg.gripper === 'schablone') chip = '<span class="chip accent">flächige Klemmung</span>';
  else if (cfg.gripper === 'traeger') chip = '<span class="chip accent">Werkstückträger</span>';
  else if (caps[0].Cn < 1.5 * need) chip = '<span class="chip crit">Haltekraft zu gering</span>';
  else if (want >= 2 && caps[1].Cn > need && caps[2].Cn < need) chip = '<span class="chip good">zwei Lagen wie gewollt</span>';
  else if (caps[1].Cn > need) chip = '<span class="chip warn">Doppelgriff-Risiko</span>';
  else chip = '<span class="chip good">Einzelgriff erwartet</span>';
  $('predict').innerHTML = `<div class="head"><strong>Statische Abschätzung je Element</strong>${chip}</div>
    <table class="kv">
      <tr><td>Haltekraft Lage 1 / 2 / 3</td><td class="mono">${caps.map((c) => fmt(c.Cn, 3)).join(' / ')}</td><td class="unit">N</td></tr>
      <tr><td>Bedarf (Gewicht + Lagenhaftung)</td><td class="mono">${fmt(weight, 3)} + ${fmt(cling, 3)}</td><td class="unit">N</td></tr>
      ${caps.chamber ? `<tr><td>Unterdruck in der Saugkammer</td><td class="mono">${fmt(caps.chamber / 1000, 1)}</td><td class="unit">kPa</td></tr>` : ''}
    </table><p class="note">Dynamische Lasten (Beschleunigung, Luft, Abschälen) zeigt die Simulation.</p>`;
}

function readSetup() {
  cfg.tableMaterial = $('tableMat').value;
  cfg.footMaterial = $('footMat').value;
  cfg.quality = $('quality').value;
  Object.assign(cfg, (['tshirt', 'aermel', 'bund'].includes(cfg.scenario) ? QUALITY_LARGE : QUALITY)[cfg.quality]);
  cfg.selfCollision = $('selfColl').checked;
  cfg.airCushion = $('airCushion').checked;
  cfg.program = $('program').value;
}

// ---------------------------------------------------------------- Programm --
function renderGutter() {
  const n = $('program').value.split('\n').length;
  $('gutter').innerHTML = Array.from({ length: n }, (_, i) => i + 1).join('<br>');
  $('gutter').scrollTop = $('program').scrollTop;
  const errs = validateProgram(parseProgram($('program').value));
  $('progErr').textContent = errs.join(' · ');
  $('progErr').style.color = errs.length ? 'var(--crit)' : '';
}
function highlightLine(line) {
  const hl = $('hl'), ta = $('program');
  if (line === null || line === undefined) { hl.style.display = 'none'; return; }
  hl.style.display = 'block';
  hl.style.top = `${8 + line * 18 - ta.scrollTop}px`;
}

function startProgram() {
  cfg.program = $('program').value;
  const errs = world.robot.load(cfg.program);
  if (errs.length) { $('progErr').textContent = errs.join(' · '); return; }
  world.robot.start();
  running = true;
  $('btnPause').textContent = 'Pause';
}

// ---------------------------------------------------------------- Welt ------
function rebuild() {
  readSetup();
  world = new World(cfg);
  view.build(world);
  view.setColorMode(view.colorMode);
  chart.reset();
  csvRows.length = 0;
  $('log').innerHTML = '';
  lastLog = 0;
  buildHeadGrid();
  renderUi(true);
}

function buildHeadGrid() {
  const hg = $('headgrid');
  hg.style.gridTemplateColumns = `repeat(${cfg.cols}, minmax(0, 1fr))`;
  // Draufsicht: z wächst zum Bediener; Reihen von hinten (oben) nach vorne
  hg.innerHTML = world.head.elements.map((el) => `<div class="el" id="el-${el.index}"><div class="t"><span>G${el.index + 1}</span><span class="n" id="eln-${el.index}">aus</span></div><div class="meter"><i id="elm-${el.index}"></i></div><div class="n" id="elf-${el.index}">–</div></div>`).join('');
}

let lastLog = 0;
function renderUi(force = false) {
  const now = performance.now();
  if (!force && now - lastUi < 120) return;
  lastUi = now;
  const w = world;
  $('clock').textContent = `t = ${fmt(w.t, 2)} s`;
  const r = $('rtf');
  r.textContent = `${fmt(rtf, 2)}× Echtzeit`;
  r.className = 'chip ' + (rtf > 0.9 * Math.min(1, timeScale) ? 'good' : rtf > 0.4 * Math.min(1, timeScale) ? 'accent' : 'warn');
  const cur = w.robot.current;
  $('progNow').textContent = w.robot.running ? `Zeile ${cur ? cur.line + 1 : '–'}: ${cur ? cur.raw : ''}` : (w.machine.busy ? 'Nähen …' : 'Programm bereit');
  highlightLine(w.robot.running && cur ? cur.line : null);

  // Greiferelemente
  const st = w.head.status();
  let maxU = 0;
  const heldIds = new Set();
  for (const s of st) {
    const held = s.plies.filter((p) => p.held > 0);
    held.forEach((p) => heldIds.add(p.cloth.id));
    let u = 0;
    for (const p of held) u = Math.max(u, p.Cn > 0 ? Math.hypot(p.Fn / p.Cn, p.Ft / Math.max(p.Ct, 1e-9)) : 0);
    maxU = Math.max(maxU, u);
    const el = $(`el-${s.index}`);
    if (!el) continue;
    el.className = 'el' + (s.on ? ' on' : '') + (u > 0.8 ? ' hot' : '') + (held.length > 1 ? ' double' : '');
    $(`eln-${s.index}`).textContent = s.on ? (held.length ? `${held.length} Lage${held.length > 1 ? 'n' : ''}` : 'ein') : s.act > 0.02 ? 'löst' : 'aus';
    $(`elm-${s.index}`).style.width = `${Math.min(100, u * 100)}%`;
    const top = held[0];
    $(`elf-${s.index}`).textContent = top ? `${fmt(top.Fn, 3)} / ${fmt(top.Cn, 3)} N` : (w.head.type === 'vakuum' && s.on ? `${fmt(s.chamber / 1000, 1)} kPa` : '–');
  }
  $('kHeld').textContent = heldIds.size;
  const want = w.cfg.pickPlies || 1;
  $('kHeldSub').innerHTML = heldIds.size > want ? '<span class="chip crit">Doppelgriff</span>' : heldIds.size === want ? `<span class="chip good">${want > 1 ? want + ' Lagen, gewollt' : 'Einzelgriff'}</span>` : heldIds.size ? `<span class="chip warn">${heldIds.size} von ${want}</span>` : 'keine';
  $('kUtil').textContent = heldIds.size ? `${fmt(maxU * 100, 0)} %` : '–';

  // Lagen
  const rep = w.plyReport();
  let lastPlaced = null;
  $('plyTable').innerHTML = '<tr><th>Lage</th><th>Zustand</th><th>Δx</th><th>Δz</th><th>Δθ</th><th>Dehnung</th><th>σ<sub>y</sub></th></tr>' + rep.map((p) => {
    const cls = p.state === 'verloren' ? 'crit' : p.state === 'gegriffen' ? 'accent' : p.state === 'abgelegt' || p.state === 'angenäht' ? 'good' : '';
    const e = p.error;
    if (e && p.state === 'abgelegt') lastPlaced = p;
    const lim = w.cfg.limitLoad / Math.min(p.cloth.m.Tw, p.cloth.m.Tf);
    const atLim = p.strain > 0.95 * lim;
    return `<tr><td>${p.name}</td><td><span class="chip ${cls}">${p.state}</span></td>
      <td>${e ? fmt(e.dx * 1000, 1) : '–'}</td><td>${e ? fmt(e.dz * 1000, 1) : '–'}</td><td>${e ? fmt((e.dth * 180) / Math.PI, 1) + '°' : '–'}</td>
      <td title="${atLim ? 'an der Dehnungsbegrenzung (Linienlast ≥ ' + w.cfg.limitLoad + ' N/m oder numerische Auflösung)' : ''}">${fmt(p.strain * 100, 2)} %</td><td>${fmt(p.wav * 1000, 1)}</td></tr>`;
  }).join('');
  $('kErr').textContent = lastPlaced ? `${fmt(Math.hypot(lastPlaced.error.dx, lastPlaced.error.dz) * 1000, 1)} mm` : '–';
  $('kErrSub').textContent = lastPlaced ? `${lastPlaced.name}, Δθ ${fmt((lastPlaced.error.dth * 180) / Math.PI, 1)}°` : 'letzte abgelegte Lage';
  $('kStitch').textContent = w.machine.stitchPoints.length;
  $('kStitchSub').textContent = w.machine.busy ? `läuft, ${w.machine.stitches}/${w.machine.sewTarget}` : w.machine.stitchPoints.length ? `${fmt((w.machine.stitchPoints.length * w.machine.stitchLength) / 10, 1)} cm genäht` : 'Naht –';

  const dev = w.machine.deviations || [];
  if (dev.length) {
    const mean = dev.reduce((a, b) => a + b, 0) / dev.length, mx = Math.max(...dev);
    $('kDev').textContent = `${fmt(mean * 1000, 1)} mm`;
    $('kDevSub').innerHTML = `max. ${fmt(mx * 1000, 1)} mm ` + (mx < 0.003 ? '<span class="chip good">i. O.</span>' : mx < 0.006 ? '<span class="chip warn">grenzwertig</span>' : '<span class="chip crit">n. i. O.</span>');
  } else { $('kDev').textContent = '–'; $('kDevSub').textContent = w.machine.activePath ? 'erste Stiche …' : 'nur bei Bahnnaht (SEWPATH)'; }
  const E = w.machine.edge;
  $('kSleeveBox').hidden = $('kEaseBox').hidden = !E;
  if (E) {
    const ds = (w.machine.devSleeve || []).filter(Number.isFinite), miss = (w.machine.devSleeve || []).length - ds.length;
    if (ds.length) {
      const mean = ds.reduce((a, b) => a + b, 0) / ds.length, mx = Math.max(...ds);
      $('kSleeve').textContent = `${fmt(mean * 1000, 1)} mm`;
      $('kSleeveSub').innerHTML = `max. ${fmt(mx * 1000, 1)} mm` + (miss ? ` · <span class="chip crit">${miss} Stiche verfehlt</span>` : mx < 0.003 ? ' <span class="chip good">i. O.</span>' : ' <span class="chip warn">grenzwertig</span>');
    } else { $('kSleeve').textContent = '–'; $('kSleeveSub').textContent = E.err !== null ? `Kantensensor ${fmt(E.err * 1000, 1)} mm` : (E.profile === 'const' ? 'Einstich ↔ Bündchennaht' : 'Einstich ↔ Kugelnaht'); }
    const et = w.machine.easeTrack || [];
    const rib = E.profile === 'const';
    $('kSleeveLbl').textContent = rib ? 'Bündchennaht' : 'Ärmelnaht';
    $('kEaseLbl').textContent = rib ? 'Bündchendehnung' : 'Mehrweite';
    if (et.length > 3) {
      const a = et[0], b = et[et.length - 1];
      if (rib) {
        // Dehnung: genähte Körperlänge / eingenähte Bündchenlänge − 1
        const st = (b.pb - a.pb) / Math.max(1e-6, b.ps - a.ps) - 1, soll = 1 / (1 + E.ease) - 1;
        $('kEase').textContent = `${fmt(st * 100, 1)} %`;
        $('kEaseSub').textContent = `Soll ${fmt(soll * 100, 1)} % · Körper ${fmt((b.pb - a.pb) * 100, 1)} cm / Bündchen ${fmt((b.ps - a.ps) * 100, 1)} cm`;
      } else {
        const ez = (b.ps - a.ps) / Math.max(1e-6, b.pb - a.pb) - 1;
        $('kEase').textContent = `${fmt(ez * 100, 1)} %`;
        $('kEaseSub').textContent = `Soll ${fmt(E.ease * 100, 1)} % · ${fmt((b.ps - b.pb) * 1000, 1)} mm eingehalten`;
      }
    } else { $('kEase').textContent = '–'; $('kEaseSub').textContent = rib ? `Soll ${fmt((1 / (1 + E.ease) - 1) * 100, 1)} % (Bündchen kürzer als Ausschnitt)` : `Soll ${fmt(E.ease * 100, 1)} % (Kugel länger als Armloch)`; }
  }
  const rp = w.robot.pose;
  $('kPose').textContent = `${fmt(((rp.yaw * 180) / Math.PI), 0)}°`;
  $('kPoseSub').textContent = `x ${fmt(rp.x, 3)} · z ${fmt(rp.z, 3)} m`;

  // Ereignisse
  if (w.events.length < lastLog) lastLog = 0;
  const log = $('log');
  for (; lastLog < w.events.length; lastLog++) {
    const e = w.events[lastLog];
    const li = document.createElement('li');
    li.className = e.level;
    li.innerHTML = `<time>${fmt(e.t, 2)} s</time><span></span>`;
    li.lastChild.textContent = e.msg;
    log.prepend(li);
  }
  chart.draw();
}

function sample() {
  const w = world;
  // Summen über alle Elemente für die oberste gehaltene Lage; Auslastung = max. je Element
  let Fn = 0, Cn = 0, util = 0;
  for (const s of w.head.status()) {
    const top = s.plies.find((p) => p.held > 0);
    if (top) { Fn += top.Fn; Cn += top.Cn; }
    for (const p of s.plies) if (p.held > 0 && p.Cn > 0) util = Math.max(util, Math.hypot(p.Fn / p.Cn, p.Ft / Math.max(p.Ct, 1e-9)));
  }
  chart.push(w.t, util * 100, 100);
  if (csvRows.length < 200000) {
    const rp = w.robot.pose;
    const plies = w.plyReport().map((p) => `${p.state};${p.pose.x.toFixed(5)};${p.pose.z.toFixed(5)};${(p.pose.theta * 180 / Math.PI).toFixed(3)};${(p.strain * 100).toFixed(4)}`).join(';');
    csvRows.push(`${w.t.toFixed(4)};${rp.x.toFixed(5)};${rp.y.toFixed(5)};${rp.z.toFixed(5)};${Fn.toFixed(5)};${Cn.toFixed(5)};${plies}`);
  }
}

// ---------------------------------------------------------------- Schleife --
const FRAME = 1 / 60;
let sampleAcc = 0;
function loop(now) {
  const real = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (mode === 'linie') { lineUi.tick(real, now); requestAnimationFrame(loop); return; }
  if (running) {
    const t0 = performance.now();
    acc += timeScale >= 4 ? 1e9 : real * timeScale;
    let steps = 0, simAdv = 0;
    const budget = timeScale >= 4 ? 40 : 28; // ms Rechenzeit je Bild
    while (acc >= FRAME && performance.now() - t0 < budget) {
      world.step(FRAME);
      acc -= FRAME; steps++; simAdv += FRAME;
      sampleAcc += FRAME;
      if (sampleAcc >= 0.05) { sampleAcc = 0; sample(); }
    }
    if (acc > 4 * FRAME) acc = 0; // Rückstand verwerfen (Rechenleistung reicht nicht)
    if (real > 0) rtf = rtf * 0.9 + 0.1 * (simAdv / real);
  } else rtf = 0;
  view.update(world);
  renderUi();
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- Dialoge ---
function showValidation() {
  const dlg = $('dlg');
  $('dlgTitle').textContent = 'Validierung des Physikmodells';
  $('dlgBody').innerHTML = '<p>Die Tests laufen (ca. 5–10 s) …</p>';
  dlg.showModal();
  setTimeout(() => {
    const rows = runValidation();
    const ok = rows.filter((r) => r.ok).length;
    $('dlgBody').innerHTML = `<p>${ok} von ${rows.length} Prüfungen liegen innerhalb der Toleranz. Jede Prüfung vergleicht den Solver mit einer analytischen Lösung oder einer Normprüfung.</p>
    <div class="tablewrap"><table><tr><th>Prüfung</th><th>Simulation</th><th>Referenz</th><th>Abw.</th><th></th></tr>
    ${rows.map((r) => `<tr><td>${r.name}<br><span class="note">${r.note || ''}</span></td><td class="num">${fmt(r.sim, 3)} ${r.unit}</td><td class="num">${fmt(r.ref, 3)} ${r.unit}</td><td class="num">${r.dev === null ? '–' : fmt(r.dev, 1) + ' %'}</td><td><span class="chip ${r.ok ? 'good' : 'crit'}">${r.ok ? 'OK' : 'Abweichung'}</span></td></tr>`).join('')}
    </table></div>`;
  }, 50);
}

// ---------------------------------------------------------------- Ansicht ---
function setMode(m) {
  mode = m;
  const line = m === 'linie';
  document.querySelectorAll('#modeSeg button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  for (const [id, show] of [['cellLeft', !line], ['cellRight', !line], ['cellOverlay', !line], ['cellControls', !line], ['lineLeft', line], ['lineRight', line], ['lineOverlay', line]]) $(id).hidden = !show;
  $('progNow').hidden = line;
  view.renderer.domElement.style.display = line ? 'none' : 'block';
  lineUi.setVisible(line);
  if (!line) view.resize();
  try { history.replaceState(null, '', line ? '#linie' : location.pathname + location.search); } catch { /* egal */ }
}

// ---------------------------------------------------------------- Start -----
function init() {
  view = new SceneView($('viewport'));
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const applyTheme = () => {
    const t = document.documentElement.dataset.theme;
    view.setTheme(t ? t === 'dark' : mq.matches);
    lineUi?.setTheme(t ? t === 'dark' : mq.matches);
  };
  applyTheme();
  mq.addEventListener?.('change', applyTheme);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  chart = new LoadChart($('chart'), $('tip'));
  $('program').value = cfg.program;
  renderGutter();
  $('program').addEventListener('input', renderGutter);
  $('program').addEventListener('scroll', () => { $('gutter').scrollTop = $('program').scrollTop; });
  $('modelInfo').innerHTML = MODEL_INFO;
  buildSetupUI();

  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('.pane').forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.tab; });
  }));
  $('views').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $('views').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    view.setView(b.dataset.view);
  });
  $('colorModes').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $('colorModes').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    view.setColorMode(b.dataset.color);
  });
  $('btnContacts').onclick = () => { view.showContacts = !view.showContacts; $('btnContacts').setAttribute('aria-pressed', String(view.showContacts)); };
  $('btnRun').onclick = startProgram;
  $('btnRun2').onclick = startProgram;
  $('btnStop').onclick = () => world.robot.stop();
  $('btnPause').onclick = () => { running = !running; $('btnPause').textContent = running ? 'Pause' : 'Weiter'; };
  $('btnReset').onclick = rebuild;
  $('btnApply').onclick = () => { rebuild(); startProgram(); };
  $('btnDefault').onclick = () => { $('program').value = programFor(cfg.scenario); renderGutter(); };
  $('timeScale').onchange = (e) => { timeScale = +e.target.value; };
  $('btnValidate').onclick = showValidation;
  $('dlgClose').onclick = () => $('dlg').close();
  document.querySelectorAll('[data-jog]').forEach((b) => b.addEventListener('click', () => {
    if (world.robot.running) return;
    const [dx, dy, dz] = b.dataset.jog.split(',').map(Number);
    const p = world.robot.pose;
    world.robot.vmax = 0.2; world.robot.amax = 1;
    world.robot.moveTo({ x: p.x + dx, y: p.y + dy, z: p.z + dz, yaw: p.yaw }, world.t);
  }));
  $('jogTouch').onclick = () => { if (!world.robot.running) world.robot.seg = { touch: true, v: 0.01, travel: 0 }; };
  $('jogGrip').onclick = () => { const on = !world.head.elements.some((e) => e.on); world.head.setActive(null, on); world.log(`Greifer ${on ? 'EIN' : 'AUS'} (Hand)`); };
  $('jogHome').onclick = () => { if (!world.robot.running) { world.robot.vmax = 0.3; world.robot.moveTo(world.robot.home, world.t); } };
  $('btnCsv').onclick = async () => {
    const head = 't_s;robot_x;robot_y;robot_z;Fn_N;Cn_N;' + world.plyReport().map((p) => `${p.name}_zustand;${p.name}_x;${p.name}_z;${p.name}_theta_grad;${p.name}_dehnung_proz`).join(';');
    const text = [head, ...csvRows].join('\n');
    try { await navigator.clipboard.writeText(text); $('btnCsv').textContent = `${csvRows.length} Zeilen kopiert`; }
    catch { $('btnCsv').textContent = 'Kopieren nicht erlaubt'; }
    setTimeout(() => { $('btnCsv').textContent = 'Messdaten als CSV kopieren'; }, 2500);
  };

  rebuild();
  // Beispiel sofort starten, damit die Zelle beim Öffnen arbeitet
  startProgram();

  // Produktionsstraße
  lineUi = new LineUI({ onOpenPhysics: (sc) => { setMode('zelle'); $('scenario').value = sc; $('scenario').onchange(); } });
  applyTheme();
  $('modeSeg').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setMode(b.dataset.mode); });
  try { if (location.hash === '#linie') setMode('linie'); } catch { /* ohne Hash */ }
  requestAnimationFrame(loop);
}

init();
window.__sim = { get world() { return world; }, get view() { return view; }, get line() { return lineUi; }, rebuild, startProgram, setMode };
