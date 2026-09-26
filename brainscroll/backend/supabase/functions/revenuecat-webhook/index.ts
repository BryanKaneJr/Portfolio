// RevenueCat → Supabase: applies every subscription event to the learner's
// Unlimited entitlement (apply_revenuecat_event). Deployed with
// `supabase functions deploy revenuecat-webhook --no-verify-jwt`, because
// RevenueCat authenticates with a shared secret, not a Supabase session.
//
// Secrets: REVENUECAT_WEBHOOK_SECRET (also set as the webhook's
// Authorization header, "Bearer <secret>", in RevenueCat). SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { webhookAuthorized } from '../_shared/revenuecat.ts';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (!webhookAuthorized(req.headers.get('Authorization'), Deno.env.get('REVENUECAT_WEBHOOK_SECRET'))) return json(401, { error: 'unauthorized' });
  let event: unknown;
  try {
    event = (await req.json())?.event;
  } catch {
    return json(400, { error: 'invalid JSON' });
  }
  if (!event || typeof event !== 'object') return json(400, { error: 'missing event' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('apply_revenuecat_event_checked', { p_event: event });
  // A 5xx makes RevenueCat retry later. A malformed event would fail every
  // retry, so it's acknowledged (200) and logged instead.
  if (error) {
    const malformed = /_REQUIRED|invalid input syntax/.test(error.message);
    console.error('apply_revenuecat_event failed', error.message);
    return json(malformed ? 200 : 500, { error: error.message });
  }
  return json(200, data);
});
