// Validierung: node tests/validate.mjs
import { runValidation } from '../src/physics/validation.js';

const t0 = performance.now();
const rows = runValidation();
const f = (x) => (x === null || x === undefined ? '–' : Math.abs(x) >= 100 ? x.toFixed(1) : x.toPrecision(4));
console.log('Test'.padEnd(58), 'Simulation'.padStart(11), 'Referenz'.padStart(11), 'Abw.'.padStart(8), '  Ergebnis');
for (const r of rows) {
  console.log(r.name.padEnd(58), `${f(r.sim)} ${r.unit}`.padStart(11), `${f(r.ref)} ${r.unit}`.padStart(11), (r.dev === null ? '–' : r.dev.toFixed(1) + ' %').padStart(8), r.ok ? '  OK' : '  ABWEICHUNG', r.note ? `  (${r.note})` : '');
}
const bad = rows.filter((r) => !r.ok).length;
console.log(`\n${rows.length - bad}/${rows.length} Tests innerhalb der Toleranz (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
process.exitCode = bad ? 1 : 0;
