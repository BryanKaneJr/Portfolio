import { describe, expect, it } from 'vitest';
import { LEARNING_STRUCTURE, STANDARD_QUESTIONS, levelTypeFor, validateContent, type RawContentBundle } from '../src';

const CONCEPT = 'concept.astronomy.sun_is_a_star';
const FACT = 'fact.astronomy.sun_is_a_star';
const PURPOSES = ['recall', 'understanding', 'connection'] as const;

/** A well-formed regular level: hook → 2 learning cards → 3 questions → recap. */
function makeLevel(n: number, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const num = String(n).padStart(3, '0');
  const q = (i: number) => ({
    id: `question.astronomy.${num}.q${i}`,
    kind: 'mcq',
    purpose: PURPOSES[(i - 1) % 3],
    conceptIds: [CONCEPT],
    sourceCardIds: [`card.astronomy.${num}.c2`],
    prompt: `Question ${i}?`,
    options: [
      { id: 'a', label: 'A star', correct: i === 1 },
      { id: 'b', label: 'A planet', correct: i === 2 },
      { id: 'c', label: 'A moon', correct: i === 3 },
    ],
    explanation: 'The Sun is a star.',
    difficulty: 0.1,
  });
  const body = 'The Sun is an ordinary star, the closest one to Earth, and every other star you can see is a distant sun of its own. '.repeat(2);
  return {
    id: `level.science.astronomy.${num}`,
    skillId: 'skill.science.astronomy',
    number: n,
    type: levelTypeFor(n),
    revision: 1,
    status: 'draft',
    title: 'Your Cosmic Address',
    objective: 'Place Earth within the solar system.',
    summary: 'Earth orbits a star.',
    concepts: [{ conceptId: CONCEPT, role: 'teach' }],
    prerequisites: n > 1 ? [`level.science.astronomy.${String(n - 1).padStart(3, '0')}`] : [],
    cards: [
      { id: `card.astronomy.${num}.c1`, type: 'text', role: 'hook', headline: 'The Sun is a star.' },
      { id: `card.astronomy.${num}.c2`, type: 'text', role: 'explain', headline: 'An ordinary star', body },
      { id: `card.astronomy.${num}.c3`, type: 'fact', fact: 'The Sun is the closest star to Earth.', context: body },
      { id: `card.astronomy.${num}.c4`, type: 'mcq', questionId: `question.astronomy.${num}.q1` },
      { id: `card.astronomy.${num}.c5`, type: 'mcq', questionId: `question.astronomy.${num}.q2` },
      { id: `card.astronomy.${num}.c6`, type: 'mcq', questionId: `question.astronomy.${num}.q3` },
      { id: `card.astronomy.${num}.c7`, type: 'checkpoint', headline: 'Done', learned: ['The Sun is a star'] },
    ],
    questions: [q(1), q(2), q(3)],
    sourceIds: ['source.nasa_sun'],
    ...overrides,
  };
}

function bundle(levels: Record<string, unknown>[] = [makeLevel(1)], verified = true, verification: unknown[] = [verifiedRecord()]): RawContentBundle {
  return {
    subjects: [{ id: 'subject.science', name: 'Science', order: 1, status: 'draft' }],
    skills: [{ id: 'skill.science.astronomy', subjectId: 'subject.science', name: 'Astronomy', order: 1, status: 'draft', description: 'Space.' }],
    sources: [{ id: 'source.nasa_sun', title: 'Sun facts', url: 'https://science.nasa.gov/sun/facts/', publisher: 'NASA', license: 'US_gov_public_domain', accessedAt: '2026-09-23', verified }],
    assets: [],
    concepts: [
      {
        where: 'concepts',
        data: { id: CONCEPT, title: 'The Sun is a star', description: 'The Sun is a star.', difficulty: 0.05, facts: [{ id: FACT, text: 'The Sun is a star.', sourceIds: ['source.nasa_sun'], cardIds: ['card.astronomy.001.c2'] }] },
      },
    ],
    levels: levels.map((data, i) => ({ where: `l${i + 1}`, data })),
    verification,
  };
}

function verifiedRecord(overrides: Record<string, unknown> = {}) {
  return { factId: FACT, sourceId: 'source.nasa_sun', status: 'verified', checkedBy: 'Editor', checkedAt: '2026-09-24', supportingQuote: 'The Sun is a star.', ...overrides };
}

const issues = (b: RawContentBundle, severity: 'error' | 'warning') =>
  validateContent(b).issues.filter((i) => i.severity === severity).map((i) => i.message);

type Q = { options: { correct: boolean }[] };
type Card = { questionId?: string };

