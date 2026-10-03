import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

/** JSON persistence that never throws: storage can be unavailable (private mode, previews). */
export async function load<T>(key: string): Promise<T | undefined> {
  try {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : undefined;
  } catch {
    return undefined;
  }
}

export async function save(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Progress still lives in memory for this session.
  }
}

/**
 * A fresh UUID for a one-time request (finishing a level). The server's key
 * column is a uuid, so it must be a real one: expo-crypto works on iPhone,
 * Android and web, where Hermes has no globalThis.crypto.randomUUID (the old
 * fallback made keys the server refused, so levels couldn't be saved).
 */
export function newIdempotencyKey(): string {
  return Crypto.randomUUID();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Whether a stored key is one the server accepts (sessions saved before the fix hold ones it doesn't). */
export const isUuid = (key: string) => UUID.test(key);

export async function remove(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Nothing to clean up.
  }
}

/** Trophy ids an account has already been shown (`${key}:${userId}`), for the "Trophy earned" moment. */
export const TROPHIES_SEEN_KEY = 'brainscroll.trophiesSeen.v1';
/** Trophy ids an account has already looked at on the Trophies screen (`${key}:${userId}`), for the NEW tag. */
export const TROPHIES_VIEWED_KEY = 'brainscroll.trophiesViewed.v1';
