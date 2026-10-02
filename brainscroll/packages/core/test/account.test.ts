import { describe, expect, it } from 'vitest';
import {
  AccountError,
  accountErrorFromAuth,
  accountFromUser,
  checkedOtpTarget,
  isValidEmail,
  isValidOtp,
  isValidPhone,
  maskPhone,
  normalizeEmail,
  normalizePhone,
  SIGN_IN_METHODS,
} from '../src/account';

describe('accountFromUser', () => {
  it('is signed out without a user', () => {
    expect(accountFromUser(null)).toEqual({ status: 'signed_out' });
    expect(accountFromUser(undefined)).toEqual({ status: 'signed_out' });
  });
  it('never treats an anonymous user as signed in (there is no guest mode)', () => {
    expect(accountFromUser({ id: 'u', is_anonymous: true })).toEqual({ status: 'signed_out' });
    expect(accountFromUser({ id: 'u', is_anonymous: true, email: 'a@b.co' })).toEqual({ status: 'signed_out' });
  });
  it('reads the sign-in method from the provider', () => {
    expect(accountFromUser({ id: 'u', email: 'a@b.co', app_metadata: { provider: 'apple' } })).toEqual({ status: 'signed_in', userId: 'u', method: 'apple', email: 'a@b.co' });
    expect(accountFromUser({ id: 'u', email: 'a@gmail.com', app_metadata: { provider: 'google' } })).toMatchObject({ method: 'google' });
    expect(accountFromUser({ id: 'u', phone: '15551234567', app_metadata: { provider: 'phone' } })).toEqual({ status: 'signed_in', userId: 'u', method: 'phone', phone: '15551234567' });
    expect(accountFromUser({ id: 'u', email: 'a@b.co', app_metadata: { provider: 'email' } })).toMatchObject({ method: 'email' });
  });
  it('falls back sensibly when the provider is missing', () => {
    expect(accountFromUser({ id: 'u', phone: '+15551234567' })).toMatchObject({ method: 'phone' });
    expect(accountFromUser({ id: 'u', email: 'a@b.co', phone: '' })).toMatchObject({ method: 'email' });
  });
});

describe('sign-in methods', () => {
  it('offers one-tap methods first and email last', () => {
    expect(SIGN_IN_METHODS).toEqual(['apple', 'google', 'phone', 'email']);
  });
});

describe('email, phone and code checks', () => {
  it('normalises and validates email', () => {
    expect(normalizeEmail('  A@B.Co ')).toBe('a@b.co');
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
  });
  it('normalises phone numbers to E.164 and requires a country code', () => {
    expect(normalizePhone(' +1 (555) 123-4567 ')).toBe('+15551234567');
    expect(normalizePhone('0044 20 7946 0958')).toBe('+442079460958');
    expect(isValidPhone('+1 555 123 4567')).toBe(true);
    expect(isValidPhone('555 123 4567')).toBe(false);
    expect(isValidPhone('+0 555 123 4567')).toBe(false);
    expect(isValidPhone('+1 23')).toBe(false);
  });
  it('masks phone numbers for display', () => {
    expect(maskPhone('+15551234567')).toBe('+15 •••• 4567');
  });
  it('validates codes', () => {
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp(' 123456 ')).toBe(true);
    expect(isValidOtp('12ab56')).toBe(false);
  });
  it('checks OTP targets and throws the matching error', () => {
    expect(checkedOtpTarget({ channel: 'email', email: ' A@B.co' })).toEqual({ channel: 'email', email: 'a@b.co' });
    expect(checkedOtpTarget({ channel: 'phone', phone: '+44 20 7946 0958' })).toEqual({ channel: 'phone', phone: '+442079460958' });
    expect(() => checkedOtpTarget({ channel: 'email', email: 'nope' })).toThrow(expect.objectContaining({ code: 'INVALID_EMAIL' }));
    expect(() => checkedOtpTarget({ channel: 'phone', phone: '5551234' })).toThrow(expect.objectContaining({ code: 'INVALID_PHONE' }));
  });
});

describe('accountErrorFromAuth', () => {
  it('maps Supabase Auth codes to stable account errors', () => {
    expect(accountErrorFromAuth({ code: 'otp_expired' }).code).toBe('INVALID_CODE');
    expect(accountErrorFromAuth({ code: 'over_sms_send_rate_limit' }).code).toBe('RATE_LIMITED');
    expect(accountErrorFromAuth({ code: 'phone_provider_disabled' }).code).toBe('PROVIDER_UNAVAILABLE');
    expect(accountErrorFromAuth({ code: 'anonymous_provider_disabled' }).code).toBe('PROVIDER_UNAVAILABLE');
    expect(accountErrorFromAuth({ status: 429 }).code).toBe('RATE_LIMITED');
    const unknown = accountErrorFromAuth({ code: 'weird', message: 'boom' });
    expect(unknown).toBeInstanceOf(AccountError);
    expect(unknown.code).toBe('UNKNOWN');
    expect(unknown.message).toMatch(/boom/);
  });
});