describe('validateContent', () => {
  it('accepts a well-formed regular level with no errors or warnings', () => {
    expect(issues(bundle(), 'error')).toEqual([]);
    expect(issues(bundle(), 'warning')).toEqual([]);
  });

  it('rejects a question with two correct answers', () => {
    const l = makeLevel(1);
    (l.questions as Q[])[0]!.options[1]!.correct = true;
    expect(issues(bundle([l]), 'error')).toContain('must have exactly one correct option; has 2');
  });

  it('rejects a card pointing at a missing question', () => {
    const l = makeLevel(1);
    (l.cards as Card[])[3]!.questionId = 'question.astronomy.001.q9';
    expect(issues(bundle([l]), 'error').some((m) => m.includes('missing question'))).toBe(true);
  });

  it('rejects mismatched id and number', () => {
    expect(issues(bundle([makeLevel(1, { number: 2 })]), 'error').length).toBeGreaterThan(0);
  });

  it('blocks publishing with unverified sources but only warns on drafts', () => {
    expect(issues(bundle([makeLevel(1)], false), 'error')).toEqual([]);
    expect(issues(bundle([makeLevel(1, { status: 'published' })], false), 'error').some((m) => m.includes('unverified'))).toBe(true);
  });

  it('requires recall cards to test a concept taught earlier', () => {
    const l2 = makeLevel(2, { concepts: [{ conceptId: CONCEPT, role: 'recall' }] });
    (l2.cards as Record<string, unknown>[])[3]!.type = 'recall';
    // Level 2 recalls correctly, but teaches nothing new.
    expect(issues(bundle([makeLevel(1), l2]), 'error')).toEqual(['teaches no concept']);
  });

  it('requires contiguous level numbers', () => {
    expect(issues(bundle([makeLevel(1), makeLevel(3)]), 'error').some((m) => m.includes('contiguous'))).toBe(true);
  });
});

describe('level structure by type', () => {
  it('derives the canonical type from the level number', () => {
    expect([1, 9, 10, 20, 49, 50, 60, 99, 100, 150, 200].map(levelTypeFor)).toEqual([
      'regular', 'regular', 'checkpoint', 'checkpoint', 'regular', 'milestone', 'checkpoint', 'regular', 'mastery', 'milestone', 'mastery',
    ]);
  });

  it('rejects a declared type that does not match the schedule', () => {
    expect(issues(bundle([makeLevel(1, { type: 'mastery' })]), 'error')).toContain('level 1 must be type "regular", not "mastery"');
  });

  it('never lets a regular level become a 10-question test', () => {
    const l = makeLevel(1);
    const qs = l.questions as Record<string, unknown>[];
    const cards = l.cards as Record<string, unknown>[];
    for (let i = 4; i <= 10; i++) {
      qs.push({ ...qs[0]!, id: `question.astronomy.001.q${i}` });
      cards.splice(cards.length - 1, 0, { id: `card.astronomy.001.c${i + 4}`, type: 'mcq', questionId: `question.astronomy.001.q${i}` });
    }
    expect(issues(bundle([l]), 'error')).toContain('Level has 10 questions; allowed 2–4');
  });

  it('warns when a regular level drifts from 3 questions, and allows 2–4', () => {
    const l = makeLevel(1);
    l.questions = (l.questions as unknown[]).slice(0, 2);
    l.cards = (l.cards as Card[]).filter((c) => c.questionId !== 'question.astronomy.001.q3');
    expect(issues(bundle([l]), 'error')).toEqual([]);
    expect(issues(bundle([l]), 'warning')).toContain('Level has 2 questions; the standard is 3');
    // Published content must match the canonical count exactly.
    expect(issues(bundle([{ ...l, status: 'published' }]), 'error')).toContain('Level has 2 questions; the standard is 3');
  });

  it('has one canonical question count per type: 3 · 5 · 7 · 10', () => {
    expect(STANDARD_QUESTIONS).toEqual({ regular: 3, checkpoint: 5, milestone: 7, mastery: 10 });
    for (const t of ['regular', 'checkpoint', 'milestone', 'mastery'] as const) {
      expect(LEARNING_STRUCTURE[t].questions.standard).toBe(STANDARD_QUESTIONS[t]);
    }
  });

  /** Question-count issues for an encounter level with `n` questions and no learning cards. */
  const encounterIssues = (number: number, n: number, severity: 'error' | 'warning') => {
    const num = String(number).padStart(3, '0');
    const qs = Array.from({ length: n }, (_, i) => ({ ...(makeLevel(number).questions as object[])[0]!, id: `question.astronomy.${num}.q${i + 1}` }));
    const cards = [
      { id: `card.astronomy.${num}.c1`, type: 'text', role: 'hook', headline: 'Encounter' },
      ...qs.map((q, i) => ({ id: `card.astronomy.${num}.c${i + 2}`, type: 'mcq', questionId: (q as { id: string }).id })),
    ];
    return validateContent(bundle([makeLevel(number, { questions: qs, cards })]))
      .issues.filter((i) => i.severity === severity && i.message.includes('questions;'))
      .map((i) => i.message);
  };

  it('accepts a 10-question Mastery Challenge at level 100', () => {
    expect(encounterIssues(100, 10, 'error')).toEqual([]);
    expect(encounterIssues(100, 10, 'warning')).toEqual([]);
  });

  it('makes 7 the fixed Level 50 milestone standard', () => {
    expect(encounterIssues(50, 7, 'error')).toEqual([]);
    expect(encounterIssues(50, 7, 'warning')).toEqual([]);
    expect(encounterIssues(50, 6, 'warning')).toEqual(['Milestone has 6 questions; the standard is 7']);
    expect(encounterIssues(50, 5, 'error')).toEqual(['Milestone has 5 questions; allowed 6–8']);
  });

  it('warns when questions come before the learning content', () => {
    const l = makeLevel(1);
    const cards = l.cards as Record<string, unknown>[];
    [cards[2], cards[3]] = [cards[3]!, cards[2]!];
    expect(issues(bundle([l]), 'warning')).toContain('put the learning cards before the questions');
  });

  it('warns when a regular level misses a question purpose', () => {
    const l = makeLevel(1);
    for (const q of l.questions as Record<string, unknown>[]) q.purpose = 'recall';
    expect(issues(bundle([l]), 'warning')).toContain('questions should cover recall, understanding and connection; missing understanding, connection');
  });

  it('warns when learning content is too thin', () => {
    const l = makeLevel(1);
    (l.cards as Record<string, unknown>[])[1]!.body = 'Too short.';
    expect(issues(bundle([l]), 'warning').some((m) => m.includes('words of learning content'))).toBe(true);
  });
});

