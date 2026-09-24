import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { request, type Server } from 'node:http';
import { createAdminServer } from '../server';

const repoContent = join(import.meta.dirname, '..', '..', 'content');
let dir: string;
let server: Server;
let base: string;
const LEVEL = 'skills/science.astronomy/levels/002.json';

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'bs-admin-'));
  cpSync(repoContent, dir, { recursive: true });
  const insightsPath = join(dir, 'insights.json');
  writeFileSync(insightsPath, JSON.stringify({
    pulledAt: '2026-09-24T00:00:00Z', source: 'https://x.supabase.co', health: { active_learners: 40 },
    questions: [{ question_id: 'question.astronomy.001.q1', level_id: 'level.science.astronomy.001', learners: 40, first_try_rate: 0.2, avg_attempts: 2, first_picks: {}, review_attempts: 0, review_first_try_rate: null }],
    levels: [{ level_id: 'level.science.astronomy.001', started: 40, completed: 38, completion_rate: 0.95, mean_first_try_share: 0.5, exits_by_card: {} }],
    reports: [{ id: 'r1', level_id: 'level.science.astronomy.001', revision: 1, object_type: 'card', object_id: 'card.astronomy.001.c2', category: 'typo', message: 'Missing comma', status: 'open', created_at: '2026-09-23T00:00:00Z' }],
  }));
  server = createAdminServer({ contentRoot: dir, insightsPath });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => {
  server.close();
  rmSync(dir, { recursive: true, force: true });
});

const put = (path: string, body: unknown, headers: Record<string, string> = { 'x-brainscroll-admin': '1', 'content-type': 'application/json' }) =>
  fetch(base + path, { method: 'PUT', headers, body: JSON.stringify(body) });
const level = () => JSON.parse(readFileSync(join(dir, LEVEL), 'utf8'));

test('serves the UI and a content snapshot with editor limits', async () => {
  assert.equal((await fetch(base + '/')).status, 200);
  const c = await (await fetch(base + '/api/content')).json();
  assert.ok(c.levels.length >= 10);
  assert.ok(c.concepts.length > 0 && c.sources.length > 0);
  assert.equal(c.meta.textBudget.headline, 80);
  assert.equal(c.meta.structure.mastery.questions.standard, 10);
});

test('serves learner insights with flags and reports per level', async () => {
  const i = await (await fetch(base + '/api/insights')).json();
  assert.equal(i.available, true);
  const l1 = i.levels['level.science.astronomy.001'];
  assert.equal(l1.reports.length, 1);
  assert.ok(l1.questions.find((q: { id: string }) => q.id === 'question.astronomy.001.q1').flags.some((f: string) => f.startsWith('Hard')));
});

test('runs validation', async () => {
  const v = await (await fetch(base + '/api/validate')).json();
  assert.ok(Array.isArray(v.issues));
  assert.equal(v.issues.filter((i: { severity: string }) => i.severity === 'error').length, 0);
});

test('saves an edited draft level to disk', async () => {
  const l = level();
  l.summary = 'Edited in the admin test.';
  const r = await put('/api/levels/science.astronomy/002', l);
  assert.equal(r.status, 200);
  assert.equal(level().summary, 'Edited in the admin test.');
});

test('rejects schema-invalid levels and mismatched numbers without writing', async () => {
  const before = readFileSync(join(dir, LEVEL), 'utf8');
  const bad = { ...level(), title: 'x'.repeat(61) };
  assert.equal((await put('/api/levels/science.astronomy/002', bad)).status, 400);
  assert.equal((await put('/api/levels/science.astronomy/003', level())).status, 400);
  assert.equal(readFileSync(join(dir, LEVEL), 'utf8'), before);
});

test('refuses to publish a level with unverified claims', async () => {
  const r = await put('/api/levels/science.astronomy/002', { ...level(), status: 'published' });
  assert.equal(r.status, 409);
  const body = await r.json();
  assert.ok(body.issues.some((i: { message: string }) => /unverified/.test(i.message)));
  assert.equal(level().status, 'draft');
});

test('is local-only and needs the admin header to write', async () => {
  assert.equal((await put('/api/levels/science.astronomy/002', level(), { 'content-type': 'application/json' })).status, 403);
  // fetch() won't let us spoof Host, so use a raw request (DNS-rebinding case).
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const r = request(base + '/api/content', { headers: { host: 'evil.example' } }, (res) => { res.resume(); resolve(res.statusCode); });
    r.on('error', reject);
    r.end();
  });
  assert.equal(status, 403);
  assert.equal((await put('/api/levels/..%2F..%2Fetc/002', level())).status, 404);
});
