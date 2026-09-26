import { describe, expect, it } from 'vitest';
import {
  CompletionError,
  answerQuestion,
  buildReviewQueue,
  checkStart,
  completeLevel,
  dailyStatus,
  dueConcepts,
  emptyProgress,
  levelTypeFor,
  type Level,
  type ProgressState,
} from '../src';

// Mirrors backend/tests/core-loop.test.sql so local play and the server agree.

/** A regular level: 3 questions (correct option is always "a"), each on its own concept. */
function lvl(n: number): Level {
  const num = String(n).padStart(3, '0');
  const q = (i: number) => ({
    id: `question.testing.${num}.q${i}`,
    kind: 'mcq' as const,
    purpose: (['recall', 'understanding', 'connection'] as const)[i - 1]!,
    conceptIds: [`concept.testing.c${n}_${i}`],
    sourceCardIds: [`card.testing.${num}.c1`],
    prompt: 'Q?',
    options: [
      { id: 'a', label: 'A', correct: true },
      { id: 'b', label: 'B', correct: false, rationale: 'Not B.' },
      { id: 'c', label: 'C', correct: false },
    ],
    explanation: 'Because A.',
    difficulty: 0.1,
  });
  return {
    id: `level.science.testing.${num}`,
    skillId: 'skill.science.testing',
    number: n,
    type: levelTypeFor(n),
    revision: 1,
    status: 'published',
    title: `Level ${n}`,
    objective: 'x',
    summary: 'x',
    concepts: [1, 2, 3].map((i) => ({ conceptId: `concept.testing.c${n}_${i}`, role: 'teach' as const, weight: 1 })),
    prerequisites: [],
    cards: [],
    questions: [q(1), q(2), q(3)],
    sourceIds: ['source.test'],
  };
}

const NOW = new Date('2026-09-23T15:00:00Z');
/** Not the first day, so the normal 5/day cap applies. */
const veteran = (): ProgressState => emptyProgress(new Date('2026-08-01T00:00:00Z'), 'UTC');
const qid = (n: number, i: number) => `question.testing.${String(n).padStart(3, '0')}.q${i}`;