describe('question → learning-card evidence', () => {
  const withSources = (ids: string[], n = 1) => {
    const l = makeLevel(n);
    (l.questions as Record<string, unknown>[])[0]!.sourceCardIds = ids;
    return l;
  };

  it('requires every question to name at least one source card', () => {
    expect(issues(bundle([withSources([])]), 'error').some((m) => m.includes('sourceCardIds'))).toBe(true);
  });

  it('rejects source cards that do not exist', () => {
    expect(issues(bundle([withSources(['card.astronomy.001.c9'])]), 'error')).toContain('source card card.astronomy.001.c9 does not exist');
  });

  it('rejects question or recap cards as evidence', () => {
    expect(issues(bundle([withSources(['card.astronomy.001.c4'])]), 'error')).toContain('source card card.astronomy.001.c4 must be a learning or hook card, not a mcq card');
    expect(issues(bundle([withSources(['card.astronomy.001.c7'])]), 'error')).toContain('source card card.astronomy.001.c7 must be a learning or hook card, not a checkpoint card');
  });

  it('allows evidence from an earlier level of the same skill, never a later one', () => {
    expect(issues(bundle([makeLevel(1), withSources(['card.astronomy.001.c2'], 2)]), 'error')).toEqual([]);
    expect(issues(bundle([withSources(['card.astronomy.002.c2'], 1), makeLevel(2)]), 'error')).toContain(
      'source card card.astronomy.002.c2 must be in this level or an earlier level of the same skill',
    );
  });
});

describe('answer position balance', () => {
  it('warns when one option letter is correct too often', () => {
    const levels = Array.from({ length: 8 }, (_, i) => {
      const l = makeLevel(i + 1);
      for (const q of l.questions as { options: { correct: boolean }[] }[]) q.options.forEach((o, j) => (o.correct = j === 0));
      return l;
    });
    expect(issues(bundle(levels), 'warning').some((m) => m.includes('24/24 correct answers are option a'))).toBe(true);
  });
});

describe('claim verification', () => {
  const published = () => makeLevel(1, { status: 'published' });

  it('lets a level publish only when every claim it states is verified', () => {
    expect(issues(bundle([published()]), 'error')).toEqual([]);
    const pending = bundle([published()], true, [verifiedRecord({ status: 'unverified' })]);
    expect(issues(pending, 'error')).toContain(`published level states unverified claim ${FACT}`);
  });

  it('only counts unverified claims as a warning on drafts', () => {
    expect(issues(bundle([makeLevel(1)], true, [verifiedRecord({ status: 'unverified' })]), 'warning')).toContain(
      '1/1 claims not yet verified — see docs/verification/',
    );
  });

  it('requires who, when and the supporting quote to mark a claim verified', () => {
    const b = bundle([makeLevel(1)], true, [verifiedRecord({ supportingQuote: undefined })]);
    expect(issues(b, 'error')).toContain(`${FACT} / source.nasa_sun is verified without checkedBy, checkedAt and supportingQuote`);
  });

  it('rejects records for sources the fact does not cite, and warns on missing records', () => {
    expect(issues(bundle([makeLevel(1)], true, [verifiedRecord({ sourceId: 'source.other' })]), 'error')).toEqual(
      expect.arrayContaining([`${FACT} does not cite source.other`]),
    );
    expect(issues(bundle([makeLevel(1)], true, []), 'warning')).toContain('no verification record for source.nasa_sun (run npm run verify:sync)');
  });

  it("rejects a fact pointing at a card in a level that doesn't cover its concept", () => {
    const other = makeLevel(2, { concepts: [{ conceptId: 'concept.astronomy.other', role: 'teach' }] });
    const b = bundle([makeLevel(1), other]);
    (b.concepts[0]!.data as { facts: { cardIds: string[] }[] }).facts[0]!.cardIds = ['card.astronomy.002.c2'];
    expect(issues(b, 'error')).toContain(`card card.astronomy.002.c2 is in level.science.astronomy.002, which does not list ${CONCEPT}`);
  });
});
