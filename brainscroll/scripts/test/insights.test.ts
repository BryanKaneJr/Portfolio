import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pullInsights } from '../lib/insights';

const service = ['{"alg":"HS256"}', '{"role":"service_role"}'].map((s) => Buffer.from(s).toString('base64url')).join('.') + '.sig';

test('pulls all four aggregates with the service key', async () => {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const stub = async (url: string, init: { headers: Record<string, string>; body: string }) => {
    calls.push({ url, ...init });
    const fn = url.split('/').pop();
    const body = fn === 'admin_learning_health' ? { active_learners: 3 } : [];
    return { status: 200, text: async () => JSON.stringify(body) };
  };
  const r = await pullInsights('https://x.supabase.co/', service, { skillId: 'skill.science.astronomy', days: 7 }, stub);
  assert.equal(r.health.active_learners, 3);
  assert.deepEqual(calls.map((c) => c.url.split('/').pop()).sort(), ['admin_content_reports', 'admin_learning_health', 'admin_level_funnel', 'admin_question_stats']);
  assert.equal(calls[0]!.headers.authorization, `Bearer ${service}`);
  assert.equal(JSON.parse(calls.find((c) => c.url.endsWith('admin_level_funnel'))!.body).p_skill_id, 'skill.science.astronomy');
});

test('refuses a public key and surfaces server errors', async () => {
  await assert.rejects(pullInsights('https://x.supabase.co', 'sb_publishable_x'), /service_role/);
  const failing = async () => ({ status: 403, text: async () => 'permission denied' });
  await assert.rejects(pullInsights('https://x.supabase.co', 'sb_secret_x', {}, failing), /permission denied/);
});
