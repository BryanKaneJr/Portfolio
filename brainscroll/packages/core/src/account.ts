/**
 * Account persistence: every player starts as an anonymous (guest) user, and
 * can later attach an email to the SAME user id, so nothing is migrated and
 * no progress can be lost. See docs/accounts.md.
 *
 * States the app shows:
 *   device_only — offline build (no Supabase): progress lives on this device
 *   guest       — anonymous server account; progress is saved server-side but
 *                 is tied to this install until an email is linked
 *   linking     — a code was sent to `pendingEmail`; waiting for it
 *   saved       — permanent account with a confirmed email
 */
export type AccountState =
  | { status: 'device_only' }
  | { status: 'guest'; userId: string }
  | { status: 'linking'; userId: string; pendingEmail: string }
  | { status: 'saved'; userId: string; email: string };

export type AccountErrorCode =
  | 'ACCOUNTS_UNAVAILABLE' // offline build
  | 'INVALID_EMAIL'
  | 'EMAIL_IN_USE' // the email already belongs to another account: sign in instead
  | 'NO_ACCOUNT' // sign-in: no account with that email
  | 'INVALID_CODE' // wrong or expired one-time code
  | 'RATE_LIMITED'
  | 'NOT_ALLOWED' // e.g. signing a guest out would orphan their progress
  | 'UNKNOWN';

export class AccountError extends Error {
  constructor(
    readonly code: AccountErrorCode,
    message?: string,
  ) {
    super(message ?? ACCOUNT_ERROR_TEXT[code]);
    this.name = 'AccountError';
  }
}

/** Player-facing copy. Calm, specific, no blame. */
export const ACCOUNT_ERROR_TEXT: Record<AccountErrorCode, string> = {
  ACCOUNTS_UNAVAILABLE: 'Accounts aren’t available in this build. Your progress is saved on this device.',
  INVALID_EMAIL: 'That doesn’t look like an email address.',
  EMAIL_IN_USE: 'That email already has a BrainScroll account. Sign in to it instead.',
  NO_ACCOUNT: 'There’s no BrainScroll account with that email yet.',
  INVALID_CODE: 'That code is wrong or has expired. Check the latest email, or send a new code.',
  RATE_LIMITED: 'Too many tries. Wait a minute, then try again.',
  NOT_ALLOWED: 'That isn’t possible right now.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Deliberately loose: the server is the real check; this only catches typos early. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email)) && email.length <= 254;
}

export function isValidOtp(code: string): boolean {
  return /^\d{6,10}$/.test(code.trim());
}

/** The subset of a Supabase Auth user this module reads. */
export interface AuthUserLike {
  id: string;
  is_anonymous?: boolean;
  email?: string | null;
  new_email?: string | null;
}

export function accountFromUser(user: AuthUserLike | null | undefined): AccountState | null {
  if (!user) return null;
  const email = user.email?.trim();
  if (!user.is_anonymous && email) return { status: 'saved', userId: user.id, email };
  const pending = user.new_email?.trim();
  if (pending) return { status: 'linking', userId: user.id, pendingEmail: pending };
  return { status: 'guest', userId: user.id };
}

/** Maps Supabase Auth error codes (AuthApiError.code) and statuses to ours. */
export function accountErrorFromAuth(err: { code?: string | null; status?: number | null; message?: string | null }): AccountError {
  const code = err.code ?? '';
  const map: Record<string, AccountErrorCode> = {
    email_exists: 'EMAIL_IN_USE',
    user_already_exists: 'EMAIL_IN_USE',
    identity_already_exists: 'EMAIL_IN_USE',
    email_address_invalid: 'INVALID_EMAIL',
    validation_failed: 'INVALID_EMAIL',
    otp_expired: 'INVALID_CODE',
    invalid_credentials: 'INVALID_CODE',
    otp_disabled: 'NO_ACCOUNT',
    user_not_found: 'NO_ACCOUNT',
    over_email_send_rate_limit: 'RATE_LIMITED',
    over_request_rate_limit: 'RATE_LIMITED',
  };
  if (map[code]) return new AccountError(map[code]!);
  if (err.status === 429) return new AccountError('RATE_LIMITED');
  return new AccountError('UNKNOWN', err.message ? `${ACCOUNT_ERROR_TEXT.UNKNOWN} (${err.message})` : undefined);
}
