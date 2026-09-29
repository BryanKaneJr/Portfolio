import { describe, expect, it } from 'vitest';
import {
  answerFinalRound,
  completeQuest,
  emptyProgress,
  openFinalRound,
  questsView,
  QuestError,
  startQuest,
  type ProgressState,
  type QuestDefinition,
} from '../src';

// Mirrors backend/tests/quests.test.sql. "Now" is Wednesday of the live week.
const NOW = new Date('2026-10-07T12:00:00Z');
const def = (id: string, startsOn: string, requirements: QuestDefinition['requirements'], xpReward = 50): QuestDefinition => ({
  id,
  startsOn,
  requirements,
  xpReward,
  trophy: { id: `trophy.${id.split('.')[1]}`, name: id },
});
const LIVE = def('quest.live', '2026-10-05', [
  { skillId: 'skill.science.testing', newLevels: 2 },
  { skillId: 'skill.science.curve', newLevels: 1 },
]);
const PAST = def('quest.past', '2026-09-21', [{ skillId: 'skill.science.testing', newLevels: 1 }], 75);
const OLDER = def('quest.older', '2026-09-14', [{ skillId: 'skill.science.testing', newLevels: 1 }]);
const FUTURE = def('quest.future', '2026-10-12', [{ skillId: 'skill.science.testing', newLevels: 1 }]);
const ALL = [LIVE, PAST, OLDER, FUTURE];

const minutes = (m: number) => new Date(NOW.getTime() + m * 60_000);
function clear(state: ProgressState, skill: 'testing' | 'curve', n: number, at: Date): ProgressState {
  const levelId = `level.science.${skill}.${String(n).padStart(3, '0')}`;
  const key = `level_complete:${levelId}`;
  if (state.xpEvents.some((e) => e.idempotencyKey === key)) return state; // a replay is not a new level
  return { ...state, xpEvents: [...state.xpEvents, { type: 'LEVEL_COMPLETE', amount: 100, skillId: `skill.science.${skill}`, levelId, idempotencyKey: key, at: at.toISOString() }] };
}
// Testing levels have one question; the curve level has three (q3 last).
const questionsFor = (levelId: string) =>
  levelId.includes('curve') ? [1, 2, 3].map((n) => ({ id: `question.curve.001.q${n}`, purpose: 'recall' })) : [{ id: levelId.replace('level.science.', 'question.') + '.q1' }];
const right = () => ({ correct: true, explanation: 'Because.' });
const wrong = () => ({ correct: false, rationale: 'Not b.' });
const view = (s: ProgressState, id: string, now = NOW) => questsView(s, ALL, now).quests.find((q) => q.id === id);
const done = (s: ProgressState, id: string, skill: string, now = NOW) => view(s, id, now)?.requirements.find((r) => r.skillId === skill)?.done;

