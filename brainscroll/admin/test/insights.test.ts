import { test } from 'node:test';
import assert from 'node:assert/strict';
import { levelFlags, MIN_LEARNERS, questionFlags } from '../lib/insights';

const options = [
  { id: 'a', label: 'Right', correct: true },
  { id: 'b', label: 'Tempting', correct: false },
  { id: 'c', label: 'Silly', correct: false },
];
const stat = (over: object) => ({ question_id: 'q', level_id: 'l', learners: 100, first_try_rate: 0.6, avg_attempts: 1.4, first_picks: { a: 60, b: 30, c: 10 }, review_attempts: 0, review_first_try_rate: null, ...over });

test('no flags below the learner threshold', () => {
  assert.deepEqual(questionFlags(stat({ learners: MIN_LEARNERS - 1, first_try_rate: 0.1 }), options), []);
});

test('a healthy question has no flags', () => {
  assert.deepEqual(questionFlags(stat({}), options), []);
});

test('flags hard, mis-keyed-looking, never-picked and poorly recalled questions', () => {
  const f = questionFlags(stat({ first_try_rate: 0.3, first_picks: { a: 30, b: 70, c: 0 }, review_attempts: 40, review_first_try_rate: 0.4 }), options);
  assert.ok(f.some((x) => x.startsWith('Hard')));
  assert.ok(f.some((x) => x.includes('“Tempting” is picked first more often')));
  assert.ok(f.some((x) => x.includes('“Silly” is never picked')));
  assert.ok(f.some((x) => x.startsWith('Weak delayed recall')));
});

test('flags levels people leave and where they leave', () => {
  const f = levelFlags({ level_id: 'l', started: 100, completed: 60, completion_rate: 0.6, mean_first_try_share: 0.7, exits_by_card: { '3': 30, '1': 5 } }, 8);
  assert.ok(f[0]!.startsWith('40% of learners'));
  assert.ok(f[1]!.includes('card 4 of 8'));
});
