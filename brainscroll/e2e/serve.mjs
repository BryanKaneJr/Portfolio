// The e2e web server: static files from the export, plus what a real host does
// for the app's dynamic routes: /level/ID serves level/[id].html (any
// `[param].html` the export has for that place), and unknown paths fall back
// to the app's index. Serving index.html for a dynamic route would hand React
// the home page's HTML to hydrate a level, a hydration mismatch (React #418).
// Usage: node serve.mjs <dir> <port>
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';

const [dir, port] = process.argv.slice(2);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };
const file = (p) => {
  const f = join(dir, normalize(p).replace(/^(\.\.[/\\])+/, ''));
  return existsSync(f) && statSync(f).isFile() ? f : null;
};
/** A dynamic route's page: each segment as a folder (or, last, a page), else the folder's `[param]` one. */
function dynamic(path) {
  const segments = path.split('/').filter(Boolean);
  let at = dir;
  for (let i = 0; i < segments.length; i++) {
    const last = i === segments.length - 1;
    const entries = (() => {
      try {
        return readdirSync(at);
      } catch {
        return [];
      }
    })();
    const seg = segments[i];
    if (last) {
      const page = entries.includes(`${seg}.html`) ? `${seg}.html` : entries.find((e) => /^\[[^\]]+\]\.html$/.test(e));
      return page ? join(at, page) : null;
    }
    const folder = entries.includes(seg) ? seg : entries.find((e) => /^\[[^\]]+\]$/.test(e));
    if (!folder) return null;
    at = join(at, folder);
  }
  return null;
}
createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  const found = file(path) ?? file(`${path}.html`) ?? file(join(path, 'index.html')) ?? dynamic(path) ?? file('/index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(found)] ?? 'application/octet-stream' });
  res.end(readFileSync(found));
}).listen(Number(port));
