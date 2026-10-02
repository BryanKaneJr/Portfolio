// Sends BrainScroll's social push notifications (docs/notifications.md). Called
// every few minutes by a cron job with a shared secret, it:
// 1. closes finished league weeks (so Monday's results go out on Monday);
// 2. claims what may go out now (claim_social_pushes applies quiet hours, the
//    daily cap, grouping and the switch);
// 3. sends it through Expo's push service, and forgets devices Expo says are gone;
// 4. clears week-old notes.
// Deployed with `supabase functions deploy send-push --no-verify-jwt`.
// Secrets: PUSH_CRON_SECRET (the cron job sends "Authorization: Bearer <secret>");
// EXPO_ACCESS_TOKEN only if the Expo project requires push security.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { chunk, cronAuthorized, expoMessages, goneTokens, type PushGroup } from '../_shared/push.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!cronAuthorized(req.headers.get('Authorization'), Deno.env.get('PUSH_CRON_SECRET'))) return json(401, { error: 'unauthorized' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const finalized = await admin.rpc('finalize_due_leagues');
  if (finalized.error) console.error('finalize_due_leagues', finalized.error.message);

  const claimed = await admin.rpc('claim_social_pushes', { p_limit: 500 });
  if (claimed.error) return json(500, { error: claimed.error.message });
  const messages = expoMessages((claimed.data ?? []) as PushGroup[]);

  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (expoToken) headers.Authorization = `Bearer ${expoToken}`;
  const gone: string[] = [];
  let sent = 0;
  for (const batch of chunk(messages)) {
    const r = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(batch) });
    if (!r.ok) {
      console.error('expo push', r.status, await r.text());
      continue;
    }
    const tickets = ((await r.json()) as { data?: { status: string; details?: { error?: string } }[] }).data ?? [];
    gone.push(...goneTokens(batch, tickets));
    sent += tickets.filter((t) => t.status === 'ok').length;
  }
  if (gone.length) await admin.rpc('forget_push_tokens', { p_tokens: gone });
  await admin.rpc('prune_outbox');
  return json(200, { finalized: finalized.data ?? 0, messages: messages.length, sent, forgotten: gone.length });
});
