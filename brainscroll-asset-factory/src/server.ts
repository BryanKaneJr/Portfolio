// Local HTTP server: JSON API + static UI + asset files.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { paths, settings } from './config.ts';
import { IMAGE_MODEL, IMAGE_PROVIDER } from './image-provider.ts';
import { approve, reject, search, updateEntry } from './library.ts';
import { generateMetadata } from './metadata.ts';
import { ID_PATTERN, cleanText, normalizeConcept } from './normalize.ts';
import { preprocess } from './preprocess.ts';
import { buildPrompt, readStyle } from './prompt.ts';
import { enqueue, run } from './queue.ts';
import { findEntry, findItem, queue, registry, saveQueue, touch } from './store.ts';
import type { QueueItem } from './types.ts';

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

async function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += c.length;
    if (size > 2_000_000) throw new HttpError(413, 'Request body too large.');
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function serveFile(res: http.ServerResponse, baseDir: string, rel: string): void {
  const file = path.resolve(baseDir, '.' + path.posix.normalize('/' + rel));
  if (!file.startsWith(baseDir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

function itemOr404(key: string): QueueItem {
  const item = findItem(key);
  if (!item) throw new HttpError(404, 'Item not found.');
  return item;
}

function readStyleTest(): { id: string; label: string; subject: string }[] {
  return fs
    .readFileSync(paths.styleTest, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [id, label, subject] = l.split('|').map((s) => s.trim());
      if (!ID_PATTERN.test(id) || !label) throw new HttpError(400, `Bad style test line: "${l}"`);
      return { id, label, subject: subject || `${label}.` };
    });
}

function startStyleTest(): number {
  // Replace the previous style test round (approved items stay).
  for (let i = queue.length - 1; i >= 0; i--) {
    const q = queue[i];
    if (q.style_test && !['APPROVED', 'GENERATING', 'PENDING'].includes(q.status)) queue.splice(i, 1);
  }
  const now = new Date().toISOString();
  const items: QueueItem[] = readStyleTest().map((t) => ({
    key: randomUUID(),
    inputs: [t.label.toLowerCase()],
    canonical_concept: normalizeConcept(t.label),
    label: t.label,
    id: t.id,
    category: t.id.split('.')[0],
    subject: t.subject,
    notes: '',
    contexts: [],
    status: 'PROPOSED',
    style_test: true,
    history: [],
    attempts: 0,
    created_at: now,
    updated_at: now,
  }));
  queue.push(...items);
  return enqueue(items);
}

type Handler = (body: Record<string, unknown>, params: string[], url: URL) => unknown | Promise<unknown>;
const routes: [string, RegExp, Handler][] = [
  ['GET', /^\/api\/state$/, () => ({
    queue,
    run,
    libraryCount: registry.length,
    metadataPending: registry.filter((e) => e.metadata_status === 'pending').length,
    config: {
      hasKey: !!settings.apiKey,
      mock: settings.mock,
      provider: IMAGE_PROVIDER,
      imageModel: IMAGE_MODEL,
      textModel: settings.textModel,
      concurrency: settings.concurrency,
      styleVersion: settings.styleVersion,
    },
  })],

  ['POST', /^\/api\/preprocess$/, (b) => preprocess(String(b.text ?? ''), String(b.category ?? ''))],

  ['POST', /^\/api\/generate$/, (b) => {
    const keys = Array.isArray(b.keys) ? (b.keys as string[]) : null;
    const items = keys
      ? queue.filter((q) => keys.includes(q.key) && ['PROPOSED', 'PENDING', 'FAILED', 'REJECTED'].includes(q.status))
      : queue.filter((q) => q.status === 'PROPOSED' || q.status === 'PENDING');
    return { queued: enqueue(items) };
  }],

  ['POST', /^\/api\/style-test$/, () => ({ queued: startStyleTest() })],

  ['PATCH', /^\/api\/items\/([\w-]+)$/, (b, [key]) => {
    const item = itemOr404(key);
    if (['GENERATING', 'APPROVED'].includes(item.status)) throw new HttpError(409, 'This item cannot be edited right now.');
    if (typeof b.id === 'string') {
      const id = b.id.trim();
      if (!ID_PATTERN.test(id)) throw new HttpError(400, `Invalid asset ID "${id}". Use lowercase like object.telescope.`);
      item.id = id;
      item.category = id.split('.')[0];
    }
    if (typeof b.label === 'string') item.label = cleanText(b.label, 80) || item.label;
    if (typeof b.subject === 'string') item.subject = cleanText(b.subject, 300);
    if (typeof b.notes === 'string') item.notes = cleanText(b.notes, 300);
    if (typeof b.canonical_concept === 'string') item.canonical_concept = normalizeConcept(b.canonical_concept) || item.canonical_concept;
    touch(item);
    saveQueue();
    return item;
  }],

  ['POST', /^\/api\/items\/([\w-]+)\/override$/, (_b, [key]) => {
    const item = itemOr404(key);
    if (item.status !== 'EXISTING' && item.status !== 'TOO_ABSTRACT') throw new HttpError(409, 'Nothing to override.');
    item.reason = item.status === 'EXISTING'
      ? `Override. Approving with ID ${item.id} replaces the existing asset; change the ID to keep both.`
      : 'Override of the abstract check.';
    item.status = 'PROPOSED';
    touch(item);
    saveQueue();
    return item;
  }],

  ['POST', /^\/api\/items\/([\w-]+)\/regenerate$/, (_b, [key]) => ({ queued: enqueue([itemOr404(key)]) })],
  ['POST', /^\/api\/items\/([\w-]+)\/approve$/, (_b, [key]) => approve(itemOr404(key))],
  ['POST', /^\/api\/items\/([\w-]+)\/reject$/, (_b, [key]) => (reject(itemOr404(key)), { ok: true })],

  ['DELETE', /^\/api\/items\/([\w-]+)$/, (_b, [key]) => {
    const item = itemOr404(key);
    if (item.status === 'GENERATING') throw new HttpError(409, 'Wait for generation to finish.');
    queue.splice(queue.indexOf(item), 1);
    saveQueue();
    return { ok: true };
  }],

  ['GET', /^\/api\/registry$/, (_b, _p, url) => search(url.searchParams.get('q') ?? '')],
  ['GET', /^\/api\/registry\/([\w.-]+)$/, (_b, [id]) => findEntry(id) ?? (() => { throw new HttpError(404, 'Asset not found.'); })()],
  ['PUT', /^\/api\/registry\/([\w.-]+)$/, (b, [id]) => updateEntry(id, b)],
  ['POST', /^\/api\/registry\/([\w.-]+)\/metadata$/, async (_b, [id]) => {
    if (!findEntry(id)) throw new HttpError(404, 'Asset not found.');
    const inputs = queue.filter((q) => q.id === id).flatMap((q) => q.inputs);
    await generateMetadata(id, inputs);
    return findEntry(id);
  }],

  ['GET', /^\/api\/style$/, () => ({
    version: settings.styleVersion,
    style: readStyle(),
    styleTest: fs.readFileSync(paths.styleTest, 'utf8'),
    preview: buildPrompt({ label: 'Telescope', subject: 'Optical telescope mounted on a tripod.', notes: '' }),
  })],
  ['PUT', /^\/api\/style$/, (b) => {
    if (typeof b.style === 'string') {
      if (!b.style.trim()) throw new HttpError(400, 'The style specification cannot be empty.');
      fs.writeFileSync(paths.style, b.style.trim() + '\n');
    }
    if (typeof b.styleTest === 'string') {
      fs.writeFileSync(paths.styleTest, b.styleTest.trim() + '\n');
      readStyleTest(); // validate
    }
    return { ok: true };
  }],
];

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      for (const [method, pattern, handler] of routes) {
        const m = url.pathname.match(pattern);
        if (m && req.method === method) {
          const body = method === 'GET' ? {} : await readBody(req);
          return send(res, 200, await handler(body, m.slice(1).map(decodeURIComponent), url));
        }
      }
      throw new HttpError(404, 'Unknown endpoint.');
    }
    if (url.pathname.startsWith('/assets/')) return serveFile(res, paths.assets, url.pathname.slice(8));
    return serveFile(res, paths.public, url.pathname === '/' ? 'index.html' : url.pathname);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    send(res, status, { error: (err as Error).message || 'Something went wrong.' });
  }
});

server.listen(settings.port, '127.0.0.1', () => {
  const mode = settings.mock ? 'MOCK mode (no API calls)' : settings.apiKey ? `OpenAI ${settings.imageModel}` : 'OPENAI_API_KEY missing';
  console.log(`BrainScroll Asset Factory: http://localhost:${settings.port}  [${mode}]`);
});
