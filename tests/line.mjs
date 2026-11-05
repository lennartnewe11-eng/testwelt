// Plausibilitätstests der Produktionsstraße (ereignisdiskrete Simulation).
import { LineSim, defaultLineConfig, applySpeedPreset } from '../src/line/des.js';
import { buildGarment, nestMarker } from '../src/line/garment.js';

const rows = [];
const check = (name, ok, info) => rows.push({ name, ok, info });
const cfgOf = (over = {}) => Object.assign(defaultLineConfig(), over);
const run = (cfg, T) => { const s = new LineSim(cfg); while (s.t < T) s.step(0.1); return s; };
const lastHour = (s) => s.outputLog.filter((t) => t > s.t - 3600).length;

// 1) Schnittteile: Nahtlängen vorhanden
const G = buildGarment();
check('Nahtlängen vorhanden', Object.keys(G.seams).length >= 6, Object.entries(G.seams).map(([k, v]) => `${k} ${(v * 100).toFixed(1)} cm`).join(', '));

// 2) Schnittbild ohne Bündchen (kommt von der Rolle): Ausnutzung realistisch (60 … 85 %)
const M = nestMarker(G, 1.5, 6);
check('Schnittbild-Ausnutzung 60…85 %', M.utilization > 0.6 && M.utilization < 0.85 && !M.parts.some((p) => p.name === 'Bündchen'), `${(M.utilization * 100).toFixed(0)} %, Länge ${(M.length * 100).toFixed(0)} cm, ohne Bündchen`);

// 3) Ohne Störungen erreicht die Linie ≥ 90 % des Takts (kein Stau), in beiden Zuschnittverfahren
for (const cutMode of ['einlagig', 'stapel']) {
  const s = run(cfgOf({ cutMode, faults: false }), 3 * 3600), k = s.kpis();
  check(`Ohne Störungen ≥ 90 % des Takts (${cutMode})`, lastHour(s) >= 0.9 * k.theo, `${lastHour(s)} / ${k.theo.toFixed(0)} Shirts in der letzten Stunde, Engpass ${k.bottleneck.name}`);
}

// 4) Mit Störungen: Verfügbarkeit einer Reihenlinie 70 … 97 %, Ausschuss an der Prüfstation
const sF = run(cfgOf(), 4 * 3600), kF = sF.kpis();
const avail = lastHour(sF) / kF.theo;
check('Störungen senken die Ausbringung auf 70…97 %', avail > 0.7 && avail < 0.97, `${lastHour(sF)} von ${kF.theo.toFixed(0)} (${(avail * 100).toFixed(0)} %), ${kF.faults} Störungen, ${kF.rejects} Shirts Nacharbeit`);

// 5) Drehzahlstufen: validiert < Ziel < optimistisch
const theo = Object.fromEntries(['validiert', 'ziel', 'optimistisch'].map((p) => [p, new LineSim(applySpeedPreset(defaultLineConfig(), p)).kpis().theo]));
check('Drehzahlstufen geordnet', theo.validiert < theo.ziel && theo.ziel < theo.optimistisch, Object.entries(theo).map(([k, v]) => `${k} ${v.toFixed(0)}/h`).join(', '));

// 6) Engpass doppelt → mehr Ausbringung
// (Stufe „validiert“: dort liegt der Engpass deutlich vor der nächsten Station)
const V = (over) => applySpeedPreset(cfgOf({ faults: false, ...over }), 'validiert');
const s1 = run(V({}), 3 * 3600), k1 = s1.kpis();
const s2 = run(V({ caps: { [k1.bottleneck.id]: 2 } }), 3 * 3600), k2 = s2.kpis();
check('Engpass doppelt → mehr Ausbringung', k2.theo > k1.theo && lastHour(s2) > lastHour(s1), `${lastHour(s1)} → ${lastHour(s2)} Shirts/h (neuer Engpass ${k2.bottleneck.name})`);

// 7) Zu wenige Werkstückträger begrenzen den Durchsatz (Little: WIP = Rate · Durchlaufzeit)
const s0 = run(cfgOf({ faults: false }), 2 * 3600), s3 = run(cfgOf({ faults: false, carriers: 6 }), 2 * 3600);
check('6 Träger → Durchsatz begrenzt', lastHour(s3) < 0.6 * lastHour(s0), `${lastHour(s3)} Shirts/h`);

const w = Math.max(...rows.map((r) => r.name.length));
for (const r of rows) console.log(`${r.name.padEnd(w)}  ${r.ok ? 'OK  ' : 'FEHL'}  ${r.info}`);
const n = rows.filter((r) => r.ok).length;
console.log(`\n${n}/${rows.length} Linientests bestanden`);
process.exit(n === rows.length ? 0 : 1);
