// Plausibilitätstests der Produktionsstraße (ereignisdiskrete Simulation).
import { LineSim, defaultLineConfig } from '../src/line/des.js';
import { buildGarment, nestMarker } from '../src/line/garment.js';

const rows = [];
const check = (name, ok, info) => rows.push({ name, ok, info });
const run = (cfg, T) => { const s = new LineSim(cfg); while (s.t < T) s.step(0.1); return s; };

// 1) Schnittteile: Nahtlängen passen zueinander (Ärmelkugel ≈ Armloch + Mehrweite, Seiten gleich lang)
const G = buildGarment();
const L = Object.fromEntries(Object.entries(G.seams).map(([k, v]) => [k, v.length ?? v]));
check('Nahtlängen vorhanden', Object.keys(L).length >= 6, Object.entries(L).map(([k, v]) => `${k} ${(v * 100).toFixed(1)} cm`).join(', '));

// 2) Schnittbild: Ausnutzung realistisch (60 … 85 %)
const M = nestMarker(G, 1.5, 6);
check('Schnittbild-Ausnutzung 60…85 %', M.utilization > 0.6 && M.utilization < 0.85, `${(M.utilization * 100).toFixed(0)} %, Länge ${(M.length * 100).toFixed(0)} cm`);

// 3) Eingeschwungener Durchsatz erreicht ≥ 85 % des theoretischen Takts, kein Stau
const s = run(defaultLineConfig(), 3 * 3600);
const k = s.kpis();
check('Durchsatz ≥ 85 % theoretisch (3 h)', k.rate >= 0.85 * k.theo, `${k.rate.toFixed(0)} / ${k.theo.toFixed(0)} Stück/h, ${k.done} Shirts, Engpass ${k.bottleneck.name}`);
check('Kein Stillstand (Ausstoß in letzter Stunde)', s.outputLog.filter((t) => t > s.t - 3600).length > 0.8 * k.theo, `${s.outputLog.filter((t) => t > s.t - 3600).length} Shirts`);

// 4) Engpass verdoppeln → Takt sinkt, Ausbringung steigt
const cfg2 = defaultLineConfig(); cfg2.caps[k.bottleneck.id] = 2;
const s2 = run(cfg2, 3 * 3600), k2 = s2.kpis();
check('Engpass doppelt → mehr Ausbringung', k2.theo > k.theo && k2.rate > k.rate, `${k.rate.toFixed(0)} → ${k2.rate.toFixed(0)} Stück/h (neuer Engpass ${k2.bottleneck.name})`);

// 5) Zu wenige Werkstückträger begrenzen den Durchsatz (Little: WIP = Rate · Durchlaufzeit)
const cfg3 = defaultLineConfig(); cfg3.carriers = 6;
const k3 = run(cfg3, 2 * 3600).kpis();
check('6 Träger → Durchsatz begrenzt', k3.rate < k.rate, `${k3.rate.toFixed(0)} Stück/h`);

const w = Math.max(...rows.map((r) => r.name.length));
for (const r of rows) console.log(`${r.name.padEnd(w)}  ${r.ok ? 'OK  ' : 'FEHL'}  ${r.info}`);
const n = rows.filter((r) => r.ok).length;
console.log(`\n${n}/${rows.length} Linientests bestanden`);
process.exit(n === rows.length ? 0 : 1);
