import { describe, expect, it } from 'vitest';
import { checkClientConfig, classifySupabaseKey } from '../src/supabase-config';

const b64url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (payload: object) => [{ alg: 'HS256', typ: 'JWT' }, payload].map((p) => b64url(JSON.stringify(p))).join('.') + '.sig';
const ANON = jwt({ iss: 'supabase', ref: 'abcd', role: 'anon' });
const SERVICE = jwt({ iss: 'supabase', ref: 'abcd', role: 'service_role' });
const URL_OK = 'https://abcdefghijklmnop.supabase.co';
const errors = (u?: string, k?: string) => checkClientConfig(u, k).filter((p) => p.severity === 'error');

describe('classifySupabaseKey', () => {
  it('recognises legacy JWT and new-style keys', () => {
    expect(classifySupabaseKey(ANON)).toBe('anon_jwt');
    expect(classifySupabaseKey(SERVICE)).toBe('service_role_jwt');
    expect(classifySupabaseKey('sb_publishable_abc123')).toBe('publishable');
    expect(classifySupabaseKey('sb_secret_abc123')).toBe('secret');
    expect(classifySupabaseKey('nonsense')).toBe('unknown');
    expect(classifySupabaseKey('a.!!!.c')).toBe('unknown');
  });
});

describe('checkClientConfig', () => {
  it('accepts no config (offline play) and a correct project config', () => {
    expect(checkClientConfig(undefined, undefined)).toEqual([]);
    expect(checkClientConfig(URL_OK, ANON)).toEqual([]);
    expect(checkClientConfig(URL_OK, 'sb_publishable_x')).toEqual([]);
    expect(errors('http://localhost:54321', ANON)).toEqual([]);
  });

  it('refuses secret keys in the client', () => {
    expect(errors(URL_OK, SERVICE)[0]?.message).toMatch(/SECRET/);
    expect(errors(URL_OK, 'sb_secret_x')[0]?.message).toMatch(/SECRET/);
  });

  it('catches half-set and malformed URLs', () => {
    expect(errors(URL_OK, undefined)).toHaveLength(1);
    expect(errors(undefined, ANON)).toHaveLength(1);
    expect(errors('not a url', ANON)).toHaveLength(1);
    expect(errors('http://abcd.supabase.co', ANON)[0]?.message).toMatch(/https/);
    expect(errors(`${URL_OK}/rest/v1`, ANON)[0]?.message).toMatch(/root/);
  });
});
