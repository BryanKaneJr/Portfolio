import { AccountError } from '@brainscroll/core';

/**
 * Web has no native sheet: the remote backend uses Supabase OAuth redirects for
 * Apple and Google instead (signInWithOAuth, PKCE). This file keeps the native
 * SDKs out of the web bundle.
 */
export type IdTokenProvider = 'apple' | 'google';
export interface IdToken {
  token: string;
  nonce?: string;
}

export async function canUseNativeSheet(_provider: IdTokenProvider): Promise<boolean> {
  return false;
}

export async function getIdToken(_provider: IdTokenProvider): Promise<IdToken> {
  throw new AccountError('PROVIDER_UNAVAILABLE');
}

export async function forgetNativeSession(): Promise<void> {}
