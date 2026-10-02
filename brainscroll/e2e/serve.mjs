// The e2e web server: static files from the export, plus what a real host does
// for the app's dynamic routes (/invite/CODE serves invite/[code].html, and
// unknown paths fall back to the app's index). Usage: node serve.mjs <dir> <port>
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const [dir, port] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const file = (p) => {
  const f = join(dir, normalize(p).replace(/^(\.\.[/\\])+/, ''));
  return existsSync(f) && statSync(f).isFile() ? f : null;
};
createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  const found = file(path) ?? file(`${path}.html`) ?? file(join(path, 'index.html')) ?? (/^\/invite\/[^/]+$/.test(path) ? file('/invite/[code].html') : null) ?? file('/index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(found)] ?? 'application/octet-stream' });
  res.end(readFileSync(found));
}).listen(Number(port));
