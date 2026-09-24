import { describe, expect, it } from 'vitest';
import { ANALYTICS_EVENTS, sanitizeEvent } from '../src/analytics';

describe('sanitizeEvent', () => {
  const at = new Date('2026-09-24T10:00:00Z');
  it('keeps declared, correctly typed props only', () => {
    expect(sanitizeEvent('level_exit', { level_id: 'level.science.astronomy.004', card_index: 2, card_count: 7, extra: 'x', email: 'a@b.co' }, at)).toEqual({
      name: 'level_exit',
      props: { level_id: 'level.science.astronomy.004', card_index: 2, card_count: 7 },
      at: '2026-09-24T10:00:00.000Z',
    });
    expect(sanitizeEvent('onboarding_step', { step: '2' }, at)?.props).toEqual({});
    expect(sanitizeEvent('daily_complete_seen', { used: NaN, cap: 5 }, at)?.props).toEqual({ cap: 5 });
  });
  it('drops unknown events and anything that looks like an email', () => {
    expect(sanitizeEvent('session_minutes', { n: 12 })).toBeNull();
    expect(sanitizeEvent('report_opened', { object_type: 'me@example.com' })?.props).toEqual({});
  });
  it('drops anything that looks like a phone number, but keeps sign-in methods and level ids', () => {
    expect(sanitizeEvent('sign_in_started', { method: '+1 (555) 123-4567' })?.props).toEqual({});
    expect(sanitizeEvent('sign_in_completed', { method: 'phone' })?.props).toEqual({ method: 'phone' });
    expect(sanitizeEvent('level_exit', { level_id: 'level.history.ancient_rome.100', card_index: 1, card_count: 9 })?.props).toMatchObject({ level_id: 'level.history.ancient_rome.100' });
  });
  it('declares no time-spent events or duration props', () => {
    const names = Object.keys(ANALYTICS_EVENTS).join(' ');
    const props = Object.values(ANALYTICS_EVENTS).flatMap((p) => Object.keys(p)).join(' ');
    expect(`${names} ${props}`).not.toMatch(/duration|minutes|seconds|time_spent|session_length|ms\b/);
  });
});
