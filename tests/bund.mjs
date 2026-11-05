// Regressionstest Halsbündchen: ganzes Programm (≈ 1 min Rechenzeit), Qualitätsgrenzen.
import { World, defaultConfig, applyScenario } from '../src/physics/world.js';

const cfg = defaultConfig(); applyScenario(cfg, 'bund'); cfg.spacing = 0.015; cfg.substeps = 14; // Qualität „Standard“
const w = new World(cfg); w.robot.start();
while (w.t < 60 && (w.robot.running || w.machine.busy)) w.step(1 / 60);
const M = w.machine, dev = M.deviations, ds = M.devSleeve.filter(Number.isFinite), et = M.easeTrack;
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const stretch = (et.at(-1).pb - et[0].pb) / (et.at(-1).ps - et[0].ps) - 1;
const lost = w.events.some((e) => e.level === 'error');
const rows = [
  ['kein Teil verloren', !lost, lost ? w.events.filter((e) => e.level === 'error').map((e) => e.msg).join('; ') : 'ok'],
  ['Stiche durch beide Lagen ≥ 110', ds.length >= 110, `${ds.length} von ${M.stitchPoints.length}`],
  ['Körpernaht Ø < 1,5 mm', mean(dev) < 0.0015, `Ø ${(mean(dev) * 1000).toFixed(2)} mm, max ${(Math.max(...dev) * 1000).toFixed(2)} mm`],
  ['Bündchennaht Ø < 0,5 mm', mean(ds) < 0.0005, `Ø ${(mean(ds) * 1000).toFixed(2)} mm, max ${(Math.max(...ds) * 1000).toFixed(2)} mm`],
  ['Dehnung 12 … 19 %', stretch > 0.12 && stretch < 0.19, `${(stretch * 100).toFixed(1)} % (Soll 15 %)`],
];
for (const [n, ok, info] of rows) console.log(`${n.padEnd(32)} ${ok ? 'OK  ' : 'FEHL'} ${info}`);
const n = rows.filter((r) => r[1]).length;
console.log(`\n${n}/${rows.length} Prüfungen Halsbündchen bestanden`);
process.exit(n === rows.length ? 0 : 1);
