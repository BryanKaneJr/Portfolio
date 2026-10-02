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
const triaged: string[] = [];
const moderated: string[] = [];
const BAD = '00000000-0000-0000-0000-0000000000b1';
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
    userReports: [
      { id: 7, reported_id: BAD, username: 'old_badword', avatar: null, reason: 'username', note: null, status: 'open', created_at: '2026-09-23T00:00:00Z', open_reports: 2 },
      { id: 8, reported_id: BAD, username: 'old_badword', avatar: null, reason: 'cheating', note: 'too fast', status: 'open', created_at: '2026-09-23T00:00:00Z', open_reports: 2 },
    ],
    flaggedUsernames: [{ id: BAD, username: 'old_badword', avatar: null }],
  }));
  server = createAdminServer({
    contentRoot: dir,
    insightsPath,
    triage: async (id, status) => void triaged.push(`${id}:${status}`),
    moderation: {
      setUserReportStatus: async (id, status) => void moderated.push(`${id}:${status}`),
      resetUsername: async (id) => (moderated.push(`reset:${id}`), 'calm_owl_1234'),
    },
  });
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

test('refuses to publish a level with unverified claims (unless its tree is approved on a sample)', async () => {
  rmSync(join(dir, 'approvals.json'), { force: true });
  const before = JSON.stringify(level());
  const r = await put('/api/levels/science.astronomy/002', { ...level(), status: 'published' });
  assert.equal(r.status, 409);
  const body = await r.json();
  assert.ok(body.issues.some((i: { message: string }) => /unverified/.test(i.message)));
  assert.equal(JSON.stringify(level()), before, 'a refused save leaves the file as it was');
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

test('triages a content report through the server and drops it from the queue', async () => {
  const post = (id: string, body: unknown, headers: Record<string, string> = { 'x-brainscroll-admin': '1', 'content-type': 'application/json' }) =>
    fetch(`${base}/api/reports/${id}/status`, { method: 'POST', headers, body: JSON.stringify(body) });
  const before = await (await fetch(base + '/api/insights')).json();
  assert.equal(before.canTriage, true);
  assert.equal(before.reports.length, 1);
  assert.equal((await post('r1', { status: 'fixed' }, {})).status, 403, 'cross-site writes are refused');
  assert.equal((await post('r1', { status: 'deleted' })).status, 400, 'only real statuses');
  assert.equal((await post('r1', { status: 'fixed' })).status, 200);
  assert.deepEqual(triaged, ['r1:fixed']);
  const afterIns = await (await fetch(base + '/api/insights')).json();
  assert.equal(afterIns.reports.length, 0, 'a fixed report leaves the queue');
});

test('moderates learner reports: reset a username, dismiss a report', async () => {
  const post = (path: string, body: unknown, headers: Record<string, string> = { 'x-brainscroll-admin': '1', 'content-type': 'application/json' }) =>
    fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body) });
  const before = await (await fetch(base + '/api/insights')).json();
  assert.equal(before.canModerate, true);
  assert.equal(before.userReports.length, 2);
  assert.equal(before.flaggedUsernames.length, 1);
  assert.equal((await post(`/api/users/${BAD}/reset-username`, {}, {})).status, 403, 'cross-site writes are refused');
  const r = await post(`/api/users/${BAD}/reset-username`, {});
  assert.equal(r.status, 200);
  assert.equal((await r.json()).username, 'calm_owl_1234');
  let ins = await (await fetch(base + '/api/insights')).json();
  assert.deepEqual(ins.userReports.map((x: { id: number; username: string }) => `${x.id}:${x.username}`), ['8:calm_owl_1234'], 'the username report closes; the other shows the new name');
  assert.equal(ins.flaggedUsernames.length, 0);
  assert.equal((await post('/api/user-reports/8/status', { status: 'nope' })).status, 400);
  assert.equal((await post('/api/user-reports/8/status', { status: 'dismissed' })).status, 200);
  ins = await (await fetch(base + '/api/insights')).json();
  assert.equal(ins.userReports.length, 0);
  assert.deepEqual(moderated, [`reset:${BAD}`, '8:dismissed']);
});
