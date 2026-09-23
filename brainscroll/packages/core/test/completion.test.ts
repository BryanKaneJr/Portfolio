import { describe, expect, it } from 'vitest';
import { CompletionError, checkStart, completeLevel, dailyStatus, dueConcepts, emptyProgress, type Level, type ProgressState } from '../src';

// Mirrors backend/tests/core-loop.test.sql so local play and the server agree.

function lvl(n: number): Level {
  const num = String(n).padStart(3, '0');
  return {
    id: `level.science.testing.${num}`,
    skillId: 'skill.science.testing',
    number: n,
    revision: 1,
    status: 'published',
    title: `Level ${n}`,
    objective: 'x',
    summary: 'x',
    concepts: [{ conceptId: `concept.testing.c${n}`, role: 'teach', weight: 1 }],
    prerequisites: [],
    cards: [],
    questions: [
      {
        id: `question.testing.${num}.q1`,
        kind: 'mcq',
        conceptIds: [`concept.testing.c${n}`],
        prompt: 'Q?',
        options: [
          { id: 'a', label: 'A', correct: true },
          { id: 'b', label: 'B', correct: false },
        ],
        explanation: 'Because.',
        difficulty: 0.1,
      },
    ],
    sourceIds: ['source.test'],
  };
}
const ans = (n: number, opt: string) => ({ [`question.testing.${String(n).padStart(3, '0')}.q1`]: opt });

const NOW = new Date('2026-09-23T15:00:00Z');
/** Not the first day, so the normal 5/day cap applies. */
function veteran(): ProgressState {
  return emptyProgress(new Date('2026-08-01T00:00:00Z'), 'UTC');
}
function complete(s: ProgressState, n: number, opt = 'a', key = `k${n}-${Math.random()}`) {
  return completeLevel(s, { level: lvl(n), answers: ans(n, opt), idempotencyKey: key, now: NOW });
}
function code(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    if (e instanceof CompletionError) return e.code;
    throw e;
  }
  return undefined;
}

describe('completeLevel', () => {
  it("doesn't let you skip ahead", () => {
    const s = veteran();
    expect(checkStart(s, lvl(2), NOW)).toBe('LEVEL_LOCKED');
    expect(checkStart(s, lvl(1), NOW)).toBe('NEW');
    expect(code(() => complete(s, 2))).toBe('LEVEL_LOCKED');
  });

  it('requires every question to be answered', () => {
    expect(code(() => completeLevel(veteran(), { level: lvl(1), answers: {}, idempotencyKey: 'k', now: NOW }))).toBe('INCOMPLETE_ANSWERS');
  });

  it('awards XP exactly once per level', () => {
    const r1 = complete(veteran(), 1, 'a', 'same');
    expect(r1.summary).toMatchObject({ xpAwarded: 22, skillLevel: 1, alreadyCompleted: false, skillLevelBefore: 0 });
    const r2 = complete(r1.state, 1, 'a', 'same');
    expect(r2.summary).toMatchObject({ xpAwarded: 0, alreadyCompleted: true });
    expect(r2.state).toBe(r1.state);
    const r3 = complete(r1.state, 1, 'a', 'different');
    expect(r3.summary.xpAwarded).toBe(0);
    expect(r1.state.xpEvents.reduce((n, e) => n + e.amount, 0)).toBe(22);
  });

  it('lets a wrong answer complete the level and schedules the concept soon', () => {
    let s = complete(veteran(), 1).state;
    const r = complete(s, 2, 'b');
    s = r.state;
    expect(r.summary.xpAwarded).toBe(20);
    expect(s.concepts['concept.testing.c2']!.strength).toBe(0);
    expect(new Date(s.concepts['concept.testing.c2']!.dueAt).getTime() - NOW.getTime()).toBe(10 * 60_000);
    expect(s.concepts['concept.testing.c1']!.strength).toBe(1);
    expect(dueConcepts(s, new Date(NOW.getTime() + 11 * 60_000))).toEqual(['concept.testing.c2']);
  });

  it('ends the day at 5/5 while replays stay open', () => {
    let s = veteran();
    for (let n = 1; n <= 5; n++) s = complete(s, n).state;
    expect(dailyStatus(s, NOW)).toMatchObject({ used: 5, dailyComplete: true });
    expect(checkStart(s, lvl(6), NOW)).toBe('DAILY_COMPLETE');
    expect(code(() => complete(s, 6))).toBe('DAILY_LIMIT_REACHED');
    expect(checkStart(s, lvl(1), NOW)).toBe('REPLAY');
    // Next local day, the allowance resets.
    const tomorrow = new Date('2026-09-24T15:00:00Z');
    expect(checkStart(s, lvl(6), tomorrow)).toBe('NEW');
  });

  it('removes only the cap for Unlimited', () => {
    let s = veteran();
    for (let n = 1; n <= 5; n++) s = complete(s, n).state;
    s = { ...s, hasUnlimited: true };
    const r = complete(s, 6);
    expect(r.summary).toMatchObject({ skillLevel: 6, xpAwarded: 22 });
    expect(r.summary.daily.cap).toBeNull();
  });

  it('gives a brand-new account the first-day bonus', () => {
    expect(dailyStatus(emptyProgress(NOW, 'UTC'), NOW).cap).toBe(10);
  });

  it('awards a star and mastery XP at level 100', () => {
    const s: ProgressState = { ...veteran(), skills: { 'skill.science.testing': { highestCleared: 99, stars: 0, totalXp: 0 } } };
    const r = complete(s, 100);
    expect(r.summary).toMatchObject({ skillLevel: 100, stars: 1, masteryCleared: true, xpAwarded: 272 });
  });
});
