import { emptyGame, forceWar } from './helpers';
import { AIM_WEIGHT, activeAims, wantedRegions, wantsFrom } from '../src/sim/aims';
import { monthlyAI } from '../src/sim/ai';
import { GRAPH } from '../src/sim/content';
import { opinionBreakdown } from '../src/sim/diplomacy';
import { buildDemands, declareWar, regionPeaceCost } from '../src/sim/war';
import { dayOf } from '../src/sim/util';

describe('historical aims', () => {
  test('France wants the English off the continent, and thinks less of England for it', () => {
    const s = emptyGame('POR');
    expect(wantsFrom(s, 'FRA', 'ENG', AIM_WEIGHT)).toEqual(expect.arrayContaining(['normandy', 'gascony', 'calais']));
    const why = opinionBreakdown(s, 'FRA', 'ENG');
    expect(why.find(r => r.label === 'The long war over France')?.value).toBe(-25);
    expect(why.find(r => r.label.startsWith('Holds land we want'))!.value).toBeLessThan(0);
    // Old friends think better of each other.
    expect(opinionBreakdown(s, 'ENG', 'POR').find(r => r.label === 'The Treaty of Windsor')?.value).toBe(25);
  });

  test('aims end with their years, or once the land is won; the player has none', () => {
    const s = emptyGame('POR');
    expect(activeAims(s, 'ENG').map(a => a.id)).toContain('eng_french_lands');
    for (const r of ['normandy', 'gascony', 'calais']) s.regions[r].owner = 'FRA';
    expect(activeAims(s, 'FRA').map(a => a.id)).not.toContain('fra_english_out');
    expect(activeAims(s, 'FRA').map(a => a.id)).not.toContain('fra_italy'); // not before 1490
    s.day = dayOf(1600, 1, 1);
    expect(activeAims(s, 'ENG').map(a => a.id)).not.toContain('eng_french_lands');
    expect(activeAims(s, 'FRA').map(a => a.id)).not.toContain('fra_italy'); // over by 1560
    expect(activeAims(s, 'POR')).toEqual([]);
  });

  test('the AI forges claims on land it wants, next to its own', () => {
    const s = emptyGame('POR');
    delete s.flags.__noAI;
    const fra = s.nations.FRA;
    for (let i = 0; i < 60 && !fra.fabricating; i++) {
      fra.ai.nextEval = 0;
      fra.gold = 1000;
      monthlyAI(s);
    }
    const r = fra.fabricating!.region;
    expect(wantedRegions(s, 'FRA').has(r)).toBe(true);
    expect(GRAPH[r].some(e => s.regions[e.to]?.owner === 'FRA')).toBe(true);
  });

  test('peace demands put wanted land first', () => {
    const s = emptyGame('POR');
    s.day = dayOf(1495, 1, 1);
    forceWar(s, 'MOS', 'LIT');
    s.nations.MOS.claims = {};
    const w = declareWar(s, 'MOS', 'LIT', 'none')!;
    for (const r of ['lithuania', 'volhynia', 'smolensk']) {
      s.regions[r].controller = 'MOS';
      s.regions[r].dev = 5;
      s.regions[r].cores = ['LIT'];
    }
    const terms = buildDemands(s, s.wars[w.id], 'MOS', regionPeaceCost(s, 'MOS', 'smolensk'));
    expect(terms.regions).toEqual(['smolensk']);
  });
});
