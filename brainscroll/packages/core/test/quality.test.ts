import { describe, expect, it } from 'vitest';
import { checkQuality, checkRevisions, jaccard, contentWords, numbersIn, type Concept, type Level } from '../src';

/** A minimal level: hook, one learning card stating a fact, questions, recap. */
function level(n: number, questions: Partial<Level['questions'][number]>[] = [{}], extra: Partial<Level> = {}): Level {
  const num = String(n).padStart(3, '0');
  return {
    id: `level.science.astronomy.${num}`,
    skillId: 'skill.science.astronomy',
    number: n,
    type: 'regular',
    revision: 1,
    status: 'draft',
    title: 'T',
    objective: 'O',
    summary: 'S',
    concepts: [{ conceptId: 'concept.astronomy.c1', role: 'teach', weight: 1 }],
    prerequisites: [],
    cards: [
      { id: `card.astronomy.${num}.c1`, type: 'text', role: 'hook', headline: 'Hook' },
      { id: `card.astronomy.${num}.c2`, type: 'text', role: 'explain', headline: 'Sun', body: 'The Sun is about 4.6 billion years old.' },
      ...questions.map((_, i) => ({ id: `card.astronomy.${num}.c${i + 3}`, type: 'mcq' as const, questionId: `question.astronomy.${num}.q${i + 1}` })),
    ],
    questions: questions.map((q, i) => ({
      id: `question.astronomy.${num}.q${i + 1}`,
      kind: 'mcq' as const,
      purpose: 'recall' as const,
      conceptIds: ['concept.astronomy.c1'],
      sourceCardIds: [`card.astronomy.${num}.c2`],
      prompt: `How old is the Sun, question ${i}?`,
      options: [
        { id: 'a', label: 'About 4.6 billion years', correct: true },
        { id: 'b', label: 'About 13.8 billion years', correct: false },
        { id: 'c', label: 'About 10,000 years old', correct: false },
      ],
      explanation: 'The Sun is about 4.6 billion years old.',
      difficulty: 0.1,
      ...q,
    })),
    sourceIds: ['source.s'],
    ...extra,
  };
}
const concept = (cardIds: string[], text = 'The Sun is about 4.6 billion years old.'): Concept => ({
  id: 'concept.astronomy.c1',
  title: 'Sun age',
  description: 'd',
  difficulty: 0.1,
  facts: [{ id: 'fact.astronomy.f1', text, sourceIds: ['source.s'], cardIds }],
});
function run(levels: Level[], concepts: Concept[] = [concept(['card.astronomy.001.c2'])]) {
  const errors: string[] = [];
  const warnings: string[] = [];
  checkQuality(
    { levels, concepts, sources: [{ id: 'source.s', title: 's', url: 'https://e.org', publisher: 'p', license: 'CC0', accessedAt: '2026-01-01', verified: false }], assets: [] },
    (w, m) => errors.push(`${w}: ${m}`),
    (w, m) => warnings.push(`${w}: ${m}`),
  );
  return { errors, warnings };
}

describe('text helpers', () => {
  it('finds numbers as written, ignoring thousands separators', () => {
    expect(numbersIn('about 1,670 km/h, 23.5° and 4.6 billion; in 1543')).toEqual(['1670', '23.5', '4.6', '1543']);
  });
  it('measures prompt similarity over content words', () => {
    expect(jaccard(contentWords('What causes Earth’s seasons?'), contentWords('What mainly causes Earth’s seasons?'))).toBeGreaterThan(0.6);
  });
});

