import { AccountError } from '@brainscroll/core';
import { GoogleSignin, isCancelledResponse, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from './config';

/**
 * Native Apple and Google sign-in: show the OS sheet, return an ID token that
 * Supabase verifies with signInWithIdToken. (Web uses OAuth redirects instead:
 * see idToken.web.ts.) Nothing here creates a local or guest identity.
 */
export type IdTokenProvider = 'apple' | 'google';
export interface IdToken {
  token: string;
  /** The raw nonce whose SHA-256 was sent to the provider (Apple). Supabase re-hashes and compares. */
  nonce?: string;
}

/** Native sheets can be shown on this device. Web returns false and redirects instead. */
export async function canUseNativeSheet(provider: IdTokenProvider): Promise<boolean> {
  if (provider === 'apple') return Platform.OS === 'ios' && (await AppleAuthentication.isAvailableAsync().catch(() => false));
  if (!GOOGLE_WEB_CLIENT_ID) return false;
  return Platform.OS === 'android' || (Platform.OS === 'ios' && !!GOOGLE_IOS_CLIENT_ID);
}

export async function getIdToken(provider: IdTokenProvider): Promise<IdToken> {
  return provider === 'apple' ? appleIdToken() : googleIdToken();
}

async function appleIdToken(): Promise<IdToken> {
  const nonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!credential.identityToken) throw new AccountError('UNKNOWN', 'Apple didn’t return an identity token.');
    return { token: credential.identityToken, nonce };
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new AccountError('CANCELLED');
    throw e instanceof AccountError ? e : new AccountError('UNKNOWN', (e as Error).message);
  }
}

let googleConfigured = false;
async function googleIdToken(): Promise<IdToken> {
  if (!GOOGLE_WEB_CLIENT_ID) throw new AccountError('PROVIDER_UNAVAILABLE');
  if (!googleConfigured) {
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID, iosClientId: GOOGLE_IOS_CLIENT_ID });
    googleConfigured = true;
  }
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (isCancelledResponse(response)) throw new AccountError('CANCELLED');
    const token = response.data.idToken;
    if (!token) throw new AccountError('UNKNOWN', 'Google didn’t return an ID token. Check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
    return { token };
  } catch (e) {
    if (e instanceof AccountError) throw e;
    if (isErrorWithCode(e) && e.code === statusCodes.IN_PROGRESS) throw new AccountError('CANCELLED');
    if (isErrorWithCode(e) && e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) throw new AccountError('PROVIDER_UNAVAILABLE');
    throw new AccountError('UNKNOWN', (e as Error).message);
  }
}

/** Forget the provider-side session too, so the next sign-in can pick another account. */
export async function forgetNativeSession(): Promise<void> {
  if (googleConfigured) await GoogleSignin.signOut().catch(() => {});
}
