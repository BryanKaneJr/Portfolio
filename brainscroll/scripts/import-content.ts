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
/** Levels per request: about 10 KB each, so a call stays well under hosted request limits. */
const LEVELS_PER_CALL = 25;
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
// Weekly Quests go in a second call (import_quests), after the skills they name exist.
const quests = JSON.stringify(content.quests);

if (sqlOut !== undefined) {
  if (!sqlOut) throw new Error('--sql needs a file path or "-"');
  const tag = '$brainscroll_content$';
  if (json.includes(tag)) throw new Error('content contains the SQL quote tag');
  if (quests.includes(tag)) throw new Error('quests contain the SQL quote tag');
  const sql = `select public.import_content(${tag}${json}${tag}::jsonb, ${publishDrafts});\nselect public.import_quests(${tag}${quests}${tag}::jsonb, ${publishDrafts});\n`;
  if (sqlOut === '-') process.stdout.write(sql);
  else {
    writeFileSync(sqlOut, sql);
    log(`wrote ${sqlOut}`);
  }
} else {
  const url = process.env.SUPABASE_URL?.trim().replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (never commit the service key), or use --sql.');
    process.exit(1);
  }
  // The whole catalog is tens of MB: too big for one request to a hosted
  // project. import_content upserts and never removes what a call leaves out,
  // so it goes in pieces, in dependency order: the catalog and sources, then
  // concepts, then a few levels at a time.
  const rpc = async (fn: string, body: unknown, what: string) => {
    for (let attempt = 1; ; attempt++) {
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch((e: Error) => ({ ok: false, status: 0, text: async () => e.message }) as const);
      const text = await res.text();
      if (res.ok) return text;
      // Retry only what may pass next time (network, timeouts, overload); a content error won't.
      const transient = res.status === 0 || res.status === 408 || res.status === 429 || res.status >= 500;
      if (!transient || attempt === 3) {
        console.error(`import failed on ${what} (${res.status || 'network error'}): ${text.slice(0, 2000)}`);
        if (res.status === 401 || res.status === 403) console.error('Check SUPABASE_SERVICE_ROLE_KEY: it must be the service_role (secret) key of this project.');
        process.exit(1);
      }
      log(`  ${what}: ${res.status || 'network error'}, retrying (${attempt}/3)`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  };
  const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  const put = (part: Partial<typeof payload>, what: string) =>
    rpc('import_content', { p: { subjects: [], skills: [], sources: [], assets: [], concepts: [], levels: [], ...part }, p_publish_drafts: publishDrafts }, what);

  await put({ subjects: payload.subjects, skills: payload.skills, assets: payload.assets }, 'subjects and skills');
  for (const [i, part] of chunks(payload.sources, 1000).entries()) await put({ sources: part }, `sources ${i + 1}`);
  log(`sources: ${payload.sources.length}`);
  for (const [i, part] of chunks(payload.concepts, 500).entries()) await put({ concepts: part }, `concepts ${i + 1}`);
  log(`concepts: ${payload.concepts.length}`);
  let revisions = 0;
  const batches = chunks(payload.levels, LEVELS_PER_CALL);
  for (const [i, part] of batches.entries()) {
    const r = JSON.parse(await put({ levels: part }, `levels ${part[0]!.id} to ${part.at(-1)!.id}`)) as { new_revisions: number };
    revisions += r.new_revisions;
    if ((i + 1) % 10 === 0 || i === batches.length - 1) log(`levels: ${Math.min((i + 1) * LEVELS_PER_CALL, payload.levels.length)} of ${payload.levels.length}`);
  }
  log(`imported: ${payload.levels.length} levels, ${revisions} new published revisions`);
  log(`imported quests: ${await rpc('import_quests', { p: content.quests, p_publish_drafts: publishDrafts }, 'quests')}`);
}

