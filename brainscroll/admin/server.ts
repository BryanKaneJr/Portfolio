/**
 * BrainScroll Content Admin v1: an internal, local-only tool.
 *
 *   npm run admin            # http://127.0.0.1:4321
 *   ADMIN_PORT=5000 npm run admin
 *
 * It reads and writes content/ directly (no database, no credentials). Commit
 * the resulting JSON like any other change; `npm run check` stays the gate.
 *
 * Content reports can be triaged (fixed, triaged, dismissed) when
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in the shell that runs it:
 * the server calls admin_set_report_status, never the browser, so the key
 * never reaches the page.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeReport } from './lib/insights';
import { createStore, type StoreOptions } from './lib/store';

const here = dirname(fileURLToPath(import.meta.url));
const STATIC: Record<string, [string, string]> = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/admin.js': ['admin.js', 'text/javascript; charset=utf-8'],
  '/admin.css': ['admin.css', 'text/css; charset=utf-8'],
};
const MAX_BODY = 2 * 1024 * 1024;

export type ReportStatus = 'open' | 'triaged' | 'fixed' | 'dismissed';
const REPORT_STATUSES = new Set<ReportStatus>(['open', 'triaged', 'fixed', 'dismissed']);

/** Sets a report's status on the live project with the service key (server-side only). */
export function supabaseTriage(env: NodeJS.ProcessEnv = process.env): ((id: string, status: ReportStatus) => Promise<void>) | undefined {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return undefined;
  return async (id, status) => {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/admin_set_report_status`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_id: id, p_status: status }),
    });
    if (!r.ok) throw new Error(`admin_set_report_status failed (${r.status}): ${await r.text()}`);
  };
}

export function createAdminServer(options: StoreOptions & { triage?: (id: string, status: ReportStatus) => Promise<void> }): Server {
  const store = createStore(options);
  const triage = options.triage;

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
      if (req.method === 'GET' && url.pathname === '/api/insights') return send(res, 200, { ...store.insights(), canTriage: !!triage });

      const rep = /^\/api\/reports\/([0-9a-zA-Z-]+)\/status$/.exec(url.pathname);
      if (req.method === 'POST' && rep) {
        if (req.headers['x-brainscroll-admin'] !== '1' || !(req.headers['content-type'] ?? '').startsWith('application/json'))
          return send(res, 403, { error: 'missing admin header or JSON content type' });
        if (!triage) return send(res, 409, { error: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY where you run the admin to triage reports.' });
        let status: unknown;
        try {
          status = (JSON.parse(await readBody(req)) as { status?: unknown }).status;
        } catch (e) {
          return send(res, 400, { error: `invalid JSON: ${(e as Error).message}` });
        }
        if (!REPORT_STATUSES.has(status as ReportStatus)) return send(res, 400, { error: 'status must be open, triaged, fixed or dismissed' });
        await triage(rep[1]!, status as ReportStatus);
        if (status !== 'open') removeReport(options.insightsPath, rep[1]!);
        return send(res, 200, { ok: true });
      }

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
    builtDir: join(repo, 'app', 'src', 'content', 'built'),
    insightsPath: process.env.INSIGHTS_PATH ?? join(here, '.data', 'insights.json'),
    triage: supabaseTriage(),
  }).listen(
    port,
    '127.0.0.1',
    () => console.log(`BrainScroll Content Admin → http://127.0.0.1:${port}`),
  );
}
