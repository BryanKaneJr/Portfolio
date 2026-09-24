/**
 * Pulls learning/product-health insights and open content reports for the
 * Content Admin (docs/analytics.md).
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run insights:pull [-- --skill skill.science.astronomy --days 28]
 *
 * Writes admin/.data/insights.json (gitignored: it's derived data about real
 * learners, even though it's aggregate). Open the admin to browse it.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pullInsights } from './lib/insights';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (never commit the service key).');
  process.exit(1);
}
const insights = await pullInsights(url, key, { skillId: arg('skill'), days: arg('days') ? Number(arg('days')) : undefined });
const out = join(repo, 'admin', '.data', 'insights.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(insights, null, 2) + '\n');
console.log(`Wrote ${out}: ${insights.questions.length} questions, ${insights.levels.length} levels, ${insights.reports.length} open reports.`);
