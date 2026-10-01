import { describe, expect, it } from 'vitest';
import { avatarIdFor, avatarUnlocked, compareSubjects, leagueFits, leaguePrize, leagueWeekStart, ordinal, rarestTrophies, usernameProblem, weeklyXp, type XpEvent } from '../src';

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
});

