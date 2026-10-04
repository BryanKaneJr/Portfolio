import { describe, expect, it } from 'vitest';
import { APP_STRUCTURE_REF, EM_DASH, emDashPaths, questionTexts, SOURCE_METADATA_KEYS, VERBATIM_KEYS } from '../src/editorial';

const D = EM_DASH;

describe('emDashPaths', () => {
  it('finds em dashes anywhere in authored text, with a path', () => {
    const level = { title: 'Fine', cards: [{ body: 'ok' }, { body: `Venus is hot ${D} hotter than Mercury.` }], questions: [{ options: [{ rationale: `No ${D} that's Mars.` }] }] };
    expect(emDashPaths(level)).toEqual(['cards[1].body', 'questions[0].options[0].rationale']);
  });

  it('ignores en dashes and hyphens (ranges like 1–100 are fine)', () => {
    expect(emDashPaths({ t: 'Levels 1–100, a well-known star' })).toEqual([]);
  });

  it('exempts verbatim quotations', () => {
    expect(emDashPaths({ supportingQuote: `It is ${D} as NASA put it ${D} hot.`, notes: 'fine' }, VERBATIM_KEYS)).toEqual([]);
    expect(emDashPaths({ supportingQuote: 'fine', notes: `check ${D} later` }, VERBATIM_KEYS)).toEqual(['notes']);
  });

  it('exempts source metadata but not our notes about the source', () => {
    const exempt = new Set([...VERBATIM_KEYS, ...SOURCE_METADATA_KEYS]);
    expect(emDashPaths({ title: `Mars ${D} Facts`, publisher: 'NASA', notes: 'ok' }, exempt)).toEqual([]);
    expect(emDashPaths({ title: 'Mars', notes: `Cited for ${D} rust` }, exempt)).toEqual(['notes']);
  });
});

describe('APP_STRUCTURE_REF', () => {
  it('catches callbacks to levels, cards and chapters', () => {
    for (const t of [
      "Level 13's Lindisfarne raid shocked Alcuin.",
      'The level blames nitrate stock.',
      'Nothing on this card says so.',
      'Put these moments from Chapter 2 in order.',
      'Cities recap: which tablets came first?',
      'Great Chemists mastery: what burns?',
      'Which tool from the earlier lesson fits?',
    ])
      expect(APP_STRUCTURE_REF.test(t), t).toBe(true);
  });
  it('leaves ordinary topic words alone', () => {
    for (const t of ['Sea level rose 20 cm.', 'The level of carbon dioxide climbed.', 'It sends a request through the card network.', 'Which level of government runs schools?'])
      expect(APP_STRUCTURE_REF.test(t), t).toBe(false);
  });
  it('lists every text a question shows', () => {
    const paths = questionTexts({ prompt: 'p', explanation: 'e', options: [{ label: 'a', rationale: 'r' }], items: ['i'], pairs: [{ left: 'l', right: 'r' }] }).map(([p]) => p);
    expect(paths).toEqual(['prompt', 'explanation', 'options[0].label', 'options[0].rationale', 'items[0]', 'pairs[0].left', 'pairs[0].right']);
  });
});
