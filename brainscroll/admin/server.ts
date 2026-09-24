/**
 * BrainScroll Content Admin v1: an internal, local-only tool.
 *
 *   npm run admin            # http://127.0.0.1:4321
 *   ADMIN_PORT=5000 npm run admin
 *
 * It reads and writes content/ directly (no database, no credentials). Commit
 * the resulting JSON like any other change; `npm run check` stays the gate.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, type StoreOptions } from './lib/store';

const here = dirname(fileURLToPath(import.meta.url));
const STATIC: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/admin.js': ['admin.js', 'text/javascript; charset=utf-8'],
  '/admin.css': ['admin.css', 'text/css; charset=utf-8'],
};
const MAX_BODY = 2 * 1024 * 1024;

export function createAdminServer(options: StoreOptions): Server {
  const store = createStore(options);

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };

  const readBody = (req: IncomingMessage) =>
    new Promise<string>((resolve, reject) => {
      let size = 0;
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => {
        size += c.length;
        if (size > MAX_BODY) reject(new Error('body too large'));
        else chunks.push(c);
      });
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      req.on('error', reject);
    });

  return createServer(async (req, res) => {
    try {
      // Local-only tool: refuse other hosts (DNS rebinding) and cross-site writes.
      const host = (req.headers.host ?? '').replace(/:\d+$/, '');
      if (host !== '127.0.0.1' && host !== 'localhost') return send(res, 403, { error: 'admin is local-only' });
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (req.method === 'GET' && STATIC[url.pathname]) {
        const [file, type] = STATIC[url.pathname]!;
        res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
        return res.end(readFileSync(join(here, 'public', file)));
      }
      if (req.method === 'GET' && url.pathname === '/api/content') return send(res, 200, store.snapshot());
      if (req.method === 'GET' && url.pathname === '/api/validate') return send(res, 200, { issues: store.validate() });
      if (req.method === 'GET' && url.pathname === '/api/insights') return send(res, 200, store.insights());

      const m = /^\/api\/levels\/([^/]+)\/(\d{3})$/.exec(url.pathname);
      if (req.method === 'PUT' && m) {
        if (req.headers['x-brainscroll-admin'] !== '1' || !(req.headers['content-type'] ?? '').startsWith('application/json'))
          return send(res, 403, { error: 'missing admin header or JSON content type' });
        let data: unknown;
        try {
          data = JSON.parse(await readBody(req));
        } catch (e) {
          return send(res, 400, { error: `invalid JSON: ${(e as Error).message}` });
        }
        const r = store.saveLevel(m[1]!, m[2]!, data);
        return r.ok ? send(res, 200, { ok: true, issues: r.issues }) : send(res, r.status, { ok: false, error: r.error, issues: r.issues ?? [] });
      }
      send(res, 404, { error: 'not found' });
    } catch (e) {
      send(res, 500, { error: (e as Error).message });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const repo = join(here, '..');
  const port = Number(process.env.ADMIN_PORT ?? 4321);
  createAdminServer({
    contentRoot: process.env.CONTENT_ROOT ?? join(repo, 'content'),
    bundlePath: join(repo, 'app', 'src', 'content', 'bundle.json'),
    insightsPath: process.env.INSIGHTS_PATH ?? join(here, '.data', 'insights.json'),
  }).listen(
    port,
    '127.0.0.1',
    () => console.log(`BrainScroll Content Admin → http://127.0.0.1:${port}`),
  );
}
