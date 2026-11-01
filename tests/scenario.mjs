// Führt das Standardprogramm headless aus und protokolliert Ereignisse.
import { World, defaultConfig, applyScenario } from '../src/physics/world.js';

const cfg = defaultConfig();
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
if (args.scenario) applyScenario(cfg, args.scenario);
if (args.fabric) cfg.fabricId = args.fabric;
if (args.gripper) cfg.gripper = args.gripper, cfg.gripperParams = {};
if (args.plies) cfg.plies = +args.plies;
const until = +(args.t || 60);
const w = new World(cfg);
w.robot.start();
const fdt = 1 / 60;
const t0 = performance.now();
let lastEv = 0, frames = 0;
while (w.t < until && (w.robot.running || w.machine.busy || w.t < 1)) {
  w.step(fdt); frames++;
  for (; lastEv < w.events.length; lastEv++) {
    const e = w.events[lastEv];
    console.log(`${e.t.toFixed(2).padStart(6)} s  [${e.level}] ${e.msg}`);
  }
  if (frames % 120 === 0 && args.v) {
    const r = w.robot.pose;
    console.log(`   t=${w.t.toFixed(1)} pose=(${r.x.toFixed(3)},${r.y.toFixed(4)},${r.z.toFixed(3)}) line=${w.robot.current?.raw} contacts=${w.contacts.n}`);
  }
}
const ms = performance.now() - t0;
const dev = w.machine.deviations || [];
const ds = (w.machine.devSleeve || []).filter(Number.isFinite);
if (ds.length) console.log(`Ärmelnaht: Mittel ${(ds.reduce((a, b) => a + b, 0) / ds.length * 1000).toFixed(2)} mm, max ${(Math.max(...ds) * 1000).toFixed(2)} mm, ${ds.length}/${(w.machine.devSleeve || []).length} Stiche im Ärmel`);
if (dev.length) console.log(`Nahtabweichung: Mittel ${(dev.reduce((a, b) => a + b, 0) / dev.length * 1000).toFixed(2)} mm, max ${(Math.max(...dev) * 1000).toFixed(2)} mm über ${dev.length} Stiche`);
console.log(`\nSimzeit ${w.t.toFixed(2)} s in ${(ms / 1000).toFixed(1)} s Rechenzeit (${(ms / frames).toFixed(1)} ms/Bild), Stiche ${w.machine.stitchPoints.length}`);
for (const r of w.plyReport()) {
  const e = r.error;
  console.log(`${r.name.padEnd(8)} ${r.state.padEnd(10)} x=${r.pose.x.toFixed(3)} z=${r.pose.z.toFixed(3)} θ=${(r.pose.theta * 180 / Math.PI).toFixed(2)}°  ε=${(r.strain * 100).toFixed(2)}%  σy=${(r.wav * 1000).toFixed(2)}mm` + (e ? `  Fehler dx=${(e.dx * 1000).toFixed(1)}mm dz=${(e.dz * 1000).toFixed(1)}mm dθ=${(e.dth * 180 / Math.PI).toFixed(2)}°` : ''));
}
