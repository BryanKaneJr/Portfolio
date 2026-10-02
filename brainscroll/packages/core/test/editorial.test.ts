import { describe, expect, it } from 'vitest';
import { EM_DASH, emDashPaths, SOURCE_METADATA_KEYS, VERBATIM_KEYS } from '../src/editorial';

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