function answer(s: ProgressState, n: number, i: number, opt: string) {
  return answerQuestion(s, { level: lvl(n), questionId: qid(n, i), optionId: opt });
}
/** Answer every question: `first[i]` is the first choice; wrong ones are then corrected. */
function play(s: ProgressState, n: number, first: string[] = ['a', 'a', 'a']): ProgressState {
  first.forEach((opt, k) => {
    s = answer(s, n, k + 1, opt).state;
    if (opt !== 'a') s = answer(s, n, k + 1, 'a').state;
  });
  return s;
}
function complete(s: ProgressState, n: number, key = `k${n}-${Math.random()}`) {
  return completeLevel(s, { level: lvl(n), idempotencyKey: key, now: NOW });
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

describe('first-attempt XP curve', () => {
  it.each([
    [['a', 'a', 'a'], 100, 'perfect'],
    [['a', 'b', 'a'], 70, 'strong'],
    [['b', 'a', 'c'], 35, 'reinforced'],
    [['b', 'c', 'b'], 15, 'heavily_reinforced'],
  ] as const)('first attempts %j award %i XP (%s)', (first, xp, outcome) => {
    const r = complete(play(veteran(), 1, [...first]), 1);
    expect(r.summary).toMatchObject({ xpAwarded: xp, outcome, total: 3, skillLevel: 1 });
    expect(r.state.xpEvents).toEqual([expect.objectContaining({ type: 'LEVEL_COMPLETE', amount: xp })]);
  });

  it('never goes negative and corrections never restore lost XP', () => {
    const r = complete(play(veteran(), 1, ['b', 'b', 'a']), 1);
    expect(r.summary.firstAttemptCorrect).toBe(1);
    expect(r.summary.xpAwarded).toBe(35);
    expect(r.state.xpEvents.every((e) => e.amount > 0)).toBe(true);
  });
});

describe('resolution before completion', () => {
  it('requires every question to be correctly resolved', () => {
    let s = veteran();
    expect(code(() => complete(s, 1))).toBe('UNRESOLVED_QUESTIONS');
    s = answer(s, 1, 1, 'a').state;
    s = answer(s, 1, 2, 'b').state; // wrong and not yet corrected
    s = answer(s, 1, 3, 'a').state;
    expect(code(() => complete(s, 1))).toBe('UNRESOLVED_QUESTIONS');
    s = answer(s, 1, 2, 'c').state; // still wrong
    expect(code(() => complete(s, 1))).toBe('UNRESOLVED_QUESTIONS');
    s = answer(s, 1, 2, 'a').state;
    expect(complete(s, 1).summary.skillLevel).toBe(1);
  });

  it('shows the rationale for a wrong answer and the explanation once resolved', () => {
    const wrong = answer(veteran(), 1, 1, 'b');
    expect(wrong.result).toMatchObject({ correct: false, resolved: false, firstAttemptCorrect: false, attemptCount: 1, rationale: 'Not B.' });
    expect(wrong.result.explanation).toBeUndefined();
    const right = answer(wrong.state, 1, 1, 'a');
    expect(right.result).toMatchObject({ correct: true, resolved: true, firstAttemptCorrect: false, attemptCount: 2, explanation: 'Because A.' });
  });
});

describe('anti-farming', () => {
  it('keeps the first attempt immutable: answering again cannot improve it', () => {
    let s = answer(veteran(), 1, 1, 'b').state;
    s = answer(s, 1, 1, 'a').state;
    // "Restart" the level and answer perfectly: the recorded first attempt stands.
    s = answer(s, 1, 1, 'a').state;
    s = play(s, 1, ['a', 'a', 'a']);
    expect(s.questionAttempts[qid(1, 1)]).toMatchObject({ firstOptionId: 'b', firstAttemptCorrect: false });
    expect(complete(s, 1).summary.xpAwarded).toBe(70);
  });

  it('awards primary XP once; replays award nothing and record only the check', () => {
    const r1 = complete(play(veteran(), 1), 1, 'same');
    expect(r1.summary.xpAwarded).toBe(100);
    const r2 = complete(r1.state, 1, 'different');
    expect(r2.summary).toMatchObject({ xpAwarded: 0, alreadyCompleted: true });
    expect(r2.state).toBe(r1.state);
    const replay = answer(r1.state, 1, 1, 'b');
    const { checks, ...rest } = replay.state;
    expect(rest).toEqual(r1.state);
    expect(Object.keys(checks ?? {})).toEqual(['question.testing.001.q1']);
    expect(r1.state.xpEvents.reduce((n, e) => n + e.amount, 0)).toBe(100);
  });

  it("doesn't record attempts on locked levels", () => {
    expect(code(() => answer(veteran(), 2, 1, 'a'))).toBe('LEVEL_LOCKED');
    expect(checkStart(veteran(), lvl(2), NOW)).toBe('LEVEL_LOCKED');
  });
});

describe('review priority from first attempts', () => {
  it('queues missed concepts sooner and repeatedly-missed ones first', () => {
    // q1 right first time, q2 missed once, q3 missed twice.
    let s = veteran();
    s = answer(s, 1, 1, 'a').state;
    s = answer(s, 1, 2, 'b').state;
    s = answer(s, 1, 2, 'a').state;
    s = answer(s, 1, 3, 'b').state;
    s = answer(s, 1, 3, 'c').state;
    s = answer(s, 1, 3, 'a').state;
    const r = complete(s, 1);
    expect(r.summary.reinforcedConceptIds).toEqual(['concept.testing.c1_2', 'concept.testing.c1_3']);
    const c = r.state.concepts;
    expect(c['concept.testing.c1_1']).toMatchObject({ strength: 1, priority: 0 });
    expect(c['concept.testing.c1_2']).toMatchObject({ strength: 0, priority: 1 });
    expect(c['concept.testing.c1_3']).toMatchObject({ strength: 0, priority: 2 });
    expect(c['concept.testing.c1_3']!.dueAt).toBe(NOW.toISOString()); // due right away
    expect(new Date(c['concept.testing.c1_2']!.dueAt).getTime() - NOW.getTime()).toBe(10 * 60_000);
    // Highest priority reviews first.
    const later = new Date(NOW.getTime() + 11 * 60_000);
    expect(dueConcepts(r.state, later)).toEqual(['concept.testing.c1_3', 'concept.testing.c1_2']);
    expect(buildReviewQueue(r.state, [lvl(1)], later).map((i) => i.conceptId)).toEqual(['concept.testing.c1_3', 'concept.testing.c1_2']);
  });
});

describe('daily cap, Unlimited and mastery', () => {
  it('counts one resolved level as one level: 5/5 ends the day, replays stay open', () => {
    let s = veteran();
    for (let n = 1; n <= 5; n++) s = complete(play(s, n, ['b', 'b', 'b']), n).state;
    expect(dailyStatus(s, NOW)).toMatchObject({ used: 5, dailyComplete: true });
    expect(checkStart(s, lvl(6), NOW)).toBe('DAILY_COMPLETE');
    expect(code(() => complete(play(s, 6), 6))).toBe('DAILY_LIMIT_REACHED');
    expect(checkStart(s, lvl(1), NOW)).toBe('REPLAY');
    expect(checkStart(s, lvl(6), new Date('2026-09-24T15:00:00Z'))).toBe('NEW');
  });

  it('removes only the cap for Unlimited: same XP per level', () => {
    let s = veteran();
    for (let n = 1; n <= 5; n++) s = complete(play(s, n), n).state;
    s = { ...s, hasUnlimited: true };
    const r = complete(play(s, 6), 6);
    expect(r.summary).toMatchObject({ skillLevel: 6, xpAwarded: 100 });
    expect(r.summary.daily.cap).toBeNull();
  });

  it('gives a brand-new account the first-day bonus', () => {
    expect(dailyStatus(emptyProgress(NOW, 'UTC'), NOW).cap).toBe(10);
  });

  it('earns the ★ at level 100 by resolving it, with XP from the Mastery pool and no separate bonus', () => {
    const at99: ProgressState = { ...veteran(), skills: { 'skill.science.testing': { highestCleared: 99, stars: 0, totalXp: 0 } } };
    const perfect = complete(play(at99, 100), 100);
    expect(perfect.summary).toMatchObject({ skillLevel: 100, stars: 1, masteryCleared: true, xpAwarded: 500, outcome: 'perfect' });
    expect(perfect.state.xpEvents).toEqual([expect.objectContaining({ type: 'LEVEL_COMPLETE', amount: 500 })]);
    // No minimum first-attempt score: every question missed first, then corrected, still earns the star.
    const corrected = complete(play(at99, 100, ['b', 'b', 'b']), 100);
    expect(corrected.summary).toMatchObject({ stars: 1, masteryCleared: true, xpAwarded: 75, outcome: 'heavily_reinforced' });
    // …and opens the next band.
    expect(checkStart(corrected.state, lvl(101), NOW)).toBe('NEW');
  });

  it('awards checkpoint XP from the checkpoint pool', () => {
    const at9: ProgressState = { ...veteran(), skills: { 'skill.science.testing': { highestCleared: 9, stars: 0, totalXp: 0 } } };
    expect(complete(play(at9, 10), 10).summary).toMatchObject({ xpAwarded: 150, masteryCleared: false });
  });
});
