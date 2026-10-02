import type { SupabaseClient } from '@supabase/supabase-js';
import { AccountError } from '@brainscroll/core';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

/**
 * Sign in with Apple on Android, where there's no system sheet: Supabase's
 * OAuth flow in a secure browser tab (PKCE), returning to the app at
 * `brainscroll://auth-callback`. That URL must be in Supabase → Auth → URL
 * Configuration → Redirect URLs. Closing the tab is a choice, not a failure.
 */
export async function signInWithBrowser(supabase: SupabaseClient, provider: 'apple' | 'google'): Promise<void> {
  const redirectTo = Linking.createURL('auth-callback');
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data?.url) throw error ?? new AccountError('UNKNOWN', 'No sign-in page to open.');
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new AccountError('CANCELLED');
  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  if (!code) throw new AccountError('UNKNOWN', url.searchParams.get('error_description') ?? 'Sign-in didn’t finish.');
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw exchanged.error;
}
