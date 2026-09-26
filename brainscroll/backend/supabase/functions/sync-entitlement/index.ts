// The app calls this right after a purchase or restore, so Unlimited applies
// at once instead of waiting for the webhook. It asks RevenueCat about the
// signed-in learner (never trusting the app's word) and records the answer.
// Deployed with JWT verification on: only a signed-in learner can call it,
// and only for themselves.
//
// Secrets: REVENUECAT_SECRET_API_KEY (RevenueCat → Project settings → API
// keys, a secret v1 key). SUPABASE_URL, SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { entitlementFromSubscriber } from '../_shared/revenuecat.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const url = Deno.env.get('SUPABASE_URL')!;
  const asLearner = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  });
  const { data: auth } = await asLearner.auth.getUser();
  if (!auth.user) return json(401, { error: 'NOT_AUTHENTICATED' });

  const key = Deno.env.get('REVENUECAT_SECRET_API_KEY');
  if (!key) return json(503, { error: 'SUBSCRIPTIONS_NOT_CONFIGURED' });
  const rc = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(auth.user.id)}`, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  if (!rc.ok) return json(502, { error: `REVENUECAT_${rc.status}` });
  const state = entitlementFromSubscriber(await rc.json());

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { error } = await admin.rpc('apply_entitlement', {
    p_user: auth.user.id,
    p_active: state.active,
    p_expires_at: state.expiresAt,
    p_event_at: new Date().toISOString(),
    p_product_id: state.productId,
    p_store: state.store,
    p_will_renew: state.willRenew,
  });
  if (error) return json(500, { error: error.message });
  const { data: entitlement } = await asLearner.rpc('get_entitlement');
  return json(200, entitlement);
});
