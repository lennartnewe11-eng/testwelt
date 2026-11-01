// Baut eine eigenständige HTML-Datei (alle eigenen Module eingebettet, Three.js vom CDN).
//   node scripts/build-single.mjs [ausgabe.html] [--fragment]
// --fragment: ohne <!doctype>/<html>/<head>/<body> (für Hosting-Umgebungen, die das Gerüst selbst liefern)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const fragment = args.includes('--fragment');
const out = resolve(root, args.find((a) => !a.startsWith('--')) || 'dist/naehzelle.html');

const ORDER = [
  'src/physics/constants.js', 'src/physics/materials.js', 'src/physics/cloth.js', 'src/physics/colliders.js',
  'src/physics/collision.js', 'src/physics/grippers.js', 'src/physics/sewing.js', 'src/physics/robot.js', 'src/physics/garments.js',
  'src/physics/world.js', 'src/physics/validation.js', 'src/render/textures.js', 'src/render/scene.js',
  'src/ui/chart.js', 'src/ui/modelinfo.js', 'src/ui/app.js',
];
const key = (p) => '__M_' + p.replace(/^src\//, '').replace(/\.js$/, '').replace(/[^a-zA-Z0-9]/g, '_');

let bundle = "import * as THREE from 'three';\n";
const hoisted = new Set();
for (const file of ORDER) {
  let code = await readFile(join(root, file), 'utf8');
  const exports = [];
  code = code.replace(/^import\s+\*\s+as\s+THREE\s+from\s+'three';\s*$/m, '');
  code = code.replace(/^import\s+\{[^}]*\}\s+from\s+'three\/addons\/[^']+';\s*$/gm, (line) => { hoisted.add(line.trim()); return ''; });
  code = code.replace(/^import\s+\{([^}]*)\}\s+from\s+'([^']+)';\s*$/gm, (_, names, from) => {
    const target = join(dirname(file), from).replace(/\\/g, '/');
    if (!ORDER.includes(target)) throw new Error(`Unbekannter Import ${from} in ${file}`);
    const list = names.split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': '));
    return `const { ${list.join(', ')} } = ${key(target)};`;
  });
  code = code.replace(/^export\s+(const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm, (_, kind, name) => { exports.push(name); return `${kind} ${name}`; });
  if (/^\s*export\s/m.test(code)) throw new Error(`Nicht unterstützter Export in ${file}`);
  if (/^\s*import\s/m.test(code)) throw new Error(`Nicht unterstützter Import in ${file}`);
  bundle += `\n// ---- ${file} ----\nconst ${key(file)} = (() => {\n${code}\nreturn { ${exports.join(', ')} };\n})();\n`;
}

bundle = [...hoisted].join('\n') + '\n' + bundle;
const html = await readFile(join(root, 'index.html'), 'utf8');
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/, '')
  .replace(/<meta name="viewport"[^>]*>\s*/, '');
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1]
  .replace(/<script type="module" src="[^"]+"><\/script>\s*/, '');
const script = `<script type="module">\n${bundle}\n</script>\n`;
const doc = fragment
  ? `${head.trim()}\n${body.trim()}\n${script}`
  : `<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n${head.trim()}\n</head>\n<body>\n${body.trim()}\n${script}</body>\n</html>\n`;
await mkdir(dirname(out), { recursive: true });
await writeFile(out, doc);
console.log(`geschrieben: ${out} (${(doc.length / 1024).toFixed(0)} KB)`);