describe('weekly quests', () => {
  it('runs a live quest from the ledger, through the Final Round, to the trophy', () => {
    let s = emptyProgress(new Date('2026-09-01T00:00:00Z'), 'UTC');
    expect(view(s, 'quest.future')).toBeUndefined();
    expect(view(s, 'quest.live')).toMatchObject({ state: 'live', active: true, finalRoundUnlocked: false });
    expect(view(s, 'quest.past')).toMatchObject({ state: 'archive', active: false });
    expect(() => openFinalRound(s, LIVE, NOW, questionsFor)).toThrow(QuestError);

    s = clear(s, 'testing', 1, minutes(1));
    s = clear(s, 'testing', 2, minutes(2));
    s = clear(s, 'curve', 1, minutes(3));
    s = clear(s, 'testing', 1, minutes(4));
    expect(done(s, 'quest.live', 'skill.science.testing')).toBe(2);
    expect(done(s, 'quest.live', 'skill.science.curve')).toBe(1);
    expect(done(s, 'quest.past', 'skill.science.testing')).toBe(0);
    expect(view(s, 'quest.live')?.finalRoundUnlocked).toBe(true);

    s = openFinalRound(s, LIVE, minutes(5), questionsFor);
    expect(view(s, 'quest.live')?.finalRound?.questionIds).toEqual(['question.testing.002.q1', 'question.curve.001.q3']);
    expect(openFinalRound(s, LIVE, minutes(6), questionsFor)).toBe(s);

    expect(() => completeQuest(s, LIVE, minutes(6))).toThrow('FINAL_ROUND_UNRESOLVED');
    expect(() => answerFinalRound(s, LIVE, { questionId: 'question.testing.001.q1', now: minutes(6), grade: right })).toThrow('QUESTION_NOT_IN_FINAL_ROUND');

    let r = answerFinalRound(s, LIVE, { questionId: 'question.curve.001.q3', now: minutes(6), grade: wrong });
    expect(r.result).toEqual({ correct: false, resolved: false, rationale: 'Not b.' });
    s = r.state;
    s = answerFinalRound(s, LIVE, { questionId: 'question.curve.001.q3', now: minutes(7), grade: right }).state;
    s = answerFinalRound(s, LIVE, { questionId: 'question.testing.002.q1', now: minutes(7), grade: right }).state;

    const c = completeQuest(s, LIVE, minutes(8));
    expect(c.result).toEqual({ questId: 'quest.live', xpAwarded: 50, liveClear: true, trophy: { trophyId: 'trophy.live', name: 'quest.live' } });
    s = c.state;
    expect(completeQuest(s, LIVE, minutes(9)).result.xpAwarded).toBe(0);
    expect(view(s, 'quest.live')?.state).toBe('completed');
    expect(s.xpEvents.filter((e) => e.type === 'QUEST_COMPLETE')).toHaveLength(1);
    expect(questsView(s, ALL, NOW).trophies).toHaveLength(1);

    // The Archive: XP, but no trophy; levels before you start it don't count.
    s = startQuest(s, PAST, minutes(10));
    expect(view(s, 'quest.past')).toMatchObject({ active: true });
    expect(done(s, 'quest.past', 'skill.science.testing')).toBe(0);
    s = clear(s, 'testing', 3, minutes(11));
    expect(done(s, 'quest.past', 'skill.science.testing')).toBe(1);
    s = openFinalRound(s, PAST, minutes(12), questionsFor);
    s = answerFinalRound(s, PAST, { questionId: 'question.testing.003.q1', now: minutes(12), grade: right }).state;
    const a = completeQuest(s, PAST, minutes(13));
    expect(a.result).toEqual({ questId: 'quest.past', xpAwarded: 75, liveClear: false });
    s = a.state;
    expect(questsView(s, ALL, NOW).trophies).toHaveLength(1);
    expect(view(s, 'quest.past')?.active).toBe(false);
  });

  it('keeps one active Archive quest; switching resets the one you leave', () => {
    let s = emptyProgress(new Date('2026-09-01T00:00:00Z'), 'UTC');
    s = startQuest(s, PAST, minutes(1));
    s = clear(s, 'testing', 1, minutes(2));
    expect(done(s, 'quest.past', 'skill.science.testing')).toBe(1);
    s = startQuest(s, OLDER, minutes(3));
    expect(view(s, 'quest.past')).toMatchObject({ active: false });
    expect(done(s, 'quest.past', 'skill.science.testing')).toBe(0);
    expect(view(s, 'quest.older')).toMatchObject({ active: true });
    expect(done(s, 'quest.older', 'skill.science.testing')).toBe(0);
  });

  it('carries over your own unfinished live week when you continue it', () => {
    let s = emptyProgress(new Date('2026-09-01T00:00:00Z'), 'UTC');
    s = clear(s, 'testing', 1, new Date('2026-09-22T09:00:00Z')); // during quest.past's live week
    s = startQuest(s, PAST, NOW);
    expect(done(s, 'quest.past', 'skill.science.testing')).toBe(1);
    expect(view(s, 'quest.past')?.finalRoundUnlocked).toBe(true);
  });

  it('pays no trophy for a live quest finished after its week', () => {
    let s = emptyProgress(new Date('2026-09-01T00:00:00Z'), 'UTC');
    s = clear(s, 'testing', 1, minutes(1));
    s = clear(s, 'testing', 2, minutes(2));
    s = clear(s, 'curve', 1, minutes(3));
    s = openFinalRound(s, LIVE, minutes(4), questionsFor);
    for (const q of view(s, 'quest.live')!.finalRound!.questionIds) s = answerFinalRound(s, LIVE, { questionId: q, now: minutes(5), grade: right }).state;
    const afterWeek = new Date('2026-10-12T00:00:01Z');
    expect(completeQuest(s, LIVE, afterWeek).result).toEqual({ questId: 'quest.live', xpAwarded: 50, liveClear: false });
  });
});
