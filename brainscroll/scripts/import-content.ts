/**
 * Validates content/ and publishes it to Supabase through the `import_content`
 * RPC (service role). Refuses to run if validation has errors.
 *
 *   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… npm run content:import
 *   npm run content:import -- --publish-drafts      # staging: treat drafts as published
 *   npm run content:import -- --sql out.sql         # write SQL instead (psql / tests); "-" = stdout
 *
 * Published levels become immutable revisions. Changing a published level
 * without bumping its "revision" fails with REVISION_CONFLICT.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateContent } from '@brainscroll/core';
import { loadContent } from './lib/load-content';

const args = process.argv.slice(2);
const publishDrafts = args.includes('--publish-drafts');
const sqlIndex = args.indexOf('--sql');
const sqlOut = sqlIndex >= 0 ? args[sqlIndex + 1] : undefined;
const log = (msg: string) => (sqlOut === '-' ? console.error(msg) : console.log(msg));

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'content');
const { issues, content } = validateContent(loadContent(root));
const errors = issues.filter((i) => i.severity === 'error');
if (errors.length) {
  for (const e of errors) console.error(`✖ ${e.where}: ${e.message}`);
  console.error(`\nRefusing to import: ${errors.length} content errors`);
  process.exit(1);
}
if (!publishDrafts) {
  const unverified = issues.filter((i) => i.message.includes('unverified'));
  if (unverified.length) log(`note: ${unverified.length} unverified-source warnings (drafts stay unpublished)`);
}

const payload = {
  subjects: content.subjects,
  // Planned skills (a syllabus, no levels yet) stay out of the database.
  skills: content.skills.filter((s) => content.levels.some((l) => l.skillId === s.id)),
  sources: content.sources,
  assets: content.assets,
  concepts: content.concepts,
  levels: content.levels,
};
const json = JSON.stringify(payload);

if (sqlOut !== undefined) {
  if (!sqlOut) throw new Error('--sql needs a file path or "-"');
  const tag = '$brainscroll_content$';
  if (json.includes(tag)) throw new Error('content contains the SQL quote tag');
  const sql = `select public.import_content(${tag}${json}${tag}::jsonb, ${publishDrafts});\n`;
  if (sqlOut === '-') process.stdout.write(sql);
  else {
    writeFileSync(sqlOut, sql);
    log(`wrote ${sqlOut}`);
  }
} else {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (never commit the service key), or use --sql.');
    process.exit(1);
  }
  const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/import_content`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p: payload, p_publish_drafts: publishDrafts }),
  });
  const body = await res.text();
  if (!res.ok) {
    console.error(`import failed (${res.status}): ${body}`);
    process.exit(1);
  }
  log(`imported: ${body}`);
}
