import type { SupabaseClient } from '@supabase/supabase-js';

/** Web signs in by full-page redirect (remoteBackend), never through this. Keeps expo-web-browser out of the web bundle. */
export async function signInWithBrowser(_supabase: SupabaseClient, _provider: 'apple' | 'google'): Promise<void> {
  throw new Error('signInWithBrowser is native only');
}
