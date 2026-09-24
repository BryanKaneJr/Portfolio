/**
 * Accounts. BrainScroll requires an account before any learning progress is
 * kept: open the app → choose a sign-in method → onboarding → Level 1.
 * There are no anonymous or guest users, no guest progress and nothing to
 * migrate or merge. Progress is keyed to the account's user id, so it follows
 * the learner across reinstalls and devices. See docs/accounts.md.
 *
 *   signed_out: nothing is shown but the sign-in screen
 *   signed_in:  a permanent account, identified by one sign-in method
 */
export type SignInMethod = 'apple' | 'google' | 'phone' | 'email';

/** Display order on the sign-in screen: one-tap methods first, email as the fallback. */
export const SIGN_IN_METHODS: readonly SignInMethod[] = ['apple', 'google', 'phone', 'email'];

export const SIGN_IN_METHOD_LABEL: Record<SignInMethod, string> = {
  apple: 'Continue with Apple',
  google: 'Continue with Google',
  phone: 'Continue with phone number',
  email: 'Continue with email',
};

export type AccountState =
  | { status: 'signed_out' }
  | { status: 'signed_in'; userId: string; method: SignInMethod; email?: string; phone?: string };

export const SIGNED_OUT: AccountState = { status: 'signed_out' };

/** Where a one-time code is sent. Codes both create the account and sign in to it. */
export type OtpTarget = { channel: 'phone'; phone: string } | { channel: 'email'; email: string };

export type AccountErrorCode =
  | 'PROVIDER_UNAVAILABLE' // this sign-in method isn't configured for this build or project
  | 'CANCELLED' // the learner closed the Apple/Google sheet: not an error to show
  | 'INVALID_EMAIL'
  | 'INVALID_PHONE'
  | 'INVALID_CODE' // wrong or expired one-time code
  | 'RATE_LIMITED'
  | 'NOT_SIGNED_IN'
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
  PROVIDER_UNAVAILABLE: 'That sign-in option isn’t available yet. Try another one.',
  CANCELLED: 'Sign-in was cancelled.',
  INVALID_EMAIL: 'That doesn’t look like an email address.',
  INVALID_PHONE: 'Enter your number with its country code, like +1 555 123 4567.',
  INVALID_CODE: 'That code is wrong or has expired. Check the latest message, or send a new code.',
  RATE_LIMITED: 'Too many tries. Wait a minute, then try again.',
  NOT_SIGNED_IN: 'Please sign in to continue.',
  UNKNOWN: 'Something went wrong. Please try again.',
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Deliberately loose: the server is the real check; this only catches typos early. */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email)) && email.length <= 254;
}

/** E.164 without formatting: "+1 (555) 123-4567" → "+15551234567". */
export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/[^\d]/g, '');
  return trimmed.startsWith('+') || trimmed.startsWith('00') ? `+${digits.replace(/^00/, '')}` : digits;
}

/** Requires a country code, because SMS providers need E.164. */
export function isValidPhone(phone: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(normalizePhone(phone));
}

/** "+15551234567" → "+15 •••• 4567": enough to recognise, not to copy. */
export function maskPhone(phone: string): string {
  const p = normalizePhone(phone);
  return p.length > 7 ? `${p.slice(0, 3)} •••• ${p.slice(-4)}` : p;
}

export function isValidOtp(code: string): boolean {
  return /^\d{6,10}$/.test(code.trim());
}

/** Validates and normalises an OTP target, or throws the matching AccountError. */
export function checkedOtpTarget(target: OtpTarget): OtpTarget {
  if (target.channel === 'email') {
    if (!isValidEmail(target.email)) throw new AccountError('INVALID_EMAIL');
    return { channel: 'email', email: normalizeEmail(target.email) };
  }
  if (!isValidPhone(target.phone)) throw new AccountError('INVALID_PHONE');
  return { channel: 'phone', phone: normalizePhone(target.phone) };
}

/** The subset of a Supabase Auth user this module reads. */
export interface AuthUserLike {
  id: string;
  is_anonymous?: boolean;
  email?: string | null;
  phone?: string | null;
  app_metadata?: { provider?: string | null } | null;
}

const PROVIDER_TO_METHOD: Record<string, SignInMethod> = { apple: 'apple', google: 'google', phone: 'phone', email: 'email' };

/**
 * An anonymous user is never a valid session: BrainScroll doesn't create them,
 * and the database refuses them. Treat one as signed out.
 */
export function accountFromUser(user: AuthUserLike | null | undefined): AccountState {
  if (!user || user.is_anonymous) return SIGNED_OUT;
  const email = user.email?.trim() || undefined;
  const phone = user.phone?.trim() || undefined;
  const method = PROVIDER_TO_METHOD[user.app_metadata?.provider ?? ''] ?? (phone && !email ? 'phone' : 'email');
  return { status: 'signed_in', userId: user.id, method, ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
}

/** Maps Supabase Auth error codes (AuthApiError.code) and statuses to ours. */
export function accountErrorFromAuth(err: { code?: string | null; status?: number | null; message?: string | null }): AccountError {
  const code = err.code ?? '';
  const map: Record<string, AccountErrorCode> = {
    email_address_invalid: 'INVALID_EMAIL',
    validation_failed: 'INVALID_EMAIL',
    phone_number_invalid: 'INVALID_PHONE',
    otp_expired: 'INVALID_CODE',
    invalid_credentials: 'INVALID_CODE',
    over_email_send_rate_limit: 'RATE_LIMITED',
    over_sms_send_rate_limit: 'RATE_LIMITED',
    over_request_rate_limit: 'RATE_LIMITED',
    provider_disabled: 'PROVIDER_UNAVAILABLE',
    email_provider_disabled: 'PROVIDER_UNAVAILABLE',
    phone_provider_disabled: 'PROVIDER_UNAVAILABLE',
    signup_disabled: 'PROVIDER_UNAVAILABLE',
    anonymous_provider_disabled: 'PROVIDER_UNAVAILABLE',
    no_authorization: 'NOT_SIGNED_IN',
    session_not_found: 'NOT_SIGNED_IN',
  };
  if (map[code]) return new AccountError(map[code]!);
  if (err.status === 429) return new AccountError('RATE_LIMITED');
  return new AccountError('UNKNOWN', err.message ? `${ACCOUNT_ERROR_TEXT.UNKNOWN} (${err.message})` : undefined);
}
