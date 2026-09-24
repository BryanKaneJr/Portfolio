import { describe, expect, it } from 'vitest';
import { AccountError, accountErrorFromAuth, accountFromUser, isValidEmail, isValidOtp, normalizeEmail } from '../src/account';

describe('accountFromUser', () => {
  it('maps anonymous, pending and permanent users', () => {
    expect(accountFromUser(null)).toBeNull();
    expect(accountFromUser({ id: 'u', is_anonymous: true, email: '' })).toEqual({ status: 'guest', userId: 'u' });
    expect(accountFromUser({ id: 'u', is_anonymous: true, email: '', new_email: 'a@b.co' })).toEqual({ status: 'linking', userId: 'u', pendingEmail: 'a@b.co' });
    expect(accountFromUser({ id: 'u', is_anonymous: false, email: 'a@b.co' })).toEqual({ status: 'saved', userId: 'u', email: 'a@b.co' });
  });
  it('keeps the same user id through linking (progress is never migrated)', () => {
    const before = accountFromUser({ id: 'same', is_anonymous: true });
    const after = accountFromUser({ id: 'same', is_anonymous: false, email: 'a@b.co' });
    expect(before && 'userId' in before && before.userId).toBe(after && 'userId' in after && after.userId);
  });
});

describe('email and code checks', () => {
  it('normalises and validates', () => {
    expect(normalizeEmail('  A@B.Co ')).toBe('a@b.co');
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('nope')).toBe(false);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp('12ab56')).toBe(false);
  });
});

describe('accountErrorFromAuth', () => {
  it('maps Supabase Auth codes to stable account errors', () => {
    expect(accountErrorFromAuth({ code: 'email_exists' }).code).toBe('EMAIL_IN_USE');
    expect(accountErrorFromAuth({ code: 'otp_expired' }).code).toBe('INVALID_CODE');
    expect(accountErrorFromAuth({ code: 'otp_disabled' }).code).toBe('NO_ACCOUNT');
    expect(accountErrorFromAuth({ status: 429 }).code).toBe('RATE_LIMITED');
    const unknown = accountErrorFromAuth({ code: 'weird', message: 'boom' });
    expect(unknown).toBeInstanceOf(AccountError);
    expect(unknown.code).toBe('UNKNOWN');
    expect(unknown.message).toMatch(/boom/);
  });
});
