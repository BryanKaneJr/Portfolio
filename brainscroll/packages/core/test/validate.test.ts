import { describe, expect, it } from 'vitest';
import { validateContent, type RawContentBundle } from '../src';

function bundle(overrides: Partial<{ level: Record<string, unknown>; level2: Record<string, unknown> | null; verified: boolean }> = {}): RawContentBundle {
  const level = {
    id: 'level.science.astronomy.001',
    skillId: 'skill.science.astronomy',
    number: 1,
    revision: 1,
    status: 'draft',
    title: 'Your Cosmic Address',
    objective: 'Place Earth within the solar system.',
    summary: 'Earth orbits a star.',
    concepts: [{ conceptId: 'concept.astronomy.sun_is_a_star', role: 'teach' }],
    prerequisites: [],
    cards: [
      { id: 'card.astronomy.001.c1', type: 'text', role: 'hook', headline: 'The Sun is a star.' },
      { id: 'card.astronomy.001.c2', type: 'mcq', questionId: 'question.astronomy.001.q1' },
      { id: 'card.astronomy.001.c3', type: 'checkpoint', headline: 'Done', learned: ['The Sun is a star'] },
    ],
    questions: [
      {
        id: 'question.astronomy.001.q1',
        kind: 'mcq',
        conceptIds: ['concept.astronomy.sun_is_a_star'],
        prompt: 'What is the Sun?',
        options: [
          { id: 'a', label: 'A star', correct: true },
          { id: 'b', label: 'A planet', correct: false },
        ],
        explanation: 'The Sun is a star.',
        difficulty: 0.1,
      },
    ],
    sourceIds: ['source.nasa_sun'],
    ...overrides.level,
  };
  const levels: { where: string; data: unknown }[] = [{ where: 'l1', data: level }];
  if (overrides.level2) levels.push({ where: 'l2', data: overrides.level2 });
  return {
    subjects: [{ id: 'subject.science', name: 'Science', order: 1, status: 'draft' }],
    skills: [{ id: 'skill.science.astronomy', subjectId: 'subject.science', name: 'Astronomy', order: 1, status: 'draft', description: 'Space.' }],
    sources: [{ id: 'source.nasa_sun', title: 'Sun facts', url: 'https://science.nasa.gov/sun/facts/', publisher: 'NASA', license: 'US_gov_public_domain', accessedAt: '2026-09-23', verified: overrides.verified ?? true }],
    assets: [],
    concepts: [
      {
        where: 'concepts',
        data: { id: 'concept.astronomy.sun_is_a_star', title: 'The Sun is a star', description: 'The Sun is a star.', difficulty: 0.05, facts: [{ text: 'The Sun is a star.', sourceIds: ['source.nasa_sun'] }] },
      },
    ],
    levels,
  };
}

const errors = (b: RawContentBundle) => validateContent(b).issues.filter((i) => i.severity === 'error');

describe('validateContent', () => {
  it('accepts a minimal valid level', () => {
    expect(errors(bundle())).toEqual([]);
  });

  it('rejects a question with two correct answers', () => {
    const b = bundle();
    const lvl = b.levels[0]!.data as { questions: { options: { correct: boolean }[] }[] };
    lvl.questions[0]!.options[1]!.correct = true;
    expect(errors(b).map((e) => e.message)).toContain('must have exactly one correct option; has 2');
  });

  it('rejects a card pointing at a missing question', () => {
    const b = bundle();
    const lvl = b.levels[0]!.data as { cards: { questionId?: string }[] };
    lvl.cards[1]!.questionId = 'question.astronomy.001.q9';
    expect(errors(b).some((e) => e.message.includes('missing question'))).toBe(true);
  });

  it('rejects mismatched id and number', () => {
    expect(errors(bundle({ level: { number: 2 } })).length).toBeGreaterThan(0);
  });

  it('blocks publishing with unverified sources but only warns on drafts', () => {
    expect(errors(bundle({ verified: false }))).toEqual([]);
    expect(errors(bundle({ verified: false, level: { status: 'published' } })).some((e) => e.message.includes('unverified'))).toBe(true);
  });

  it('requires recall cards to test a concept taught earlier', () => {
    const level2 = {
      ...(bundle().levels[0]!.data as object),
      id: 'level.science.astronomy.002',
      number: 2,
      prerequisites: ['level.science.astronomy.001'],
      concepts: [
        { conceptId: 'concept.astronomy.sun_is_a_star', role: 'recall' },
      ],
      cards: [
        { id: 'card.astronomy.002.c1', type: 'text', role: 'hook', headline: 'Remember the Sun?' },
        { id: 'card.astronomy.002.c2', type: 'recall', questionId: 'question.astronomy.002.q1' },
        { id: 'card.astronomy.002.c3', type: 'checkpoint', headline: 'Done', learned: ['x'] },
      ],
      questions: [{ ...(bundle().levels[0]!.data as { questions: object[] }).questions[0]!, id: 'question.astronomy.002.q1' }],
    };
    const errs = errors(bundle({ level2 }));
    // Level 2 recalls correctly, but teaches nothing new.
    expect(errs.map((e) => e.message)).toEqual(['teaches no concept']);
  });

  it('requires contiguous level numbers', () => {
    const level3 = { ...(bundle().levels[0]!.data as object), id: 'level.science.astronomy.003', number: 3, cards: [], questions: [] };
    expect(errors(bundle({ level2: level3 })).some((e) => e.message.includes('contiguous'))).toBe(true);
  });
});
