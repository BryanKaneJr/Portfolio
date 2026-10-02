/**
 * BrainScroll Content Admin v1: an internal, local-only tool.
 *
 *   npm run admin            # http://127.0.0.1:4321
 *   ADMIN_PORT=5000 npm run admin
 *
 * It reads and writes content/ directly (no database, no credentials). Commit
 * the resulting JSON like any other change; `npm run check` stays the gate.
 *
 * Content reports can be triaged (fixed, triaged, dismissed), and learner
 * reports moderated (triaged, dismissed, or the username reset to a fresh
 * generated one), when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in
 * the shell that runs it: the server calls the admin_* RPCs, never the
 * browser, so the key never reaches the page.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifySupabaseKey } from '@brainscroll/core';
import { applyUsernameReset, removeReport, removeUserReport } from './lib/insights';
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

/** Calls a service-role RPC on the live project (server-side only), with the same headers as insights:pull. */
function serviceRpc(env: NodeJS.ProcessEnv) {
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return undefined;
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  // A legacy service_role JWT also goes as the bearer token; an sb_secret key goes as the apikey only.
  if (classifySupabaseKey(key) === 'service_role_jwt') headers.Authorization = `Bearer ${key}`;
  return async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
    const text = await r.text();
    if (!r.ok) throw new Error(`${fn} failed (${r.status}): ${text}`);
    return text ? JSON.parse(text) : null;
  };
}

/** Sets a content report's status on the live project with the service key (server-side only). */
export function supabaseTriage(env: NodeJS.ProcessEnv = process.env): ((id: string, status: ReportStatus) => Promise<void>) | undefined {
  const rpc = serviceRpc(env);
  return rpc && (async (id, status) => void (await rpc('admin_set_report_status', { p_id: id, p_status: status })));
}

/** Learner moderation on the live project (server-side only). */
export interface Moderation {
  setUserReportStatus(id: number, status: ReportStatus): Promise<void>;
  /** Replaces the learner's username with a fresh generated one; returns it. */
  resetUsername(userId: string): Promise<string>;
}
export function supabaseModeration(env: NodeJS.ProcessEnv = process.env): Moderation | undefined {
  const rpc = serviceRpc(env);
  return (
    rpc && {
      setUserReportStatus: async (id, status) => void (await rpc('admin_set_user_report_status', { p_id: id, p_status: status })),
      resetUsername: async (userId) => ((await rpc('admin_reset_username', { p_user: userId })) as { username: string }).username,
    }
  );
}

export function createAdminServer(options: StoreOptions & { triage?: (id: string, status: ReportStatus) => Promise<void>; moderation?: Moderation }): Server {
  const store = createStore(options);
  const { triage, moderation } = options;

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
      if (req.method === 'GET' && url.pathname === '/api/insights') return send(res, 200, { ...store.insights(), canTriage: !!triage, canModerate: !!moderation });

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

      const ur = /^\/api\/user-reports\/(\d+)\/status$/.exec(url.pathname);
      const reset = /^\/api\/users\/([0-9a-f-]{36})\/reset-username$/.exec(url.pathname);
      if (req.method === 'POST' && (ur || reset)) {
        if (req.headers['x-brainscroll-admin'] !== '1' || !(req.headers['content-type'] ?? '').startsWith('application/json'))
          return send(res, 403, { error: 'missing admin header or JSON content type' });
        if (!moderation) return send(res, 409, { error: 'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY where you run the admin to moderate.' });
        if (reset) {
          const username = await moderation.resetUsername(reset[1]!);
          applyUsernameReset(options.insightsPath, reset[1]!, username);
          return send(res, 200, { ok: true, username });
        }
        let status: unknown;
        try {
          status = (JSON.parse(await readBody(req)) as { status?: unknown }).status;
        } catch (e) {
          return send(res, 400, { error: `invalid JSON: ${(e as Error).message}` });
        }
        if (!REPORT_STATUSES.has(status as ReportStatus)) return send(res, 400, { error: 'status must be open, triaged, fixed or dismissed' });
        await moderation.setUserReportStatus(Number(ur![1]), status as ReportStatus);
        if (status !== 'open') removeUserReport(options.insightsPath, Number(ur![1]));
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
    moderation: supabaseModeration(),
  }).listen(
    port,
    '127.0.0.1',
    () => console.log(`BrainScroll Content Admin → http://127.0.0.1:${port}`),
  );
}
