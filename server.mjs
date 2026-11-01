// Minimaler statischer Webserver ohne Abhängigkeiten: node server.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = +(process.argv[2] || process.env.PORT || 8080);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

createServer(async (req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const path = normalize(join(root, url === '/' ? 'index.html' : url));
  if (!path.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch { res.writeHead(404).end('Nicht gefunden'); }
}).listen(port, () => console.log(`Nähzelle: http://localhost:${port}`));