describe('checkQuality', () => {
  it('passes a clean level', () => {
    const r = run([level(1)]);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('from Level 61, wants a connection question that draws on an earlier chapter', () => {
    const arc = (w: string[]) => w.filter((x) => x.includes('draws on an earlier chapter'));
    const inChapter = level(65, [{ purpose: 'connection', sourceCardIds: ['card.astronomy.063.c2'] }]);
    expect(arc(run([inChapter]).warnings)).toEqual(['level.science.astronomy.065: no connection question draws on an earlier chapter (from Level 61 one should; see docs/writing/chapter-brief.md)']);
    const reaching = level(65, [{ purpose: 'connection', sourceCardIds: ['card.astronomy.065.c2', 'card.astronomy.012.c2'] }]);
    expect(arc(run([reaching]).warnings)).toEqual([]);
    expect(arc(run([level(45, [{ purpose: 'connection' }])]).warnings)).toEqual([]);
    expect(arc(run([level(70, [{}], { type: 'checkpoint' })]).warnings)).toEqual([]);
  });

  it('flags a number on a card that no claim on that card backs', () => {
    const r = run([level(1)], [concept(['card.astronomy.001.c2'], 'The Sun is about 4.5 billion years old.')]);
    expect(r.warnings).toContain('card.astronomy.001.c2: number 4.6 is not in any claim on this card (unsupported or mismatched figure)');
  });

  it('ignores level and chapter references when checking numbers', () => {
    const l = level(1);
    (l.cards[1] as { body: string }).body = 'The Sun is about 4.6 billion years old, as you saw in Level 10 and Chapter 3.';
    expect(run([l]).warnings).toEqual([]);
  });

  it('flags learning cards that state no claim', () => {
    expect(run([level(1)], [concept([])]).warnings).toContain('card.astronomy.001.c2: states no claim; add this card to the cardIds of the facts it states');
  });

  it('flags a prompt that contains its own answer, and feedback that gives away a later answer', () => {
    const prompt = level(1, [{ prompt: 'About 4.6 billion years: is that the Sun’s age?' }]);
    expect(run([prompt]).warnings).toContain('question.astronomy.001.q1: the prompt contains the correct answer "About 4.6 billion years"');
    const partWord = level(1, [{ prompt: 'A lack of which vitamin causes scurvy?', options: [{ id: 'a', label: 'Vitamin C', correct: true }, { id: 'b', label: 'Vitamin A', correct: false }, { id: 'c', label: 'Vitamin K', correct: false }] }]);
    expect(run([partWord]).warnings.join('\n')).not.toContain('contains the correct answer');
    const giveaway = level(1, [
      { explanation: 'Unlike the universe, which is about 13.8 billion years old.' },
      { prompt: 'How old is the universe?', options: [{ id: 'a', label: 'About 13.8 billion years', correct: true }, { id: 'b', label: 'About 4.6 billion years', correct: false }, { id: 'c', label: 'About 6,000 years', correct: false }] },
    ]);
    expect(run([giveaway]).warnings).toContain('question.astronomy.001.q2: its answer "About 13.8 billion years" is given away by the feedback of question.astronomy.001.q1');
  });

  it('errors on identical prompts and warns on near-duplicates with the same answer', () => {
    const twin = run([level(1, [{}, { prompt: 'How old is the Sun, question 0?' }])]);
    expect(twin.errors).toContain('question.astronomy.001.q2: duplicates the prompt of question.astronomy.001.q1');
    const near = run([level(1, [{ prompt: 'About how old is our Sun today?' }, { prompt: 'How old is our Sun today?' }])]);
    expect(near.warnings.some((m) => m.includes('near-duplicate of question.astronomy.001.q1'))).toBe(true);
  });

  it('warns when the right answer is conspicuously the longest option across a skill', () => {
    const long = { options: [{ id: 'a', label: 'A much longer and more specific correct answer here', correct: true }, { id: 'b', label: 'Short', correct: false }, { id: 'c', label: 'Tiny', correct: false }] };
    const levels = Array.from({ length: 8 }, (_, i) => level(i + 1, [{ ...long, prompt: `Distinct prompt number ${i} here?` }]));
    const concepts = [concept(levels.map((l) => `card.astronomy.${String(l.number).padStart(3, '0')}.c2`))];
    expect(run(levels, concepts).warnings.some((m) => m.includes('conspicuously the longest option'))).toBe(true);
  });

  it('warns when a question’s evidence cards state nothing about its concepts', () => {
    const l = level(1, [{ sourceCardIds: ['card.astronomy.001.c1'] }]);
    expect(run([l]).warnings.some((m) => m.includes('none of its sourceCardIds states a claim'))).toBe(true);
  });

  it('warns on concepts taught twice, taught but never tested, and unused', () => {
    const untested = level(1, [], { cards: level(1).cards.slice(0, 2) });
    expect(run([untested]).warnings).toContain('concept.astronomy.c1: is taught but no question tests it, so it can never come back in review');
    const twice = run([level(1), level(2, [{ prompt: 'A different question?' }])], [concept(['card.astronomy.001.c2', 'card.astronomy.002.c2'])]);
    expect(twice.warnings.some((m) => m.includes('is taught by level.science.astronomy.001, level.science.astronomy.002'))).toBe(true);
  });

  it('caps cards per level and blocks reproducing reference-only assets', () => {
    const many = level(1, Array.from({ length: 15 }, (_, i) => ({ prompt: `Unique question ${i} about stars?` })));
    expect(run([many]).errors.some((m) => m.includes('cards; at most 16'))).toBe(true);
    const errors: string[] = [];
    checkQuality(
      { levels: [], concepts: [], sources: [], assets: [{ id: 'asset.x', type: 'image', file: 'x.png', altText: 'x', license: 'reference_only', sourceId: 'source.s', width: 1, height: 1 }] },
      (w, m) => errors.push(`${w}: ${m}`),
      () => {},
    );
    expect(errors).toContain('asset.x: reference_only material may be cited for facts but never reproduced as an asset');
  });
});

describe('checkRevisions', () => {
  const run = (prev: Level[], next: Level[]) => {
    const out: string[] = [];
    checkRevisions(prev, next, (w, m) => out.push(`E ${w}: ${m}`), (w, m) => out.push(`W ${w}: ${m}`));
    return out;
  };
  const published = level(1, [{}], { status: 'published' });

  it('requires a revision bump to change published content', () => {
    const edited = { ...published, title: 'New title' };
    expect(run([published], [edited])).toContain('E level.science.astronomy.001: published revision 1 changed; bump "revision" to publish a correction');
    expect(run([published], [{ ...edited, revision: 2 }])).toEqual([]);
  });

  it('lets drafts change freely', () => {
    const draft = level(1);
    expect(run([draft], [{ ...draft, title: 'Changed' }])).toEqual([]);
  });

  it('never lets published levels or their IDs silently disappear', () => {
    expect(run([published], [])).toContain('E level.science.astronomy.001: published level was deleted; retire it instead (status "retired")');
    const fewer = { ...published, revision: 2, cards: published.cards.filter((c) => c.id !== 'card.astronomy.001.c2') };
    expect(run([published], [fewer]).some((m) => m.startsWith('W') && m.includes('removes published IDs card.astronomy.001.c2'))).toBe(true);
    expect(run([published], [{ ...published, revision: 0 }]).some((m) => m.includes('went backwards'))).toBe(true);
  });
});
