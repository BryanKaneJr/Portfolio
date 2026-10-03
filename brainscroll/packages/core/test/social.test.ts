import { describe, expect, it } from 'vitest';
import { avatarIdFor, avatarUnlocked, compareSubjects, hiddenLeagueMember, leagueFits, leaguePrize, leagueWeekStart, ordinal, profileAccess, rarestTrophies, SOCIAL_ERROR_TEXT, USER_REPORT_NOTE_MAX, USER_REPORT_REASONS, usernameProblem, weeklyXp, type XpEvent } from '../src';

// Mirrors backend/tests/social.test.sql.
describe('leagues', () => {
  it('run Monday to Monday, UTC', () => {
    expect(leagueWeekStart(new Date('2026-10-05T00:00:00Z'))).toBe('2026-10-05'); // a Monday
    expect(leagueWeekStart(new Date('2026-10-11T23:59:59Z'))).toBe('2026-10-05'); // Sunday night
    expect(leagueWeekStart(new Date('2026-10-12T00:00:00Z'))).toBe('2026-10-12');
  });

  it('match brain levels within 20%, and anyone under 100 is fair game', () => {
    expect(leagueFits([1, 40, 99], 2)).toBe(true);
    expect(leagueFits([1, 40], 110)).toBe(false);
    expect(leagueFits([110], 115)).toBe(true);
    expect(leagueFits([110], 140)).toBe(false);
  });

  it('pay 1,000 / 500 / 250 to the top 3 with XP, in a league bigger than the place', () => {
    expect([1, 2, 3, 4].map((p) => leaguePrize(p, 20, 100))).toEqual([1000, 500, 250, 0]);
    expect(leaguePrize(1, 20, 0)).toBe(0);
    expect(leaguePrize(1, 1, 500)).toBe(0); // alone: nothing to win
    expect(leaguePrize(2, 2, 500)).toBe(0);
  });

  it('count every XP event in the week except league prizes', () => {
    const e = (type: XpEvent['type'], amount: number, at: string) => ({ type, amount, at, idempotencyKey: at + type, skillId: 's', levelId: 'l', reason: '' }) as XpEvent;
    const events = [e('LEVEL_COMPLETE', 100, '2026-10-05T10:00:00Z'), e('LEAGUE_FINISH', 1000, '2026-10-05T11:00:00Z'), e('DELAYED_RECALL', 10, '2026-10-04T23:00:00Z')];
    expect(weeklyXp(events, '2026-10-05')).toBe(100);
  });

  it('says places as people do', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
  });
});

describe('profiles', () => {
  it('show the rarest trophies first', () => {
    const ids = ['trophy.first_level', 'trophy.streak_30', 'trophy.mastery_astronomy', 'trophy.century', 'trophy.streak_7'];
    expect(rarestTrophies(ids.map((trophyId) => ({ trophyId }))).map((t) => t.trophyId)).toEqual(['trophy.mastery_astronomy', 'trophy.streak_30', 'trophy.century']);
  });

  it('compare subjects by levels cleared in them', () => {
    const skills = [{ id: 'a', subjectId: 'x' }, { id: 'b', subjectId: 'x' }, { id: 'c', subjectId: 'y' }];
    const subjects = [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }];
    expect(compareSubjects({ a: 3, b: 2 }, { c: 9 }, skills, subjects)).toEqual([
      { subjectId: 'x', name: 'X', you: 5, them: 0 },
      { subjectId: 'y', name: 'Y', you: 0, them: 9 },
    ]);
  });

  it('check usernames like the server', () => {
    expect(usernameProblem('ab')).toBeTruthy();
    expect(usernameProblem('has space')).toBeTruthy();
    expect(usernameProblem('Curious_Owl_42')).toBeNull();
  });
});

// QA fixes, 2026-10-03 (migration 20261103000000_social_qa_fixes.sql).
describe('privacy and safety', () => {
  const none = { self: false, friend: false, leagueMate: false, requested: false, askedYou: false, blocked: false };
  it('opens a profile to yourself, friends and league mates only; a pending request shows just the name', () => {
    expect(profileAccess({ ...none, self: true })).toEqual({ relation: 'you', limited: false });
    expect(profileAccess({ ...none, friend: true })).toEqual({ relation: 'friend', limited: false });
    expect(profileAccess({ ...none, leagueMate: true })).toEqual({ relation: 'league', limited: false });
    expect(profileAccess({ ...none, requested: true })).toEqual({ relation: 'requested', limited: true });
    expect(profileAccess({ ...none, askedYou: true })).toEqual({ relation: 'asked_you', limited: true });
    expect(profileAccess({ ...none, requested: true, leagueMate: true })).toEqual({ relation: 'requested', limited: false });
    expect(profileAccess(none)).toBeNull();
    expect(profileAccess({ ...none, friend: true, blocked: true })).toBeNull();
  });

  it('hides who a blocked league mate is, but keeps their place and XP', () => {
    const m = hiddenLeagueMember(3, 420);
    expect(m).toMatchObject({ username: '', knowledgeLevel: 0, weeklyXp: 420, blocked: true, you: false });
    expect(m.avatar).toBeUndefined();
    expect(m.id).not.toMatch(/sim|[0-9a-f]{8}-/);
  });

  it('pays a podium place only when the server would (the real rule, not a promise)', () => {
    expect(leaguePrize(1, 3, 0)).toBe(0); // no XP this week
    expect(leaguePrize(2, 2, 300)).toBe(0); // 2nd of 2: nobody behind
    expect(leaguePrize(1, 2, 300)).toBe(1000);
  });

  it('offers the report reasons the server takes, with a short note', () => {
    expect(USER_REPORT_REASONS.map((r) => r.id)).toEqual(['username', 'cheating', 'other']);
    expect(USER_REPORT_NOTE_MAX).toBe(500);
    expect(SOCIAL_ERROR_TEXT.MOMENT_NOT_FOUND).toBeTruthy();
  });
});

describe('avatars', () => {
  const ids = ['skill.science.astronomy', 'skill.money.how_money_works'];
  it('every tree\'s is open from the start; gold needs the tree mastered', () => {
    expect(avatarIdFor('skill.science.astronomy')).toBe('avatar.astronomy');
    expect(avatarIdFor('skill.money.how_money_works', true)).toBe('avatar.how_money_works.gold');
    expect(avatarUnlocked('avatar.astronomy', {}, ids)).toBe(true);
    expect(avatarUnlocked('avatar.astronomy.gold', { 'skill.science.astronomy': 99 }, ids)).toBe(false);
    expect(avatarUnlocked('avatar.astronomy.gold', { 'skill.science.astronomy': 100 }, ids)).toBe(true);
    expect(avatarUnlocked('avatar.nope', {}, ids)).toBe(false);
  });

  it('legendary ones need their trophy', () => {
    expect(avatarUnlocked('avatar.legendary.master_of_all', {}, ids)).toBe(false);
    expect(avatarUnlocked('avatar.legendary.master_of_all', {}, ids, ['trophy.master_of_all'])).toBe(true);
    expect(avatarUnlocked('avatar.legendary.streak_thousand', {}, ids, ['trophy.streak_365'])).toBe(false);
  });
});

